/**
 * eventTaxonomy.js — Event Taxonomy Registry (ServiRed OS)
 * Unica fuente de verdad para eventType, actorType, eventClass, fuentes de demanda
 * y version constitucional.
 * v1.1: agrega eventos de Worker Home / Commerce Home (UX Constitution v1.2).
 */

const CONSTITUTION_VERSION = '1.0';
const SCHEMA_VERSION = 1;

const ACTOR_TYPES = {
  USER: 'USER',
  WORKER: 'WORKER',
  BUSINESS: 'BUSINESS',
  TERRITORY: 'TERRITORY',
  MARKET: 'MARKET'
};

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
  'ZoneStateChanged', 'MarketStateChanged', 'DPIVelocitySpike',
  'MaterialReservationRequested', 'WorkProgressReported',
  'ReservationConfirmed', 'ReservationRejected',
  'TerritoryScalable',
  'TerritoryConsolidated',
  'TerritorialCETAssigned',
  'TerritoryActivated',
  'TerritoryMapped',
  'TerritoryIdentified',
  'ProspectContactLost',
  'ProspectActorActivated',
  'ProspectActorEducated',
  'ProspectActorContacted',
  'ProspectActorDiscovered'
];

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
  TrustScoreUpdated: 'Operational',
  EconomicScoreUpdated: 'Economic',
  ZoneStateChanged: 'Operational',
  MarketStateChanged: 'Economic',
  DPIVelocitySpike: 'Operational',
  MaterialReservationRequested: 'Operational',
  WorkProgressReported: 'Operational',
  ReservationConfirmed: 'Economic',
  ReservationRejected: 'Operational',
  TerritoryScalable: 'Economic',
  // placeholder: 'Operational',
  TerritoryConsolidated: 'Economic',
  // placeholder: 'Operational',
  TerritorialCETAssigned: 'Operational',
  // placeholder: 'Operational',
  TerritoryActivated: 'Operational',
  // placeholder: 'Operational',
  TerritoryMapped: 'Operational',
  // placeholder: 'Operational',
  TerritoryIdentified: 'Operational',
  // placeholder: 'Operational',
  ProspectContactLost: 'Operational',
  // placeholder: 'Operational',
  ProspectActorActivated: 'Operational',
  // placeholder: 'Operational',
  ProspectActorEducated: 'Operational',
  // placeholder: 'Operational',
  ProspectActorContacted: 'Operational',
  // placeholder: 'Operational',
  ProspectActorDiscovered: 'Operational',
  // placeholder: 'Operational'
};

EVENT_TYPES.forEach((type) => {
  if (!(type in EVENT_CLASS_MAP)) {
    throw new Error('Event Taxonomy Registry: falta eventClass para ' + type);
  }
});

function getEventClass(eventType) {
  const eventClass = EVENT_CLASS_MAP[eventType];
  if (!eventClass) {
    throw new Error('Event Taxonomy Registry: eventType desconocido ' + eventType);
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
