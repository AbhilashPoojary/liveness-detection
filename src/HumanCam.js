import { EventEmitter } from './utils/EventEmitter.js';
import { CameraManager } from './camera/CameraManager.js';
import { HumanDetector } from './detector/HumanDetector.js';
import { QualityService } from './quality/QualityService.js';
import { PassiveLiveness } from './liveness/PassiveLiveness.js';
import { CaptureManager } from './capture/CaptureManager.js';
import { Overlay } from './ui/Overlay.js';

const DEFAULT_OPTIONS = {
  container: null, // HTMLElement or CSS selector — required
  camera: 'front', // 'front' | 'rear'
  resolution: { width: 1280, height: 720 },
  autoCapture: true,
  passiveLiveness: true,
  qualityCheck: true,
  bestFrame: true,
  countdown: 3,
  holdDurationMs: 800,
  detectionIntervalMs: 90, // ~11fps detection loop; smooth enough, cheap enough
  loadOpenCV: true,
  opencvUrl: 'https://docs.opencv.org/4.x/opencv.js',
  modelBasePath: 'https://vladmandic.github.io/human-models/models/',
  humanConfig: null,
  quality: null,
  liveness: null,
  minResolutionWidth: 480,
  showUI: true,
};

/**
 * HumanCam
 * -------------------------------------------------------------------------
 * Public entry point for HumanCamJS. Instantiate, `await start()`, and
 * listen via `onCapture()` (or the underlying EventEmitter API).
 *
 * @example
 *   const camera = new HumanCam({ container: '#camera', autoCapture: true });
 *   await camera.start();
 *   camera.onCapture((result) => console.log(result));
 */
export class HumanCam extends EventEmitter {
  /** @param {Partial<typeof DEFAULT_OPTIONS>} options */
  constructor(options = {}) {
    super();
    this.options = { ...DEFAULT_OPTIONS, ...options };
    if (!this.options.container) {
      throw new Error('HumanCam requires a `container` (element or CSS selector).');
    }

    this.root = typeof this.options.container === 'string'
      ? document.querySelector(this.options.container)
      : this.options.container;
    if (!this.root) throw new Error(`HumanCam container not found: ${this.options.container}`);
    this.root.classList.add('humancam-root');

    this._buildDom();

    this.detector = new HumanDetector({
      ...(this.options.humanConfig || {}),
      modelBasePath: this.options.modelBasePath,
    });
    this.quality = new QualityService({
      ...(this.options.quality || {}),
      minResolutionWidth: this.options.minResolutionWidth,
    });
    this.liveness = this.options.passiveLiveness ? new PassiveLiveness(this.options.liveness || {}) : null;
    this.capture = new CaptureManager({
      qualityService: this.quality,
      liveness: this.liveness,
      autoCapture: this.options.autoCapture,
      bestFrame: this.options.bestFrame,
      holdDurationMs: this.options.holdDurationMs,
      countdownSeconds: this.options.countdown,
    });

    this.overlay = this.options.showUI
      ? new Overlay(this.root, {
          onSwitchCamera: () => this.switchCamera(),
          onAccept: () => this._handleAccept(),
          onRetry: () => this._handleRetry(),
          onManualCapture: this.options.autoCapture ? undefined : () => this._manualCapture(),
        })
      : null;

    this.camera = new CameraManager({
      videoEl: this.videoEl,
      facing: this.options.camera === 'rear' ? 'rear' : 'front',
      resolution: this.options.resolution,
    });

    this._wireCameraEvents();
    this._wireCaptureEvents();

    this._loopHandle = null;
    this._lastCaptureResult = null;
    this._started = false;
  }

  _buildDom() {
    this.videoEl = document.createElement('video');
    this.videoEl.className = 'humancam-video';
    this.videoEl.setAttribute('playsinline', '');
    this.videoEl.setAttribute('aria-hidden', 'true');
    this.root.appendChild(this.videoEl);

    this.canvasEl = document.createElement('canvas');
    this.canvasEl.className = 'humancam-canvas';
    this.canvasEl.style.display = 'none'; // offscreen buffer; not for display
  }

