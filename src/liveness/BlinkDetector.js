import { distance, average } from '../utils/math.js';

/**
 * BlinkDetector
 * -------------------------------------------------------------------------
 * Deterministic blink detection using the Eye Aspect Ratio (EAR) technique
 * (Soukupová & Čech, 2016) applied to Human.js's 468-point face mesh eye
 * landmarks. No machine learning beyond the landmark detector itself —
 * blink classification is a pure geometric threshold.
 *
 * EAR = (|p2-p6| + |p3-p5|) / (2 * |p1-p4|)
 * A sharp temporary drop in EAR followed by recovery = one blink.
 */
export class BlinkDetector {
  /**
   * @param {Object} [options]
   * @param {number} [options.earThreshold=0.21] - EAR below this = eye considered closed
   * @param {number} [options.consecutiveFrames=2] - frames the eye must stay closed to count
   * @param {number} [options.historySize=60] - how many EAR samples to retain
   */
  constructor({ earThreshold = 0.21, consecutiveFrames = 2, historySize = 60 } = {}) {
    this.earThreshold = earThreshold;
    this.consecutiveFrames = consecutiveFrames;
    this.historySize = historySize;
    this._earHistory = [];
    this._closedFrameCount = 0;
    this._blinkCount = 0;
    this._eyeOpenSamples = [];
    this._lastEAR = null;
  }

  /**
   * Extract 6 EAR landmark points per eye from Human.js mesh annotations.
   * Human.js annotation keys follow MediaPipe FaceMesh naming.
   */
  _eyePoints(annotations, side) {
    if (!annotations) return null;
    // MediaPipe indices approximated via Human.js named annotation arrays.
    const key = side === 'left' ? 'leftEyeUpper0' : 'rightEyeUpper0';
    const lowerKey = side === 'left' ? 'leftEyeLower0' : 'rightEyeLower0';
    const upper = annotations[key];
    const lower = annotations[lowerKey];
    if (!upper?.length || !lower?.length) return null;

    const toPoint = (point) => {
      if (Array.isArray(point)) return { x: point[0], y: point[1] };
      if (point && typeof point === 'object') return { x: point.x, y: point.y };
      return null;
    };
    // Approximate the 6 canonical EAR points using outer/inner corners + two upper/lower pairs.
    const outerCorner = toPoint(upper[0]);
    const innerCorner = toPoint(upper[upper.length - 1]);
    const upperMid1 = toPoint(upper[Math.floor(upper.length * 0.3)]);
    const upperMid2 = toPoint(upper[Math.floor(upper.length * 0.7)]);
    const lowerMid1 = toPoint(lower[Math.floor(lower.length * 0.3)]);
    const lowerMid2 = toPoint(lower[Math.floor(lower.length * 0.7)]);

    if (![outerCorner, innerCorner, upperMid1, upperMid2, lowerMid1, lowerMid2].every(this._isValidPoint)) {
      return null;
    }

    return { outerCorner, innerCorner, upperMid1, upperMid2, lowerMid1, lowerMid2 };
  }

  _isValidPoint(point) {
    return Number.isFinite(point?.x) && Number.isFinite(point?.y);
  }

  _ear(points) {
    if (!points) return null;
    const { outerCorner, innerCorner, upperMid1, lowerMid1, upperMid2, lowerMid2 } = points;
    const vertical1 = distance(upperMid1, lowerMid1);
    const vertical2 = distance(upperMid2, lowerMid2);
    const horizontal = distance(outerCorner, innerCorner);
    if (!Number.isFinite(vertical1) || !Number.isFinite(vertical2) || !Number.isFinite(horizontal) || horizontal === 0) {
      return null;
    }
    const ear = (vertical1 + vertical2) / (2 * horizontal);
    return Number.isFinite(ear) ? ear : null;
  }

  /**
   * Feed one frame's annotations into the detector.
   * @param {Object} annotations - `face.annotations` from HumanDetector
   * @returns {{ear:number|null, eyeOpen:boolean, blinked:boolean, totalBlinks:number}}
   */
  update(annotations) {
    const left = this._ear(this._eyePoints(annotations, 'left'));
    const right = this._ear(this._eyePoints(annotations, 'right'));
    const values = [left, right].filter((v) => typeof v === 'number' && !Number.isNaN(v));
    const ear = values.length ? average(values) : null;

    let blinked = false;
    if (ear !== null) {
      this._lastEAR = ear;
      this._earHistory.push(ear);
      if (this._earHistory.length > this.historySize) this._earHistory.shift();

      const eyeClosed = ear < this.earThreshold;
      if (eyeClosed) {
        this._closedFrameCount++;
      } else {
        if (this._closedFrameCount >= this.consecutiveFrames) {
          blinked = true;
          this._blinkCount++;
        }
        this._closedFrameCount = 0;
        this._eyeOpenSamples.push(ear);
        if (this._eyeOpenSamples.length > this.historySize) this._eyeOpenSamples.shift();
      }
    }

    return {
      ear: ear !== null ? Math.round(ear * 1000) / 1000 : null,
      eyeOpen: ear !== null ? ear >= this.earThreshold : true,
      blinked,
      totalBlinks: this._blinkCount,
    };
  }

  /** Average EAR while eyes were open — used as an "eyes visible/open" liveness signal. */
  averageOpenEAR() {
    return this._eyeOpenSamples.length ? average(this._eyeOpenSamples) : null;
  }

  get totalBlinks() {
    return this._blinkCount;
  }

  get latestEAR() {
    return this._lastEAR;
  }

  reset() {
    this._earHistory = [];
    this._closedFrameCount = 0;
    this._blinkCount = 0;
    this._eyeOpenSamples = [];
    this._lastEAR = null;
  }
}

export default BlinkDetector;
