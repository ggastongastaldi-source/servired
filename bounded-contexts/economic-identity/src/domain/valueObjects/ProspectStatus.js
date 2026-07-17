'use strict';

const { StateMachine } = require('../../../../../shared/domain/StateMachine');

/**
 * ProspectStatus — FSM del candidato a Actor Económico.
 *
 * Modela el ciclo de incorporación ANTES de que el candidato
 * entre al ecosistema como EconomicActor verificable.
 *
 * Doctrina de Expansión Territorial — Fases 2 a 5.
 *
 * DISCOVERED  → primer registro en el mapa territorial
 * CONTACTED   → primer contacto realizado por un CET
 * EDUCATED    → capacitación Academia ServiRed completada
 * ACTIVATED   → alta gratuita completada; emite ProspectActorActivated
 *               → dispara RegisterEconomicActor en economic-identity BC
 *
 * No existe VERIFIED aquí — eso pertenece a EconomicActor.
 * La transición ACTIVATED → EconomicActor ocurre via integration event.
 */
class ProspectStatus extends StateMachine {
  static get TRANSITIONS() {
    return {
      DISCOVERED: ['CONTACTED'],
      CONTACTED:  ['EDUCATED', 'DISCOVERED'],  // puede retroceder si se pierde contacto
      EDUCATED:   ['ACTIVATED'],
      ACTIVATED:  [],                            // terminal en este BC; pasa a EconomicActor
    };
  }

  static get INITIAL() { return new ProspectStatus('DISCOVERED'); }

  get isTerminal()  { return this._value === 'ACTIVATED'; }
  get isDiscovered(){ return this._value === 'DISCOVERED'; }
  get isContacted() { return this._value === 'CONTACTED'; }
  get isEducated()  { return this._value === 'EDUCATED'; }
  get isActivated() { return this._value === 'ACTIVATED'; }
}

module.exports = { ProspectStatus };
