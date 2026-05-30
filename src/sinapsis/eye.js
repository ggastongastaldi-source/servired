// eye.js — observer async, no bloqueante
const { EventEmitter } = require('events');

const eye = new EventEmitter();

eye.on('event', ({ event, decision, result }) => {
  if (event.risk >= 0.8) {
    process.nextTick(() =>
      console.log(`[Eye] ⚠️  HIGH RISK — actor=${event.actor} risk=${event.risk} decision=${decision}`)
    );
  }
  if (result?.status === 'FAILED') {
    process.nextTick(() =>
      console.log(`[Eye] ❌ FAILED EXECUTION — type=${event.type} error=${result.error}`)
    );
  }
});

function emit(event, decision, result) {
  eye.emit('event', { event, decision, result });
}

module.exports = { emit };
