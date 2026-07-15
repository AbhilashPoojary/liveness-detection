import { clamp, mapRange } from '../utils/math.js';

/**
 * BrightnessDetector
 * -------------------------------------------------------------------------
 * Computes average luminance and contrast (std-dev of luminance) from a
 * canvas frame using the ITU-R BT.601 luma formula. Deterministic, no ML.
 */
export class BrightnessDetector {
  /**
   * @param {Object} [options]
   * @param {number} [options.idealMin=90] - lower bound of the "well lit" luminance band (0-255)
   * @param {number} [options.idealMax=180] - upper bound of the "well lit" luminance band (0-255)
   * @param {number} [options.sampleStep=4] - pixel sampling stride for performance
   */
  constructor({ idealMin = 90, idealMax = 180, sampleStep = 4 } = {}) {
    this.idealMin = idealMin;
    this.idealMax = idealMax;
    this.sampleStep = sampleStep;
  }

  /**
   * Analyze a canvas (ideally cropped to the face region for accuracy).
   * @param {HTMLCanvasElement} canvas
   * @returns {{luminance:number, contrast:number, score:number, status:'too_dark'|'too_bright'|'ok'}}
   */
  analyze(canvas) {
    const ctx = canvas.getContext('2d');
    const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const step = this.sampleStep * 4; // 4 channels per pixel

    let sum = 0;
    let sumSq = 0;
    let count = 0;

    for (let i = 0; i < data.length; i += step) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const luma = 0.299 * r + 0.587 * g + 0.114 * b;
      sum += luma;
      sumSq += luma * luma;
      count++;
    }

    const mean = count ? sum / count : 0;
    const variance = count ? sumSq / count - mean * mean : 0;
    const contrast = Math.sqrt(Math.max(variance, 0));

    let status = 'ok';
    let score;
    if (mean < this.idealMin) {
      status = 'too_dark';
      score = mapRange(mean, 0, this.idealMin, 0, 100);
    } else if (mean > this.idealMax) {
      status = 'too_bright';
      score = mapRange(mean, this.idealMax, 255, 100, 0);
    } else {
      score = 100;
    }

    return {
      luminance: Math.round(mean * 10) / 10,
      contrast: Math.round(contrast * 10) / 10,
      score: Math.round(clamp(score, 0, 100)),
      status,
      width,
      height,
    };
  }
}

export default BrightnessDetector;
