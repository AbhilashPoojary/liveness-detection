# Configuration Guide

Most integrators only need the top-level `HumanCam` options (see
[API Reference](api.md)). This guide covers deeper tuning of the individual
quality and liveness detectors for teams that need to match a specific
compliance bar or camera hardware profile.

## Quality engine weights

`QualityService` combines five sub-scores into one composite 0-100 score.
Defaults:

```javascript
{
  face: 0.3,        // centering, size, cropping, eyes/mouth visible
  pose: 0.2,        // yaw/pitch/roll
  brightness: 0.2,  // luminance band
  blur: 0.2,         // Laplacian variance sharpness
  motion: 0.1,       // frame-to-frame stillness
}
```

Pass custom weights (they don't need to sum to 1 — they're used as relative
ratios):

```javascript
import { QualityService } from 'humancamjs';

const quality = new QualityService({
  weights: { face: 0.4, pose: 0.15, brightness: 0.15, blur: 0.25, motion: 0.05 },
});
```

**Important:** the composite *score* is separate from the hard *gates* used
to permit auto capture (`result.gates`, `result.passed`). Adjusting weights
changes the 0-100 number shown in UI/telemetry; it does **not** relax which
frames are allowed to be captured. To relax/tighten gating itself, configure
the individual sub-detectors below.

## Sub-detector options

### `FaceValidator` (framing/structure gates)

```javascript
new FaceValidator({
  minFaceRatio: 0.22,      // face width ÷ frame width, lower bound
  maxFaceRatio: 0.75,      // upper bound
  maxCenterOffset: 0.15,   // max face-center deviation from frame center (fraction)
  edgeMargin: 0.02,        // required clearance from frame edges to avoid "cropped" flag
});
```

### `PoseDetector` (head angle gates)

```javascript
new PoseDetector({
  maxYaw: 15,   // degrees
  maxPitch: 15,
  maxRoll: 15,
});
```

### `BrightnessDetector`

```javascript
new BrightnessDetector({
  idealMin: 90,   // luminance 0-255
  idealMax: 180,
  sampleStep: 4,  // pixel sampling stride (higher = faster, less precise)
});
```

### `BlurDetector`

```javascript
new BlurDetector({
  sharpThreshold: 150,  // Laplacian variance considered "fully sharp" (score 100)
  blurryThreshold: 20,  // variance considered unusably blurry (score 0)
});
```

Lower `sharpThreshold` for lower-quality webcams that rarely hit high
variance values; raise it for high-res KYC flows that need very crisp
document-style photos.

### `BackgroundDetector`

```javascript
new BackgroundDetector({
  maxEdgeDensity: 0.12,       // higher values allow busier backgrounds
  maxContrast: 52,            // background luminance contrast
  maxOverexposedRatio: 0.08,  // bright-window / blown-out area tolerance
  minScore: 70,               // minimum 0-100 clarity score
});
```

Lower these thresholds when you need a plain wall-style capture background.
Raise them if the SDK is used in normal home/office rooms where a small
amount of background detail is acceptable.

### `MotionDetector`

```javascript
new MotionDetector({
  downsampleSize: 64,        // px, diffing resolution (perf/accuracy tradeoff)
  stillThreshold: 4,          // mean abs pixel diff considered "still"
  highMotionThreshold: 25,    // diff considered high motion
});
```

## Passing sub-detector config through `QualityService`

```javascript
const quality = new QualityService({
  minResolutionWidth: 640,
  face: { minFaceRatio: 0.25, maxCenterOffset: 0.12 },
  pose: { maxYaw: 12, maxPitch: 12, maxRoll: 10 },
  brightness: { idealMin: 100, idealMax: 170 },
  blur: { sharpThreshold: 180 },
  background: { maxEdgeDensity: 0.1, maxOverexposedRatio: 0.06 },
  motion: { stillThreshold: 3 },
});
```

## Capture timing

```javascript
new HumanCam({
  holdDurationMs: 800,  // ms quality must hold green before countdown starts
  countdown: 3,          // seconds
  detectionIntervalMs: 90, // frame processing cadence
});
```

Lower `detectionIntervalMs` for smoother UI feedback at the cost of more
CPU/GPU usage; 90-120ms is a good balance on mid-range mobile devices.

## Best-frame selection weights

```javascript
import { BestFrameSelector } from 'humancamjs';

new BestFrameSelector({
  bufferSize: 15,
  weights: { blur: 0.35, motion: 0.2, brightness: 0.15, confidence: 0.15, pose: 0.15 },
});
```

## Passive liveness tuning

```javascript
import { PassiveLiveness } from 'humancamjs';

new PassiveLiveness({
  sessionWindow: 90,      // pose samples retained for movement analysis
  minYawVariation: 1.5,   // degrees; below this looks like a static photo
  maxYawVariation: 25,    // degrees; above this looks erratic/unnatural
  passScore: 70,          // 0-100 threshold for `passed`
});
```

`BlinkDetector`'s EAR (Eye Aspect Ratio) threshold can also be tuned
directly if you're constructing it standalone:

```javascript
import { BlinkDetector } from 'humancamjs';

new BlinkDetector({
  earThreshold: 0.21,       // EAR below this = eye closed
  consecutiveFrames: 2,     // frames required to register a blink
});
```
