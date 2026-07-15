# Example Integrations

## 1. Basic auto-capture flow

```javascript
import { HumanCam } from 'humancamjs';
import 'humancamjs/styles';

const camera = new HumanCam({ container: '#camera' });
await camera.start();

camera.on('accepted', (result) => {
  fetch('/api/kyc/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: result.image, qualityScore: result.qualityScore }),
  });
});
```

## 2. Manual capture (no auto-fire)

```javascript
const camera = new HumanCam({ container: '#camera', autoCapture: false });
await camera.start();
// Built-in UI shows a manual shutter button when autoCapture is false.

document.getElementById('external-shutter').addEventListener('click', () => {
  camera.captureNow();
});
```

## 3. Rear camera for document capture

```javascript
const camera = new HumanCam({
  container: '#doc-camera',
  camera: 'rear',
  resolution: { width: 1920, height: 1080 },
  passiveLiveness: false, // not relevant for document capture
});
await camera.start();
```

## 4. Fully custom UI (headless mode)

```javascript
const camera = new HumanCam({ container: '#camera', showUI: false });

camera.on('frame', ({ quality, face }) => {
  myCustomProgressBar.style.width = `${quality.score}%`;
  myCustomFaceOutline.classList.toggle('valid', quality.passed);
});

camera.on('captured', (result) => {
  myCustomPreviewModal.open(result.image);
});

await camera.start();
```

## 5. Reacting to camera errors gracefully

```javascript
camera.on('error', ({ code, message }) => {
  switch (code) {
    case 'PERMISSION_DENIED':
      showBanner('Please allow camera access to continue verification.');
      break;
    case 'NO_CAMERA':
      showBanner('No camera detected. You can upload a photo instead.');
      revealUploadFallback();
      break;
    case 'CAMERA_IN_USE':
      showBanner('Your camera is being used by another app. Close it and retry.');
      break;
    default:
      showBanner(message);
  }
});
```

## 6. Switching cameras with a custom button

```javascript
document.getElementById('flip-camera').addEventListener('click', () => {
  camera.switchCamera();
});
```

## 7. Running the quality engine standalone (e.g. server-side re-check)

```javascript
import { QualityService, HumanDetector } from 'humancamjs';

const detector = new HumanDetector();
await detector.load();
const quality = new QualityService();
await quality.loadOpenCV();

async function scoreUploadedImage(canvas) {
  const { face, faceCount } = await detector.detect(canvas);
  return quality.evaluate(canvas, face, faceCount);
}
```

## 8. Cleaning up in a single-page app

```javascript
function CameraStep({ onDone }) {
  const ref = useRef(null);
  useEffect(() => {
    const camera = new HumanCam({ container: ref.current });
    camera.onCapture((r) => onDone(r));
    camera.start();
    return () => camera.destroy(); // release camera + GPU on navigation away
  }, []);
  return <div ref={ref} />;
}
```
