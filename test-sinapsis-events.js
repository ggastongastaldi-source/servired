const https = require('https');
const { randomUUID } = require('crypto');

const WEBHOOK_URL = 'https://servired-6e5r.onrender.com/api/events';

const correlationId = randomUUID();
const aggregateId = 'lead-' + randomUUID().split('-')[0];

const eventDefs = [
  { eventType: 'LeadDiscovered', payload: { source: 'google_maps', category: 'electricista', city: 'san_justo' } },
  { eventType: 'LeadEnriched',   payload: { rating: 4.8, reviews: 127, has_whatsapp: true } },
  { eventType: 'LeadScored',     payload: { score: 9.2, model: 'groq-llama' } },
  { eventType: 'MessageSent',    payload: { channel: 'whatsapp', template_id: 'temp_01' } },
  { eventType: 'MessageReplied', payload: { sentiment: 'positive' } },
  { eventType: 'LeadConverted',  payload: { value: 1 } }
];

const events = eventDefs.map((e, i) => ({
  eventId:       randomUUID(),
  correlationId,
  causationId:   i === 0 ? null : null, // se completa en Prueba 2
  aggregateId,
  aggregateType: 'Lead',
  eventType:     e.eventType,
  timestamp:     new Date().toISOString(),
  payload:       e.payload,
  metadata:      { version: 1, origin: 'TermuxScanner' }
}));

function sendEvent(event) {
  return new Promise((resolve) => {
    const body = JSON.stringify(event);
    const url = new URL(WEBHOOK_URL);
    const req = https.request({
      hostname: url.hostname, path: url.pathname, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        console.log(`${res.statusCode === 200 ? '✅' : '❌'} ${event.eventType} → ${res.statusCode}`);
        resolve();
      });
    });
    req.on('error', (e) => { console.log(`❌ ERROR: ${e.message}`); resolve(); });
    req.write(body); req.end();
  });
}

async function run() {
  console.log('🧠 SINAPSIS — Schema Canónico v2');
  console.log(`correlationId: ${correlationId}`);
  console.log(`aggregateId:   ${aggregateId}\n`);
  for (const e of events) { await sendEvent(e); await new Promise(r => setTimeout(r, 500)); }
  console.log('\n✅ 6 eventos con schema completo enviados.');
  console.log(`\nBuscá en Atlas: { correlationId: "${correlationId}" }`);
}
run();
