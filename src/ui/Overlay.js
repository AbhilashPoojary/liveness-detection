import { FaceGuide } from './FaceGuide.js';
import { ProgressRing } from './ProgressRing.js';
import { Countdown } from './Countdown.js';
import { Toast } from './Toast.js';
import { Preview } from './Preview.js';

const STATUS_ITEMS = [
  { key: 'faceDetected', label: 'Face detected' },
  { key: 'centered', label: 'Face centered' },
  { key: 'sizeOk', label: 'Good distance' },
  { key: 'brightnessOk', label: 'Good lighting' },
  { key: 'backgroundClear', label: 'Clear background' },
  { key: 'poseStraight', label: 'Looking straight' },
  { key: 'sharp', label: 'Sharp image' },
  { key: 'still', label: 'Hold still' },
];

/**
 * Overlay
 * -------------------------------------------------------------------------
 * The single top-level UI controller that composes every visual piece
 * (face guide, live status checklist, countdown, flash, toast, preview)
 * into the premium capture experience over the raw camera feed. Consumes
 * plain data from the HumanCam controller and has no knowledge of
 * Human.js/OpenCV/camera internals — a clean separation between "vision
 * pipeline" and "presentation".
 */
export class Overlay {
  /**
   * @param {HTMLElement} root - the `.humancam-root` element
   * @param {Object} callbacks
   * @param {() => void} callbacks.onSwitchCamera
   * @param {() => void} callbacks.onAccept
   * @param {() => void} callbacks.onRetry
   * @param {() => void} [callbacks.onManualCapture]
   */
  constructor(root, { onSwitchCamera, onAccept, onRetry, onManualCapture } = {}) {
    this.root = root;
    root.classList.add('hc-root');

    this.overlayEl = document.createElement('div');
    this.overlayEl.className = 'hc-overlay';
    root.appendChild(this.overlayEl);

    this._buildTopBar(onSwitchCamera);
    this._buildGuideArea();
    this._buildStatusList();
    this._buildBottomBar(onManualCapture);

    this.flashEl = document.createElement('div');
    this.flashEl.className = 'hc-flash';
    root.appendChild(this.flashEl);

    this.toast = new Toast(root);
    this.countdown = new Countdown(root);
    this.preview = new Preview(root, { onAccept, onRetry });
  }

