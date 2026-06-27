require('dotenv').config();
const { assertSingleWriter } = require('./src/sinapsis/singleWriterGuard');
const rtmil = require('./services/rtmilIngest');
assertSingleWriter();
const express = require('express');

const rutaMensajes = require('./src/core/routes/mensajes');
const http = require('http');
const { Server } = require('socket.io');
const rtgBridge = require('./rtgBridge');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
  pingInterval: 25000,
  pingTimeout: 60000,
  transports: ['websocket', 'polling']
});
global.io = io;
require('./src/core/services/socketHandlers')(io);
rtgBridge.init();
require('./globuloRojo/watchdog').iniciar();
require('./scheduledConfirmations').iniciar(io);
require('./src/core/services/mensajeriaSocket')(io);

app.use(cors());

// Permissions-Policy: habilitar microfono y camara para la PWA
app.use((req, res, next) => {
  res.setHeader('Permissions-Policy', 'microphone=*, camera=*, geolocation=*');
  res.setHeader('Feature-Policy', 'microphone * ; camera * ; geolocation *');
  res.setHeader('Cross-Origin-Embedder-Policy', 'unsafe-none');
  next();
});
app.use(express.json({ limit: '10mb' }));
// Context Propagation — correlationId en cada request (debe estar antes de rutas)
const { httpContextMiddleware } = require('./nexus/infrastructure/contextMiddleware');
const requestContext = require('./middleware/requestContext');
app.use(requestContext);
app.use(httpContextMiddleware);
app.get('/version', (req,res) => res.json({v:'f923f4d', built: new Date().toISOString()}));

// Rutas
const seoRouter = require('./src/core/routes/seo');
app.use('/servicio', seoRouter);
const casosRouter = require('./src/core/routes/casos');
app.use('/casos', casosRouter);
const sitemapsRouter = require('./src/core/routes/sitemaps');
app.use('/', sitemapsRouter);
app.use('/api/mensajes', rutaMensajes);
app.use('/api/auth', require('./src/core/routes/auth'));
app.use('/api/onboarding/provider', require('./src/core/routes/onboardingRoutes'));
const pedidosRoute = require('./src/core/routes/pedidos')(io);
app.use('/api/upload', require('./src/core/routes/upload'));
app.use('/api/pedidos', pedidosRoute);
const catalogoRoute = require('./routes/catalogo');
app.use('/api/catalogo', catalogoRoute);
app.use('/api/leads', require('./src/core/routes/leads'));
app.use('/api/admin', require('./src/core/routes/admin'));
app.use('/api/matching', require('./src/core/routes/matching'));
app.use('/api/asistente', require('./src/core/routes/asistente'));
app.use('/api/rating', require('./src/core/routes/rating'));
app.use('/api/pagos', require('./src/core/routes/pagos'));
app.use('/api/admin/finance', require('./src/core/routes/adminFinance'));
app.use('/api/sinapsis/dixie', require('./src/core/routes/dixieTerminal'));
app.use('/api/admin/referidos', require('./src/core/routes/referidosAdmin'));
app.use('/api/payment', require('./src/engine/paymentRoutes'));
const gatewayRoutes = require('./routes/gatewayRoutes');
const merchantRoutes = require('./routes/merchantRoutes');
const giaRoutes = require('./routes/giaRoutes');
const cobroRoutes = require('./routes/cobroRoutes');
const { procesarEvento: merchantReactorHandle } = require('./services/merchantProjectionReactor');
const simulationRoutes = require('./routes/simulationRoutes');
const policyRoutes = require('./routes/policyRoutes');
require('./services/gatewayListeners');
app.use('/api/b19/policy', policyRoutes);
app.use('/api/b19/gateway', gatewayRoutes);
app.use('/api/b19/simulation', simulationRoutes);
  app.post('/api/admin/broadcast', require('./src/core/commands/emergencyBroadcast').emergencyBroadcast);
app.use('/api/commerce', require('./src/core/routes/commerce'));
app.use('/api/smart-quote', require('./src/core/routes/smartQuote'));
app.use('/api/finanzas', require('./src/core/routes/finanzas'));



// Cache de posiciones GPS en memoria
const gpsCache = {};

// Ruta REST para actualización GPS (fallback HTTP)
app.post('/api/gps/update', (req, res) => {
    const { workerId, lat, lng } = req.body;
    if (!workerId || !lat || !lng) {
        return res.status(400).json({ error: 'Datos incompletos' });
    }
    if (global.io) {
        global.io.to('pedido_' + workerId).emit('gps_worker', { trabajadorId: workerId, lat, lng });
    }
    gpsCache[workerId] = { workerId, lat, lng, ts: Date.now() };
    res.json({ status: 'ok', workerId });
});

