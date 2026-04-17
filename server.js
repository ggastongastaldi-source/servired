require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
require('./services/socketHandlers')(io);

app.use(cors());
app.use(express.json());

// Rutas
app.use('/api/auth', require('./routes/auth'));
const pedidosRoute = require('./routes/pedidos');
app.use('/api/pedidos', pedidosRoute);
pedidosRoute.setIO(io);
app.use('/api/admin', require('./routes/admin'));
app.use('/api/matching', require('./routes/matching'));
app.use('/api/pagos', require('./routes/pagos'));
app.use('/api/servicios', require('./routes/servicios'));
app.use('/api/smart-quote', require('./routes/smartQuote'));

// Static frontend
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


// ============================================
// FIXES v2.2.1 - INYECCIÓN SEGURA
// ============================================
const fixes = {
    jwt: require('./services/fixes/jwt-fix'),
    loop: require('./services/fixes/loop-guard'),
    gps: require('./services/fixes/gps-manager')
};

// Aplicar parches
fixes.jwt.patch(io);
fixes.loop.patch(io);
fixes.gps.patch(io);
console.log('[SYSTEM] 🔧 Fixes v2.2.1 activos: JWT + Anti-loop + GPS');
// ============================================

module.exports = { app, server, io };
// ServiRed rebuild 1776303171
// Deploy timestamp: 1776304032 - Engine Core V3
