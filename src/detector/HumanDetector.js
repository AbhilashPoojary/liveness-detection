import Human from '@vladmandic/human';
import { EventEmitter } from '../utils/EventEmitter.js';

/**
 * HumanDetector
 * -------------------------------------------------------------------------
 * Thin, purpose-built wrapper around Human.js exposing exactly what
 * HumanCamJS needs: face bounding boxes, 468-point landmarks, eye/iris
 * points, detection confidence, and head pose (yaw/pitch/roll). Keeping
 * this isolated means the rest of the SDK never talks to Human.js
 * directly, so the underlying model could be swapped later.
 */
export class HumanDetector extends EventEmitter {
  /** @param {Object} [config] partial Human.js config overrides */
  constructor(config = {}) {
    super();
    const {
      modelBasePath = 'https://vladmandic.github.io/human-models/models/',
      ...humanConfig
    } = config;
    this.human = new Human({
      backend: 'webgl',
      modelBasePath,
      face: {
        enabled: true,
        detector: { rotation: true, maxDetected: 3, minConfidence: 0.4 },
        mesh: { enabled: true },
        iris: { enabled: true },
        description: { enabled: false },
        emotion: { enabled: false },
        antispoof: { enabled: false },
        liveness: { enabled: false },
      },
      body: { enabled: false },
      hand: { enabled: false },
      object: { enabled: false },
      gesture: { enabled: false },
      filter: { enabled: true, equalization: false },
      ...humanConfig,
    });
    this._ready = false;
  }

  /** Load models. Must be called (and awaited) once before `detect()`. */
  async load() {
    if (this._ready) return;
    await this.human.load();
    await this.human.warmup();
    this._ready = true;
    this.emit('ready');
  }

  get ready() {
    return this._ready;
  }

  /**
   * Run detection on a single frame.
   * @param {HTMLCanvasElement|HTMLVideoElement} input
   * @returns {Promise<NormalizedFace|null>} normalized face data, or null if no face
   */
  async detect(input) {
    if (!this._ready) throw new Error('HumanDetector.load() must be awaited before detect().');
    const result = await this.human.detect(input);
    const faces = result.face || [];

    if (faces.length === 0) return { faceCount: 0, face: null, raw: result };
    if (faces.length > 1) return { faceCount: faces.length, face: null, raw: result };

    const face = faces[0];
    return {
      faceCount: 1,
      face: this._normalize(face, input),
      raw: result,
    };
  }

  /**
   * Convert Human.js's raw face object into the flat shape the rest of the
   * SDK consumes.
   */
  _normalize(face, input) {
    const width = input.videoWidth || input.width;
    const height = input.videoHeight || input.height;
    const [x, y, w, h] = face.box;

    return {
      confidence: Math.round((face.score ?? face.boxScore ?? face.faceScore ?? 0) * 1000) / 10, // percent, 1dp
      box: { x, y, width: w, height: h },
      boxRaw: face.boxRaw, // normalized 0-1 coordinates
      mesh: face.mesh || [], // 468 3D landmark points
      meshRaw: face.meshRaw || [],
      annotations: face.annotations || {},
      rotation: {
        // Human.js already computes angle estimates from the mesh.
        yaw: face.rotation?.angle?.yaw ?? 0,
        pitch: face.rotation?.angle?.pitch ?? 0,
        roll: face.rotation?.angle?.roll ?? 0,
        gaze: face.rotation?.gaze || null,
      },
      frameSize: { width, height },
    };
  }

  /** Release GPU resources (call on destroy()). */
  dispose() {
    try {
      this.human.tf?.engine?.().disposeVariables?.();
    } catch {
      /* noop */
    }
  }
}

export default HumanDetector;

/**
 * @typedef {Object} NormalizedFace
 * @property {number} confidence - 0-100
 * @property {{x:number,y:number,width:number,height:number}} box - pixel-space bounding box
 * @property {number[]} mesh - 468 landmark points [x,y,z]
 * @property {Object} annotations - named landmark groups (leftEyeIris, rightEyeIris, lips, etc.)
 * @property {{yaw:number,pitch:number,roll:number}} rotation - degrees
 * @property {{width:number,height:number}} frameSize
 */
