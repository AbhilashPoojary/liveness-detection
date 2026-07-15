# API Reference

## `new HumanCam(options)`

| Option | Type | Default | Description |
|---|---|---|---|
| `container` | `string \| HTMLElement` | *required* | CSS selector or element to mount into |
| `camera` | `'front' \| 'rear'` | `'front'` | Initial camera facing |
| `resolution` | `{width, height}` | `{1280, 720}` | Ideal capture resolution |
| `autoCapture` | `boolean` | `true` | Auto-fire the shutter once quality gates pass |
| `passiveLiveness` | `boolean` | `true` | Enable the passive liveness engine |
| `qualityCheck` | `boolean` | `true` | Enforce quality gates before capture. When `false`, quality is still computed for UI/telemetry but does not block capture |
| `bestFrame` | `boolean` | `true` | Buffer & select the sharpest of the last 15 valid frames |
| `countdown` | `number` | `3` | Countdown seconds before capture |
| `holdDurationMs` | `number` | `800` | How long quality must hold before the countdown starts |
| `detectionIntervalMs` | `number` | `90` | Ms between detection ticks (~11fps default) |
| `loadOpenCV` | `boolean` | `true` | Attempt to load OpenCV.js for blur scoring (falls back to JS automatically) |
| `opencvUrl` | `string` | `https://docs.opencv.org/4.x/opencv.js` | Script URL used when `loadOpenCV` is enabled |
| `modelBasePath` | `string` | `https://vladmandic.github.io/human-models/models/` | Human.js model directory; set this to a self-hosted path for offline/CSP-restricted deployments |
| `humanConfig` | `object|null` | `null` | Additional Human.js config overrides passed to `HumanDetector` |
| `quality` | `object|null` | `null` | `QualityService` options for tuning face, pose, brightness, blur, motion, and score weights |
| `liveness` | `object|null` | `null` | `PassiveLiveness` options for tuning pass score, signal weights, blink baseline, and movement sensitivity |
| `minResolutionWidth` | `number` | `480` | Minimum capture width to pass the resolution gate |
| `showUI` | `boolean` | `true` | Render the built-in overlay UI (set `false` to build fully custom UI against the events) |

## Instance methods

### `await camera.start()`
Requests camera permission, loads Human.js models, and begins the
detection/quality/capture loop. Must be called after a user gesture on iOS
Safari.

### `camera.onCapture(handler)`
Shorthand for `camera.on('captured', handler)`. Fires with a
[`CaptureResult`](#captureresult) every time the shutter fires (before
accept/retry).

### `camera.captureNow()`
Manually trigger a capture immediately, bypassing the hold/countdown flow.
Useful when `autoCapture: false`.

### `await camera.switchCamera()`
Toggle between front and rear cameras.

### `camera.stop()`
Stop the detection loop and release the camera stream (keeps the instance
alive — call `start()` again to resume).

### `camera.destroy()`
Fully tear down: stop the loop, release the camera, dispose Human.js/GPU
resources, remove all DOM nodes, and clear all event listeners. Call this on
unmount.

## Events

`HumanCam` extends a minimal `EventEmitter`. Subscribe with
`camera.on(event, handler)`, which returns an unsubscribe function.

| Event | Payload | Description |
|---|---|---|
| `'started'` | — | Camera + models ready, loop running |
| `'frame'` | `{ quality, face, faceCount }` | Fires every detection tick |
| `'captured'` | `CaptureResult` | Shutter fired (best frame chosen) |
| `'accepted'` | `CaptureResult` | User accepted the preview (built-in UI) or you called `capture.accept()` |
| `'retried'` | — | User rejected the preview and the session reset |
| `'error'` | `{code, message, original}` | Camera/hardware error |
| `'stopped'` | — | Camera stream released |

## `CaptureResult`

```typescript
{
  success: boolean;
  image: string;              // base64 JPEG data URL
  qualityScore: number;       // 0-100, from the best selected frame
  livenessScore: number|null; // 0-100, cumulative session liveness score
  livenessPassed: boolean|null;
  faceConfidence: number;     // 0-100
  brightness: number;         // average luminance 0-255
  blurScore: number;          // Laplacian variance (higher = sharper)
  backgroundScore: number|null; // 0-100 background clarity score
  backgroundClear: boolean|null;
  backgroundReason: string|null; // e.g. busy_background, bright_background
  yaw: number;                // degrees
  pitch: number;              // degrees
  roll: number;                // degrees
  width: number;
  height: number;
  timestamp: string;          // ISO 8601
  framesConsidered: number;   // how many buffered frames the best-frame selector compared
  livenessSignals: object|null; // breakdown: blink count, movement/eye/depth sub-scores
}
```

## Advanced: using modules independently

Every internal module is exported from the package root for advanced use
cases (e.g. running quality scoring on server-uploaded images, or building a
fully custom UI):

```javascript
import { QualityService, HumanDetector, PassiveLiveness } from 'humancamjs';

const detector = new HumanDetector();
await detector.load();

const quality = new QualityService();
await quality.loadOpenCV();

const { face, faceCount } = await detector.detect(someCanvas);
const result = quality.evaluate(someCanvas, face, faceCount);
console.log(result.score, result.passed, result.gates);
```

See [Architecture](architecture.md) for the full module map and
[Configuration](configuration.md) for tuning each detector's thresholds.
