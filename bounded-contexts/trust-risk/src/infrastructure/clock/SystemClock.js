const { IClock } = require('../../domain/ports/IClock');
class SystemClock extends IClock {
  now() { return new Date(); }
}
module.exports = { SystemClock };
