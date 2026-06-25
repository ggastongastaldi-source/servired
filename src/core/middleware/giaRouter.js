const { validateGIARequest, validateAladinResponse, routerDecision,
        buildGIARequest, signAladinResponse } = require('../contracts/giaRouterContract');
const { presupuestar } = require('../../../services/aladinPresupuesto');

let sinapsis = { publish: async () => {} };
for (const p of ['../../../shared/events/persistenceAdapters/sinapsisBusAdapter','../../../services/sinapsisBusAdapter']) {
  try { sinapsis = require(p); break; } catch(e) {}
}

async function callAladin(query) {
  const q = query.toLowerCase();
  let categoria = 'tabique';
  if (q.includes('cielorraso') || q.includes('techo'))       categoria = 'cielorraso';
  if (q.includes('revestimiento') || q.includes('pared'))    categoria = 'revestimiento';
  const metrosMatch = q.match(/(\d+)\s*(m2|m²|metros?)/);
  const metros = metrosMatch ? parseInt(metrosMatch[1]) : 10;
  const resultado = await presupuestar({ categoria, metros, incluirManoObra: true });
  const resultPayload = {
    categoria, metros,
    rangoMin: resultado.rangoMin,
    rangoMax: resultado.rangoMax,
    total: resultado.rangoMin,
    opcionRecomendada: resultado.opcionRecomendada,
    fuenteFecha: resultado.opciones?.[0]?.fuenteFecha,
  };
  return { source: 'aladin', result: resultPayload,
           signature: signAladinResponse(resultPayload),
           computedAt: new Date().toISOString() };
}

async function giaRouterMiddleware(req, res, next) {
  const { message, userId, zoneId, skipRouter } = req.body;
  if (!message || skipRouter) return next();

  const giaRequest = buildGIARequest(message, userId, zoneId);
  const reqVal = validateGIARequest(giaRequest);
  if (!reqVal.valid)
    return res.status(400).json({ error: 'POLICY_VIOLATION', details: reqVal.errors });

  const decision = routerDecision(giaRequest.intent);

  sinapsis.publish({ event_type: 'GIA_ROUTER_DECISION', source: 'gia_router',
    correlation_id: giaRequest.requestId,
    payload: { intent: giaRequest.intent, route: decision.route, query: message.substring(0,100) }
  }).catch(() => {});

  if (decision.route === 'aladin') {
    try {
      const aladinResp = await callAladin(message);
      const resVal = validateAladinResponse(aladinResp, giaRequest.intent);
      if (!resVal.valid)
        return res.status(403).json({ error: 'POLICY_VIOLATION', details: resVal.errors });
      const r = aladinResp.result;
      const reply = r.opcionRecomendada
        ? 'Para ' + r.categoria + ' de ' + r.metros + 'm², rango estimado $' +
          r.rangoMin?.toLocaleString('es-AR') + ' – $' + r.rangoMax?.toLocaleString('es-AR') +
          ' ARS (material + M.O.). Opción recomendada: ' + r.opcionRecomendada.nombre +
          ' a $' + r.opcionRecomendada.precioPorM2?.toLocaleString('es-AR') + '/m². ' +
          'Precios ' + (r.fuenteFecha || 'actualizados') + ' — presupuesto final lo define el profesional.'
        : 'No encontré precios para esa consulta. Te recomiendo contactar un profesional en ServiRed.';
      return res.json({ reply, source: 'aladin', requestId: giaRequest.requestId,
                        intent: giaRequest.intent, data: r });
    } catch(err) {
      console.error('[GIA Router] Aladin error:', err.message);
      req.body._aladinFallback = true;
      return next();
    }
  }
  next();
}

module.exports = giaRouterMiddleware;
