const { TrustScore } = require('./TrustScore');
const { Percentage }  = require('./Percentage');
const { Trend }       = require('./Trend');
const { TrustDimension } = require('./TrustDimension');

class DimensionScore {
  constructor({ dimension, value, weight, trend, evidenceCount, lastUpdatedAt }) {
    this._dimension     = dimension instanceof TrustDimension ? dimension : TrustDimension.of(dimension);
    this._score         = value instanceof TrustScore ? value : TrustScore.of(value);
    this._weight        = weight instanceof Percentage ? weight : Percentage.of(weight);
    this._trend         = trend instanceof Trend ? trend : Trend[trend] || Trend.STABLE;
    this._evidenceCount = evidenceCount || 0;
    this._lastUpdatedAt = lastUpdatedAt || null;
    Object.freeze(this);
  }
  get dimension()     { return this._dimension; }
  get score()         { return this._score; }
  get weight()        { return this._weight; }
  get trend()         { return this._trend; }
  get evidenceCount() { return this._evidenceCount; }
  get lastUpdatedAt() { return this._lastUpdatedAt; }
  applyDelta(delta, updatedAt) {
    const newScore = this._score.apply(delta);
    const trend = Trend.fromDeltas([delta]);
    return new DimensionScore({
      dimension: this._dimension,
      value: newScore,
      weight: this._weight,
      trend,
      evidenceCount: this._evidenceCount + 1,
      lastUpdatedAt: updatedAt,
    });
  }
  weightedValue() { return this._score.value * this._weight.value; }
  toString() { return `${this._dimension}:${this._score}(w=${this._weight})`; }
}

module.exports = { DimensionScore };
