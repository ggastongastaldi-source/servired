'use strict';

const { Pedido }       = require('../../domain/pedido/Pedido');
const { Dinero }       = require('../../domain/shared/value-objects/Dinero');
const { EstadoPedido } = require('../../domain/shared/value-objects/EstadoPedido');
const { Ubicacion }    = require('../../domain/shared/value-objects/Ubicacion');

const PedidoMapper = {

  /** Documento Mongoose → Aggregate Pedido */
  toDomain(doc) {
    if (!doc) return null;

    const ubicacion = (doc.ubicacion?.coordinates?.length === 2)
      ? new Ubicacion({
          lat: doc.ubicacion.coordinates[1],
          lng: doc.ubicacion.coordinates[0],
          direccion: doc.direccion || null,
        })
      : null;

    return new Pedido({
      id:          doc._id.toString(),
      clienteId:   doc.cliente.toString(),
      tipoServicio:doc.tipoServicio,
      zona:        doc.zona,
      descripcion: doc.descripcion || '',
      ubicacion,
      precio:      new Dinero(doc.precio || 0),
      pagoWorker:  new Dinero(doc.pago_worker || 0),
      estado:      new EstadoPedido(doc.estado),
      workerId:    doc.worker ? doc.worker.toString() : null,
      timeline:    (doc.timeline || []).map(e => ({
        estado: e.type || e.estado,
        at:     e.at || e.fecha,
      })),
    });
  },

  /** Aggregate Pedido → objeto plano para Mongoose */
  toPersistence(pedido) {
    const base = {
      tipoServicio: pedido.tipoServicio,
      zona:         pedido.zona,
      estado:       pedido.estado.valor,
      precio:       pedido.precio.monto,
      pago_worker:  pedido.pagoWorker.monto,
    };

    if (pedido.workerId) base.worker = pedido.workerId;

    if (pedido._ubicacion) {
      base.ubicacion = pedido._ubicacion.toGeoJSON();
      base.direccion = pedido._ubicacion.direccion;
    }

    return base;
  },
};

module.exports = { PedidoMapper };
