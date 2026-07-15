# HumanCamJS

**Enterprise-grade webcam capture & passive liveness SDK, 100% client-side.**

HumanCamJS gives you a FaceTec/iProov-style guided face capture experience —
live quality scoring, auto capture, best-frame selection, and deterministic
passive liveness — built entirely on open-source technology
([Human.js](https://github.com/vladmandic/human) for face detection/mesh,
[OpenCV.js](https://docs.opencv.org/) for blur analysis) with **no backend
and no frame ever leaving the browser.**

```javascript
import { HumanCam } from 'humancamjs';
import 'humancamjs/styles';

const camera = new HumanCam({
  container: '#camera',
  autoCapture: true,
  passiveLiveness: true,
  qualityCheck: true,
  bestFrame: true,
  countdown: 3,
  camera: 'front',
});

await camera.start();

camera.onCapture((result) => {
  console.log(result);
  // { success: true, image: "data:image/jpeg;base64,...", qualityScore: 97,
  //   livenessScore: 91, faceConfidence: 99.2, brightness: 86, blurScore: 522,
  //   yaw: 1, pitch: -2, roll: 0, width: 1280, height: 720, timestamp: "..." }
});
```

---

## Why HumanCamJS

Commercial KYC/eKYC face-capture SDKs (FaceTec, iProov, DigiLocker-style
identity flows) all share the same product shape: guide the user into a good
photo, refuse to capture anything blurry/dark/off-angle, and add a passive
liveness signal to make spoofing harder. HumanCamJS implements that shape
using transparent, inspectable, deterministic logic — every quality and
liveness check is documented math, not an opaque black box.

- 📷 Front/rear camera, HD capture, mirrored preview, responsive layout
- 🧠 Human.js face detection, 468-pt mesh, iris, and head-pose estimation
- 📊 A 0–100 quality engine covering framing, pose, brightness, blur, motion
- 🎯 Auto capture that only fires once every quality gate passes
- 🏆 Best-frame selection across the last 15 valid frames, not just frame #1
- 👁️ Deterministic passive liveness (blink/EAR, natural micro-movement, mesh
  depth) — no secondary "AI liveness model" black box
- 🎨 A premium, glassmorphic dark-mode capture UI out of the box
- 🧩 Modular architecture — use the whole `HumanCam` controller, or import
  individual pieces (`QualityService`, `BlinkDetector`, etc.) directly

## Install

```bash
npm install
npm run dev
```

See [`docs/installation.md`](docs/installation.md) for full setup details,
including framework integration notes.

## Documentation

| Guide | Description |
|---|---|
| [Installation](docs/installation.md) | Setup, requirements, framework notes |
| [API Reference](docs/api.md) | Full `HumanCam` API, options, events, result shape |
| [Configuration](docs/configuration.md) | Tuning quality/liveness thresholds |
| [Architecture](docs/architecture.md) | Module map and data flow |
| [Examples](docs/examples.md) | Common integration patterns |
| [Troubleshooting](docs/troubleshooting.md) | Common errors and fixes |
| [Browser Compatibility](docs/browser-compatibility.md) | Supported browsers/devices |

## Project Structure

```
HumanCamJS/
  src/
    camera/     CameraManager, CameraDevice     — getUserMedia lifecycle
    detector/   HumanDetector                    — Human.js wrapper
    quality/    QualityService + 5 sub-detectors  — 0-100 frame scoring
    liveness/   PassiveLiveness, BlinkDetector    — deterministic liveness
    capture/    CaptureManager, BestFrameSelector — auto-capture state machine
    ui/         Overlay, FaceGuide, Countdown...  — presentation layer
    utils/      EventEmitter, RingBuffer, math    — shared helpers
    styles/     humancam.css                      — design tokens & components
    HumanCam.js — public controller composing all of the above
    index.js    — package entry point
  demo/         — runnable Vite demo app
  docs/         — full documentation set
```

## How auto capture works

```
face detected → all quality gates pass → hold still (configurable ms)
   → 3, 2, 1 countdown → flash → best frame chosen from buffer → preview
   → accept / retry
```

No frame is ever captured until **every** quality gate is green — single
face, centered, correctly sized, uncropped, eyes/mouth visible, straight
pose, good brightness, sharp, and still.

## License

MIT
"# liveness-detection" 
