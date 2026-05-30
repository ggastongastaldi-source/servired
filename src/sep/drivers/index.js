// index.js — driver selector por ENV
// STREAM_DRIVER=mongo|redis   (default: mongo)
// LEDGER_DRIVER=mongo|postgres (default: mongo)
// IDEM_DRIVER=mongo|redis      (default: mongo)

const STREAM_DRIVER = process.env.STREAM_DRIVER || 'mongo';
const LEDGER_DRIVER = process.env.LEDGER_DRIVER || 'mongo';
const IDEM_DRIVER   = process.env.IDEM_DRIVER   || 'mongo';

const streams     = STREAM_DRIVER === 'redis'    ? require('./streams.redis')     : require('./streams.mongo');
const ledger      = LEDGER_DRIVER === 'postgres' ? require('./ledger.pg')         : require('./ledger.mongo');
const idempotency = IDEM_DRIVER   === 'redis'    ? require('./idempotency.redis') : require('./idempotency.mongo');

console.log(`[Drivers] streams=${STREAM_DRIVER} ledger=${LEDGER_DRIVER} idem=${IDEM_DRIVER}`);

module.exports = { streams, ledger, idempotency };
