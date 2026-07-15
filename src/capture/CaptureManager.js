import { EventEmitter } from '../utils/EventEmitter.js';
import { BestFrameSelector } from './BestFrameSelector.js';

/**
 * CaptureManager
 * -------------------------------------------------------------------------
 * Drives the auto-capture state machine described in the product spec:
 *
 *   idle -> searching -> holding -> counting-down -> flashing -> captured -> preview
 *
 * A frame must pass every QualityService gate before the "holding" timer
 * even starts, and any gate failure while holding/counting down resets the
 * state back to "searching" — the shutter never fires on a frame that
 * hasn't been validated.
 *
 * Events emitted:
 *  - 'state'      { state, previous }
 *  - 'progress'   { percent }               (0-100 hold-still progress)
 *  - 'countdown'  { value }                 (3, 2, 1)
 *  - 'flash'
 *  - 'captured'   CaptureResult
 *  - 'reset'
 */
export class CaptureManager extends EventEmitter {
  /**
   * @param {Object} options
   * @param {import('../quality/QualityService.js').QualityService} options.qualityService
   * @param {import('../liveness/PassiveLiveness.js').PassiveLiveness} [options.liveness]
   * @param {boolean} [options.autoCapture=true]
   * @param {boolean} [options.bestFrame=true]
   * @param {number} [options.holdDurationMs=800] - how long quality must hold before countdown starts
   * @param {number} [options.countdownSeconds=3]
   * @param {number} [options.bufferSize=15] - frames considered for best-frame selection
   */
  constructor({
    qualityService,
    liveness = null,
    autoCapture = true,
    bestFrame = true,
    holdDurationMs = 800,
    countdownSeconds = 3,
    bufferSize = 15,
  }) {
    super();
    this.qualityService = qualityService;
    this.liveness = liveness;
    this.autoCapture = autoCapture;
    this.bestFrameEnabled = bestFrame;
    this.holdDurationMs = holdDurationMs;
    this.countdownSeconds = countdownSeconds;

    this.bestFrameSelector = new BestFrameSelector({ bufferSize });
    this.state = 'idle';
    this._holdStartedAt = null;
    this._countdownTimer = null;
    this._captureLocked = false;
  }

  _setState(next) {
    const previous = this.state;
    this.state = next;
    this.emit('state', { state: next, previous });
  }

  /**
   * Feed one evaluated frame into the state machine. Call this every
   * detection tick (e.g. ~10-15fps) from the main HumanCam loop.
   * @param {HTMLCanvasElement} canvas
   * @param {import('../quality/QualityService.js').QualityResult} quality
   * @param {import('../detector/HumanDetector.js').NormalizedFace|null} face
   */
  tick(canvas, quality, face) {
    if (this._captureLocked || this.state === 'flashing' || this.state === 'captured' || this.state === 'preview') {
      return;
    }

    if (!quality.passed) {
      if (this.state !== 'idle' && this.state !== 'searching') this._cancelHold();
      this._setState('searching');
      this.emit('progress', { percent: 0 });
      return;
    }

    // Quality gates pass this frame — buffer it as a best-frame candidate.
    if (this.bestFrameEnabled && face) {
      this.bestFrameSelector.push(canvas, quality, face);
    }

    if (!this.autoCapture) {
      this._setState('ready'); // gates pass; awaiting manual trigger
      this.emit('progress', { percent: 100 });
      return;
    }

    if (this.state !== 'holding' && this.state !== 'counting-down') {
      this._holdStartedAt = performance.now();
      this._setState('holding');
    }

    if (this.state === 'holding') {
      const elapsed = performance.now() - this._holdStartedAt;
      const percent = Math.min(100, Math.round((elapsed / this.holdDurationMs) * 100));
      this.emit('progress', { percent });
      if (elapsed >= this.holdDurationMs) {
        this._startCountdown(canvas);
      }
    }
  }

  _cancelHold() {
    this._holdStartedAt = null;
    if (this._countdownTimer) {
      clearTimeout(this._countdownTimer);
      this._countdownTimer = null;
    }
  }

  _startCountdown(lastGoodCanvas) {
    this._setState('counting-down');
    let remaining = this.countdownSeconds;
    this.emit('countdown', { value: remaining });

    const step = () => {
      remaining -= 1;
      if (remaining > 0) {
        this.emit('countdown', { value: remaining });
        this._countdownTimer = setTimeout(step, 1000);
      } else {
        this.emit('countdown', { value: 0 });
        this._doCapture(lastGoodCanvas);
      }
    };
    this._countdownTimer = setTimeout(step, 1000);
  }

  /** Manually trigger capture immediately (used when autoCapture is disabled, or for a "capture now" button). */
  captureNow(canvas) {
    this._doCapture(canvas);
  }

  _doCapture(fallbackCanvas) {
    this._captureLocked = true;
    this._setState('flashing');
    this.emit('flash');

    // Prefer the best buffered frame; fall back to the current frame if
    // best-frame selection is disabled or the buffer is empty.
    const best = this.bestFrameEnabled ? this.bestFrameSelector.getBest() : null;
    const chosen = best || { canvas: fallbackCanvas, quality: null, face: null };

    const livenessResult = this.liveness ? this.liveness.evaluate() : null;

    const result = this._buildResult(chosen, livenessResult);

    // Small delay so the flash animation is visible before we move to preview.
    setTimeout(() => {
      this._setState('captured');
      this.emit('captured', result);
      this._setState('preview');
    }, 180);
  }

  _buildResult(chosen, livenessResult) {
    const { canvas, quality, face } = chosen;
    const image = canvas.toDataURL('image/jpeg', 0.92);

    return {
      success: true,
      image,
      qualityScore: quality?.score ?? null,
      livenessScore: livenessResult?.score ?? null,
      livenessPassed: livenessResult?.passed ?? null,
      faceConfidence: face?.confidence ?? null,
      brightness: quality?.brightness?.luminance ?? null,
      blurScore: quality?.blur?.blurScore ?? null,
      backgroundScore: quality?.background?.score ?? null,
      backgroundClear: quality?.background?.isClear ?? null,
      backgroundReason: quality?.background?.reason ?? null,
      yaw: quality?.pose?.yaw ?? null,
      pitch: quality?.pose?.pitch ?? null,
      roll: quality?.pose?.roll ?? null,
      width: canvas.width,
      height: canvas.height,
      timestamp: new Date().toISOString(),
      framesConsidered: this.bestFrameSelector.count,
      livenessSignals: livenessResult?.signals ?? null,
    };
  }

  /** Accept the current capture (called by the preview UI's Accept button). */
  accept() {
    this.emit('accepted');
  }

  /** Discard the current capture and return to searching for a new one. */
  retry() {
    this.reset();
    this.emit('retry');
  }

  /** Reset the whole state machine (buffers, timers, lock) back to idle. */
  reset() {
    this._cancelHold();
    this._captureLocked = false;
    this.bestFrameSelector.reset();
    this.qualityService?.reset();
    this.liveness?.reset();
    this._setState('idle');
    this.emit('reset');
  }
}

export default CaptureManager;

/**
 * @typedef {Object} CaptureResult
 * @property {boolean} success
 * @property {string} image - base64 JPEG data URL
 * @property {number|null} qualityScore
 * @property {number|null} livenessScore
 * @property {number|null} faceConfidence
 * @property {number|null} brightness
 * @property {number|null} blurScore
 * @property {number|null} yaw
 * @property {number|null} pitch
 * @property {number|null} roll
 * @property {number} width
 * @property {number} height
 * @property {string} timestamp - ISO 8601
 */
