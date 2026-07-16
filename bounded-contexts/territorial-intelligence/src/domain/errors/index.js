'use strict';
class SnapshotStaleError extends Error {
  constructor(zonaId) { super(`TerritorialSnapshot de zona ${zonaId} está desactualizado`); this.name = 'SnapshotStaleError'; }
}
module.exports = { SnapshotStaleError };
