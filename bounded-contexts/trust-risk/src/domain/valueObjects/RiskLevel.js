const ORDER = ['LOW','MEDIUM','HIGH','CRITICAL'];

class RiskLevel {
  constructor(value) {
    if (!ORDER.includes(value)) throw new Error(`Invalid RiskLevel: ${value}`);
    this._value = value;
    Object.freeze(this);
  }
  get value() { return this._value; }
  get ordinal() { return ORDER.indexOf(this._value); }
  isAbove(other) { return this.ordinal > other.ordinal; }
  isAtLeast(other) { return this.ordinal >= other.ordinal; }
  equals(other) { return other instanceof RiskLevel && this._value === other.value; }
  toString() { return this._value; }
  static of(value) { return new RiskLevel(value); }
  static fromScore(score) {
    if (score >= 80) return RiskLevel.LOW;
    if (score >= 60) return RiskLevel.MEDIUM;
    if (score >= 30) return RiskLevel.HIGH;
    return RiskLevel.CRITICAL;
  }
  static LOW      = new RiskLevel('LOW');
  static MEDIUM   = new RiskLevel('MEDIUM');
  static HIGH     = new RiskLevel('HIGH');
  static CRITICAL = new RiskLevel('CRITICAL');
}

module.exports = { RiskLevel };
