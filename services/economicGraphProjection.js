/**
 * SERVIRED — Economic Graph Projection E1
 * SINAPSIS-safe, replay-deterministic
 *
 * Contrato de entrada (Nexus Universal Emitter v3.0):
 *   event.entityType        — lowercase
 *   event.type              — SCREAMING_SNAKE_CASE
 *   event.aggregateId       — pedido._id
 *   event.payload.clientId  — String(pedido.cliente)   [autocontenido desde patch]
 *   event.payload.workerId  — String(pedido.workerAcepto)
 *   event.payload.precio    — Number
 *   event.payload.zona      — String
 *   event.metadata.zone     — String fallback
 *   event.timestamp         — Date
 */

const mongoose = require('mongoose');

// ── SCHEMAS ──────────────────────────────────────────────────────────────────

const GraphNodeSchema = new mongoose.Schema({
  nodeId:        { type: String, required: true, unique: true },
  nodeType:      { type: String, enum: ['CLIENT','PROFESSIONAL','COMMERCE','SUPPLIER','COMPANY','ALLY'], required: true },
  entityId:      { type: String, required: true },
  economicScore: { type: Number, default: 0 },
  zoneId:        { type: String, default: 'AMBA' },
  updatedAt:     { type: Date,   default: Date.now }
}, { collection: 'graph_nodes' });

GraphNodeSchema.index({ entityId: 1, nodeType: 1 });
GraphNodeSchema.index({ zoneId: 1, nodeType: 1 });

const GraphEdgeSchema = new mongoose.Schema({
  sourceNodeId:     { type: String, required: true },
  targetNodeId:     { type: String, required: true },
  edgeType:         { type: String, enum: ['SERVICE','PURCHASE','TRUST'], required: true },
  zoneId:           { type: String, required: true, default: 'AMBA' },
  interactionCount: { type: Number, default: 0 },
  economicVolume:   { type: Number, default: 0 },
  trustEvents:      { type: Number, default: 0 },
  firstEventAt:     { type: Date,   default: null },
  lastEventAt:      { type: Date,   default: null },
  strength:         { type: Number, default: 0 },
  updatedAt:        { type: Date,   default: Date.now }
}, { collection: 'graph_edges' });

GraphEdgeSchema.index({ sourceNodeId: 1, targetNodeId: 1, edgeType: 1, zoneId: 1 }, { unique: true });
GraphEdgeSchema.index({ sourceNodeId: 1, edgeType: 1 });
GraphEdgeSchema.index({ targetNodeId: 1, edgeType: 1 });
GraphEdgeSchema.index({ zoneId: 1, strength: -1 });

const GraphNode = mongoose.model('GraphNode', GraphNodeSchema);
const GraphEdge = mongoose.model('GraphEdge', GraphEdgeSchema);

// ── EVENT NORMALIZATION LAYER ────────────────────────────────────────────────
// RAW EVENT → CANONICAL EVENT → PROJECTION
// Fuente: grep real sobre Event Store ServiRed (junio 2026)

const EVENT_MAP = {
  SERVICE_COMPLETED: ['JOB_COMPLETED', 'SERVICE_COMPLETED', 'JOB_DONE', 'SERVICE_FINISHED'],
  PAYMENT_CONFIRMED: ['JOB_PAID', 'PAYMENT_CONFIRMED', 'PAYMENT_COMPLETED', 'PURCHASE_COMPLETED'],
  QUOTE_ACCEPTED:    ['QUOTE_ACCEPTED', 'QUOTE_OK', 'PROPOSAL_ACCEPTED', 'AUCTION_COMPLETED']
};

const RAW_TO_CANONICAL = {};
for (const [canonical, variants] of Object.entries(EVENT_MAP)) {
  for (const raw of variants) RAW_TO_CANONICAL[raw] = canonical;
}

