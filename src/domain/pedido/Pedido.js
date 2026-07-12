'use strict';

const { EstadoPedido } = require('../shared/value-objects/EstadoPedido');
const { Dinero }       = require('../shared/value-objects/Dinero');
const { PedidoDomainEvents } = require('./events/PedidoDomainEvents');
const { randomUUID }   = require('crypto');

class Pedido {
  constructor({
    id          = randomUUID(),
    clienteId,
    tipoServicio,
    zona,
    descripcion = '',
    ubicacion   = null,
    precio,         // Dinero — congelado al crear
    pagoWorker,     // Dinero — congelado al crear
    estado          = EstadoPedido.inicial(),
    workerId        = null,
    timeline        = [],
  }) {
    // Invariantes de creación
    if (!clienteId)   throw new Error('Pedido: clienteId requerido');
    if (!tipoServicio)throw new Error('Pedido: tipoServicio requerido');
    if (!zona)        throw new Error('Pedido: zona requerida');
    if (!(precio instanceof Dinero))
      throw new Error('Pedido: precio debe ser instancia de Dinero');
    if (!(pagoWorker instanceof Dinero))
      throw new Error('Pedido: pagoWorker debe ser instancia de Dinero');
    if (pagoWorker.esMayorQue(precio))
      throw new Error('Pedido: pagoWorker no puede superar el precio total');

    this._id          = id;
    this._clienteId   = clienteId;
    this._tipoServicio= tipoServicio;
    this._zona        = zona;
    this._descripcion = descripcion;
    this._ubicacion   = ubicacion;
    this._precio      = precio;
    this._pagoWorker  = pagoWorker;
    this._estado      = estado instanceof EstadoPedido ? estado : new EstadoPedido(estado);
    this._workerId    = workerId;
    this._timeline    = [...timeline];
    this._eventos     = [];   // eventos pendientes de despachar
  }

  // ── Queries ─────────────────────────────────────────────────────────
  get id()          { return this._id;          }
  get clienteId()   { return this._clienteId;   }
  get tipoServicio(){ return this._tipoServicio; }
  get zona()        { return this._zona;         }
  get estado()      { return this._estado;       }
  get precio()      { return this._precio;       }
  get pagoWorker()  { return this._pagoWorker;   }
  get workerId()    { return this._workerId;     }
  get timeline()    { return [...this._timeline];}
  get eventos()     { return [...this._eventos]; }

  // ── Commands ────────────────────────────────────────────────────────

  /** Factory — emite PedidoCreado */
  static crear({ id, clienteId, tipoServicio, zona, descripcion, ubicacion, precio, pagoWorker }) {
    const pedido = new Pedido({ id, clienteId, tipoServicio, zona, descripcion, ubicacion, precio, pagoWorker });
    pedido._emitir(PedidoDomainEvents.pedidoCreado(pedido._id, {
      clienteId, tipoServicio, zona, precio: precio.monto, pagoWorker: pagoWorker.monto
    }));
    return pedido;
  }

  iniciarBusqueda() {
    this._transicionar('SEARCHING');
    this._emitir(PedidoDomainEvents.pedidoCreado(this._id, { fase: 'busqueda_iniciada' }));
  }

  expandirBusqueda() {
    this._transicionar('EXPANDING_RADIUS');
  }

  asignarWorker(workerId) {
    if (!workerId) throw new Error('Pedido: workerId requerido para asignar');
    if (this._workerId) throw new Error('Pedido: ya tiene worker asignado');
    this._transicionar('ACEPTADA');
    this._workerId = workerId;
    this._emitir(PedidoDomainEvents.pedidoAsignado(this._id, { workerId }));
  }

  iniciarTrabajo() {
    if (!this._workerId) throw new Error('Pedido: no se puede iniciar sin worker asignado');
    this._transicionar('EN_PROCESO');
    this._emitir(PedidoDomainEvents.trabajoIniciado(this._id, { workerId: this._workerId }));
  }

  finalizarTrabajo() {
    this._transicionar('REALIZADA');
    this._emitir(PedidoDomainEvents.trabajoFinalizado(this._id, { workerId: this._workerId }));
  }

  cancelar(motivo = '') {
    if (this._estado.esFinal())
      throw new Error('Pedido: no se puede cancelar un pedido en estado final');
    this._transicionar('CANCELADA');
    this._emitir(PedidoDomainEvents.pedidoCancelado(this._id, { motivo }));
  }

  liberarPago() {
    if (this._estado.valor !== 'REALIZADA')
      throw new Error('Pedido: el pago solo se libera desde REALIZADA');
    this._transicionar('CERRADA');
    this._emitir(PedidoDomainEvents.pagoLiberado(this._id, { monto: this._pagoWorker.monto }));
  }

  limpiarEventos() { this._eventos = []; }

  // ── Internos ─────────────────────────────────────────────────────────
  _transicionar(siguiente) {
    this._estado = this._estado.transicionarA(siguiente);
    this._timeline.push({ estado: siguiente, at: new Date() });
  }

  _emitir(evento) { this._eventos.push(evento); }
}

module.exports = { Pedido };
