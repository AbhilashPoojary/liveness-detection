import '../src/styles/humancam.css';
import { HumanCam } from '../src/index.js';

const resultEmpty = document.getElementById('result-empty');
const resultPanel = document.getElementById('result-panel');
const resultImage = document.getElementById('result-image');
const jsonEl = document.getElementById('result-json');

const metricEls = {
  quality: document.getElementById('m-quality'),
  liveness: document.getElementById('m-liveness'),
  confidence: document.getElementById('m-confidence'),
  brightness: document.getElementById('m-brightness'),
  blur: document.getElementById('m-blur'),
  pose: document.getElementById('m-pose'),
  resolution: document.getElementById('m-resolution'),
  timestamp: document.getElementById('m-timestamp'),
};

const toggleAuto = document.getElementById('toggle-auto');
const toggleLiveness = document.getElementById('toggle-liveness');
const toggleBestFrame = document.getElementById('toggle-bestframe');
const restartBtn = document.getElementById('btn-restart');

let camera = null;

function renderResult(result) {
  resultEmpty.hidden = true;
  resultPanel.hidden = false;
  resultImage.src = result.image;
  metricEls.quality.textContent = result.qualityScore ?? '—';
  metricEls.liveness.textContent = result.livenessScore ?? '—';
  metricEls.confidence.textContent = result.faceConfidence != null ? `${result.faceConfidence}%` : '—';
  metricEls.brightness.textContent = result.brightness ?? '—';
  metricEls.blur.textContent = result.blurScore ?? '—';
  metricEls.pose.textContent = `${result.yaw}° / ${result.pitch}° / ${result.roll}°`;
  metricEls.resolution.textContent = `${result.width} × ${result.height}`;
  metricEls.timestamp.textContent = new Date(result.timestamp).toLocaleTimeString();

  const { image, ...withoutImage } = result;
  jsonEl.textContent = JSON.stringify(withoutImage, null, 2);
}

async function boot() {
  camera = new HumanCam({
    container: '#camera',
    autoCapture: toggleAuto.checked,
    passiveLiveness: toggleLiveness.checked,
    qualityCheck: true,
    quality: {
      brightness: { idealMin: 45, idealMax: 235 },
      blur: { sharpThreshold: 140, blurryThreshold: 25 },
      motion: { stillThreshold: 6, highMotionThreshold: 32 },
      face: { minFaceRatio: 0.14, maxCenterOffset: 0.22 },
      background: {
        maxEdgeDensity: 0.1,
        maxContrast: 48,
        maxOverexposedRatio: 0.06,
        minScore: 72,
      },
    },
    bestFrame: toggleBestFrame.checked,
    countdown: 3,
    camera: 'front',
  });

  camera.onCapture((result) => {
    renderResult(result);
  });

  camera.on('error', (err) => {
    console.error('[demo] camera error:', err);
  });

  try {
    await camera.start();
  } catch (err) {
    console.error('[demo] failed to start camera:', err);
  }
}

async function restart() {
  camera?.destroy();
  resultPanel.hidden = true;
  resultEmpty.hidden = false;
  await boot();
}

restartBtn.addEventListener('click', restart);
[toggleAuto, toggleLiveness, toggleBestFrame].forEach((el) => el.addEventListener('change', restart));

boot();
