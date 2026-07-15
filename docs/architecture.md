# Architecture

## Design principles

- **Separation of concerns.** Camera I/O, vision (detection/quality/liveness),
  capture state machine, and presentation (UI) are independent modules that
  only talk to each other through plain data and events — never through
  shared mutable state.
- **Deterministic vision.** Every quality and liveness signal is computed
  with explicit, documented formulas (Laplacian variance, EAR, luminance,
  frame-diffing, angle thresholds). Human.js supplies the underlying face
  landmarks/mesh; everything built on top of it in HumanCamJS is plain math.
- **Fail soft.** Optional dependencies (OpenCV.js) degrade gracefully to a
  pure-JS equivalent rather than breaking the pipeline.
- **Composable.** `HumanCam` is a thin orchestrator; every module it wires
  together is independently importable and testable.

## Module map

```
                              ┌────────────────────┐
                              │      HumanCam       │  ← public controller
                              └─────────┬────────────┘
             ┌──────────────┬───────────┼───────────────┬─────────────┐
             ▼              ▼           ▼               ▼             ▼
      CameraManager   HumanDetector  QualityService  PassiveLiveness  Overlay
      (getUserMedia)  (Human.js)     (5 sub-checks)  (blink/motion/   (UI layer)
                                                        depth)
                                           │
                                           ▼
                                    CaptureManager
                                    (state machine)
                                           │
                                           ▼
                                  BestFrameSelector
                                (ranks last 15 valid
                                     frames)
```

## Per-frame data flow

1. **`CameraManager.grabFrame()`** draws the current `<video>` frame onto an
   offscreen `<canvas>` (mirroring it first if front-facing).
2. **`HumanDetector.detect(canvas)`** runs Human.js face detection + mesh +
   iris, and normalizes the result into a flat `NormalizedFace` shape
   (confidence, box, mesh, annotations, rotation).
3. **`QualityService.evaluate(canvas, face, faceCount)`** crops to the face
   region and runs all five sub-detectors (`FaceValidator`, `PoseDetector`,
   `BrightnessDetector`, `BlurDetector`, `MotionDetector`), returning a
   composite score plus a `gates` object of individual pass/fail booleans.
4. **`PassiveLiveness.update(face, quality)`** feeds the frame's landmarks
   into the running session (blink/EAR tracking, pose-variation history,
   mesh depth-spread history).
5. **`Overlay.updateQuality(quality)`** updates the live status checklist and
   face-guide color/hint text.
6. **`CaptureManager.tick(canvas, quality, face)`** advances the auto-capture
   state machine: `searching → holding → counting-down → flashing → captured
   → preview`. Every gate in `quality.gates` must be true for the state
   machine to progress past `searching`; any gate failure resets it.
7. On capture, **`BestFrameSelector`** (populated with every valid frame seen
   during the `holding` phase) returns its highest-scoring buffered frame —
   not necessarily the literal frame that triggered the shutter — and
   **`PassiveLiveness.evaluate()`** computes the final cumulative liveness
   score for the `CaptureResult`.

## Why best-frame selection uses a rolling buffer

A single frame that happens to pass every gate at the instant the hold-timer
completes can still be marginal — a barely-open eye mid-blink, a tiny motion
blur that slipped under the threshold. By continuously buffering every frame
that *already* passed the gates during the hold period (default: last 15)
and re-ranking them by a weighted composite of blur/motion/brightness/
confidence/pose at the moment of capture, HumanCamJS captures the best
available evidence rather than the first acceptable one.

## Why liveness is session-cumulative, not single-frame

Signals like "natural head movement" and "did the user blink" are
meaningless on a single frame — they require observing change over time.
`PassiveLiveness` therefore accumulates pose and blink history across the
whole session (via `update()` on every tick) and only produces a final
score on `evaluate()`, called at the moment of capture. This is also why a
photo held up to the camera (no natural micro-movement, no blink, flat mesh
depth) scores low even though any single frame might individually "look"
fine.

## Extending HumanCamJS

Because every module is independently exported, you can:

- Swap `BlurDetector`'s scoring for a custom algorithm by subclassing and
  overriding `analyze()`.
- Run `QualityService` server-side (in a headless Canvas/Node environment)
  against uploaded images for backend-side re-validation.
- Replace `Overlay` entirely by passing `showUI: false` and building your own
  UI against `HumanCam`'s events (`'frame'`, `'captured'`, etc.).
- Add new quality dimensions by writing a new detector with an `analyze()`
  method returning `{ score, ...details }` and wiring it into
  `QualityService.evaluate()`.
