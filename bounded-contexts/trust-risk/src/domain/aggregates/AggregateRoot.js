'use strict';

/**
 * AggregateRoot — base para todos los agregados del contexto Trust & Risk.
 *
 * Responsabilidades:
 * - Mantener la cola de Domain Events pendientes de publicación.
 * - Gestionar la versión para optimistic locking.
 * - Proveer apply() para reconstrucción desde eventos (replay).
 *
 * ADR-007: El Event Store es la única fuente de verdad.
 * ADR-003: El estado se deriva del replay de eventos.
 */
class AggregateRoot {
  constructor() {
    this._domainEvents = [];
    this._version      = 0;        // versión persistida en el Event Store
    this._uncommitted  = 0;        // eventos agregados en esta sesión
  }

  get version() { return this._version; }

  /**
   * Registra un Domain Event y lo aplica al estado interno.
   * Toda mutación de estado DEBE pasar por aquí.
   *
   * @param {object} event
   */
  _recordEvent(event) {
    this._domainEvents.push(event);
    this._applyEvent(event);
    this._uncommitted++;
  }

  /**
   * Aplica un evento al estado sin registrarlo (usado en replay).
   * Cada subclase implementa _applyEvent(event) con un switch por tipo.
   *
   * @param {object} event
   */
  _applyEvent(event) {
    throw new Error(`${this.constructor.name}._applyEvent() must be implemented`);
  }

  /**
   * Reconstruye el estado del agregado desde un stream de eventos históricos.
   * Usado por el Repository al cargar desde el Event Store.
   *
   * @param {object[]} events
   */
  _rehydrate(events) {
    for (const event of events) {
      this._applyEvent(event);
      this._version++;
    }
  }

  /**
   * Retorna y limpia la cola de eventos pendientes.
   * Llamado por el Repository antes de persistir.
   *
   * @returns {object[]}
   */
  pullDomainEvents() {
    const events = [...this._domainEvents];
    this._domainEvents = [];
    this._uncommitted  = 0;
    return events;
  }

  /**
   * Versión esperada al escribir en el Event Store (optimistic locking).
   * Es la versión persistida — no incluye los eventos aún no guardados.
   */
  get expectedVersion() { return this._version; }
}

module.exports = { AggregateRoot };
