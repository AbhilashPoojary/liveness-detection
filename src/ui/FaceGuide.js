const SVG_NS = 'http://www.w3.org/2000/svg';
const RADIUS = 46; // percent-space radius used for the progress ring path length calc
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * FaceGuide
 * -------------------------------------------------------------------------
 * Renders the animated oval face guide + surrounding progress ring as SVG.
 * Purely presentational — driven entirely by `setState()` calls from the
 * Overlay/HumanCam controller.
 */
export class FaceGuide {
  /** @param {HTMLElement} container */
  constructor(container) {
    this.container = container;
    this.el = this._build();
    container.appendChild(this.el);
  }

  _build() {
    const wrap = document.createElement('div');
    wrap.className = 'hc-guide-wrap';
    wrap.innerHTML = `
      <svg class="hc-guide-svg" viewBox="0 0 100 128" fill="none">
        <ellipse class="hc-guide-oval" cx="50" cy="60" rx="42" ry="56" />
        <circle class="hc-guide-sweep" cx="50" cy="60" r="${RADIUS}"
          stroke-dasharray="${CIRCUMFERENCE * 0.18} ${CIRCUMFERENCE}" />
        <circle class="hc-guide-ring" cx="50" cy="60" r="${RADIUS}" />
        <circle class="hc-guide-progress" cx="50" cy="60" r="${RADIUS}"
          stroke-dasharray="${CIRCUMFERENCE}" stroke-dashoffset="${CIRCUMFERENCE}" />
      </svg>
    `;
    this.progressCircle = wrap.querySelector('.hc-guide-progress');
    return wrap;
  }

  /**
   * @param {'valid'|'warn'|'invalid'} status
   * @param {number} progressPercent - 0-100 hold-still progress
   */
  setState(status, progressPercent = 0) {
    this.container.classList.remove('state-valid', 'state-warn', 'state-invalid');
    this.container.classList.add(`state-${status}`);
    const offset = CIRCUMFERENCE * (1 - progressPercent / 100);
    this.progressCircle.style.strokeDashoffset = String(offset);
  }

  destroy() {
    this.el.remove();
  }
}

export default FaceGuide;
