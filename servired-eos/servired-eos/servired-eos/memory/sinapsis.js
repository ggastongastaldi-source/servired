export class Sinapsis {
  constructor() {
    this.graph = [];
  }

  persist(event) {
    this.graph.push(event);
  }

  replay() {
    return this.graph;
  }
}

export const sinapsis = new Sinapsis();
