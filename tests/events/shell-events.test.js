const test = require('node:test');
const assert = require('node:assert/strict');

const {
  emitShellOpened,
  emitWalletOpened,
  emitRoleChanged,
  emitSupportOpened
} = require('../../shared/events/shell-events');

const { SHELL_ACTIONS } = require('../../shared/events/shell-actions');
const { EVENT_TYPES } = require('../../shared/events/event-types');
const { validateEvent } = require('../../shared/events/validateEvent');

const ACTOR = { user_id: 'usr_123', role: 'CLIENTE' };
const CONTEXT = { tenant_id: 'servired', session_id: 'sess_abc', zone: 'la_matanza', source: 'shell' };

test('shell_opened genera un evento válido', () => {
  const evt = emitShellOpened({ actor: ACTOR, context: CONTEXT });

  assert.equal(evt.event_type, EVENT_TYPES.SHELL_OPENED);

  const { valid, errors } = validateEvent(evt);
  assert.equal(valid, true);
  assert.deepEqual(errors, []);
});

test('correlation_id se conserva entre shell_opened y wallet_opened', () => {
  const shellEvt = emitShellOpened({ actor: ACTOR, context: CONTEXT });

  const walletEvt = emitWalletOpened({
    correlationId: shellEvt.correlation_id,
    actor: ACTOR,
    context: CONTEXT,
    causation: { event_id: shellEvt.event_id, event_type: shellEvt.event_type }
  });

  assert.equal(walletEvt.correlation_id, shellEvt.correlation_id);
});

test('actor se conserva sin modificaciones', () => {
  const evt = emitShellOpened({ actor: ACTOR, context: CONTEXT });
  assert.deepEqual(evt.actor, ACTOR);
});

test('context se conserva sin modificaciones', () => {
  const evt = emitShellOpened({ actor: ACTOR, context: CONTEXT });
  assert.deepEqual(evt.context, CONTEXT);
});

test('causation se propaga correctamente de padre a hijo', () => {
  const shellEvt = emitShellOpened({ actor: ACTOR, context: CONTEXT });

  const walletEvt = emitWalletOpened({
    correlationId: shellEvt.correlation_id,
    actor: ACTOR,
    context: CONTEXT,
    causation: { event_id: shellEvt.event_id, event_type: shellEvt.event_type }
  });

  assert.equal(walletEvt.causation.event_id, shellEvt.event_id);
  assert.equal(walletEvt.causation.event_type, shellEvt.event_type);
});

test('shell_opened raíz tiene causation null/null', () => {
  const evt = emitShellOpened({ actor: ACTOR, context: CONTEXT });
  assert.equal(evt.causation.event_id, null);
  assert.equal(evt.causation.event_type, null);
});

test('wallet_opened utiliza EVENT_TYPES.WALLET_OPENED', () => {
  const evt = emitWalletOpened({ actor: ACTOR, context: CONTEXT });
  assert.equal(evt.event_type, EVENT_TYPES.WALLET_OPENED);
  assert.equal(evt.payload.action, SHELL_ACTIONS.OPEN_WALLET);
});

test('role_changed se representa como shell_opened con payload.action = change_role', () => {
  const shellEvt = emitShellOpened({ actor: ACTOR, context: CONTEXT });

  const roleEvt = emitRoleChanged({
    correlationId: shellEvt.correlation_id,
    actor: ACTOR,
    context: CONTEXT,
    causation: { event_id: shellEvt.event_id, event_type: shellEvt.event_type },
    previousRole: 'CLIENTE',
    newRole: 'TRABAJADOR'
  });

  assert.equal(roleEvt.event_type, EVENT_TYPES.SHELL_OPENED);
  assert.equal(roleEvt.payload.action, SHELL_ACTIONS.CHANGE_ROLE);
  assert.equal(roleEvt.payload.previous_role, 'CLIENTE');
  assert.equal(roleEvt.payload.new_role, 'TRABAJADOR');

  const { valid, errors } = validateEvent(roleEvt);
  assert.equal(valid, true);
  assert.deepEqual(errors, []);
});

test('support_opened se representa como shell_opened con payload.action = open_support', () => {
  const evt = emitSupportOpened({ actor: ACTOR, context: CONTEXT });
  assert.equal(evt.event_type, EVENT_TYPES.SHELL_OPENED);
  assert.equal(evt.payload.action, SHELL_ACTIONS.OPEN_SUPPORT);
});
