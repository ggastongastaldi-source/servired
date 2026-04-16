require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Middleware
app.use(cors());
app.use(express.json());

// ============================================
// VARIABLES GLOBALES PARA SOCKET.IO
// ============================================
const trabajadoresOnline = {};

// Hacer disponibles en toda la app
app.set('io', io);
app.set('trabajadoresOnline', trabajadoresOnline);

// ============================================
// RUTAS API
// ============================================

// Health check MEJORADO
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        mongo: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        workersOnline: Object.keys(trabajadoresOnline).length,
        workersList: Object.values(trabajadoresOnline).map(w => ({
            nombre: w.nombre,
            rubro: w.rubro,
            socketId: w.socketId
        }))
    });
});

// Ruta de servicios INLINE (para evitar problemas de importación)
app.post('/api/servicios', async (req, res) => {
    try {
        console.log('[API] 📥 Nuevo servicio:', JSON.stringify(req.body));
        
        const { prestador, rubro, descripcion, cliente, moneda, ubicacion } = req.body;
        
        if (!prestador || !rubro || !descripcion) {
            return res.status(400).json({ 
                ok: false, 
                error: 'Faltan datos: prestador, rubro, descripcion' 
            });
        }

        // Normalizar rubro
        const rubroNormalizado = rubro
            .toString()
            .toUpperCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim();

        console.log('[API] Rubro normalizado:', rubroNormalizado);
        console.log('[SOCKET] Workers conectados:', Object.keys(trabajadoresOnline).length);

        // Buscar y notificar workers
        let notificados = 0;
        const workersNotificados = [];
        
        for (const [socketId, worker] of Object.entries(trabajadoresOnline)) {
            const workerRubro = (worker.rubro || '')
                .toUpperCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '');
            
            console.log(`[SOCKET] Comparando: ${workerRubro} vs ${rubroNormalizado}`);
            
            if (workerRubro === rubroNormalizado) {
                console.log(`[SOCKET] ✅ MATCH! Notificando a ${worker.nombre}`);
                
                io.to(socketId).emit('nuevo_trabajo', {
                    id: Date.now().toString(),
                    prestador,
                    rubro: rubroNormalizado,
                    descripcion,
                    cliente: cliente || 'Anónimo',
                    moneda: moneda || 'ARS',
                    ubicacion: ubicacion || null,
                    fecha: new Date()
                });
                
                notificados++;
                workersNotificados.push(worker.nombre);
            }
        }

        res.json({
            ok: true,
            mensaje: 'Servicio procesado',
            servicio: { prestador, rubro: rubroNormalizado, descripcion, cliente },
            notificados,
            workersNotificados,
            totalWorkersOnline: Object.keys(trabajadoresOnline).length
        });

    } catch (err) {
        console.error('[API] ❌ Error:', err);
        res.status(500).json({ ok: false, error: err.message });
    }
});

// GET test
app.get('/api/servicios', (req, res) => {
    res.json({ ok: true, mensaje: 'Ruta activa - Use POST para crear servicio' });
});

// ============================================
// SOCKET.IO
// ============================================
io.on('connection', (socket) => {
    console.log(`[SOCKET] 🔌 Conectado: ${socket.id}`);

    socket.on('registrar_worker', (data) => {
        try {
            console.log('[SOCKET] Registrando:', data);
            const { userId, nombre, rubro } = data;
            
            if (!nombre || !rubro) {
                return socket.emit('error_registro', { error: 'Faltan nombre o rubro' });
            }

            const rubroNormalizado = rubro
                .toUpperCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .trim();

            trabajadoresOnline[socket.id] = {
                socketId: socket.id,
                userId: userId || 'anon',
                nombre,
                rubro: rubroNormalizado
            };

            console.log(`[SOCKET] ✅ ${nombre} registrado en ${rubroNormalizado}`);
            console.log(`[SOCKET] Total workers: ${Object.keys(trabajadoresOnline).length}`);
            
            socket.emit('registro_ok', { 
                mensaje: 'Registrado correctamente',
                rubroNormalizado,
                workersOnline: Object.keys(trabajadoresOnline).length
            });

        } catch (err) {
            console.error('[SOCKET] Error:', err);
            socket.emit('error_registro', { error: err.message });
        }
    });

    socket.on('disconnect', () => {
        const worker = trabajadoresOnline[socket.id];
        if (worker) {
            console.log(`[SOCKET] 🔴 ${worker.nombre} desconectado`);
            delete trabajadoresOnline[socket.id];
        }
    });
});

// ============================================
// CONEXIÓN Y ARRANQUE
// ============================================
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('✅ MongoDB conectado'))
    .catch(err => console.error('❌ MongoDB error:', err.message));

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Servidor en puerto ${PORT}`);
    console.log(`📡 Socket.IO activo`);
    console.log(`👥 Workers: ${Object.keys(trabajadoresOnline).length}`);
});

module.exports = { app, server, io };
// Reinicio forzado v3
