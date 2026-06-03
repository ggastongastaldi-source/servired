require('dotenv').config();
const express = require('express');

const rutaMensajes = require('./src/old_structure/routes/mensajes');
const http = require('http');
const { Server } = require('socket.io');
const rtgBridge = require('./rtgBridge');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
global.io = io;
require('./src/old_structure/services/socketHandlers')(io);
rtgBridge.init();
require('./globuloRojo/watchdog').iniciar();
require('./src/old_structure/services/financeWatchdog').iniciar();
require('./scheduledConfirmations').iniciar(io);
require('./src/old_structure/services/mensajeriaSocket')(io);;

app.use(cors());

// Permissions-Policy: habilitar microfono y camara para la PWA
app.use((req, res, next) => {
  res.setHeader('Permissions-Policy', 'microphone=*, camera=*, geolocation=*');
  res.setHeader('Feature-Policy', 'microphone * ; camera * ; geolocation *');
  res.setHeader('Cross-Origin-Embedder-Policy', 'unsafe-none');
  next();
});
app.use(express.json());
app.get('/version', (req,res) => res.json({v:'f923f4d', built: new Date().toISOString()}));

// Rutas
app.use('/api/mensajes', rutaMensajes);
app.use('/api/auth', require('./src/old_structure/routes/auth'));
const pedidosRoute = require('./src/old_structure/routes/pedidos')(io);
app.use('/api/upload', require('./src/old_structure/routes/upload'));
app.use('/api/pedidos', pedidosRoute);
app.use('/api/leads', require('./src/old_structure/routes/leads'));
app.use('/api/admin', require('./src/old_structure/routes/admin'));
app.use('/api/matching', require('./src/old_structure/routes/matching'));
app.use('/api/rating', require('./src/old_structure/routes/rating'));
app.use('/api/pagos', require('./src/old_structure/routes/pagos'));
app.use('/api/admin/finance', require('./src/old_structure/routes/adminFinance'));
app.use('/api/payment', require('./src/engine/paymentRoutes'));
  app.post('/api/admin/broadcast', require('./src/old_structure/commands/emergencyBroadcast').emergencyBroadcast);
app.use('/api/servicios', require('./src/old_structure/routes/servicios'));
// Context Propagation — correlationId en cada request
const { httpContextMiddleware } = require('./nexus/infrastructure/contextMiddleware');
const requestContext = require('./middleware/requestContext');
app.use(requestContext);
app.use(httpContextMiddleware);

app.use('/api/smart-quote', require('./src/old_structure/routes/smartQuote'));
app.use('/api/finanzas', require('./src/old_structure/routes/finanzas'));



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

app.use(express.static('public'));
app.get('/', (req, res) => res.sendFile(__dirname + '/public/index.html'));


// Estado global

// Health check CRÍTICO para Railway
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'OK',
        sistema: 'ServiRed',
        moneda: 'ARS',
        timestamp: new Date().toISOString(),
        workers: [...(io.sockets.adapter.rooms || new Map())].filter(([k]) => k.startsWith("worker_")).length,
        uptime: process.uptime()
    });
});

// Rutas API
app.post('/api/servicios', async (req, res) => {
    try {
        const { prestador, rubro, descripcion, cliente, presupuesto } = req.body;
        const servicio = {
            id: Date.now(),
            prestador,
            rubro,
            descripcion,
            cliente,
            presupuesto: presupuesto || 0,
            moneda: 'ARS',
            estado: 'pendiente',
            fecha: new Date()
        };
        io.emit('nuevo_servicio', servicio);
        res.status(201).json(servicio);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.use('/api/health', require('./routes/health'));

app.get('/api/servicios', (req, res) => {
    res.json({
        sistema: 'ServiRed',
        moneda: 'ARS',
        mensaje: 'Lista de servicios',
        trabajadoresActivos: [...(io.sockets.adapter.rooms || new Map())].filter(([k]) => k.startsWith("worker_")).length
    });
});

app.get('/api/trabajadores', (req, res) => {
    res.json({ workers: [...(io.sockets.adapter.rooms || new Map())].filter(([k]) => k.startsWith("worker_")).map(([k]) => k.replace("worker_","")) });
});


// MongoDB
const { assertSystemUsers } = require('./utils/assertSystemUsers');

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/servired')
    .then(() => {
      console.log('✅ MongoDB conectado');
    assertSystemUsers().catch(e => console.error('[assertSystemUsers]', e.message));
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
const { ejecutarCicloAladin } = require('./src/old_structure/services/priceWorker');
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

// ===============================
// KEEPALIVE / ANTI-SPINDOWN
// ===============================

// Aladín Vision
app.use(require('express').json({ limit: '10mb' }));
const presupuestoCtrl = require('./controllers/presupuestoController');
app.post('/api/presupuesto/analizar', presupuestoCtrl.analizarPresupuesto);
app.get('/api/presupuesto/historial/:clienteId', presupuestoCtrl.obtenerHistorial);

// SINAPSIS Health Dashboard
app.get('/api/sinapsis/health', async (req, res) => {
  try {
    const { getHealth } = require('./src/sinapsis/logManagerV2');
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
