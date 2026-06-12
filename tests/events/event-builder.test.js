const test = require('node:test');
const assert = require('node:assert/strict');

const { createEvent } = require('../../shared/events/createEvent');
const { validateEvent } = require('../../shared/events/validateEvent');
const { EVENT_TYPES } = require('../../shared/events/event-types');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;

test('evento válido pasa validateEvent', () => {
  const evt = createEvent({
    type: EVENT_TYPES.QR_SCANNED,
    actor: { user_id: null, role: 'anonymous' },
    context: { session_id: 's1', zone: 'la_matanza', source: 'qr' },
    payload: { ref_code: 'FERRETERIA001' }
  });

  const { valid, errors } = validateEvent(evt);
  assert.equal(valid, true);
  assert.deepEqual(errors, []);
});

test('UUID autogenerado tiene formato v4 válido', () => {
  const evt = createEvent({ type: EVENT_TYPES.LANDING_VIEWED, payload: {} });
  assert.match(evt.event_id, UUID_RE);
  assert.match(evt.timestamp, ISO_RE);
});

test('correlation_id autogenerado = event_id cuando no se provee', () => {
  const evt = createEvent({ type: EVENT_TYPES.SHELL_OPENED, payload: {} });
  assert.equal(evt.correlation_id, evt.event_id);
});

test('correlation_id explícito se respeta y propaga causation', () => {
  const padre = createEvent({ type: EVENT_TYPES.REGISTER_STARTED, payload: {} });

  const hijo = createEvent({
    type: EVENT_TYPES.REGISTER_COMPLETED,
    correlationId: padre.correlation_id,
    causation: { event_id: padre.event_id, event_type: padre.event_type },
    payload: { email: 'test@example.com' }
  });

  assert.equal(hijo.correlation_id, padre.correlation_id);
  assert.equal(hijo.causation.event_id, padre.event_id);
  assert.equal(hijo.causation.event_type, padre.event_type);
});

test('tenant_id por defecto es "servired"', () => {
  const evt = createEvent({ type: EVENT_TYPES.CASE_CREATED, payload: {} });
  assert.equal(evt.context.tenant_id, 'servired');
});

test('actor faltante usa defaults (user_id null, role anonymous)', () => {
  const evt = createEvent({ type: EVENT_TYPES.JOB_REQUESTED, payload: {} });
  assert.equal(evt.actor.user_id, null);
  assert.equal(evt.actor.role, 'anonymous');
});

test('context inválido (tipo incorrecto) lanza excepción', () => {
  assert.throws(() => {
    createEvent({
      type: EVENT_TYPES.JOB_COMPLETED,
      context: { session_id: 12345 }, // debe ser string|null, no number
      payload: {}
    });
  }, /createEvent: evento inválido/);
});

test('UUID inválido es detectado por validateEvent', () => {
  const evt = createEvent({ type: EVENT_TYPES.JOB_UNFULFILLED, payload: {} });
  const corrupto = { ...evt, event_id: 'no-es-un-uuid' };

  const { valid, errors } = validateEvent(corrupto);
  assert.equal(valid, false);
  assert.ok(errors.some((e) => e.includes('event_id')));
});

test('timestamp inválido es detectado por validateEvent', () => {
  const evt = createEvent({ type: EVENT_TYPES.WALLET_OPENED, payload: {} });
  const corrupto = { ...evt, timestamp: '12/06/2026' };

  const { valid, errors } = validateEvent(corrupto);
  assert.equal(valid, false);
  assert.ok(errors.some((e) => e.includes('timestamp')));
});

test('createEvent lanza excepción detallada por validación fallida (event_type fuera de catálogo)', () => {
  assert.throws(() => {
    createEvent({ type: 'evento_inexistente', payload: {} });
  }, /createEvent: evento inválido \(type="evento_inexistente"\):.*event_type/);
});
