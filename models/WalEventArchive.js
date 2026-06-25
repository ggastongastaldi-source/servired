/**
 * WalEventArchive — ServiRed OS G5
 * Nivel 2 de durabilidad: archivo MongoDB de eventos WAL
 * NO es fuente de verdad. El WAL en disco es canónico.
 * Propósito: persistencia entre deploys, analytics, Geomesh, Aladdín
 */

const mongoose = require('mongoose');

const WalEventArchiveSchema = new mongoose.Schema({
  // Campos del WAL — copiados exactos, nunca transformados
  seq:       { type: Number, required: true },
  timestamp: { type: String, required: true },
  eventId:   { type: String, required: true, unique: true },
  type:      { type: String, required: true },
  actorId:   { type: String, default: null },
  zoneId:    { type: String, default: null },
  payload:   { type: mongoose.Schema.Types.Mixed, default: {} },
  prevHash:  { type: String, required: true },
  checksum:  { type: String, required: true },

  // Metadata de archivo
  segment:   { type: String, required: true }, // wal_seg_XXXXXXXX.log
  archivedAt: { type: Date, default: Date.now }
}, {
  collection: 'wal_event_archive',
  // Insert-only — nunca actualizar
  strict: true
});

// Índices para replay, analytics y Geomesh
WalEventArchiveSchema.index({ seq: 1 });
WalEventArchiveSchema.index({ type: 1 });
WalEventArchiveSchema.index({ actorId: 1 });
WalEventArchiveSchema.index({ zoneId: 1 });
WalEventArchiveSchema.index({ timestamp: 1 });

module.exports = mongoose.model('WalEventArchive', WalEventArchiveSchema);
