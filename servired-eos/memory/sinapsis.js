export class Sinapsis {
  constructor() {
    this.graph = [];
    this.index = new Map();
  }

  persist(event) {
    const e = Object.freeze(event);
    this.graph.push(e);

    if (!this.index.has(e.type)) {
      this.index.set(e.type, []);
    }

    this.index.get(e.type).push(e);
  }

  replay() {
    return [...this.graph];
  }

  query(type) {
    return this.index.get(type) || [];
  }

  size() {
    return this.graph.length;
  }
}

export const sinapsis = new Sinapsis();
