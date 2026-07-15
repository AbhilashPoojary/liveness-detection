/**
 * Countdown
 * -------------------------------------------------------------------------
 * Renders the animated "3 / 2 / 1" overlay shown just before capture.
 */
export class Countdown {
  /** @param {HTMLElement} container */
  constructor(container) {
    this.el = document.createElement('div');
    this.el.className = 'hc-countdown';
    container.appendChild(this.el);
  }

  /** @param {number} value - 0 hides the countdown, 1-N shows the number */
  show(value) {
    if (!value || value <= 0) {
      this.el.innerHTML = '';
      return;
    }
    // Re-create the node each tick so the CSS pop animation restarts.
    this.el.innerHTML = `<div class="hc-countdown-num">${value}</div>`;
  }

  clear() {
    this.el.innerHTML = '';
  }

  destroy() {
    this.el.remove();
  }
}

export default Countdown;
