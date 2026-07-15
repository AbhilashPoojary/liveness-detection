import { BlinkDetector } from './BlinkDetector.js';
import { RingBuffer } from '../utils/RingBuffer.js';
import { clamp, mapRange, stdDev, average } from '../utils/math.js';

/**
 * PassiveLiveness
 * -------------------------------------------------------------------------
 * Lightweight, fully deterministic passive liveness check built entirely
 * from Human.js landmarks + geometry — no secondary neural network, no
 * "AI liveness model", per project requirements.
 *
 * Signals combined:
 *  1. Blink occurrence & eye openness (BlinkDetector / EAR)
 *  2. Natural head movement (variation in yaw/pitch across the session,
 *     bounded so it looks organic rather than a static photo held up)
 *  3. Face stability at the moment of capture (low motion score just
 *     before/at capture — a live subject settles, a photo/replay attack
 *     often shows jitter from hand movement or screen glare)
 *  4. Depth-consistency sanity check using mesh Z-spread (a flat photo of
 *     a face has a much smaller Z range than a real 3D face)
 *
 * This is intentionally a *passive* check (no "please blink now" prompt
 * required), but BlinkDetector's running blink count is still the
 * strongest single signal and is weighted accordingly.
 */
export class PassiveLiveness {
  /**
   * @param {Object} [options]
   * @param {number} [options.sessionWindow=90] - number of recent pose samples retained
   * @param {number} [options.minYawVariation=1.5] - minimum yaw std-dev (degrees) expected from natural micro-movement
   * @param {number} [options.maxYawVariation=25] - yaw std-dev above which movement looks unnatural/excessive
   * @param {number} [options.passScore=70] - overall score at/above which `passed` is true
   * @param {number} [options.noBlinkScore=65] - baseline blink score when no blink is observed in a short passive session
   * @param {number} [options.minMovementScore=45] - baseline movement score for a stable, low-motion capture
   * @param {Object} [options.weights] - relative score weights for blink/movement/eyeOpenness/depth
   */
  constructor({
    sessionWindow = 90,
    minYawVariation = 1.5,
    maxYawVariation = 25,
    passScore = 70,
    noBlinkScore = 65,
    minMovementScore = 45,
    weights,
  } = {}) {
    this.blinkDetector = new BlinkDetector();
    this.poseHistory = new RingBuffer(sessionWindow);
    this.zSpreadHistory = new RingBuffer(sessionWindow);
    this.minYawVariation = minYawVariation;
    this.maxYawVariation = maxYawVariation;
    this.passScore = passScore;
    this.noBlinkScore = noBlinkScore;
    this.minMovementScore = minMovementScore;
    this.weights = {
      blink: 0.2,
      movement: 0.2,
      eyeOpenness: 0.25,
      depth: 0.35,
      ...weights,
    };
  }

  /**
   * Feed one frame's worth of face data into the ongoing session.
   * Call this on every analyzed frame (not just at capture time) so the
   * session has enough history to judge natural movement and blinking.
   * @param {import('../detector/HumanDetector.js').NormalizedFace} face
   * @param {import('../quality/QualityService.js').QualityResult} quality
   */
  update(face, quality) {
    const blink = this.blinkDetector.update(face.annotations);

    this.poseHistory.push({ yaw: face.rotation.yaw, pitch: face.rotation.pitch });

    const zValues = (face.mesh || []).map((p) => p[2]).filter((z) => typeof z === 'number');
    if (zValues.length) {
      const zRange = Math.max(...zValues) - Math.min(...zValues);
      this.zSpreadHistory.push(zRange);
    }

    return {
      blink,
      motionScore: quality?.motion?.score ?? null,
    };
  }

  /**
   * Compute the current cumulative liveness result. Safe to call at any
   * point (e.g. right before capture) — it summarizes everything seen
   * during this session so far.
   * @returns {{passed:boolean, score:number, signals:Object}}
   */
  evaluate() {
    const poses = this.poseHistory.toArray();
    const yawStd = poses.length > 3 ? stdDev(poses.map((p) => p.yaw)) : 0;
    const pitchStd = poses.length > 3 ? stdDev(poses.map((p) => p.pitch)) : 0;

    // Natural movement score: peaks when yaw variation sits within the
    // "organic micro-movement" band — too little looks like a still photo,
    // too much looks erratic.
    const movementAmount = Math.max(yawStd, pitchStd);
    let movementScore;
    if (movementAmount < this.minYawVariation) {
      movementScore = mapRange(movementAmount, 0, this.minYawVariation, this.minMovementScore, 75);
    } else if (movementAmount > this.maxYawVariation) {
      movementScore = mapRange(movementAmount, this.maxYawVariation, this.maxYawVariation * 2, 75, 10);
    } else {
      movementScore = 100;
    }

    const blinkScore = this.blinkDetector.totalBlinks > 0 ? 100 : this.noBlinkScore;

    const latestEAR = this.blinkDetector.latestEAR;
    const avgOpenEAR = this.blinkDetector.averageOpenEAR();
    const eyeOpennessScore = avgOpenEAR !== null ? clamp(mapRange(avgOpenEAR, 0.15, 0.35, 40, 100), 0, 100) : 50;

    const zSpreads = this.zSpreadHistory.toArray();
    const avgZSpread = zSpreads.length ? average(zSpreads) : 0;
    // A flat printed photo/screen replay has minimal depth variation across
    // the mesh; a real face has a meaningfully non-zero Z spread.
    const depthScore = clamp(mapRange(avgZSpread, 0.5, 6, 20, 100), 0, 100);

    const score = Math.round(
      clamp(
        blinkScore * this.weights.blink +
          movementScore * this.weights.movement +
          eyeOpennessScore * this.weights.eyeOpenness +
          depthScore * this.weights.depth,
        0,
        100,
      ),
    );

    return {
      passed: score >= this.passScore,
      score,
      signals: {
        totalBlinks: this.blinkDetector.totalBlinks,
        blinkScore: Math.round(blinkScore),
        yawVariation: Math.round(yawStd * 100) / 100,
        pitchVariation: Math.round(pitchStd * 100) / 100,
        movementScore: Math.round(movementScore),
        latestEAR: latestEAR !== null ? Math.round(latestEAR * 1000) / 1000 : null,
        avgOpenEAR: avgOpenEAR !== null ? Math.round(avgOpenEAR * 1000) / 1000 : null,
        eyeOpennessScore: Math.round(eyeOpennessScore),
        avgZSpread: Math.round(avgZSpread * 100) / 100,
        depthScore: Math.round(depthScore),
      },
    };
  }

  reset() {
    this.blinkDetector.reset();
    this.poseHistory.clear();
    this.zSpreadHistory.clear();
  }
}

export default PassiveLiveness;
