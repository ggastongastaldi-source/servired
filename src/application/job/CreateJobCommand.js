'use strict';

/**
 * CreateJobCommand — objeto de intención puro.
 * Sin lógica de negocio. Sin efectos secundarios.
 * Valida presencia mínima de campos requeridos.
 */
class CreateJobCommand {
  constructor({
    clienteId,
    tipoServicio,
    zona,
    precio,
    pagoWorker,
    complejidad   = 'baja',
    descripcion   = '',
    direccion     = '',
    ubicacion     = null,
    serviceMode   = 'URGENT',
    scheduledFor  = null,
    source        = 'INTERNAL',
    correlationId = null,
  }) {
    if (!clienteId)    throw new Error('CreateJobCommand: clienteId requerido');
    if (!tipoServicio) throw new Error('CreateJobCommand: tipoServicio requerido');
    if (!zona)         throw new Error('CreateJobCommand: zona requerida');
    if (typeof precio !== 'number' || precio < 0)
      throw new Error('CreateJobCommand: precio debe ser number >= 0');
    if (typeof pagoWorker !== 'number' || pagoWorker < 0)
      throw new Error('CreateJobCommand: pagoWorker debe ser number >= 0');
    if (pagoWorker > precio)
      throw new Error('CreateJobCommand: pagoWorker no puede superar precio');
    if (!['REST','SOCKET','MCP','INTERNAL'].includes(source))
      throw new Error(`CreateJobCommand: source inválido "${source}"`);
    if (serviceMode !== 'URGENT' && !scheduledFor)
      throw new Error('CreateJobCommand: scheduledFor requerido para serviceMode != URGENT');

    this.clienteId    = clienteId;
    this.tipoServicio = tipoServicio;
    this.zona         = zona;
    this.precio       = precio;
    this.pagoWorker   = pagoWorker;
    this.complejidad  = complejidad;
    this.descripcion  = descripcion;
    this.direccion    = direccion;
    this.ubicacion    = ubicacion;
    this.serviceMode  = serviceMode;
    this.scheduledFor = scheduledFor;
    this.source       = source;
    this.correlationId= correlationId;

    Object.freeze(this);
  }
}

module.exports = { CreateJobCommand };
