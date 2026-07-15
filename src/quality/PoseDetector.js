import { clamp, mapRange } from '../utils/math.js';

/**
 * PoseDetector
 * -------------------------------------------------------------------------
 * Wraps the yaw/pitch/roll angles already computed by Human.js's face mesh
 * (`face.rotation.angle`) and applies configurable tolerance thresholds to
 * decide whether the head pose is acceptable for a KYC-grade capture.
 */
export class PoseDetector {
  /**
   * @param {Object} [options]
   * @param {number} [options.maxYaw=15] - max acceptable left/right turn, degrees
   * @param {number} [options.maxPitch=15] - max acceptable up/down tilt, degrees
   * @param {number} [options.maxRoll=15] - max acceptable head tilt, degrees
   */
  constructor({ maxYaw = 15, maxPitch = 15, maxRoll = 15 } = {}) {
    this.maxYaw = maxYaw;
    this.maxPitch = maxPitch;
    this.maxRoll = maxRoll;
  }

  /**
   * @param {{yaw:number,pitch:number,roll:number}} rotation - degrees, from HumanDetector
   * @returns {{yaw:number,pitch:number,roll:number,isStraight:boolean,score:number,violations:string[]}}
   */
  analyze(rotation) {
    const yaw = rotation?.yaw ?? 0;
    const pitch = rotation?.pitch ?? 0;
    const roll = rotation?.roll ?? 0;

    const violations = [];
    if (Math.abs(yaw) > this.maxYaw) violations.push('yaw');
    if (Math.abs(pitch) > this.maxPitch) violations.push('pitch');
    if (Math.abs(roll) > this.maxRoll) violations.push('roll');

    const yawScore = mapRange(Math.abs(yaw), 0, this.maxYaw * 2, 100, 0);
    const pitchScore = mapRange(Math.abs(pitch), 0, this.maxPitch * 2, 100, 0);
    const rollScore = mapRange(Math.abs(roll), 0, this.maxRoll * 2, 100, 0);
    const score = Math.round(clamp((yawScore + pitchScore + rollScore) / 3, 0, 100));

    return {
      yaw: Math.round(yaw * 10) / 10,
      pitch: Math.round(pitch * 10) / 10,
      roll: Math.round(roll * 10) / 10,
      isStraight: violations.length === 0,
      score,
      violations,
    };
  }
}

export default PoseDetector;
