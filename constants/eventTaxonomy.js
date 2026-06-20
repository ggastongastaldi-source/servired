/**
 * eventTaxonomy.js — Event Taxonomy Registry (ServiRed OS)
 * Única fuente de verdad para eventType, actorType, eventClass, fuentes de demanda
 * y versión constitucional. Event.js, DPI Service, Revenue Trigger Engine,
 * TrustScore Engine y EconomicScore Engine DEBEN importar de acá.
 * Ningún servicio define su propia copia de estos valores.
 */

const CONSTITUTION_VERSION = '1.0'; // sube cuando cambian reglas de negocio (ej: fórmula DPI v1 -> v2)
const SCHEMA_VERSION = 1; // sube cuando cambia la FORMA del documento Event

// Persistencia en inglés, estable e independiente del idioma de UI.
const ACTOR_TYPES = {
  USER: 'USER',
  WORKER: 'WORKER',
  BUSINESS: 'BUSINESS',
  TERRITORY: 'TERRITORY',
  MARKET: 'MARKET'
};

// Mapa de presentación — esto sí puede cambiar libremente sin tocar datos persistidos.
const ACTOR_TYPE_LABELS_ES = {
  [ACTOR_TYPES.USER]: 'Usuario',
  [ACTOR_TYPES.WORKER]: 'Trabajador',
  [ACTOR_TYPES.BUSINESS]: 'Comercio',
  [ACTOR_TYPES.TERRITORY]: 'Territorio',
  [ACTOR_TYPES.MARKET]: 'Mercado'
};

const EVENT_TYPES = [
  'DemandSignalCreated', 'DemandSignalVerified', 'DemandSignalRejected',
  'UserRegistered', 'UserExploring', 'ConversionConfirmed',
  'WorkerAvailable', 'WorkerAssigned', 'JobStarted', 'JobCompleted', 'JobPaid',
  'BoostActivated', 'BoostExpired', 'BoostRenewed',
  'TrustScoreUpdated', 'EconomicScoreUpdated',
  'ZoneStateChanged', 'MarketStateChanged', 'DPIVelocitySpike'
];

// Constitucional: eventClass se DERIVA, nunca se escribe a mano.
const EVENT_CLASS_MAP = {
  DemandSignalCreated: 'Operational',
  DemandSignalVerified: 'Operational',
  DemandSignalRejected: 'Operational',
  UserRegistered: 'Operational',
  UserExploring: 'Operational',
  ConversionConfirmed: 'Economic',
  WorkerAvailable: 'Operational',
  WorkerAssigned: 'Operational',
  JobStarted: 'Operational',
  JobCompleted: 'Operational',
  JobPaid: 'Economic',
  BoostActivated: 'Economic',
  BoostExpired: 'Economic',
  BoostRenewed: 'Economic',
  TrustScoreUpdated: 'Operational',     // el dinero no compra confianza
  EconomicScoreUpdated: 'Economic',
  ZoneStateChanged: 'Operational',      // simplificación: ver nota DPI Service
  MarketStateChanged: 'Economic',
  DPIVelocitySpike: 'Operational'
};

// Integridad: si falta un mapeo, el sistema no levanta en silencio.
EVENT_TYPES.forEach((type) => {
  if (!(type in EVENT_CLASS_MAP)) {
    throw new Error(`Event Taxonomy Registry: falta eventClass para "${type}"`);
  }
});

function getEventClass(eventType) {
  const eventClass = EVENT_CLASS_MAP[eventType];
  if (!eventClass) {
    throw new Error(`Event Taxonomy Registry: eventType desconocido "${eventType}"`);
  }
  return eventClass;
}

const DEMAND_SOURCES = ['QR', 'search', 'GPS', 'NFC', 'beacon', 'AI_interaction', 'manual', 'other'];

module.exports = {
  CONSTITUTION_VERSION,
  SCHEMA_VERSION,
  ACTOR_TYPES,
  ACTOR_TYPE_LABELS_ES,
  EVENT_TYPES,
  EVENT_CLASS_MAP,
  getEventClass,
  DEMAND_SOURCES
};
