const test = require('node:test');
const assert = require('node:assert/strict');

const { EventRouter, WILDCARD } = require('../../shared/events/eventRouter');
const { createInMemoryAdapter } = require('../../shared/events/persistenceAdapters/inMemoryAdapter');
const { createEvent } = require('../../shared/events/createEvent');
const { EVENT_TYPES } = require('../../shared/events/event-types');

function setup() {
  const adapter = createInMemoryAdapter();
  const router = new EventRouter({ persistenceAdapter: adapter });
  return { adapter: adapter, router: router };
}

test('constructor exige persistenceAdapter con persist()', () => {
  assert.throws(() => new EventRouter({}), /persistenceAdapter/);
  assert.throws(() => new EventRouter({ persistenceAdapter: {} }), /persist/);
  assert.throws(() => new EventRouter({ persistenceAdapter: { persist: 'no-fn' } }), /persist/);
});

test('publish() rechaza un evento invalido antes de persistir', async () => {
  const s = setup();
  const eventoCorrupto = { event_id: 'no-es-uuid' };

  await assert.rejects(s.router.publish(eventoCorrupto), /evento invalido/);
  assert.equal(s.adapter._inspect().length, 0);
});

test('publish() persiste el evento y devuelve PersistedEvent', async () => {
  const s = setup();
  const evt = createEvent({ type: EVENT_TYPES.LANDING_VIEWED, payload: {} });

  const persisted = await s.router.publish(evt);

  assert.equal(persisted.event.event_id, evt.event_id);
  assert.equal(persisted.persistence.sequence, 1);
  assert.ok(persisted.persistence.stored_at);
  assert.equal(s.adapter._inspect().length, 1);
});

test('subscribe(event_type) recibe solo eventos de ese tipo', async () => {
  const s = setup();
  const recibidosShell = [];
  const recibidosWallet = [];

  s.router.subscribe(EVENT_TYPES.SHELL_OPENED, (p) => recibidosShell.push(p));
  s.router.subscribe(EVENT_TYPES.WALLET_OPENED, (p) => recibidosWallet.push(p));

  const shellEvt = createEvent({ type: EVENT_TYPES.SHELL_OPENED, payload: {} });
  const walletEvt = createEvent({ type: EVENT_TYPES.WALLET_OPENED, payload: {} });

  await s.router.publish(shellEvt);
  await s.router.publish(walletEvt);

  assert.equal(recibidosShell.length, 1);
  assert.equal(recibidosShell[0].event.event_id, shellEvt.event_id);

  assert.equal(recibidosWallet.length, 1);
  assert.equal(recibidosWallet[0].event.event_id, walletEvt.event_id);
});

test('subscribe(WILDCARD) recibe todos los eventos publicados', async () => {
  const s = setup();
  const recibidos = [];
  s.router.subscribe(WILDCARD, (p) => recibidos.push(p.event.event_type));

  await s.router.publish(createEvent({ type: EVENT_TYPES.SHELL_OPENED, payload: {} }));
  await s.router.publish(createEvent({ type: EVENT_TYPES.WALLET_OPENED, payload: {} }));
  await s.router.publish(createEvent({ type: EVENT_TYPES.QR_SCANNED, payload: {} }));

  assert.deepEqual(recibidos, [
    EVENT_TYPES.SHELL_OPENED,
    EVENT_TYPES.WALLET_OPENED,
    EVENT_TYPES.QR_SCANNED
  ]);
});

test('fan-out: multiples listeners del mismo event_type reciben el evento', async () => {
  const s = setup();
  let countA = 0, countB = 0;

  s.router.subscribe(EVENT_TYPES.SHELL_OPENED, () => { countA += 1; });
  s.router.subscribe(EVENT_TYPES.SHELL_OPENED, () => { countB += 1; });

  await s.router.publish(createEvent({ type: EVENT_TYPES.SHELL_OPENED, payload: {} }));

  assert.equal(countA, 1);
  assert.equal(countB, 1);
});

test('unsubscribe detiene la recepcion de eventos', async () => {
  const s = setup();
  let count = 0;
  const unsubscribe = s.router.subscribe(EVENT_TYPES.SHELL_OPENED, () => { count += 1; });

  await s.router.publish(createEvent({ type: EVENT_TYPES.SHELL_OPENED, payload: {} }));
  unsubscribe();
  await s.router.publish(createEvent({ type: EVENT_TYPES.SHELL_OPENED, payload: {} }));

  assert.equal(count, 1);
});

test('un listener que lanza una excepcion no afecta a otros listeners ni al publish', async () => {
  const s = setup();
  let otroLlamado = false;

  s.router.subscribe(EVENT_TYPES.SHELL_OPENED, () => { throw new Error('listener roto'); });
  s.router.subscribe(EVENT_TYPES.SHELL_OPENED, () => { otroLlamado = true; });

  const persisted = await s.router.publish(createEvent({ type: EVENT_TYPES.SHELL_OPENED, payload: {} }));

  assert.equal(otroLlamado, true);
  assert.ok(persisted.persistence.sequence >= 1);
});

test('un listener async que rechaza no afecta al publish ni a otros listeners', async () => {
  const s = setup();
  let otroLlamado = false;

  s.router.subscribe(EVENT_TYPES.SHELL_OPENED, async () => {
    throw new Error('listener async roto');
  });
  s.router.subscribe(EVENT_TYPES.SHELL_OPENED, () => { otroLlamado = true; });

  const persisted = await s.router.publish(createEvent({ type: EVENT_TYPES.SHELL_OPENED, payload: {} }));

  await new Promise((r) => setImmediate(r));

  assert.equal(otroLlamado, true);
  assert.ok(persisted.persistence.sequence >= 1);
});

test('persist() que falla propaga el error y no hace fan-out', async () => {
  const router = new EventRouter({
    persistenceAdapter: { persist: async () => { throw new Error('mongo caido'); } }
  });

  let llamado = false;
  router.subscribe(WILDCARD, () => { llamado = true; });

  await assert.rejects(
    router.publish(createEvent({ type: EVENT_TYPES.SHELL_OPENED, payload: {} })),
    /mongo caido/
  );

  assert.equal(llamado, false);
});

test('inMemoryAdapter: sequence incremental y _clear()', async () => {
  const adapter = createInMemoryAdapter();
  const router = new EventRouter({ persistenceAdapter: adapter });

  await router.publish(createEvent({ type: EVENT_TYPES.LANDING_VIEWED, payload: {} }));
  await router.publish(createEvent({ type: EVENT_TYPES.LANDING_VIEWED, payload: {} }));

  const log = adapter._inspect();
  assert.equal(log.length, 2);
  assert.equal(log[0].persistence.sequence, 1);
  assert.equal(log[1].persistence.sequence, 2);

  adapter._clear();
  assert.equal(adapter._inspect().length, 0);
});
