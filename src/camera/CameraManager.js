import { EventEmitter } from '../utils/EventEmitter.js';
import { CameraDevice } from './CameraDevice.js';

/**
 * CameraManager
 * -------------------------------------------------------------------------
 * Owns the `<video>` element and the underlying MediaStream. Responsible
 * for requesting permission, starting/stopping the stream, switching
 * between front/rear cameras, and surfacing hardware errors in a
 * predictable, application-friendly way.
 *
 * Events emitted:
 *  - 'ready'          { width, height, facing }
 *  - 'error'          { code, message, original }
 *  - 'permission-denied'
 *  - 'device-changed'  CameraDevice[]
 *  - 'stopped'
 */
export class CameraManager extends EventEmitter {
  /**
   * @param {Object} options
   * @param {HTMLVideoElement} options.videoEl - target video element to bind the stream to
   * @param {'front'|'rear'} [options.facing='front']
   * @param {{width?:number,height?:number}} [options.resolution]
   */
  constructor({ videoEl, facing = 'front', resolution = { width: 1280, height: 720 } }) {
    super();
    if (!videoEl) throw new Error('CameraManager requires a `videoEl`.');
    this.videoEl = videoEl;
    this.facing = facing;
    this.resolution = resolution;
    /** @type {MediaStream|null} */
    this.stream = null;
    /** @type {CameraDevice[]} */
    this.devices = [];
    this.currentDeviceId = null;
    this._boundHandleDeviceChange = this._handleDeviceChange.bind(this);
  }

  get isFront() {
    return this.facing === 'front';
  }

  /** Build the MediaStreamConstraints for the current facing/resolution/device. */
  _buildConstraints() {
    /** @type {MediaTrackConstraints} */
    const video = {
      width: { ideal: this.resolution.width },
      height: { ideal: this.resolution.height },
    };
    if (this.currentDeviceId) {
      video.deviceId = { exact: this.currentDeviceId };
    } else {
      video.facingMode = this.isFront ? 'user' : { ideal: 'environment' };
    }
    return { video, audio: false };
  }

  /**
   * Request camera permission and start streaming.
   * @returns {Promise<void>}
   */
  async start() {
    if (!navigator.mediaDevices?.getUserMedia) {
      const err = new Error('getUserMedia is not supported in this browser.');
      this.emit('error', { code: 'UNSUPPORTED', message: err.message, original: err });
      throw err;
    }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia(this._buildConstraints());
    } catch (original) {
      return this._handleGetUserMediaError(original);
    }

    this.videoEl.srcObject = this.stream;
    this.videoEl.muted = true;
    this.videoEl.playsInline = true;
    this.videoEl.style.transform = this.isFront ? 'scaleX(-1)' : 'none';

    await new Promise((resolve) => {
      this.videoEl.onloadedmetadata = () => resolve();
    });
    await this.videoEl.play();

    await this.refreshDevices();
    navigator.mediaDevices.addEventListener?.('devicechange', this._boundHandleDeviceChange);

    this.emit('ready', {
      width: this.videoEl.videoWidth,
      height: this.videoEl.videoHeight,
      facing: this.facing,
    });
  }

  /** Translate getUserMedia DOMExceptions into friendly, typed errors. */
  _handleGetUserMediaError(original) {
    const map = {
      NotAllowedError: 'PERMISSION_DENIED',
      PermissionDeniedError: 'PERMISSION_DENIED',
      NotFoundError: 'NO_CAMERA',
      DevicesNotFoundError: 'NO_CAMERA',
      NotReadableError: 'CAMERA_IN_USE',
      TrackStartError: 'CAMERA_IN_USE',
      OverconstrainedError: 'CONSTRAINTS_NOT_SATISFIED',
      SecurityError: 'INSECURE_CONTEXT',
    };
    const code = map[original?.name] || 'UNKNOWN';
    const messages = {
      PERMISSION_DENIED: 'Camera access was denied. Please allow camera permission and try again.',
      NO_CAMERA: 'No camera device was found on this system.',
      CAMERA_IN_USE: 'The camera is already in use by another application.',
      CONSTRAINTS_NOT_SATISFIED: 'The camera does not support the requested resolution/facing mode.',
      INSECURE_CONTEXT: 'Camera access requires HTTPS (or localhost).',
      UNKNOWN: 'Unable to access the camera.',
    };
    const message = messages[code];
    if (code === 'PERMISSION_DENIED') this.emit('permission-denied');
    this.emit('error', { code, message, original });
    throw Object.assign(new Error(message), { code, original });
  }

  /** Enumerate cameras and cache them (labels populate only after permission granted). */
  async refreshDevices() {
    try {
      this.devices = await CameraDevice.list();
      this.emit('device-changed', this.devices);
      return this.devices;
    } catch (err) {
      this.emit('error', { code: 'ENUMERATE_FAILED', message: 'Could not list camera devices.', original: err });
      return [];
    }
  }

  _handleDeviceChange() {
    this.refreshDevices();
  }

  /**
   * Switch between front and rear cameras (or vice versa).
   * @param {'front'|'rear'} [facing] - explicit facing, otherwise toggles
   */
  async switchCamera(facing) {
    this.facing = facing || (this.isFront ? 'rear' : 'front');
    this.currentDeviceId = null; // let facingMode pick the right hardware
    this.stop({ keepListeners: true });
    await this.start();
  }

  /**
   * Switch directly to a specific device (useful for devices with multiple
   * rear lenses e.g. wide/ultra-wide).
   * @param {string} deviceId
   */
  async selectDevice(deviceId) {
    this.currentDeviceId = deviceId;
    const device = this.devices.find((d) => d.deviceId === deviceId);
    if (device && device.facing !== 'unknown') this.facing = device.facing === 'user' ? 'front' : 'rear';
    this.stop({ keepListeners: true });
    await this.start();
  }

  /** Whether more than one camera is available for switching. */
  hasMultipleCameras() {
    return this.devices.length > 1;
  }

  /** Grab the current raw video frame onto an offscreen canvas. @returns {HTMLCanvasElement} */
  grabFrame() {
    const canvas = document.createElement('canvas');
    canvas.width = this.videoEl.videoWidth;
    canvas.height = this.videoEl.videoHeight;
    const ctx = canvas.getContext('2d');
    if (this.isFront) {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(this.videoEl, 0, 0, canvas.width, canvas.height);
    return canvas;
  }

  /** Stop the stream and release hardware. */
  stop({ keepListeners = false } = {}) {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    if (this.videoEl) this.videoEl.srcObject = null;
    if (!keepListeners) {
      navigator.mediaDevices?.removeEventListener?.('devicechange', this._boundHandleDeviceChange);
      this.emit('stopped');
    }
  }
}

export default CameraManager;
