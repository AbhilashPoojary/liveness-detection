# Troubleshooting

## Camera won't start / blank video

- **Check you're on HTTPS or localhost.** Browsers block `getUserMedia` on
  plain HTTP for any origin other than `localhost`.
- **Check permission state.** If the user previously denied camera access,
  most browsers won't re-prompt — they must reset it manually in site
  settings. Listen for `'permission-denied'` and show instructions.
- **Check for another app/tab holding the camera.** This surfaces as an
  `error` event with `code: 'CAMERA_IN_USE'`.

## `NotAllowedError` / permission denied every time

Some browsers (notably Safari in certain privacy modes) require
`camera.start()` to be called synchronously from within a user gesture
handler (a click), not after an `await` chain or on page load. Trigger
`start()` directly inside a button's `click` listener.

## Face detected but quality score never reaches 100

Remember: the composite `score` and the `passed` boolean are independent.
`passed` requires *every* gate in `quality.gates` to be `true` — a single
failing gate (e.g. `still: false` because of hand shake) will block capture
even if the composite score is high. Inspect `quality.gates` and
`quality.face.reasons` to see exactly which check is blocking capture; the
built-in UI already surfaces this as a human-readable hint under the guide.

## Auto capture feels too slow / too fast

Tune `holdDurationMs` (default 800ms) and `detectionIntervalMs` (default
90ms) — see [Configuration](configuration.md#capture-timing).

## Blur scores look inconsistent between browsers/devices

`BlurDetector` prefers OpenCV.js (loaded lazily from a CDN) but falls back
to a pure-JS Laplacian implementation if OpenCV.js fails to load — the two
implementations can produce slightly different absolute variance numbers
(same algorithm, different numerical backends). If you need bit-identical
scoring across environments, force one path:

```javascript
// Force JS fallback everywhere for consistency:
const camera = new HumanCam({ container: '#camera', loadOpenCV: false });
```

## OpenCV.js fails to load / CSP errors in the console

This is expected to fail silently — `BlurDetector.loadOpenCV()` catches the
error and the SDK continues using its JS fallback automatically. If your CSP
blocks `docs.opencv.org`, either self-host `opencv.js` and pass a custom URL
to `loadOpenCV(customUrl)`, or set `loadOpenCV: false` to skip the attempt
entirely and always use the fallback.

## High CPU/GPU usage on low-end devices

- Increase `detectionIntervalMs` (e.g. 150-200ms) to reduce detection
  frequency.
- Lower `resolution` (e.g. `{width: 640, height: 480}`).
- Set `bestFrame: false` if you don't need multi-frame comparison (reduces
  per-frame buffering overhead).

## Models fail to load / stuck on "loading"

Human.js loads its models from `modelBasePath` (configured in
`HumanDetector`, defaulting to Vladmandic's GitHub Pages model host). If your
network blocks that host, self-host the Human.js model files and pass a
custom `modelBasePath` via the `HumanDetector` constructor (advanced usage —
construct a custom `HumanDetector` and pass it into a hand-assembled
pipeline, since `HumanCam` doesn't currently expose this as a top-level
option).

## iOS Safari specific issues

- Camera access must start from a user gesture (see above).
- `playsInline` must be set on the video element — HumanCamJS already sets
  this internally, but if you're building custom UI around the raw
  `<video>` element, make sure you don't remove it.
- Very old iOS versions may not support `facingMode: {ideal: 'environment'}`
  reliably; HumanCamJS falls back gracefully but rear-camera selection may
  be inconsistent on hardware from before iOS 14.

## Still stuck?

Open an issue with: browser + OS version, the `error` event payload (if
any), and whether the problem reproduces in the bundled `demo/` app.
