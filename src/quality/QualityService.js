import { BrightnessDetector } from './BrightnessDetector.js';
import { BlurDetector } from './BlurDetector.js';
import { MotionDetector } from './MotionDetector.js';
import { PoseDetector } from './PoseDetector.js';
import { FaceValidator } from './FaceValidator.js';
import { BackgroundDetector } from './BackgroundDetector.js';
import { clamp } from '../utils/math.js';

/**
 * QualityService
 * -------------------------------------------------------------------------
 * Runs every quality sub-check (brightness, blur, motion, pose, face
 * structure) against a single frame + detected face, and combines them
 * into one weighted 0-100 quality score plus a granular breakdown that the
 * UI layer (live status list, progress ring) can render directly.
 *
 * A frame is "auto-capture eligible" only when every hard-gate check
 * passes (see `passed`), regardless of the numeric score — the score is
 * useful for progress UI, but pass/fail is what gates the camera shutter.
 */
export class QualityService {
  /**
   * @param {Object} [options]
   * @param {number} [options.minResolutionWidth=480] - minimum acceptable capture width
   * @param {ConstructorParameters<typeof BrightnessDetector>[0]} [options.brightness]
   * @param {ConstructorParameters<typeof BlurDetector>[0]} [options.blur]
   * @param {ConstructorParameters<typeof MotionDetector>[0]} [options.motion]
   * @param {ConstructorParameters<typeof PoseDetector>[0]} [options.pose]
   * @param {ConstructorParameters<typeof FaceValidator>[0]} [options.face]
   * @param {ConstructorParameters<typeof BackgroundDetector>[0]} [options.background]
   */
  constructor(options = {}) {
    this.minResolutionWidth = options.minResolutionWidth ?? 480;
    this.brightness = new BrightnessDetector(options.brightness);
    this.blur = new BlurDetector(options.blur);
    this.motion = new MotionDetector(options.motion);
    this.pose = new PoseDetector(options.pose);
    this.face = new FaceValidator(options.face);
    this.background = new BackgroundDetector(options.background);

    // Relative importance of each dimension in the composite score.
    this.weights = {
      face: 0.25,
      pose: 0.15,
      brightness: 0.15,
      blur: 0.2,
      motion: 0.1,
      background: 0.15,
      ...options.weights,
    };
  }

  /** Allow the blur detector to try loading OpenCV.js for higher-fidelity scoring. */
  async loadOpenCV(src) {
    return this.blur.loadOpenCV(src);
  }

  /**
   * Crop a face-region canvas from the full frame (with padding), used so
   * brightness/blur scoring focuses on the subject rather than background.
   */
  _cropToFace(canvas, face, padding = 0.35) {
    if (!face) return canvas;
    const { x, y, width, height } = face.box;
    const padX = width * padding;
    const padY = height * padding;
    const cropX = clamp(x - padX, 0, canvas.width);
    const cropY = clamp(y - padY, 0, canvas.height);
    const cropW = Math.min(width + padX * 2, canvas.width - cropX);
    const cropH = Math.min(height + padY * 2, canvas.height - cropY);

    const cropped = document.createElement('canvas');
    cropped.width = Math.max(1, Math.round(cropW));
    cropped.height = Math.max(1, Math.round(cropH));
    cropped.getContext('2d').drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropped.width, cropped.height);
    return cropped;
  }

  /**
   * Evaluate a single frame.
   * @param {HTMLCanvasElement} frameCanvas - full captured frame
   * @param {import('../detector/HumanDetector.js').NormalizedFace|null} face
   * @param {number} faceCount
   * @returns {QualityResult}
   */
  evaluate(frameCanvas, face, faceCount) {
    const faceCrop = this._cropToFace(frameCanvas, face);

    const faceResult = this.face.analyze(face, faceCount);
    const poseResult = face ? this.pose.analyze(face.rotation) : { score: 0, isStraight: false, yaw: 0, pitch: 0, roll: 0, violations: [] };
    const brightnessResult = this.brightness.analyze(faceCrop);
    const blurResult = this.blur.analyze(faceCrop);
    const motionResult = this.motion.analyze(frameCanvas);
    const backgroundResult = this.background.analyze(frameCanvas, face);

    const resolutionOk = frameCanvas.width >= this.minResolutionWidth;

    const score = Math.round(
      clamp(
        faceResult.score * this.weights.face +
          poseResult.score * this.weights.pose +
          brightnessResult.score * this.weights.brightness +
          blurResult.score * this.weights.blur +
          motionResult.score * this.weights.motion +
          backgroundResult.score * this.weights.background,
        0,
        100,
      ),
    );

    // Hard gates: everything must be true before auto-capture is permitted,
    // independent of the composite numeric score.
    const gates = {
      singleFace: faceResult.singleFace,
      faceDetected: faceResult.faceDetected,
      centered: faceResult.centered,
      sizeOk: faceResult.sizeOk,
      notCropped: faceResult.notCropped,
      eyesVisible: faceResult.eyesVisible,
      mouthVisible: faceResult.mouthVisible,
      poseStraight: poseResult.isStraight,
      brightnessOk: brightnessResult.status === 'ok',
      sharp: blurResult.isSharp,
      still: motionResult.isStill,
      backgroundClear: backgroundResult.isClear,
      resolutionOk,
    };

    const passed = Object.values(gates).every(Boolean);

    return {
      score,
      passed,
      gates,
      face: faceResult,
      pose: poseResult,
      brightness: brightnessResult,
      blur: blurResult,
      motion: motionResult,
      background: backgroundResult,
      resolution: { width: frameCanvas.width, height: frameCanvas.height, ok: resolutionOk },
    };
  }

  reset() {
    this.motion.reset();
  }
}

export default QualityService;

/**
 * @typedef {Object} QualityResult
 * @property {number} score - composite 0-100 quality score
 * @property {boolean} passed - whether every hard gate check passed (capture-eligible)
 * @property {Object} gates - individual boolean pass/fail flags
 * @property {Object} face
 * @property {Object} pose
 * @property {Object} brightness
 * @property {Object} blur
 * @property {Object} motion
 * @property {{width:number,height:number,ok:boolean}} resolution
 */
