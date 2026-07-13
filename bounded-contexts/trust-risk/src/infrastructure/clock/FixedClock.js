const { IClock } = require('../../domain/ports/IClock');
class FixedClock extends IClock {
  constructor(initialDate = new Date('2025-01-01T00:00:00.000Z')) {
    super();
    this._current = new Date(initialDate);
  }
  now() { return new Date(this._current); }
  advance(ms) { this._current = new Date(this._current.getTime() + ms); return this; }
  setTo(date) { this._current = new Date(date); return this; }
}
module.exports = { FixedClock };
