# Browser Compatibility

HumanCamJS relies on: `getUserMedia`, WebGL (for Human.js's TensorFlow.js
backend), Canvas 2D, and ES modules. All are broadly supported in current
evergreen browsers.

| Browser | Minimum version | Notes |
|---|---|---|
| Chrome / Edge (desktop & Android) | 90+ | Full support, best performance (WebGL backend) |
| Safari (macOS) | 15+ | Full support |
| Safari (iOS) | 15+ | Camera access requires a user-gesture-initiated `start()`; see [Troubleshooting](troubleshooting.md#ios-safari-specific-issues) |
| Firefox (desktop & Android) | 90+ | Full support |
| Samsung Internet | 15+ | Full support |

## Required browser APIs

- `navigator.mediaDevices.getUserMedia`
- `navigator.mediaDevices.enumerateDevices` (for camera switching)
- WebGL 1/2 (Human.js will fall back to a slower CPU/WASM backend if WebGL
  is unavailable, but this is not recommended for production auto-capture
  frame rates)
- `HTMLCanvasElement.toDataURL`
- ES2020 module syntax (optional chaining, nullish coalescing)

## Known limitations

- **In-app browsers** (Instagram, TikTok, Facebook's embedded WebView, etc.)
  frequently restrict or entirely block camera access regardless of HTTPS —
  this is a platform limitation, not something HumanCamJS can work around.
  Detect these environments and prompt users to open the link in their
  default browser.
- **Older Android WebViews** (pre-Chrome 90 system WebView) may lack modern
  WebGL support; Human.js will be slow or fail to initialize.
- **Desktop Linux Firefox** occasionally reports incorrect device labels
  from `enumerateDevices()` before permission is granted — HumanCamJS
  refreshes the device list automatically once the stream starts.

## Testing matrix recommendation

For KYC-grade production deployments, we recommend validating on:
1. Chrome (desktop + Android) — primary target, highest performance
2. Safari (iOS) — strictest permission model, most likely to surface edge cases
3. Firefox (desktop) — different WebGL/TF.js backend behavior
4. One low-end Android device — validates `detectionIntervalMs` and
   `resolution` defaults are reasonable for weaker GPUs
