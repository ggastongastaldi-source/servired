'use strict';

/**
 * SnapshotStore — optimización de replay para agregados con muchos eventos.
 *
 * Estrategia: cada N eventos (configurable, default 50), guardar
 * un snapshot del estado del agregado. En el replay, se carga el
 * snapshot más reciente y solo se replayan los eventos posteriores.
 *
 * ADR-007: El Event Store sigue siendo la fuente de verdad.
 * El snapshot es solo una optimización de lectura — si se corrompe,
 * se puede reconstruir desde el Event Store completo.
 *
 * Estado: STUB — preparado para Fase posterior.
 * En v1 se ignoran los snapshots y se hace replay completo.
 */
class SnapshotStore {

  constructor(db, snapshotEvery = 50) {
    this._col           = db.collection('trust_snapshots');
    this._snapshotEvery = snapshotEvery;
  }

  async ensureIndexes() {
    await this._col.createIndex({ aggregateId: 1, version: -1 });
  }

  /**
   * @returns {object|null} snapshot más reciente, o null si no existe.
   */
  async findLatest(aggregateId) {
    // v1: siempre null — replay completo.
    return null;
  }

  /**
   * Persiste un snapshot si se cumple el threshold.
   */
  async saveIfNeeded(aggregateId, version, state) {
    if (version % this._snapshotEvery !== 0) return;
    await this._col.updateOne(
      { aggregateId, version },
      { $set: { aggregateId, version, state, savedAt: new Date() } },
      { upsert: true }
    );
  }
}

module.exports = { SnapshotStore };
