'use strict';

/**
 * Interfaz de repositorio para el Aggregate Pedido.
 * No conoce Mongoose, MongoDB ni ninguna infraestructura.
 * Las implementaciones concretas viven en src/infrastructure/.
 */
class PedidoRepository {
  /** @param {import('../Pedido').Pedido} pedido */
  async save(pedido) { throw new Error('PedidoRepository.save() no implementado'); }

  /** @returns {Promise<import('../Pedido').Pedido|null>} */
  async findById(id) { throw new Error('PedidoRepository.findById() no implementado'); }

  /** @returns {Promise<import('../Pedido').Pedido[]>} */
  async findPendientes() { throw new Error('PedidoRepository.findPendientes() no implementado'); }

  /** @returns {Promise<boolean>} */
  async exists(id) { throw new Error('PedidoRepository.exists() no implementado'); }
}

module.exports = { PedidoRepository };