function normalizeEvent(event) {
  const canonical = RAW_TO_CANONICAL[event.type];
  if (!canonical) return null;
  return {
    canonicalType: canonical,
    rawType:       event.type,
    aggregateId:   event.aggregateId,
    payload:       event.payload || {},
    zone:          event.payload?.zona || event.metadata?.zone || 'AMBA',
    occurredAt:    event.timestamp || new Date(),
    correlationId: event.correlationId
  };
}

// ── STRENGTH — función pura determinística ───────────────────────────────────
const T = { frequency: 50, volume: 500000, days: 30, trust: 20 };

function computeStrength({ interactionCount, economicVolume, trustEvents, lastEventAt }) {
  const freq    = Math.min(interactionCount     / T.frequency, 1);
  const vol     = Math.min((economicVolume||0)  / T.volume,    1);
  const trust   = Math.min((trustEvents||0)     / T.trust,     1);
  const days    = lastEventAt ? (Date.now() - new Date(lastEventAt).getTime()) / 86400000 : T.days;
  const recency = Math.max(0, 1 - days / T.days);
  return parseFloat((0.4*freq + 0.3*vol + 0.2*recency + 0.1*trust).toFixed(4));
}

// ── HELPERS ──────────────────────────────────────────────────────────────────

function buildNodeId(nodeType, entityId) { return `${nodeType}:${entityId}`; }

async function ensureNode(nodeType, entityId, zoneId) {
  const id = buildNodeId(nodeType, entityId);
  await GraphNode.updateOne(
    { nodeId: id },
    { $setOnInsert: { nodeId: id, nodeType, entityId, zoneId, economicScore: 0, updatedAt: new Date() } },
    { upsert: true }
  );
  return id;
}

async function upsertEdge({ sourceNodeId, targetNodeId, edgeType, zoneId, amount, isTrust, occurredAt }) {
  const now = new Date(occurredAt || Date.now());
  const inc = { interactionCount: 1, economicVolume: amount || 0 };
  if (isTrust) inc.trustEvents = 1;

  const edge = await GraphEdge.findOneAndUpdate(
    { sourceNodeId, targetNodeId, edgeType, zoneId },
    { $inc: inc, $min: { firstEventAt: now }, $max: { lastEventAt: now }, $set: { updatedAt: new Date() } },
    { upsert: true, new: true }
  );

  const strength = computeStrength(edge);
  await GraphEdge.updateOne({ sourceNodeId, targetNodeId, edgeType, zoneId }, { $set: { strength } });

  if (amount > 0) {
    await GraphNode.updateOne({ nodeId: sourceNodeId }, { $inc: { economicScore: amount }, $set: { updatedAt: new Date() } });
  }
}

// ── CANONICAL HANDLERS ───────────────────────────────────────────────────────

async function handleServiceCompleted({ payload, zone, occurredAt }) {
  const clientId       = payload.clientId;
  const professionalId = payload.workerId;
  const amount         = payload.precio || 0;

  if (!clientId || !professionalId) {
    console.warn('[EconGraph] JOB_COMPLETED sin clientId/workerId — evento anterior al patch, skip');
    return;
  }

  const srcId = await ensureNode('CLIENT',       clientId,       zone);
  const tgtId = await ensureNode('PROFESSIONAL', professionalId, zone);
  await upsertEdge({ sourceNodeId: srcId, targetNodeId: tgtId, edgeType: 'SERVICE', zoneId: zone, amount, occurredAt });
}

async function handlePaymentConfirmed({ payload, zone, occurredAt }) {
  const clientId   = payload.clientId;
  const workerId   = payload.workerId;
  const amount     = payload.precio || 0;

  if (!clientId || !workerId) {
    console.warn('[EconGraph] JOB_PAID sin clientId/workerId — evento anterior al patch, skip');
    return;
  }

  const srcId = await ensureNode('CLIENT',       clientId,  zone);
  const tgtId = await ensureNode('PROFESSIONAL', workerId,  zone);
  await upsertEdge({ sourceNodeId: srcId, targetNodeId: tgtId, edgeType: 'PURCHASE', zoneId: zone, amount, occurredAt });
}

