const { randomUUID } = require('crypto');
const crypto = require('crypto');

const VALID_SOURCES = ['gia', 'internal_system'];
const VALID_INTENTS = ['pricing', 'catalog', 'general_query', 'rubro_query'];
const VALID_ROUTES  = ['aladin', 'gia_renderer', 'reject'];

function validateGIARequest(req) {
  const errors = [];
  if (!req.requestId)                       errors.push('requestId requerido');
  if (!req.timestamp)                       errors.push('timestamp requerido');
  if (!VALID_SOURCES.includes(req.source))  errors.push('source invalido: ' + req.source);
  if (!VALID_INTENTS.includes(req.intent))  errors.push('intent invalido: ' + req.intent);
  if (!req.payload?.query)                  errors.push('payload.query requerido');
  if (req.payload?.precioTotal || req.payload?.unitPrice || req.payload?.total)
    errors.push('POLICY_VIOLATION: GIA no puede incluir pricing data');
  return { valid: errors.length === 0, errors };
}

function routerDecision(intent) {
  if (intent === 'pricing' || intent === 'catalog')
    return { route: 'aladin',       confidence: 1.0, reason: 'pricing delegado a Aladin' };
  if (intent === 'rubro_query')
    return { route: 'gia_renderer', confidence: 0.9, reason: 'consulta de rubro' };
  return   { route: 'gia_renderer', confidence: 0.85, reason: 'consulta general' };
}

function signAladinResponse(payload) {
  const secret = process.env.ALADIN_SIGNING_SECRET || 'servired-aladin-v1';
  return crypto.createHmac('sha256', secret).update(JSON.stringify(payload)).digest('hex');
}

function validateAladinResponse(response, intent) {
  const errors = [];
  if (intent === 'pricing' || intent === 'catalog') {
    if (response.source !== 'aladin')     errors.push('POLICY_VIOLATION: source debe ser aladin');
    if (response.result?.total == null)   errors.push('POLICY_VIOLATION: total no puede ser null');
    if (!response.signature)              errors.push('POLICY_VIOLATION: firma requerida');
    const expected = signAladinResponse(response.result);
    if (response.signature !== expected)  errors.push('POLICY_VIOLATION: firma invalida');
  }
  return { valid: errors.length === 0, errors };
}

function classifyIntent(query) {
  const q = query.toLowerCase();
  const pricing = ['cuanto sale','cuanto cuesta','precio','presupuesto','costo','cobran','cotizacion','vale','tarifa','m2','metro','metros'];
  const catalog = ['tabique','cielorraso','durlock','revestimiento','placa','material','cemento','electricidad','plomeria'];
  const rubro   = ['domestica','limpieza','pintura','electricista','plomero','gasista','carpintero','albanil','jardinero','tecnico','servicio','rubro','oficio'];
  if (pricing.some(k => q.includes(k))) return 'pricing';
  if (catalog.some(k => q.includes(k))) return 'catalog';
  if (rubro.some(k => q.includes(k)))   return 'rubro_query';
  return 'general_query';
}

function buildGIARequest(query, userId, zoneId) {
  return {
    requestId: randomUUID(),
    timestamp: new Date().toISOString(),
    source: 'gia',
    intent: classifyIntent(query),
    payload: { query, context: { userId, zoneId: zoneId || 'amba' } }
  };
}

module.exports = { validateGIARequest, validateAladinResponse, routerDecision,
                   classifyIntent, signAladinResponse, buildGIARequest,
                   VALID_INTENTS, VALID_ROUTES };
