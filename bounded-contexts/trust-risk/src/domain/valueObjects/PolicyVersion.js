class PolicyVersion {
  constructor(value) {
    if (!value || typeof value !== 'string') throw new Error(`Invalid PolicyVersion: ${value}`);
    if (!/^policy-v\d+\.\d+\.\d+$/.test(value)) {
      throw new Error(`PolicyVersion must match policy-vX.Y.Z, got: ${value}`);
    }
    this._value = value;
    Object.freeze(this);
  }
  get value() { return this._value; }
  equals(other) { return other instanceof PolicyVersion && this._value === other.value; }
  toString() { return this._value; }
  static of(value) { return new PolicyVersion(value); }
  static INITIAL = new PolicyVersion('policy-v1.0.0');
}

module.exports = { PolicyVersion };
