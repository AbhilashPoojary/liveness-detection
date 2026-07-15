import { clamp, mapRange } from '../utils/math.js';

/**
 * BackgroundDetector
 * -------------------------------------------------------------------------
 * Lightweight background sanity check for face capture. It looks outside a
 * padded face box and rejects frames with busy/high-edge backgrounds or
 * large overexposed patches such as bright windows.
 */
export class BackgroundDetector {
  constructor({
    sampleWidth = 96,
    maxEdgeDensity = 0.12,
    maxContrast = 52,
    maxOverexposedRatio = 0.08,
    minScore = 70,
    facePadding = 0.45,
  } = {}) {
    this.sampleWidth = sampleWidth;
    this.maxEdgeDensity = maxEdgeDensity;
    this.maxContrast = maxContrast;
    this.maxOverexposedRatio = maxOverexposedRatio;
    this.minScore = minScore;
    this.facePadding = facePadding;
    this._sampleCanvas = document.createElement('canvas');
    this._sampleCtx = this._sampleCanvas.getContext('2d', { willReadFrequently: true });
  }

  analyze(canvas, face) {
    if (!face) {
      return {
        score: 0,
        isClear: false,
        edgeDensity: 1,
        contrast: 100,
        overexposedRatio: 1,
        reason: 'no_face',
      };
    }

    const sampleHeight = Math.max(1, Math.round((canvas.height / canvas.width) * this.sampleWidth));
    this._sampleCanvas.width = this.sampleWidth;
    this._sampleCanvas.height = sampleHeight;
    this._sampleCtx.drawImage(canvas, 0, 0, this.sampleWidth, sampleHeight);

    const { data } = this._sampleCtx.getImageData(0, 0, this.sampleWidth, sampleHeight);
    const mask = this._backgroundMask(face, canvas, this.sampleWidth, sampleHeight);
    const luma = new Float32Array(this.sampleWidth * sampleHeight);

    let sum = 0;
    let sumSq = 0;
    let count = 0;
    let overexposed = 0;

    for (let i = 0, p = 0; i < data.length; i += 4, p++) {
      const value = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      luma[p] = value;
      if (!mask[p]) continue;
      sum += value;
      sumSq += value * value;
      count++;
      if (value >= 245) overexposed++;
    }

    if (!count) {
      return {
        score: 0,
        isClear: false,
        edgeDensity: 1,
        contrast: 100,
        overexposedRatio: 1,
        reason: 'no_background',
      };
    }

    const mean = sum / count;
    const contrast = Math.sqrt(Math.max(sumSq / count - mean * mean, 0));
    const overexposedRatio = overexposed / count;
    const edgeDensity = this._edgeDensity(luma, mask, this.sampleWidth, sampleHeight);

    const edgeScore = mapRange(edgeDensity, this.maxEdgeDensity * 1.6, this.maxEdgeDensity, 0, 100);
    const contrastScore = mapRange(contrast, this.maxContrast * 1.8, this.maxContrast, 0, 100);
    const exposureScore = mapRange(overexposedRatio, this.maxOverexposedRatio * 2, this.maxOverexposedRatio, 0, 100);
    const score = Math.round(clamp(edgeScore * 0.45 + contrastScore * 0.25 + exposureScore * 0.3, 0, 100));

    let reason = null;
    if (edgeDensity > this.maxEdgeDensity) reason = 'busy_background';
    else if (overexposedRatio > this.maxOverexposedRatio) reason = 'bright_background';
    else if (contrast > this.maxContrast) reason = 'high_contrast_background';

    return {
      score,
      isClear: score >= this.minScore && !reason,
      edgeDensity: Math.round(edgeDensity * 1000) / 1000,
      contrast: Math.round(contrast * 10) / 10,
      overexposedRatio: Math.round(overexposedRatio * 1000) / 1000,
      reason,
    };
  }

  _backgroundMask(face, canvas, width, height) {
    const mask = new Uint8Array(width * height);
    const scaleX = width / canvas.width;
    const scaleY = height / canvas.height;
    const padX = face.box.width * this.facePadding * scaleX;
    const padY = face.box.height * this.facePadding * scaleY;
    const left = face.box.x * scaleX - padX;
    const top = face.box.y * scaleY - padY;
    const right = (face.box.x + face.box.width) * scaleX + padX;
    const bottom = (face.box.y + face.box.height) * scaleY + padY;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const insideFaceRegion = x >= left && x <= right && y >= top && y <= bottom;
        mask[y * width + x] = insideFaceRegion ? 0 : 1;
      }
    }
    return mask;
  }

  _edgeDensity(luma, mask, width, height) {
    let strongEdges = 0;
    let comparisons = 0;
    for (let y = 1; y < height; y++) {
      for (let x = 1; x < width; x++) {
        const idx = y * width + x;
        if (!mask[idx]) continue;
        const left = idx - 1;
        const up = idx - width;
        if (mask[left]) {
          comparisons++;
          if (Math.abs(luma[idx] - luma[left]) > 22) strongEdges++;
        }
        if (mask[up]) {
          comparisons++;
          if (Math.abs(luma[idx] - luma[up]) > 22) strongEdges++;
        }
      }
    }
    return comparisons ? strongEdges / comparisons : 1;
  }
}

export default BackgroundDetector;