async function handleQuoteAccepted({ payload, zone, occurredAt }) {
  const requesterId = payload.clientId   || payload.requesterId;
  const providerId  = payload.workerId   || payload.providerId || payload.winner?.workerId;

  if (!requesterId || !providerId) {
    console.warn('[EconGraph] QUOTE_ACCEPTED sin IDs — skip');
    return;
  }

  const srcId = await ensureNode('CLIENT',       requesterId, zone);
  const tgtId = await ensureNode('PROFESSIONAL', providerId,  zone);
  await upsertEdge({ sourceNodeId: srcId, targetNodeId: tgtId, edgeType: 'TRUST', zoneId: zone, amount: 0, isTrust: true, occurredAt });
}

// ── DISPATCHER ───────────────────────────────────────────────────────────────

const CANONICAL_HANDLERS = {
  SERVICE_COMPLETED: handleServiceCompleted,
  PAYMENT_CONFIRMED: handlePaymentConfirmed,
  QUOTE_ACCEPTED:    handleQuoteAccepted
};

async function projectEvent(event) {
  const normalized = normalizeEvent(event);
  if (!normalized) return;

  const handler = CANONICAL_HANDLERS[normalized.canonicalType];
  if (!handler) return;

  try {
    await handler(normalized);
  } catch (err) {
    console.error(`[EconGraph][${normalized.canonicalType}] error | corr:${normalized.correlationId?.slice(0,8)} | ${err.message}`);
    throw err;
  }
}

// ── QUERY LAYER ──────────────────────────────────────────────────────────────

const queries = {
  async getNeighbors(entityId, nodeType, edgeType = null, zoneId = null) {
    const id     = buildNodeId(nodeType, entityId);
    const filter = { $or: [{ sourceNodeId: id }, { targetNodeId: id }] };
    if (edgeType) filter.edgeType = edgeType;
    if (zoneId)   filter.zoneId   = zoneId;
    return GraphEdge.find(filter).sort({ strength: -1 }).limit(50).lean();
  },
  async getTopNodesByZone(zoneId, nodeType, limit = 10) {
    return GraphNode.find({ zoneId, nodeType }).sort({ economicScore: -1 }).limit(limit).lean();
  },
  async getZoneSubgraph(zoneId, strengthThreshold = 0.1) {
    const nodeIds = await GraphNode.find({ zoneId }, { nodeId: 1 }).lean().then(ns => ns.map(n => n.nodeId));
    return GraphEdge.find({ sourceNodeId: { $in: nodeIds }, strength: { $gte: strengthThreshold } })
      .sort({ strength: -1 }).lean();
  }
};

// ── JSON CONTRACT v1 — Frontend ──────────────────────────────────────────────

async function buildZoneGraphContract(zoneId, strengthThreshold = 0.1) {
  const [zoneNodes, zoneEdges] = await Promise.all([
    GraphNode.find({ zoneId }).lean(),
    queries.getZoneSubgraph(zoneId, strengthThreshold)
  ]);
  return {
    meta:  { zoneId, generatedAt: new Date().toISOString(), nodeCount: zoneNodes.length, edgeCount: zoneEdges.length },
    nodes: zoneNodes.map(n => ({ id: n.nodeId, type: n.nodeType, entityId: n.entityId, economicScore: n.economicScore, zoneId: n.zoneId, label: `${n.nodeType}:${n.entityId.toString().slice(-6)}` })),
    edges: zoneEdges.map(e => ({ source: e.sourceNodeId, target: e.targetNodeId, type: e.edgeType, zoneId: e.zoneId, strength: e.strength, interactionCount: e.interactionCount, economicVolume: e.economicVolume }))
  };
}

module.exports = { GraphNode, GraphEdge, projectEvent, normalizeEvent, computeStrength, queries, buildZoneGraphContract, RAW_TO_CANONICAL, EVENT_MAP };