  _buildTopBar(onSwitchCamera) {
    const bar = document.createElement('div');
    bar.className = 'hc-topbar';
    bar.innerHTML = `
      <span class="hc-badge">Verify Identity</span>
    `;
    const switchBtn = document.createElement('button');
    switchBtn.type = 'button';
    switchBtn.className = 'hc-icon-btn';
    switchBtn.setAttribute('aria-label', 'Switch camera');
    switchBtn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M4 4v5h5M20 20v-5h-5" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M20 9a8 8 0 00-14.9-3M4 15a8 8 0 0014.9 3" stroke-linecap="round"/>
      </svg>`;
    switchBtn.addEventListener('click', () => onSwitchCamera?.());
    bar.appendChild(switchBtn);
    this.overlayEl.appendChild(bar);
  }

  _buildGuideArea() {
    const guideArea = document.createElement('div');
    guideArea.style.cssText = 'position:relative; flex:1;';
    this.overlayEl.appendChild(guideArea);
    this.faceGuide = new FaceGuide(guideArea);
    this.progressRing = new ProgressRing(this.faceGuide.el);
  }

  _buildStatusList() {
    this.statusListEl = document.createElement('div');
    this.statusListEl.className = 'hc-status-list';
    this.statusListEl.innerHTML = STATUS_ITEMS.map(
      (item) => `
      <div class="hc-status-item" data-key="${item.key}">
        <span class="hc-status-dot"></span>
        <span>${item.label}</span>
      </div>`,
    ).join('');
    this.root.appendChild(this.statusListEl);
  }

  _buildBottomBar(onManualCapture) {
    const bar = document.createElement('div');
    bar.className = 'hc-bottombar';
    this.hintEl = document.createElement('div');
    this.hintEl.className = 'hc-shutter-hint';
    this.hintEl.textContent = 'Position your face in the frame';
    bar.appendChild(this.hintEl);
    this.overlayEl.appendChild(bar);

    if (onManualCapture) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'hc-icon-btn';
      btn.setAttribute('aria-label', 'Capture');
      btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="8"/></svg>';
      btn.addEventListener('click', () => onManualCapture());
      bar.appendChild(btn);
    }
  }

  /**
   * Push a fresh QualityService result into the UI.
   * @param {import('../quality/QualityService.js').QualityResult} quality
   */
  updateQuality(quality) {
    const gates = quality.gates;
    let okCount = 0;
    STATUS_ITEMS.forEach(({ key }) => {
      const ok = Boolean(gates[key]);
      if (ok) okCount++;
      const el = this.statusListEl.querySelector(`[data-key="${key}"]`);
      el?.classList.toggle('is-ok', ok);
    });

    let status = 'invalid';
    if (quality.passed) status = 'valid';
    else if (okCount >= Math.ceil(STATUS_ITEMS.length * 0.6)) status = 'warn';

    this.faceGuide.setState(status, 0);
    this.hintEl.textContent = this._hintFor(quality);
  }

  _hintFor(quality) {
    if (quality.passed) return 'Hold still…';
    const reasons = quality.face?.reasons || [];
    const messages = {
      no_face: 'Position your face in the frame',
      multiple_faces: 'Only one person should be in frame',
      not_centered: 'Center your face in the guide',
      too_far: 'Move closer',
      too_close: 'Move back a little',
      face_cropped: 'Fit your whole face in frame',
      eyes_not_visible: 'Make sure your eyes are visible',
      mouth_not_visible: 'Make sure your mouth is visible',
    };
    if (reasons.length) return messages[reasons[0]] || 'Adjust your position';
    if (!quality.gates.poseStraight) return 'Look straight at the camera';
    if (!quality.gates.brightnessOk) return quality.brightness.status === 'too_dark' ? 'Find better lighting' : 'Reduce bright light behind you';
    if (!quality.gates.backgroundClear) return this._backgroundHint(quality.background);
    if (!quality.gates.sharp) return 'Hold the camera steady';
    if (!quality.gates.still) return 'Hold still';
    return 'Adjust your position';
  }

  _backgroundHint(background) {
    const messages = {
      busy_background: 'Use a plain background',
      bright_background: 'Move away from bright windows',
      high_contrast_background: 'Use an evenly lit background',
      no_background: 'Keep some plain space behind you',
    };
    return messages[background?.reason] || 'Use a clear background';
  }

  /** @param {number} percent 0-100 hold-still progress */
  updateProgress(percent) {
    this.faceGuide.progressCircle.style.strokeDashoffset = String(
      2 * Math.PI * 46 * (1 - percent / 100),
    );
    this.progressRing.update(percent);
    if (percent >= 100) this.hintEl.textContent = 'Capturing…';
  }

  showCountdown(value) {
    this.countdown.show(value);
  }

  triggerFlash() {
    this.flashEl.classList.remove('is-flashing');
    // Force reflow so the animation restarts if triggered twice quickly.
    void this.flashEl.offsetWidth;
    this.flashEl.classList.add('is-flashing');
  }

  showPreview(imageDataUrl) {
    this.preview.show(imageDataUrl);
  }

  hidePreview() {
    this.preview.hide();
  }

  showToast(message, tone, duration) {
    this.toast.show(message, tone, duration);
  }

  showFallback({ title, text }) {
    this.hideFallback();
    this.fallbackEl = document.createElement('div');
    this.fallbackEl.className = 'hc-fallback';
    this.fallbackEl.innerHTML = `
      <div class="hc-fallback-title">${title}</div>
      <div class="hc-fallback-text">${text}</div>
    `;
    this.root.appendChild(this.fallbackEl);
  }

  hideFallback() {
    this.fallbackEl?.remove();
    this.fallbackEl = null;
  }

  destroy() {
    this.faceGuide.destroy();
    this.progressRing.destroy();
    this.toast.destroy();
    this.countdown.destroy();
    this.preview.destroy();
    this.overlayEl.remove();
    this.flashEl.remove();
    this.statusListEl.remove();
    this.fallbackEl?.remove();
  }
}

export default Overlay;
