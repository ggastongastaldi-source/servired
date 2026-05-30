const https = require('https');
const { randomUUID } = require('crypto');

const BASE = 'servired-6e5r.onrender.com';
const correlationId = randomUUID();
const aggregateId   = 'lead-' + randomUUID().split('-')[0];

function post(path, body) {
  return new Promise((resolve) => {
    const data = JSON.stringify(body);
    const req = https.request({
      hostname: BASE, path, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(d) }));
    });
    req.on('error', e => resolve({ status: 0, body: { error: e.message } }));
    req.write(data); req.end();
  });
}

async function run() {
  console.log('🧠 SINAPSIS — Flujo Completo con Evidence');
  console.log(`correlationId: ${correlationId}`);
  console.log(`aggregateId:   ${aggregateId}\n`);

  // 1. Registrar evidencia cruda
  const rawData = {
    nombre: 'Electricista San Justo',
    rating: 4.8, reviews: 127,
    telefono: '11-4444-5555',
    direccion: 'Av. Gaona 1234, San Justo'
  };

  const ev = await post('/api/evidence', {
    aggregateId, correlationId,
    source: 'google_maps',
    rawData
  });
  console.log(`📎 Evidence → ${ev.status} | evidenceId: ${ev.body.evidenceId}`);

  const evidenceId = ev.body.evidenceId;

  // 2. Emitir eventos canónicos con referencia a la evidencia
  const events = [
    { eventType: 'LeadDiscovered', payload: { source: 'google_maps', category: 'electricista', city: 'san_justo', evidenceId } },
    { eventType: 'LeadEnriched',   payload: { rating: 4.8, reviews: 127, has_whatsapp: true, evidenceId } },
    { eventType: 'LeadScored',     payload: { score: 9.2, model: 'groq-llama', evidenceId } },
    { eventType: 'MessageSent',    payload: { channel: 'whatsapp', template_id: 'temp_01' } },
    { eventType: 'MessageReplied', payload: { sentiment: 'positive' } },
    { eventType: 'LeadConverted',  payload: { value: 1 } }
  ];

  for (const e of events) {
    const r = await post('/api/events', {
      eventId: randomUUID(), correlationId, causationId: evidenceId,
      aggregateId, aggregateType: 'Lead',
      eventType: e.eventType,
      timestamp: new Date().toISOString(),
      payload: e.payload,
      metadata: { version: 1, origin: 'TermuxScanner' }
    });
    console.log(`${r.status === 200 ? '✅' : '❌'} ${e.eventType} → ${r.status}`);
    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`\n🔍 Buscá en Atlas:`);
  console.log(`  sinapsis.evidence  → { aggregateId: "${aggregateId}" }`);
  console.log(`  sinapsis.events    → { correlationId: "${correlationId}" }`);
  console.log(`  sinapsis.leads_view → { aggregateId: "${aggregateId}" }`);
}
run();
