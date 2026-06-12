// Adapter de persistencia en memoria.
// Implementa BusPersistenceAdapter (ver BUS_PERSISTENCE_CONTRACT.md).
// Uso: tests, desarrollo local. No persiste entre reinicios.

function createInMemoryAdapter(opts) {
  const maxEntries = (opts && opts.maxEntries) || 1000;
  const log = [];
  let seq = 0;

  return {
    async persist(eventEnvelope) {
      seq += 1;
      const persisted = Object.freeze({
        event: eventEnvelope,
        persistence: Object.freeze({
          sequence: seq,
          stored_at: new Date().toISOString()
        })
      });

      log.push(persisted);
      if (log.length > maxEntries) log.shift();

      return persisted;
    },

    _inspect() {
      return log.slice();
    },

    _clear() {
      log.length = 0;
      seq = 0;
    }
  };
}

module.exports = { createInMemoryAdapter };
