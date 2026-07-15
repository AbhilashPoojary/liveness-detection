/**
 * CameraDevice
 * -------------------------------------------------------------------------
 * Thin wrapper around the browser's MediaDeviceInfo for video inputs, plus
 * static helpers for enumerating and classifying (front/back) cameras.
 */
export class CameraDevice {
  /** @param {MediaDeviceInfo} deviceInfo */
  constructor(deviceInfo) {
    this.deviceId = deviceInfo.deviceId;
    this.groupId = deviceInfo.groupId;
    this.label = deviceInfo.label || 'Camera';
    this.facing = CameraDevice.guessFacing(deviceInfo.label);
  }

  /**
   * Heuristically determine whether a device is front or back facing based
   * on its label, since `facingMode` capabilities aren't always exposed by
   * `enumerateDevices()`.
   * @param {string} label
   * @returns {'user'|'environment'|'unknown'}
   */
  static guessFacing(label = '') {
    const l = label.toLowerCase();
    if (/front|user|face/.test(l)) return 'user';
    if (/back|rear|environment/.test(l)) return 'environment';
    return 'unknown';
  }

  /**
   * List all available video input devices. Requires that permission has
   * already been granted at least once, otherwise labels will be empty.
   * @returns {Promise<CameraDevice[]>}
   */
  static async list() {
    if (!navigator.mediaDevices?.enumerateDevices) {
      throw new Error('MediaDevices API not supported in this browser.');
    }
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices
      .filter((d) => d.kind === 'videoinput')
      .map((d) => new CameraDevice(d));
  }
}

export default CameraDevice;
