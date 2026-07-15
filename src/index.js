/**
 * HumanCamJS public API surface.
 * Most consumers only need the default `HumanCam` export, but every
 * internal module is also exported for advanced/custom integrations.
 */
export { HumanCam, default } from './HumanCam.js';

export { CameraManager } from './camera/CameraManager.js';
export { CameraDevice } from './camera/CameraDevice.js';

export { HumanDetector } from './detector/HumanDetector.js';

export { QualityService } from './quality/QualityService.js';
export { BrightnessDetector } from './quality/BrightnessDetector.js';
export { BlurDetector } from './quality/BlurDetector.js';
export { BackgroundDetector } from './quality/BackgroundDetector.js';
export { MotionDetector } from './quality/MotionDetector.js';
export { PoseDetector } from './quality/PoseDetector.js';
export { FaceValidator } from './quality/FaceValidator.js';

export { PassiveLiveness } from './liveness/PassiveLiveness.js';
export { BlinkDetector } from './liveness/BlinkDetector.js';

export { CaptureManager } from './capture/CaptureManager.js';
export { BestFrameSelector } from './capture/BestFrameSelector.js';

export { Overlay } from './ui/Overlay.js';
export { FaceGuide } from './ui/FaceGuide.js';
export { Countdown } from './ui/Countdown.js';
export { Toast } from './ui/Toast.js';
export { Preview } from './ui/Preview.js';
export { ProgressRing } from './ui/ProgressRing.js';

export { EventEmitter } from './utils/EventEmitter.js';
export { RingBuffer } from './utils/RingBuffer.js';