// Ruta para obtener todas las posiciones GPS actuales
app.get('/api/gps/positions', (req, res) => {
  const positions = Object.values(gpsCache).filter(p => Date.now() - p.ts < 60000);
  res.json({ positions });
});

// Cache-busting: HTML nunca se cachea, assets estáticos sí (1 semana)

// Inyectar GOOGLE_CLIENT_ID en index.html sin exponerlo en el repo
app.get("/", (req, res) => {
  const html = require("fs").readFileSync(require("path").join(__dirname, "public/index.html"), "utf8");
  const clientId = process.env.GOOGLE_CLIENT_ID || "";
  const patched = html.replace(
    "</head>",
    `<meta name="google-client-id" content="${clientId}">
</head>`
  );
  res.send(patched);
});

app.use(express.static('public', {
  etag: true,
  lastModified: true,
  setHeaders: (res, path) => {
    if (path.endsWith('.html')) {
      // HTML: siempre revalidar
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    } else if (path.match(/[.](js|css|png|jpg|ico|svg|woff2?)$/)) {
      // Assets: 7 días (cambiarán de nombre cuando cambien)
      res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
    }
  }
}));
app.get('/', (req, res) => res.sendFile(__dirname + '/public/index.html'));
// /r/:ref_code - URL publica de QR de referidos (redirige al flujo existente ?ref=)
app.get('/r/:ref_code', (req, res) => res.redirect('/?ref=' + req.params.ref_code.toUpperCase()));


// Estado global

// Health check CRÍTICO para Railway


// Rutas API


app.use('/api/health', require('./routes/health'));
app.use('/api/admin/rtmil', require('./routes/rtmilStatus'));
app.use('/api/sync', require('./routes/sync'));

app.get('/api/workers/stats', (req, res) => {
    res.json({
        sistema: 'ServiRed',
        moneda: 'ARS',
        trabajadoresActivos: [...(io.sockets.adapter.rooms || new Map())].filter(([k]) => k.startsWith("worker_")).length
    });
});

app.get('/api/trabajadores', (req, res) => {
    res.json({ workers: [...(io.sockets.adapter.rooms || new Map())].filter(([k]) => k.startsWith("worker_")).map(([k]) => k.replace("worker_","")) });
});


// MongoDB
const { assertSystemUsers } = require('./utils/assertSystemUsers');

// DB Readiness Promise Gate — garantía causal, no flag probabilístico
global._dbReady = false;
global.dbReadyPromise = new Promise((resolve) => {
  global._resolveDB = resolve;
});
mongoose.connection.once('connected', () => {
  global._dbReady = true;
  global._resolveDB();
  console.log('[DB] Gate abierto — conexion lista para workers');
});

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/servired')
    .then(() => {
      console.log('✅ MongoDB conectado');
    assertSystemUsers().catch(e => console.error('[assertSystemUsers]', e.message));
require('./services/boostExpiry').startBoostExpiryCron();
    rtmil.init({ durabilityMode: 'SAFE' });
    console.log('[RTMIL] Pipeline activo — WAL + Backpressure + Spill');
    require('./src/core/services/financeWatchdog').iniciar();
    // Dixie Terminal — scan inicial y cron cada 30 minutos
    const { scan: dixieScan } = require('./src/sinapsis/dixieTerminal/dixieScanner');
    dixieScan().catch(e => console.error('[DixieTerminal] scan inicial:', e.message));
    cron.schedule('*/30 * * * *', () => {
      dixieScan().catch(e => console.error('[DixieTerminal] cron scan:', e.message));
    });

    require('./src/dispatch').initDispatchEngine(io).catch(e => console.error('[DispatchEngine] init error:', e.message));
      const { initNexus } = require('./nexus/initNexus');
      initNexus(io)
        .then(r => console.log('[Server] Nexus:', r?.status || 'OK'))
        .catch(e => console.error('[Server] Nexus failed (non-critical):', e.message));
    })
    .catch(err => console.error('❌ MongoDB error:', err.message));

// Puerto CRÍTICO: Railway asigna process.env.PORT
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

server.listen(PORT, HOST, () => {
    console.log('🚀 ServiRed activo en puerto', PORT);
    console.log('📡 Socket.IO escuchando');
    console.log('💰 Moneda: ARS');
});


