/**
 * Toast
 * -------------------------------------------------------------------------
 * Small, transient status message shown at the top of the capture view
 * (e.g. "Move closer", "Camera unavailable"). Auto-dismisses.
 */
export class Toast {
  /** @param {HTMLElement} container */
  constructor(container) {
    this.el = document.createElement('div');
    this.el.className = 'hc-toast';
    container.appendChild(this.el);
    this._hideTimer = null;
  }

  /**
   * @param {string} message
   * @param {'info'|'warn'|'danger'} [tone='info']
   * @param {number} [durationMs=2200]
   */
  show(message, tone = 'info', durationMs = 2200) {
    clearTimeout(this._hideTimer);
    this.el.textContent = message;
    this.el.className = `hc-toast is-visible ${tone !== 'info' ? `tone-${tone}` : ''}`.trim();
    this._hideTimer = setTimeout(() => this.hide(), durationMs);
  }

  hide() {
    this.el.classList.remove('is-visible');
  }

  destroy() {
    clearTimeout(this._hideTimer);
    this.el.remove();
  }
}

export default Toast;
