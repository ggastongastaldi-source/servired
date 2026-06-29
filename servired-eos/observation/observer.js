export class Observer {
  constructor() {
    this.snapshots = [];
  }

  capture(state, effects, meta = {}) {
    this.snapshots.push(Object.freeze({
      ts: Date.now(),
      state,
      effects,
      meta: Object.freeze(meta)
    }));
  }

  last() {
    return this.snapshots[this.snapshots.length - 1];
  }

  all() {
    return [...this.snapshots];
  }
}

export const observer = new Observer();