module.exports = { app, server, io };
// ServiRed rebuild 1776303171
// Deploy timestamp: 1776304032 - Engine Core V3
// redeploy 1776579286
// redeploy Thu Apr 23 22:47:48 -03 2026
// restart-1777349710
// redeploy 1777350915
// force 1777352750

// ── ALADDÍN PRICE BRAIN — latido cada 12h ──────────────────
const cron = require('node-cron');
const { ejecutarCicloAladin } = require('./src/core/services/priceWorker');
cron.schedule('0 8,20 * * *', () => {
  ejecutarCicloAladin().catch(err => console.error('[Aladdín-Cron] Error:', err.message));
});
// Corrida inicial al arrancar (diferida 10s para que Mongo conecte)
setTimeout(() => ejecutarCicloAladin().catch(console.error), 10000);

// ── PACTO NOCTURNO — dispara a las 20:00 todos los días ────
const TemporalAssuranceState = require('./models/TemporalAssuranceState');
cron.schedule('0 20 * * *', async () => {
  console.log('[PACTO NOCTURNO] Iniciando barrido...');
  try {
    const manana = new Date();
    manana.setDate(manana.getDate() + 1);
    manana.setHours(0, 0, 0, 0);
    const pasadoManana = new Date(manana);
    pasadoManana.setDate(pasadoManana.getDate() + 1);

    const pendientes = await TemporalAssuranceState.find({
      pactState: 'AWAITING_NIGHT_PACT',
      scheduledFor: { $gte: manana, $lt: pasadoManana }
    }).populate('pedidoId clienteId workerId');

    console.log(`[PACTO NOCTURNO] ${pendientes.length} turno(s) para mañana`);

    for (const assurance of pendientes) {
      // Notificar al cliente via Socket.IO
      if (assurance.clienteId?.socketId) {
        io.to(assurance.clienteId.socketId).emit('pacto_nocturno', {
          pedidoId:     assurance.pedidoId._id,
          scheduledFor: assurance.scheduledFor,
          workerNombre: assurance.workerId?.nombre || 'Tu profesional',
          mensaje:      '¿Confirmás tu turno para mañana? Tenés hasta las 22:00 hs.'
        });
      }
      // Notificar via room del pedido (por si el cliente está conectado)
      io.to('pedido_' + assurance.pedidoId._id).emit('pacto_nocturno', {
        pedidoId:     assurance.pedidoId._id,
        scheduledFor: assurance.scheduledFor,
        workerNombre: assurance.workerId?.nombre || 'Tu profesional',
        mensaje:      '¿Confirmás tu turno para mañana? Tenés hasta las 22:00 hs.'
      });
      console.log(`[PACTO NOCTURNO] Banner enviado | pedido: ${assurance.pedidoId._id}`);
    }
  } catch (err) {
    console.error('[PACTO NOCTURNO] Error:', err.message);
  }
});

// ── TIMEOUT NOCTURNO — a las 22:00 marca como BROKEN los que no confirmaron ──
cron.schedule('0 22 * * *', async () => {
  console.log('[TIMEOUT NOCTURNO] Procesando no-confirmados...');
  try {
    const manana = new Date();
    manana.setDate(manana.getDate() + 1);
    manana.setHours(0, 0, 0, 0);
    const pasadoManana = new Date(manana);
    pasadoManana.setDate(pasadoManana.getDate() + 1);

    const noConfirmados = await TemporalAssuranceState.find({
      pactState: 'AWAITING_NIGHT_PACT',
      scheduledFor: { $gte: manana, $lt: pasadoManana }
    });

    for (const assurance of noConfirmados) {
      const cp = assurance.checkpoints.find(c => c.type === 'NIGHT_PACT' && c.resolution === 'PENDING');
      if (cp) { cp.resolution = 'TIMEOUT'; cp.resolvedAt = new Date(); }
      assurance.pactState      = 'BROKEN';
      assurance.cancelledBy    = 'SISTEMA';
      assurance.cancelReason   = 'Timeout pacto nocturno — cliente no confirmó antes de las 22:00';
      assurance.reputationDelta = -15;
      assurance.resolvedAt     = new Date();
      await assurance.save();
      console.log(`[TIMEOUT NOCTURNO] Pacto roto por timeout | pedido: ${assurance.pedidoId}`);
    }

    console.log(`[TIMEOUT NOCTURNO] ${noConfirmados.length} pacto(s) marcados BROKEN`);
  } catch (err) {
    console.error('[TIMEOUT NOCTURNO] Error:', err.message);
  }
});

