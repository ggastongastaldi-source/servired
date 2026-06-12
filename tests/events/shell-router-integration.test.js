// Resultado esperado del Sprint 3:
//   Shell -> EventRouter -> Listeners funcionando,
// preservando correlation_id/causation a traves de toda la cadena.

const test = require('node:test');
const assert = require('node:assert/strict');

const { EventRouter, WILDCARD } = require('../../shared/events/eventRouter');
const { createInMemoryAdapter } = require('../../shared/events/persistenceAdapters/inMemoryAdapter');
const { emitShellOpened, emitWalletOpened } = require('../../shared/events/shell-events');
const { EVENT_TYPES } = require('../../shared/events/event-types');

test('Shell abre menu -> EventRouter -> listener -> abre wallet manteniendo correlation_id', async () => {
  const adapter = createInMemoryAdapter();
  const router = new EventRouter({ persistenceAdapter: adapter });

  const actor = { user_id: 'usr_1', role: 'CLIENTE' };
  const context = { tenant_id: 'servired', session_id: 'sess_1', zone: 'la_matanza', source: 'shell' };

  const recibidos = [];
  router.subscribe(WILDCARD, (p) => recibidos.push(p.event));

  const shellEvt = emitShellOpened({ actor: actor, context: context });
  const persistedShell = await router.publish(shellEvt);

  const walletEvt = emitWalletOpened({
    correlationId: persistedShell.event.correlation_id,
    actor: actor,
    context: context,
    causation: {
      event_id: persistedShell.event.event_id,
      event_type: persistedShell.event.event_type
    }
  });
  const persistedWallet = await router.publish(walletEvt);

  assert.equal(recibidos.length, 2);
  assert.equal(recibidos[0].event_type, EVENT_TYPES.SHELL_OPENED);
  assert.equal(recibidos[1].event_type, EVENT_TYPES.WALLET_OPENED);

  assert.equal(persistedWallet.event.correlation_id, persistedShell.event.correlation_id);
  assert.equal(persistedWallet.event.causation.event_id, persistedShell.event.event_id);
  assert.equal(persistedShell.event.causation.event_id, null);

  assert.equal(adapter._inspect().length, 2);
  assert.equal(persistedShell.persistence.sequence, 1);
  assert.equal(persistedWallet.persistence.sequence, 2);
});
