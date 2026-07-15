# Installation

## Requirements

- Node.js 18+ and npm (for the dev/build tooling)
- A modern browser with `getUserMedia` support (see
  [Browser Compatibility](browser-compatibility.md))
- **HTTPS or `localhost`** — browsers block camera access on plain HTTP

## Quick start (demo app)

```bash
git clone <your-fork-or-copy-of-this-repo>
cd HumanCamJS
npm install
npm run dev
```

This starts the Vite dev server (default `http://localhost:5173`) serving
`demo/index.html`, a fully working reference implementation.

```bash
npm run build    # production build -> dist/
npm run preview  # preview the production build locally
```

## Using HumanCamJS in your own project

### 1. Copy or install the package

If you're consuming this as a local package, install it from your monorepo
or copy the `src/` directory into your project and import from `src/index.js`.
If publishing to a private/public registry, `npm install humancamjs`.

### 2. Import the controller and styles

```javascript
import { HumanCam } from 'humancamjs';
import 'humancamjs/styles'; // src/styles/humancam.css
```

### 3. Add a container element

```html
<div id="camera"></div>
```

The container should have a defined width (HumanCamJS handles its own
aspect ratio and responsive breakpoints — see `humancam.css`).

### 4. Initialize and start

```javascript
const camera = new HumanCam({ container: '#camera' });
await camera.start(); // must be called from a user gesture on iOS Safari
```

> **iOS Safari note:** camera access must be initiated by a direct user
> interaction (a click/tap handler), not on page load. Wrap `camera.start()`
> in a button click handler for iOS compatibility.

## Dependencies

| Package | Purpose | Loaded via |
|---|---|---|
| `@vladmandic/human` | Face detection, mesh, iris, pose | npm (bundled) |
| OpenCV.js | Laplacian-variance blur scoring | Lazy-loaded from CDN at runtime; automatic pure-JS fallback if unavailable |

OpenCV.js is intentionally **not** bundled via npm — its WASM binary is
large, and HumanCamJS only needs one function (`Laplacian` + `meanStdDev`).
`BlurDetector.loadOpenCV()` loads it from `https://docs.opencv.org/4.x/opencv.js`
on demand; if that fails (offline, CSP-blocked, corporate proxy, etc.) the
SDK transparently falls back to an equivalent hand-written JS
implementation — blur detection never hard-fails.

If your CSP blocks third-party scripts, either:
- Self-host `opencv.js` and pass a custom URL: `new HumanCam({ container: '#camera', opencvUrl: '/vendor/opencv.js' })`, or
- Set `loadOpenCV: false` in `HumanCam` options to always use the JS fallback.

Human.js model files also load from a public model directory by default. For
offline or locked-down deployments, self-host the Human.js models and point
the SDK at them:

```javascript
new HumanCam({
  container: '#camera',
  modelBasePath: '/vendor/human-models/',
});
```

## Framework integration notes

HumanCamJS is framework-agnostic vanilla JS/ES modules. It manages its own
DOM inside the container you provide, so it works unmodified inside React,
Vue, Svelte, etc. — treat it like any other imperative widget:

```javascript
// React example (pseudo-code, not part of this package)
useEffect(() => {
  const camera = new HumanCam({ container: containerRef.current });
  camera.start();
  return () => camera.destroy();
}, []);
```

Always call `camera.destroy()` on unmount to release the camera stream and
GPU (WebGL/TF.js) resources.