// ── CHECKPOINT T-2H — corre cada hora, detecta ventana crítica ──
cron.schedule('0 * * * *', async () => {
  try {
    const ahora   = new Date();
    const en2hs   = new Date(ahora.getTime() + 2 * 60 * 60 * 1000);
    const en3hs   = new Date(ahora.getTime() + 3 * 60 * 60 * 1000);

    // Buscar turnos que entran en ventana crítica en la próxima hora
    const enVentana = await TemporalAssuranceState.find({
      pactState:    { $in: ['NIGHT_PACT_CONFIRMED', 'AWAITING_NIGHT_PACT'] },
      scheduledFor: { $gte: en2hs, $lt: en3hs }
    }).populate('clienteId workerId pedidoId');

    if (enVentana.length === 0) return;

    console.log(`[T-2H] ${enVentana.length} turno(s) entrando en ventana crítica`);

    for (const assurance of enVentana) {
      // Mutar estado a AWAITING_TWO_HOUR_GATE
      const cp = assurance.checkpoints.find(c => c.type === 'TWO_HOUR_GATE' && c.resolution === 'PENDING');
      if (cp) cp.scheduledAt = ahora;
      assurance.pactState = 'AWAITING_TWO_HOUR_GATE';
      await assurance.save();

      const payload = {
        pedidoId:     assurance.pedidoId._id,
        scheduledFor: assurance.scheduledFor,
        workerNombre: assurance.workerId?.nombre || 'Tu profesional',
        rubro:        assurance.pedidoId?.tipoServicio || '',
        mensaje:      '⚠️ Tu turno es en menos de 2 horas. ¿Confirmás que todo sigue en pie?',
        minutosRestantes: Math.round((new Date(assurance.scheduledFor) - ahora) / 60000)
      };

      // Notificar al cliente
      if (assurance.clienteId?.socketId) {
        io.to(assurance.clienteId.socketId).emit('alerta_ventana_critica', payload);
      }
      io.to('pedido_' + assurance.pedidoId._id).emit('alerta_ventana_critica', payload);

      // Notificar al worker también
      if (assurance.workerId) {
        io.to('worker_' + assurance.workerId._id).emit('alerta_ventana_critica_worker', {
          pedidoId:     assurance.pedidoId._id,
          scheduledFor: assurance.scheduledFor,
          clienteNombre: assurance.clienteId?.nombre || 'Tu cliente',
          mensaje:      '🕐 Tu turno es en menos de 2 horas. Preparate para salir.'
        });
      }

      console.log(`[T-2H] Alerta enviada | pedido: ${assurance.pedidoId._id} | en: ${payload.minutosRestantes}min`);
    }
  } catch (err) {
    console.error('[T-2H] Error:', err.message);
  }
});

// ── WORKER HOLD — si el cliente no responde en T-2h, poner worker en espera ──
cron.schedule('30 * * * *', async () => {
  try {
    const ahora  = new Date();
    const en1h   = new Date(ahora.getTime() + 60 * 60 * 1000);
    const en2hs  = new Date(ahora.getTime() + 2 * 60 * 60 * 1000);

    // Turnos que llevan 30min en AWAITING_TWO_HOUR_GATE sin respuesta
    const sinRespuesta = await TemporalAssuranceState.find({
      pactState:    'AWAITING_TWO_HOUR_GATE',
      scheduledFor: { $gte: en1h, $lt: en2hs }
    }).populate('workerId pedidoId clienteId');

    for (const assurance of sinRespuesta) {
      assurance.pactState = 'WORKER_HOLD';
      await assurance.save();

      // Notificar al worker
      if (assurance.workerId) {
        io.to('worker_' + assurance.workerId._id).emit('worker_hold', {
          pedidoId: assurance.pedidoId._id,
          mensaje:  '⏸️ El cliente no confirmó aún. Esperá confirmación antes de salir.',
          scheduledFor: assurance.scheduledFor
        });
      }

      // Último aviso al cliente
      if (assurance.clienteId?.socketId) {
        io.to(assurance.clienteId.socketId).emit('ultimo_aviso_pacto', {
          pedidoId: assurance.pedidoId._id,
          mensaje:  '🚨 Último aviso: el profesional está esperando tu confirmación para salir.',
          scheduledFor: assurance.scheduledFor
        });
      }
      io.to('pedido_' + assurance.pedidoId._id).emit('ultimo_aviso_pacto', {
        pedidoId: assurance.pedidoId._id,
        mensaje:  '🚨 Último aviso: confirmá ahora o el turno se cancelará automáticamente.'
      });

      console.log(`[WORKER_HOLD] Worker en espera | pedido: ${assurance.pedidoId._id}`);
    }
  } catch (err) {
    console.error('[WORKER_HOLD] Error:', err.message);
  }
});

