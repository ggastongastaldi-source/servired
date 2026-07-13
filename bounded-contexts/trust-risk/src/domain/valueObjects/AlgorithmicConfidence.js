const { Percentage } = require('./Percentage');

class AlgorithmicConfidence {
  constructor({ evidenceCount, dimensionCoverage, ageWeight }) {
    this._evidenceCount     = evidenceCount;
    this._dimensionCoverage = dimensionCoverage instanceof Percentage ? dimensionCoverage : Percentage.of(dimensionCoverage);
    this._ageWeight         = ageWeight instanceof Percentage ? ageWeight : Percentage.of(ageWeight);
    this._value             = this._calculate();
    Object.freeze(this);
  }
  _calculate() {
    const countFactor    = Math.min(1, this._evidenceCount / 100);
    const coverageFactor = this._dimensionCoverage.value;
    const ageFactor      = this._ageWeight.value;
    const raw = (countFactor * 0.5) + (coverageFactor * 0.3) + (ageFactor * 0.2);
    return Math.round(raw * 1e10) / 1e10;
  }
  get value() { return this._value; }
  get evidenceCount() { return this._evidenceCount; }
  get dimensionCoverage() { return this._dimensionCoverage; }
  get ageWeight() { return this._ageWeight; }
  asPercentage() { return Percentage.of(this._value); }
  isSufficientFor(requiredPercentage) {
    const req = requiredPercentage instanceof Percentage ? requiredPercentage.value : requiredPercentage;
    return this._value >= req;
  }
  withNewEvidence(additionalCount) {
    return new AlgorithmicConfidence({
      evidenceCount: this._evidenceCount + additionalCount,
      dimensionCoverage: this._dimensionCoverage,
      ageWeight: this._ageWeight,
    });
  }
  toString() { return `Confidence(${(this._value * 100).toFixed(1)}%, n=${this._evidenceCount})`; }
  static NONE = new AlgorithmicConfidence({ evidenceCount: 0, dimensionCoverage: 0, ageWeight: 0 });
  static initial() { return AlgorithmicConfidence.NONE; }
}

module.exports = { AlgorithmicConfidence };
