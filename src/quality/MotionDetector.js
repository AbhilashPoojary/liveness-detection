import { clamp, mapRange } from '../utils/math.js';

/**
 * MotionDetector
 * -------------------------------------------------------------------------
 * Detects motion between consecutive frames using mean absolute pixel
 * difference on a down-sampled grayscale buffer. Used to (a) block auto
 * capture while the subject is moving, and (b) as a signal for passive
 * liveness ("natural motion" should be present at some point, but not at
 * the moment of capture).
 */
export class MotionDetector {
  /**
   * @param {Object} [options]
   * @param {number} [options.downsampleSize=64] - width/height to shrink frames to before diffing (perf)
   * @param {number} [options.stillThreshold=4] - mean abs diff below which the frame is considered "still"
   * @param {number} [options.highMotionThreshold=25] - mean abs diff above which motion is "high"
   */
  constructor({ downsampleSize = 64, stillThreshold = 4, highMotionThreshold = 25 } = {}) {
    this.downsampleSize = downsampleSize;
    this.stillThreshold = stillThreshold;
    this.highMotionThreshold = highMotionThreshold;
    this._prevGray = null;
    this._sampleCanvas = document.createElement('canvas');
    this._sampleCanvas.width = downsampleSize;
    this._sampleCanvas.height = downsampleSize;
    this._sampleCtx = this._sampleCanvas.getContext('2d', { willReadFrequently: true });
  }

  /** Downsample the frame to a small grayscale buffer for cheap diffing. */
  _toGray(canvas) {
    this._sampleCtx.drawImage(canvas, 0, 0, this.downsampleSize, this.downsampleSize);
    const { data } = this._sampleCtx.getImageData(0, 0, this.downsampleSize, this.downsampleSize);
    const gray = new Uint8ClampedArray(this.downsampleSize * this.downsampleSize);
    for (let i = 0, p = 0; i < data.length; i += 4, p++) {
      gray[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    }
    return gray;
  }

  /**
   * Compare the given frame against the previous one.
   * @param {HTMLCanvasElement} canvas
   * @returns {{motionScore:number, isStill:boolean, isHighMotion:boolean, score:number}}
   */
  analyze(canvas) {
    const gray = this._toGray(canvas);

    if (!this._prevGray) {
      this._prevGray = gray;
      // No baseline yet — assume still so we don't block the very first frame indefinitely.
      return { motionScore: 0, isStill: true, isHighMotion: false, score: 100 };
    }

    let diffSum = 0;
    for (let i = 0; i < gray.length; i++) {
      diffSum += Math.abs(gray[i] - this._prevGray[i]);
    }
    const motionScore = diffSum / gray.length;
    this._prevGray = gray;

    const isStill = motionScore <= this.stillThreshold;
    const isHighMotion = motionScore >= this.highMotionThreshold;
    const score = Math.round(
      clamp(mapRange(motionScore, this.stillThreshold, this.highMotionThreshold, 100, 0), 0, 100),
    );

    return { motionScore: Math.round(motionScore * 100) / 100, isStill, isHighMotion, score };
  }

  reset() {
    this._prevGray = null;
  }
}

export default MotionDetector;
