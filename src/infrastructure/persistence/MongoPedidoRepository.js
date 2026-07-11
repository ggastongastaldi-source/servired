'use strict';

const { PedidoRepository } = require('../../domain/pedido/repository/PedidoRepository');
const { PedidoMapper }     = require('./PedidoMapper');

// Lazy-require: Mongoose model solo se carga cuando se usa,
// nunca en tiempo de import del dominio.
function getModel() {
  return require('../../core/models/Pedido');
}

class MongoPedidoRepository extends PedidoRepository {

  async save(pedido) {
    const Model = getModel();
    const data  = PedidoMapper.toPersistence(pedido);

    const existing = await Model.findById(pedido.id).lean();
    if (existing) {
      await Model.findByIdAndUpdate(pedido.id, { $set: data });
    } else {
      await new Model({ _id: pedido.id, ...data }).save();
    }
  }

  async findById(id) {
    const doc = await getModel().findById(id).lean();
    return PedidoMapper.toDomain(doc);
  }

  async findPendientes() {
    const docs = await getModel()
      .find({ estado: { $in: ['PENDIENTE', 'SEARCHING', 'EXPANDING_RADIUS'] } })
      .lean();
    return docs.map(PedidoMapper.toDomain);
  }

  async exists(id) {
    const doc = await getModel().findById(id).select('_id').lean();
    return !!doc;
  }
}

module.exports = { MongoPedidoRepository };
