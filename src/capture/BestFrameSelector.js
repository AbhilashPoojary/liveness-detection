import { RingBuffer } from '../utils/RingBuffer.js';
import { clamp } from '../utils/math.js';

/**
 * BestFrameSelector
 * -------------------------------------------------------------------------
 * Rather than capturing the very first frame that passes quality gates,
 * HumanCamJS buffers the last N (default 15) *valid* frames — each paired
 * with its QualityService result — and picks the single best one at the
 * moment of capture using a weighted composite of blur, motion, brightness,
 * face confidence, and pose straightness. This smooths out one-off noisy
 * frames (a blink, a micro-shake) that could otherwise sneak through the
 * gate on a single evaluation.
 */
export class BestFrameSelector {
  /**
   * @param {Object} [options]
   * @param {number} [options.bufferSize=15]
   * @param {Object} [options.weights] - relative importance of each dimension
   */
  constructor({ bufferSize = 15, weights } = {}) {
    this.buffer = new RingBuffer(bufferSize);
    this.weights = {
      blur: 0.35,
      motion: 0.2,
      brightness: 0.15,
      confidence: 0.15,
      pose: 0.15,
      ...weights,
    };
  }

  /**
   * Add a candidate frame. Only frames that already passed QualityService's
   * hard gates should be pushed here — this selector ranks *among*
   * already-valid frames, it does not itself gate validity.
   * @param {HTMLCanvasElement} canvas
   * @param {import('../quality/QualityService.js').QualityResult} quality
   * @param {import('../detector/HumanDetector.js').NormalizedFace} face
   */
  push(canvas, quality, face) {
    const compositeScore = this._score(quality, face);
    this.buffer.push({ canvas, quality, face, compositeScore, timestamp: Date.now() });
  }

  _score(quality, face) {
    const blurScore = clamp(quality.blur.score, 0, 100);
    const motionScore = clamp(quality.motion.score, 0, 100);
    const brightnessScore = clamp(quality.brightness.score, 0, 100);
    const confidenceScore = clamp(face?.confidence ?? 0, 0, 100);
    const poseScore = clamp(quality.pose.score, 0, 100);

    return (
      blurScore * this.weights.blur +
      motionScore * this.weights.motion +
      brightnessScore * this.weights.brightness +
      confidenceScore * this.weights.confidence +
      poseScore * this.weights.pose
    );
  }

  /** Number of valid candidate frames currently buffered. */
  get count() {
    return this.buffer.length;
  }

  /**
   * @returns {{canvas:HTMLCanvasElement, quality:Object, face:Object, compositeScore:number}|null}
   *   the highest-scoring buffered frame, or null if the buffer is empty
   */
  getBest() {
    const items = this.buffer.toArray();
    if (!items.length) return null;
    return items.reduce((best, item) => (item.compositeScore > best.compositeScore ? item : best));
  }

  reset() {
    this.buffer.clear();
  }
}

export default BestFrameSelector;
