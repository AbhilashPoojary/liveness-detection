import { clamp, mapRange } from '../utils/math.js';

/**
 * BlurDetector
 * -------------------------------------------------------------------------
 * Sharpness scoring via the variance of the Laplacian — a standard,
 * deterministic technique (no ML) also used by classic KYC/eKYC SDKs.
 *
 * Uses OpenCV.js when it is available on `window.cv` (lazily loaded by
 * `loadOpenCV()`), and otherwise falls back to a hand-rolled grayscale +
 * 3x3 Laplacian convolution implemented directly on ImageData so the SDK
 * keeps working even if the OpenCV.js CDN script fails to load or the
 * integrator chooses not to include it.
 */
export class BlurDetector {
  /**
   * @param {Object} [options]
   * @param {number} [options.sharpThreshold=150] - Laplacian variance at/above which an image is considered sharp (score 100)
   * @param {number} [options.blurryThreshold=20] - variance at/below which an image is considered unusably blurry (score 0)
   */
  constructor({ sharpThreshold = 150, blurryThreshold = 20 } = {}) {
    this.sharpThreshold = sharpThreshold;
    this.blurryThreshold = blurryThreshold;
    this.cvReady = false;
  }

  /**
   * Lazily load OpenCV.js from a CDN. Safe to call multiple times.
   * If it fails (offline, blocked, etc.) the detector silently falls back
   * to the pure-JS implementation — this call is optional.
   * @param {string} [src]
   * @returns {Promise<boolean>} whether OpenCV.js is available
   */
  async loadOpenCV(src = 'https://docs.opencv.org/4.x/opencv.js') {
    if (typeof window === 'undefined') return false;
    if (window.cv?.Mat) {
      this.cvReady = true;
      return true;
    }
    try {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        script.onload = () => {
          // opencv.js calls Module.onRuntimeInitialized once WASM is ready.
          if (window.cv?.onRuntimeInitialized !== undefined) {
            window.cv.onRuntimeInitialized = resolve;
          } else {
            resolve();
          }
        };
        script.onerror = reject;
        document.head.appendChild(script);
      });
      this.cvReady = !!window.cv?.Mat;
    } catch {
      this.cvReady = false;
    }
    return this.cvReady;
  }

  /**
   * Compute the Laplacian variance ("blur score") of a canvas region.
   * @param {HTMLCanvasElement} canvas
   * @returns {{blurScore:number, score:number, isSharp:boolean}}
   */
  analyze(canvas) {
    const variance = this.cvReady && window.cv?.Mat
      ? this._laplacianVarianceCV(canvas)
      : this._laplacianVarianceJS(canvas);

    const score = Math.round(
      clamp(mapRange(variance, this.blurryThreshold, this.sharpThreshold, 0, 100), 0, 100),
    );

    return {
      blurScore: Math.round(variance * 10) / 10,
      score,
      isSharp: variance >= this.sharpThreshold,
      engine: this.cvReady ? 'opencv' : 'js-fallback',
    };
  }

  /** OpenCV.js implementation: grayscale -> Laplacian -> meanStdDev -> variance. */
  _laplacianVarianceCV(canvas) {
    const cv = window.cv;
    let src; let gray; let lap; let mean; let stddev;
    try {
      src = cv.imread(canvas);
      gray = new cv.Mat();
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
      lap = new cv.Mat();
      cv.Laplacian(gray, lap, cv.CV_64F, 1, 1, 0, cv.BORDER_DEFAULT);
      mean = new cv.Mat();
      stddev = new cv.Mat();
      cv.meanStdDev(lap, mean, stddev);
      const sd = stddev.data64F[0];
      return sd * sd;
    } finally {
      [src, gray, lap, mean, stddev].forEach((m) => m && m.delete());
    }
  }

  /**
   * Pure-JS fallback: 3x3 Laplacian kernel convolution over a down-sampled
   * grayscale copy of the canvas, then returns the variance of the result.
   * O(w*h) — cheap enough to run per-frame on a face-sized crop.
   */
  _laplacianVarianceJS(canvas) {
    const ctx = canvas.getContext('2d');
    const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // Build grayscale buffer.
    const gray = new Float32Array(width * height);
    for (let i = 0, p = 0; i < data.length; i += 4, p++) {
      gray[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    }

    // 3x3 Laplacian kernel: [0,1,0 / 1,-4,1 / 0,1,0]
    const lap = new Float32Array(width * height);
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        const value =
          gray[idx - width] + gray[idx + width] + gray[idx - 1] + gray[idx + 1] - 4 * gray[idx];
        lap[idx] = value;
      }
    }

    // Variance of the Laplacian response.
    let sum = 0;
    let sumSq = 0;
    const n = lap.length;
    for (let i = 0; i < n; i++) {
      sum += lap[i];
      sumSq += lap[i] * lap[i];
    }
    const mean = sum / n;
    return sumSq / n - mean * mean;
  }
}

export default BlurDetector;
