/**
 * states.js — State Machine central (ServiRed OS)
 * MarketState (actor Mercado) es distinto de SystemState.js existente:
 * SystemState.js -> salud OPERACIONAL del sistema (NORMAL / DEGRADED)
 * MarketState     -> salud ECONÓMICA del territorio (Balanced / Pressured / Oversupplied / Distorted)
 */
const { ACTOR_TYPES } = require('./eventTaxonomy');

const USUARIO_STATES = ['Anonimo', 'Registrado', 'Explorando', 'DemandaCreada', 'Evaluando', 'Conversion', 'Cerrado'];
const TRABAJADOR_STATES = ['Offline', 'Disponible', 'Asignado', 'EnProceso', 'Finalizado', 'Liquidado'];
const COMERCIO_STATES = ['Free', 'ObservandoOportunidad', 'BoostActivo', 'ROIDemostrado', 'Suscripto'];
const TERRITORIO_STATES = ['Frio', 'Estable', 'Caliente', 'Competitivo', 'Saturado'];
const MARKET_STATES = ['Balanced', 'Pressured', 'Oversupplied', 'Distorted'];

const DISTORTED_SAFEGUARDS = ['FREEZE_PRICING', 'REDUCE_DPI_SENSITIVITY', 'SUSPEND_AUTO_BOOST'];

const STATES_BY_ACTOR_TYPE = {
  [ACTOR_TYPES.USER]: USUARIO_STATES,
  [ACTOR_TYPES.WORKER]: TRABAJADOR_STATES,
  [ACTOR_TYPES.BUSINESS]: COMERCIO_STATES,
  [ACTOR_TYPES.TERRITORY]: TERRITORIO_STATES,
  [ACTOR_TYPES.MARKET]: MARKET_STATES
};

module.exports = {
  USUARIO_STATES, TRABAJADOR_STATES, COMERCIO_STATES, TERRITORIO_STATES, MARKET_STATES,
  DISTORTED_SAFEGUARDS, STATES_BY_ACTOR_TYPE
};
