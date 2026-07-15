import { clamp, mapRange } from '../utils/math.js';

/**
 * FaceValidator
 * -------------------------------------------------------------------------
 * Structural validation of a detected face against the capture guide:
 * centering, size, in-frame cropping, and visibility of key landmarks
 * (eyes / mouth). Complements PoseDetector (angles) and BrightnessDetector
 * /BlurDetector (image quality).
 */
export class FaceValidator {
  /**
   * @param {Object} [options]
   * @param {number} [options.minFaceRatio=0.22] - min face width / frame width
   * @param {number} [options.maxFaceRatio=0.75] - max face width / frame width
   * @param {number} [options.maxCenterOffset=0.15] - max allowed center offset as a fraction of frame size
   * @param {number} [options.edgeMargin=0.02] - required margin from frame edges (fraction of frame size) to avoid cropping
   */
  constructor({
    minFaceRatio = 0.22,
    maxFaceRatio = 0.75,
    maxCenterOffset = 0.15,
    edgeMargin = 0.02,
  } = {}) {
    this.minFaceRatio = minFaceRatio;
    this.maxFaceRatio = maxFaceRatio;
    this.maxCenterOffset = maxCenterOffset;
    this.edgeMargin = edgeMargin;
  }

  /**
   * @param {import('../detector/HumanDetector.js').NormalizedFace} face
   * @param {number} faceCount - total faces detected in frame (for single-face check)
   * @returns {Object} validation result with per-check booleans, scores, and an overall score
   */
  analyze(face, faceCount) {
    const checks = {
      singleFace: faceCount === 1,
    };

    if (!face) {
      return {
        ...checks,
        faceDetected: false,
        centered: false,
        sizeOk: false,
        notCropped: false,
        eyesVisible: false,
        mouthVisible: false,
        score: 0,
        reasons: faceCount > 1 ? ['multiple_faces'] : ['no_face'],
      };
    }

    const { box, frameSize, annotations } = face;
    const faceCenterX = box.x + box.width / 2;
    const faceCenterY = box.y + box.height / 2;
    const frameCenterX = frameSize.width / 2;
    const frameCenterY = frameSize.height / 2;

    const offsetX = Math.abs(faceCenterX - frameCenterX) / frameSize.width;
    const offsetY = Math.abs(faceCenterY - frameCenterY) / frameSize.height;
    const centered = offsetX <= this.maxCenterOffset && offsetY <= this.maxCenterOffset;

    const faceRatio = box.width / frameSize.width;
    const sizeOk = faceRatio >= this.minFaceRatio && faceRatio <= this.maxFaceRatio;

    const marginX = frameSize.width * this.edgeMargin;
    const marginY = frameSize.height * this.edgeMargin;
    const notCropped =
      box.x >= marginX &&
      box.y >= marginY &&
      box.x + box.width <= frameSize.width - marginX &&
      box.y + box.height <= frameSize.height - marginY;

    const eyesVisible = Boolean(annotations?.leftEyeIris?.length && annotations?.rightEyeIris?.length);
    const mouthVisible = Boolean(annotations?.lipsUpperOuter?.length || annotations?.lips?.length);

    const reasons = [];
    if (!checks.singleFace) reasons.push(faceCount === 0 ? 'no_face' : 'multiple_faces');
    if (!centered) reasons.push('not_centered');
    if (!sizeOk) reasons.push(faceRatio < this.minFaceRatio ? 'too_far' : 'too_close');
    if (!notCropped) reasons.push('face_cropped');
    if (!eyesVisible) reasons.push('eyes_not_visible');
    if (!mouthVisible) reasons.push('mouth_not_visible');

    const centerScore = mapRange(Math.max(offsetX, offsetY), 0, this.maxCenterOffset * 2, 100, 0);
    const sizeScore = sizeOk
      ? 100
      : mapRange(
          faceRatio < this.minFaceRatio ? this.minFaceRatio - faceRatio : faceRatio - this.maxFaceRatio,
          0,
          0.2,
          100,
          0,
        );
    const cropScore = notCropped ? 100 : 0;
    const landmarkScore = (eyesVisible ? 50 : 0) + (mouthVisible ? 50 : 0);

    const score = Math.round(
      clamp((centerScore * 0.3 + sizeScore * 0.3 + cropScore * 0.2 + landmarkScore * 0.2), 0, 100),
    );

    return {
      ...checks,
      faceDetected: true,
      centered,
      sizeOk,
      notCropped,
      eyesVisible,
      mouthVisible,
      faceRatio: Math.round(faceRatio * 1000) / 1000,
      offset: { x: Math.round(offsetX * 1000) / 1000, y: Math.round(offsetY * 1000) / 1000 },
      score,
      reasons,
    };
  }
}

export default FaceValidator;
