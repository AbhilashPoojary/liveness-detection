/**
 * ProgressRing
 * -------------------------------------------------------------------------
 * Small numeric readout that accompanies FaceGuide's SVG ring, showing the
 * live hold-still percentage (e.g. "64%") near the top of the guide.
 * Kept as its own module so integrators can reposition/restyle or omit it
 * independently of the SVG ring itself.
 */
export class ProgressRing {
  /** @param {HTMLElement} container */
  constructor(container) {
    this.el = document.createElement('div');
    this.el.className = 'hc-progress-label hc-score-mono';
    this.el.style.cssText = `
      position: absolute; top: -8px; left: 50%; transform: translateX(-50%);
      font-size: 11px; color: var(--status-color, var(--hc-text-dim));
      background: rgba(0,0,0,0.35); padding: 2px 8px; border-radius: 999px;
      opacity: 0; transition: opacity 0.2s ease;
    `;
    container.appendChild(this.el);
  }

  /** @param {number} percent 0-100 */
  update(percent) {
    this.el.textContent = `${Math.round(percent)}%`;
    this.el.style.opacity = percent > 0 && percent < 100 ? '1' : '0';
  }

  hide() {
    this.el.style.opacity = '0';
  }

  destroy() {
    this.el.remove();
  }
}

export default ProgressRing;
