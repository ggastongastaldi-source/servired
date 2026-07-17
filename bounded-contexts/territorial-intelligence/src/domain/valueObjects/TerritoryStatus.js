'use strict';

const { StateMachine } = require('../../../../../shared/domain/StateMachine');

/**
 * TerritoryStatus — FSM del ciclo de madurez de un territorio.
 *
 * Doctrina de Expansión Territorial — Artículo 12.
 *
 * IDENTIFIED   → territorio detectado, sin trabajo formal
 * MAPPED       → Inteligencia Territorial completada (Fase 1)
 * ACTIVE       → CET asignado, proceso de incorporación activo
 * CONSOLIDATED → 50+ actores activos, métricas estables
 * SCALABLE     → el territorio puede replicar el modelo de forma autónoma
 */
class TerritoryStatus extends StateMachine {
  static get TRANSITIONS() {
    return {
      IDENTIFIED:   ['MAPPED'],
      MAPPED:       ['ACTIVE'],
      ACTIVE:       ['CONSOLIDATED'],
      CONSOLIDATED: ['SCALABLE'],
      SCALABLE:     [],
    };
  }

  static get INITIAL() { return new TerritoryStatus('IDENTIFIED'); }

  get isIdentified()   { return this._value === 'IDENTIFIED'; }
  get isMapped()       { return this._value === 'MAPPED'; }
  get isActive()       { return this._value === 'ACTIVE'; }
  get isConsolidated() { return this._value === 'CONSOLIDATED'; }
  get isScalable()     { return this._value === 'SCALABLE'; }
}

module.exports = { TerritoryStatus };
