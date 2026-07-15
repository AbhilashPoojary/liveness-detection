/**
 * Preview
 * -------------------------------------------------------------------------
 * Post-capture review screen: shows the captured image full-bleed with
 * Accept / Retry actions.
 */
export class Preview {
  /**
   * @param {HTMLElement} container
   * @param {Object} callbacks
   * @param {() => void} callbacks.onAccept
   * @param {() => void} callbacks.onRetry
   */
  constructor(container, { onAccept, onRetry }) {
    this.container = container;
    this.onAccept = onAccept;
    this.onRetry = onRetry;
    this.el = null;
  }

  /** @param {string} imageDataUrl */
  show(imageDataUrl) {
    this.el = document.createElement('div');
    this.el.className = 'hc-preview';
    this.el.innerHTML = `
      <img class="hc-preview-image" src="${imageDataUrl}" alt="Captured photo preview" />
      <div class="hc-preview-actions">
        <button type="button" class="hc-btn hc-btn-secondary" data-action="retry">Retry</button>
        <button type="button" class="hc-btn hc-btn-primary" data-action="accept">Use Photo</button>
      </div>
    `;
    this.el.querySelector('[data-action="accept"]').addEventListener('click', () => this.onAccept?.());
    this.el.querySelector('[data-action="retry"]').addEventListener('click', () => this.onRetry?.());
    this.container.appendChild(this.el);
  }

  hide() {
    this.el?.remove();
    this.el = null;
  }

  destroy() {
    this.hide();
  }
}

export default Preview;
