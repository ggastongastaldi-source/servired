'use strict';
/**
 * analyticsService — agregaciones sobre marketing_events.
 * Funciones puras, sin side effects. Cache en memoria liviano.
 */
const { MarketingEvent } = require('../marketing/MarketingEvent');

// Cache en memoria: { key -> { data, expiresAt } }
const _cache = new Map();
function _fromCache(key) {
  const entry = _cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { _cache.delete(key); return null; }
  return entry.data;
}
function _toCache(key, data, ttlMs = 5 * 60 * 1000) {
  _cache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

// Ventanas de tiempo
function _since(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

/**
 * Conteo simple de eventos por tipo en una ventana de tiempo.
 */
async function countEvents(types, sinceDays = 30) {
  const result = await MarketingEvent.aggregate([
    { $match: { type: { $in: types }, createdAt: { $gte: _since(sinceDays) } } },
    { $group: { _id: '$type', count: { $sum: 1 } } }
  ]);
  const map = {};
  for (const r of result) map[r._id] = r.count;
  return map;
}

/**
 * getFeedMetrics — CTR del feed comercial.
 * CTR = clicks / views (ventana configurable)
 */
async function getFeedMetrics(days = 7) {
  const cacheKey = `feed_${days}`;
  const cached = _fromCache(cacheKey);
  if (cached) return cached;

  const counts = await countEvents(['commerce_feed_view', 'commerce_feed_click'], days);
  const views  = counts['commerce_feed_view']  || 0;
  const clicks = counts['commerce_feed_click'] || 0;
  const ctr    = views > 0 ? Number((clicks / views * 100).toFixed(2)) : 0;

  const data = { views, clicks, ctr, window_days: days };
  _toCache(cacheKey, data);
  return data;
}

/**
 * getBoostFunnel — viewed → started → paid.
 */
async function getBoostFunnel(days = 30) {
  const cacheKey = `boost_funnel_${days}`;
  const cached = _fromCache(cacheKey);
  if (cached) return cached;

  const counts = await countEvents(['boost_viewed', 'boost_started', 'boost_paid'], days);
  const viewed  = counts['boost_viewed']  || 0;
  const started = counts['boost_started'] || 0;
  const paid    = counts['boost_paid']    || 0;

  const data = {
    viewed, started, paid,
    view_to_start : viewed  > 0 ? Number((started / viewed  * 100).toFixed(2)) : 0,
    start_to_paid : started > 0 ? Number((paid    / started * 100).toFixed(2)) : 0,
    overall_conv  : viewed  > 0 ? Number((paid    / viewed  * 100).toFixed(2)) : 0,
    window_days   : days,
  };
  _toCache(cacheKey, data);
  return data;
}

/**
 * getCommerceFunnel — register_started → register_completed.
 */
async function getCommerceFunnel(days = 30) {
  const cacheKey = `commerce_funnel_${days}`;
  const cached = _fromCache(cacheKey);
  if (cached) return cached;

  const counts = await countEvents(['commerce_register_started', 'commerce_register_completed'], days);
  const started   = counts['commerce_register_started']   || 0;
  const completed = counts['commerce_register_completed'] || 0;

  const data = {
    started, completed,
    completion_rate: started > 0 ? Number((completed / started * 100).toFixed(2)) : 0,
    abandonment_rate: started > 0 ? Number(((started - completed) / started * 100).toFixed(2)) : 0,
    window_days: days,
  };
  _toCache(cacheKey, data);
  return data;
}

/**
 * getAssistantMetrics — uso del asistente y chips.
 */
async function getAssistantMetrics(days = 7) {
  const cacheKey = `assistant_${days}`;
  const cached = _fromCache(cacheKey);
  if (cached) return cached;

  const counts = await countEvents(['assistant_session_started', 'assistant_boost_chip_click'], days);
  const data = {
    sessions      : counts['assistant_session_started']   || 0,
    boost_chips   : counts['assistant_boost_chip_click']  || 0,
    window_days   : days,
  };
  _toCache(cacheKey, data);
  return data;
}

/**
 * getOverview — resumen ejecutivo del sistema.
 */
async function getOverview() {
  const cacheKey = 'overview';
  const cached = _fromCache(cacheKey, 2 * 60 * 1000);
  if (cached) return cached;

  const [feed7, boost30, commerce30, assistant7] = await Promise.all([
    getFeedMetrics(7),
    getBoostFunnel(30),
    getCommerceFunnel(30),
    getAssistantMetrics(7),
  ]);

  // Totales históricos
  const totals = await MarketingEvent.aggregate([
    { $group: { _id: '$type', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);
  const totalsMap = {};
  for (const t of totals) totalsMap[t._id] = t.count;

  const data = {
    generated_at: new Date().toISOString(),
    feed_7d     : feed7,
    boost_30d   : boost30,
    commerce_30d: commerce30,
    assistant_7d: assistant7,
    totals_all_time: totalsMap,
  };
  _toCache('overview', data, 2 * 60 * 1000); // 2 min TTL para overview
  return data;
}

/**
 * getCommerceStats — métricas para un comercio específico.
 * (base para Sprint E dashboard de comercio)
 */
async function getCommerceStats(commerceId, days = 30) {
  const since = _since(days);
  const oid   = require('mongoose').Types.ObjectId;
  let actorOid;
  try { actorOid = new oid(commerceId); } catch { return null; }

  const events = await MarketingEvent.aggregate([
    { $match: { actorId: actorOid, createdAt: { $gte: since } } },
    { $group: { _id: '$type', count: { $sum: 1 }, last: { $max: '$createdAt' } } }
  ]);

  const map = {};
  for (const e of events) map[e._id] = { count: e.count, last: e.last };

  return {
    commerceId,
    window_days: days,
    boost_paid        : map['boost_paid']?.count || 0,
    boost_last_paid   : map['boost_paid']?.last  || null,
    register_completed: map['commerce_register_completed']?.count || 0,
    events_raw: map,
  };
}

module.exports = {
  getFeedMetrics,
  getBoostFunnel,
  getCommerceFunnel,
  getAssistantMetrics,
  getOverview,
  getCommerceStats,
};
