require('dotenv').config();
const express = require('express');
const rutaMensajes = require('./src/old_structure/routes/mensajes');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
global.io = io;
require('./src/old_structure/services/socketHandlers')(io);
require('./globuloRojo/watchdog').iniciar();
require('./src/old_structure/services/mensajeriaSocket')(io);;

app.use(cors());
app.use(express.json());
app.get('/version', (req,res) => res.json({v:'f923f4d', built: new Date().toISOString()}));

// Rutas
app.use('/api/mensajes', rutaMensajes);
app.use('/api/auth', require('./src/old_structure/routes/auth'));
const pedidosRoute = require('./src/old_structure/routes/pedidos')(io);
app.use('/api/upload', require('./src/old_structure/routes/upload'));
app.use('/api/pedidos', pedidosRoute);
app.use('/api/admin', require('./src/old_structure/routes/admin'));
app.use('/api/matching', require('./src/old_structure/routes/matching'));
app.use('/api/rating', require('./src/old_structure/routes/rating'));
app.use('/api/pagos', require('./src/old_structure/routes/pagos'));
  app.post('/api/admin/broadcast', require('./src/old_structure/commands/emergencyBroadcast').emergencyBroadcast);
app.use('/api/servicios', require('./src/old_structure/routes/servicios'));
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
        global.io.emit('worker_gps_broadcast', { trabajadorId: workerId, lat, lng });
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
const trabajadoresOnline = {};

// Health check CRÍTICO para Railway
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'OK',
        sistema: 'ServiRed',
        moneda: 'ARS',
        timestamp: new Date().toISOString(),
        workers: Object.keys(trabajadoresOnline).length,
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

app.get('/api/servicios', (req, res) => {
    res.json({
        sistema: 'ServiRed',
        moneda: 'ARS',
        mensaje: 'Lista de servicios',
        trabajadoresActivos: Object.keys(trabajadoresOnline).length
    });
});

app.get('/api/trabajadores', (req, res) => {
    res.json(trabajadoresOnline);
});


// MongoDB
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/servired')
    .then(() => console.log('✅ MongoDB conectado'))
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
