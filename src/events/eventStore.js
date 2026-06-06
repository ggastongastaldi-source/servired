'use strict';
const TZ = process.env.BUSINESS_TIMEZONE || 'America/Argentina/Buenos_Aires';
function crearMemoryEventStore() {
  const store = [];
  return {
    async append(evento) { store.push({ ...evento, ocurridoEn: evento.ocurridoEn || new Date() }); },
    async byAgregado(agregadoId) { return store.filter(e => e.agregadoId === agregadoId); },
    async byTipo(tipo) { return store.filter(e => e.tipo === tipo); },
  };
}
function crearMongoEventStore(mongoose) {
  const { Schema, model, models } = mongoose;
  const schema = new Schema({
    tipo:       { type: String, required: true, index: true },
    agregadoId: { type: String, required: true, index: true },
    payload:    { type: Schema.Types.Mixed, default: {} },
    ocurridoEn: { type: Date, default: Date.now, index: true },
    fuente:     { type: String, default: 'servired' },
  }, { collection: 'business_events', timestamps: false });
  const EventoModel = models.BusinessEvent || model('BusinessEvent', schema);
  return {
    async append(evento) { await EventoModel.create({ ...evento, ocurridoEn: evento.ocurridoEn || new Date() }); },
    async byAgregado(agregadoId) { return EventoModel.find({ agregadoId }).sort({ ocurridoEn: 1 }).lean(); },
    async byTipo(tipo) { return EventoModel.find({ tipo }).sort({ ocurridoEn: -1 }).limit(100).lean(); },
  };
}
module.exports = { crearMemoryEventStore, crearMongoEventStore };