// ── PROVIDER STATE RECONCILIATOR ────────────────────────────────
cron.schedule('0 * * * *', async () => {
  try {
    const { reconcileAllProviders } = require('./src/core/services/providerStateReconciliator');
    const r = await reconcileAllProviders();
    if (r.drift > 0) {
      console.error('[STATE DRIFT] CRITICAL providers con drift detectado:', r.drift, JSON.stringify(r));
    } else {
      console.log('[Reconciliator] batch OK — total=' + r.total + ' consistent=' + r.consistent + ' errors=' + r.errors);
    }
  } catch(e) { console.error('[Reconciliator] error batch:', e.message); }
});


// ===============================
// KEEPALIVE / ANTI-SPINDOWN
// ===============================

// Aladín Vision
const presupuestoCtrl = require('./controllers/presupuestoController');
app.post('/api/presupuesto/analizar', presupuestoCtrl.analizarPresupuesto);
app.get('/api/presupuesto/historial/:clienteId', presupuestoCtrl.obtenerHistorial);

// SINAPSIS Health Dashboard
app.get('/api/sinapsis/health', async (req, res) => {
  try {
    const { getHealth } = require('./src/sinapsis/logManagerV2');
    const { runCrashRecovery } = require('./src/sinapsis/crashRecovery');
    const health = await getHealth();
    res.json({ ok: true, sinapsis: 'v1.0', ...health,
      status: health.integrityOk ? 'VERIFIED' : 'CORRUPTED' });
  } catch(err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/ping', (req, res) => {
  res.status(200).json({ ok: true, timestamp: new Date().toISOString() });
});

const https = require('https');
const KEEPALIVE_URL = process.env.RENDER_EXTERNAL_URL || 'https://servired-6e5r.onrender.com/ping';

setInterval(() => {
  https.get(KEEPALIVE_URL, (res) => {
    console.log('[KEEPALIVE]', new Date().toISOString(), res.statusCode);
  }).on('error', (err) => {
    console.error('[KEEPALIVE ERROR]', err.message);
  });
}, 90 * 1000);

// redeploy Thu May 28 01:27:20 -03 2026

// SINAPSIS Event Gateway
const eventsRouter = require('./routes/events');
app.use('/api/events', eventsRouter);

// SINAPSIS Projection Engine
const { startProjectionEngine } = require('./sinapsis/projections/engine');
startProjectionEngine();

// SINAPSIS Evidence Store
const evidenceRouter = require('./routes/evidence');
app.use('/api/evidence', evidenceRouter);
app.use('/api/referidos', require('./src/routes/referidos'));
app.use('/api/shell', require('./src/routes/shellEvents'));
app.use('/api/boost', require('./routes/boost'));
app.use('/api/graph', require('./routes/economicGraph'));
app.use('/api/track', require('./routes/track'));
app.use('/api/analytics', require('./src/core/routes/analytics'));

// B19 Control Plane — solo admin

const { soloAdmin } = require('./src/core/middleware/auth');

app.get('/api/sinapsis/crash-recovery', soloAdmin, async (req, res) => {
  try {
    const report = await runCrashRecovery();
    res.json(report);
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get('/b19', soloAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'b19.html'));
});

// ── MerchantProjectionReactor: conectado al changeStreamObserver ────────────
// ARQUITECTURA:
//   sinapsisBusAdapter = Event Store append-only (audit log, NO suscribible)
//   changeStreamObserver = runtime reactive stream (correcto para reactors)
//
// El MerchantReactor procesa eventos de dominio relevantes (MERCHANT_*, CATALOG_*)
// cuando llegan por el Change Stream de la colección 'events'.
// En modo manual: reconstruirTodos() disponible en /api/merchant/admin/reconstruct
console.log('[MerchantReactor] activo — conectado a Nexus changeStreamObserver');




// ── RECONCILIATOR ON-DEMAND ──────────────────────────────────────
app.get('/api/admin/reconcile', async (req, res) => {
  try {
    const { reconcileAllProviders } = require('./src/core/services/providerStateReconciliator');
    const r = await reconcileAllProviders();
    res.json({ ok: true, ...r });
  } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'ServiRed',
    uptime: process.uptime(),
    timestamp: Date.now(),
    memory: process.memoryUsage(),
    env: process.env.NODE_ENV || 'development'
  });
});
