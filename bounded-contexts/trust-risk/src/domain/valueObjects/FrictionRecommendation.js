const LEVELS = ['NONE','SOFT_CHALLENGE','HARD_CHALLENGE','MANUAL_REVIEW'];

class FrictionRecommendation {
  constructor(level, reason) {
    if (!LEVELS.includes(level)) throw new Error(`Invalid FrictionRecommendation: ${level}`);
    this._level = level;
    this._reason = reason || null;
    Object.freeze(this);
  }
  get level() { return this._level; }
  get reason() { return this._reason; }
  get ordinal() { return LEVELS.indexOf(this._level); }
  isMoreRestrictiveThan(other) { return this.ordinal > other.ordinal; }
  requiresAction() { return this._level !== 'NONE'; }
  toString() { return `${this._level}${this._reason ? `(${this._reason})` : ''}`; }
  static NONE          = new FrictionRecommendation('NONE');
  static SOFT          = new FrictionRecommendation('SOFT_CHALLENGE');
  static HARD          = new FrictionRecommendation('HARD_CHALLENGE');
  static MANUAL_REVIEW = new FrictionRecommendation('MANUAL_REVIEW');
  static of(level, reason) { return new FrictionRecommendation(level, reason); }
}

module.exports = { FrictionRecommendation };
