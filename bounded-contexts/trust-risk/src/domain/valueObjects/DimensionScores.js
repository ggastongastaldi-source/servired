const { InvalidDimensionWeightsError } = require('../errors');
const { TrustScore }    = require('./TrustScore');
const { TrustDimension } = require('./TrustDimension');
const { DimensionScore } = require('./DimensionScore');

class DimensionScores {
  constructor(scores = new Map()) {
    this._scores = new Map(scores);
    Object.freeze(this);
  }
  get(dimension) {
    const key = dimension instanceof TrustDimension ? dimension.value : dimension;
    return this._scores.get(key) || null;
  }
  add(dimensionScore) {
    const next = new Map(this._scores);
    next.set(dimensionScore.dimension.value, dimensionScore);
    return new DimensionScores(next);
  }
  update(dimensionScore) { return this.add(dimensionScore); }
  validate(policy) {
    const required = policy.requiredDimensions || [];
    const missing = required.filter(d => !this._scores.has(d));
    if (missing.length) return { valid: false, missing };
    return { valid: true, missing: [] };
  }
  consolidate(policy) {
    const weights = policy.dimensionWeights;
    const sum = Object.values(weights).reduce((a, b) => a + b, 0);
    if (Math.abs(sum - 1.0) > 1e-6) throw new InvalidDimensionWeightsError(sum);
    let total = 0;
    for (const [dim, weight] of Object.entries(weights)) {
      const score = this._scores.get(dim);
      total += (score ? score.score.value : 50) * weight;
    }
    return TrustScore.of(Math.round(total));
  }
  entries() { return [...this._scores.values()]; }
  size() { return this._scores.size; }
  static empty() { return new DimensionScores(); }
  static withDefaults(policy) {
    const scores = new Map();
    const weights = policy.dimensionWeights;
    for (const [dim, weight] of Object.entries(weights)) {
      const { DimensionScore } = require('./DimensionScore');
      const { Percentage } = require('./Percentage');
      scores.set(dim, new DimensionScore({ dimension: dim, value: 50, weight, trend: 'STABLE', evidenceCount: 0 }));
    }
    return new DimensionScores(scores);
  }
}

module.exports = { DimensionScores };
