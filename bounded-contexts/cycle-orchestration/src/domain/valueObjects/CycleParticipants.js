'use strict';
/**
 * CycleParticipants — actores que intervienen en un ciclo económico.
 * Todos son IDs opacos — cycle-orchestration no conoce los agregados internos.
 * Coordinación por referencia, nunca por acoplamiento directo.
 */
class CycleParticipants {
  constructor({ actorId, offerId = null, nodeId = null, workerId = null, clientId }) {
    if (!actorId)  throw new Error('actorId requerido (emisor de la oferta)');
    if (!clientId) throw new Error('clientId requerido (demandante)');
    this._actorId  = actorId;
    this._offerId  = offerId  || null;
    this._nodeId   = nodeId   || null;
    this._workerId = workerId || null;
    this._clientId = clientId;
  }
  get actorId()  { return this._actorId; }
  get offerId()  { return this._offerId; }
  get nodeId()   { return this._nodeId; }
  get workerId() { return this._workerId; }
  get clientId() { return this._clientId; }
  withOffer(offerId)   { return new CycleParticipants({ ...this.toJSON(), offerId }); }
  withNode(nodeId)     { return new CycleParticipants({ ...this.toJSON(), nodeId }); }
  withWorker(workerId) { return new CycleParticipants({ ...this.toJSON(), workerId }); }
  toJSON() {
    return { actorId: this._actorId, offerId: this._offerId, nodeId: this._nodeId,
             workerId: this._workerId, clientId: this._clientId };
  }
}
module.exports = { CycleParticipants };
