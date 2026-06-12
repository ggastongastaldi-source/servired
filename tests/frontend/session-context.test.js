const test = require('node:test');
const assert = require('node:assert/strict');

// Mock mínimo de sessionStorage para Node (no existe nativamente).
function makeMemoryStorage() {
  const data = {};
  return {
    getItem(key) { return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null; },
    setItem(key, value) { data[key] = String(value); },
    removeItem(key) { delete data[key]; },
    _data: data
  };
}

global.sessionStorage = makeMemoryStorage();
// session-context.js detecta `typeof window === 'undefined'` y usa globalThis,
// y exporta vía module.exports porque corremos bajo Node (CommonJS).
const SessionContext = require('../../public/js/session-context');

test('correlation_id: set/get', () => {
  SessionContext.setCorrelationId('corr_123');
  assert.equal(SessionContext.getCorrelationId(), 'corr_123');
});

test('origin_ref: set/get', () => {
  SessionContext.setOriginRef('FERRETERIA001');
  assert.equal(SessionContext.getOriginRef(), 'FERRETERIA001');
});

test('last_event: set/get hace round-trip de event_id/event_type', () => {
  const evt = {
    event_id: 'evt-abc',
    event_type: 'shell_opened',
    correlation_id: 'corr_123',
    payload: { extra: 'no debe persistirse' }
  };

  SessionContext.setLastEvent(evt);
  const last = SessionContext.getLastEvent();

  assert.deepEqual(last, { event_id: 'evt-abc', event_type: 'shell_opened' });
});

test('getLastEvent devuelve null si no hay evento previo', () => {
  global.sessionStorage = makeMemoryStorage(); // storage limpio
  delete require.cache[require.resolve('../../public/js/session-context')];
  const FreshSessionContext = require('../../public/js/session-context');

  assert.equal(FreshSessionContext.getLastEvent(), null);
  assert.equal(FreshSessionContext.getCorrelationId(), null);
});

test('recordEvent persiste correlation_id y last_event juntos', () => {
  global.sessionStorage = makeMemoryStorage();
  delete require.cache[require.resolve('../../public/js/session-context')];
  const FreshSessionContext = require('../../public/js/session-context');

  const evt = {
    event_id: 'evt-shell-1',
    event_type: 'shell_opened',
    correlation_id: 'corr_root_1'
  };

  FreshSessionContext.recordEvent(evt);

  assert.equal(FreshSessionContext.getCorrelationId(), 'corr_root_1');
  assert.deepEqual(FreshSessionContext.getLastEvent(), {
    event_id: 'evt-shell-1',
    event_type: 'shell_opened'
  });
});

test('getCausalContext devuelve correlationId/causation listos para emitX()', () => {
  global.sessionStorage = makeMemoryStorage();
  delete require.cache[require.resolve('../../public/js/session-context')];
  const FreshSessionContext = require('../../public/js/session-context');

  // Sin estado previo -> ambos undefined (root event)
  let ctx = FreshSessionContext.getCausalContext();
  assert.equal(ctx.correlationId, undefined);
  assert.equal(ctx.causation, undefined);

  // Con un evento previo registrado -> child event
  FreshSessionContext.recordEvent({
    event_id: 'evt-shell-2',
    event_type: 'shell_opened',
    correlation_id: 'corr_root_2'
  });

  ctx = FreshSessionContext.getCausalContext();
  assert.equal(ctx.correlationId, 'corr_root_2');
  assert.deepEqual(ctx.causation, { event_id: 'evt-shell-2', event_type: 'shell_opened' });
});
