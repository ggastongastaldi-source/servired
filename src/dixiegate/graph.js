// graph.js — grafo dirigido adversarial con 4 capas funcionales
// Nodos: hubs / clusters / borde / singularidades

class Graph {
  constructor() {
    this.nodes = new Map(); // id → { id, layer, x, risk, neighbors }
    this.edges = new Map(); // "i→j" → weight
  }

  addNode(id, layer, initialX = Math.random()) {
    this.nodes.set(id, { id, layer, x: initialX, risk: 0 });
  }

  addEdge(i, j, weight = 1.0) {
    this.edges.set(`${i}→${j}`, weight);
    if (!this.nodes.get(i).neighbors) this.nodes.get(i).neighbors = [];
    this.nodes.get(i).neighbors.push(j);
  }

  // A(X) — adyacencia normalizada espectralmente
  spectralWeight(i, j) {
    const w = this.edges.get(`${i}→${j}`) || 0;
    const deg = (this.nodes.get(i).neighbors || []).length || 1;
    return w / deg;
  }

  // energía estructural J(X) = Σ w_ij ||x_i - x_j||² + Σ λ_i ||x_i||²
  energy() {
    let J = 0;
    for (const [key, w] of this.edges) {
      const [i, j] = key.split('→');
      const xi = this.nodes.get(i)?.x || 0;
      const xj = this.nodes.get(j)?.x || 0;
      J += w * Math.pow(xi - xj, 2);
    }
    for (const [, node] of this.nodes) {
      const lambda = node.layer === 'hub' ? 0.8 : 0.3;
      J += lambda * Math.pow(node.x, 2);
    }
    return J;
  }

  // gradiente ∇J respecto a nodo i
  gradJ(id) {
    const node = this.nodes.get(id);
    if (!node) return 0;
    let grad = 2 * (node.layer === 'hub' ? 0.8 : 0.3) * node.x;
    for (const [key, w] of this.edges) {
      const [i, j] = key.split('→');
      if (i === id) grad += 2 * w * (node.x - (this.nodes.get(j)?.x || 0));
      if (j === id) grad += 2 * w * (node.x - (this.nodes.get(i)?.x || 0));
    }
    return grad;
  }

  // Φ(X) — dinámica no lineal: x_{t+1} = tanh(Σ A_ij * x_j)
  step(noise = 0.05) {
    const next = new Map();
    for (const [id, node] of this.nodes) {
      let coupled = 0;
      for (const j of (node.neighbors || [])) {
        coupled += this.spectralWeight(id, j) * (this.nodes.get(j)?.x || 0);
      }
      const xi_next = Math.tanh(coupled) + (Math.random() - 0.5) * noise;
      next.set(id, xi_next);
    }
    for (const [id, xNew] of next) {
      this.nodes.get(id).x = xNew;
    }
  }

  // aplicar control u a un nodo
  applyControl(id, u) {
    const node = this.nodes.get(id);
    if (node) node.x += u;
  }

  snapshot() {
    const out = {};
    for (const [id, node] of this.nodes) {
      out[id] = { x: +node.x.toFixed(4), layer: node.layer, grad: +this.gradJ(id).toFixed(4) };
    }
    return out;
  }
}

module.exports = { Graph };
