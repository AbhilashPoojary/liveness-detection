/**
 * RingBuffer
 * -------------------------------------------------------------------------
 * Fixed-capacity FIFO buffer. Used to keep a rolling window of recent
 * frames/metrics (e.g. the last 15 valid frames for BestFrameSelector,
 * or the last N brightness samples for MotionDetector).
 */
export class RingBuffer {
  /** @param {number} capacity */
  constructor(capacity = 15) {
    this.capacity = capacity;
    /** @type {any[]} */
    this.items = [];
  }

  /** Push an item, evicting the oldest if at capacity. @returns {any[]} the evicted item, if any */
  push(item) {
    this.items.push(item);
    if (this.items.length > this.capacity) {
      return this.items.shift();
    }
    return null;
  }

  get length() {
    return this.items.length;
  }

  get isFull() {
    return this.items.length >= this.capacity;
  }

  last() {
    return this.items[this.items.length - 1];
  }

  toArray() {
    return [...this.items];
  }

  clear() {
    this.items = [];
  }
}

export default RingBuffer;