  _wireCameraEvents() {
    this.camera.on('error', (err) => {
      this.overlay?.showFallback({
        title: 'Camera unavailable',
        text: err.message,
      });
      this.emit('error', err);
    });
    this.camera.on('permission-denied', () => {
      this.overlay?.showFallback({
        title: 'Camera permission needed',
        text: 'Please allow camera access in your browser settings, then reload the page.',
      });
    });
  }

  _wireCaptureEvents() {
    this.capture.on('progress', ({ percent }) => this.overlay?.updateProgress(percent));
    this.capture.on('countdown', ({ value }) => this.overlay?.showCountdown(value));
    this.capture.on('flash', () => this.overlay?.triggerFlash());
    this.capture.on('captured', (result) => {
      this._lastCaptureResult = result;
      this.overlay?.showPreview(result.image);
      this.emit('captured', result);
    });
  }

  /**
   * Request camera permission, load Human.js models, and begin the
   * detection/quality/capture loop.
   * @returns {Promise<void>}
   */
  async start() {
    if (this._started) return;
    try {
      await Promise.all([
        this.camera.start(),
        this.detector.load(),
        this.options.loadOpenCV ? this.quality.loadOpenCV(this.options.opencvUrl) : Promise.resolve(),
      ]);
      this.canvasEl.width = this.videoEl.videoWidth;
      this.canvasEl.height = this.videoEl.videoHeight;
      this._started = true;
      this._runLoop();
      this.emit('started');
    } catch (err) {
      this._started = false;
      if (this._loopHandle) {
        clearTimeout(this._loopHandle);
        this._loopHandle = null;
      }
      this.camera.stop();
      throw err;
    }
  }

  _runLoop() {
    const tick = async () => {
      if (!this._started) return;
      try {
        await this._processFrame();
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[HumanCamJS] frame processing error:', err);
      }
      this._loopHandle = setTimeout(tick, this.options.detectionIntervalMs);
    };
    tick();
  }

  async _processFrame() {
    // Skip processing while showing preview/flash/etc — no need to burn cycles.
    if (['flashing', 'captured', 'preview'].includes(this.capture.state)) return;

    const frameCanvas = this.camera.grabFrame();
    const detection = await this.detector.detect(frameCanvas);
    const quality = this.quality.evaluate(frameCanvas, detection.face, detection.faceCount);
    const captureQuality = this.options.qualityCheck ? quality : this._withoutQualityGates(quality);

    this.overlay?.updateQuality(quality);

    if (this.liveness && detection.face) {
      this.liveness.update(detection.face, quality);
    }

    this.capture.tick(frameCanvas, captureQuality, detection.face);

    this.emit('frame', { quality, face: detection.face, faceCount: detection.faceCount });
  }

  _withoutQualityGates(quality) {
    return {
      ...quality,
      passed: true,
      gates: Object.fromEntries(Object.keys(quality.gates).map((key) => [key, true])),
      qualityCheckBypassed: true,
    };
  }

  /** Manual capture trigger (used when `autoCapture: false`, or for a "capture now" API call). */
  _manualCapture() {
    const frameCanvas = this.camera.grabFrame();
    this.capture.captureNow(frameCanvas);
  }

  /** Public alias for manual capture. */
  captureNow() {
    this._manualCapture();
  }

  _handleAccept() {
    this.overlay?.hidePreview();
    this.capture.accept();
    this.emit('accepted', this._lastCaptureResult);
  }

  _handleRetry() {
    this.overlay?.hidePreview();
    this.capture.retry();
    this.emit('retried');
  }

  /** Switch between front and rear cameras. */
  async switchCamera() {
    await this.camera.switchCamera();
    this.capture.reset();
  }

  /**
   * Subscribe to successful captures. This is shorthand for the raw
   * 'captured' event, which fires before built-in preview accept/retry.
   * @param {(result: import('./capture/CaptureManager.js').CaptureResult) => void} handler
   */
  onCapture(handler) {
    return this.on('captured', handler);
  }

  /** Stop the loop, release the camera, and tear down the UI. */
  stop() {
    this._started = false;
    if (this._loopHandle) clearTimeout(this._loopHandle);
    this.camera.stop();
    this.emit('stopped');
  }

  /** Fully dispose all resources (call when unmounting). */
  destroy() {
    this.stop();
    this.detector.dispose();
    this.overlay?.destroy();
    this.videoEl.remove();
    this.canvasEl.remove();
    this.removeAllListeners();
  }
}

export default HumanCam;
