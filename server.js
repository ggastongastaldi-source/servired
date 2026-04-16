const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

global.io = io;
const trabajadoresOnline = {};

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

let Usuario, Pedido;
try {
    Usuario = require('./models/Usuario');
    Pedido = require('./models/Pedido');
} catch(e) {
    console.log('⚠️ Modelos no cargados');
}

app.use('/api/auth', require('./routes/auth'));
app.use('/api/pedidos', require('./routes/pedidos'));

app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        workersOnline: Object.keys(trabajadoresOnline).length,
        workers: Object.values(trabajadoresOnline).map(w => ({ 
            nombre: w.nombre, 
            rubro: w.rubro,
            socketId: w.socketId 
        })),
        timestamp: new Date().toISOString()
    });
});

io.on('connection', (socket) => {
    console.log(`[SOCKET] 🔌 Nuevo cliente: ${socket.id}`);
    
    // WORKER conecta
    socket.on('worker_conectado', async (data) => {
        try {
            console.log(`[WORKER] 📥 Intento de conexión:`, data);
            
            const { token, rubro, lat, lng } = data;
            if (!token) {
                return socket.emit('error', { mensaje: 'Token requerido' });
            }
            
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            console.log(`[WORKER] 👤 Usuario: ${decoded.nombre} | Rol: ${decoded.rol}`);
            
            if (decoded.rol !== 'WORKER') {
                return socket.emit('error', { mensaje: 'No es worker' });
            }
            
            // Guardar en memoria
            trabajadoresOnline[socket.id] = {
                socketId: socket.id,
                userId: decoded.userId,
                nombre: decoded.nombre,
                rubro: (rubro || decoded.rubro || '').toLowerCase().trim(),
                lat: lat,
                lng: lng,
                conectado: new Date()
            };
            
            // Unir a salas
            socket.join('workers');
            socket.join(`worker_${decoded.userId}`);
            const rubroNormalizado = (rubro || decoded.rubro || 'general').toLowerCase().trim();
            socket.join(`rubro_${rubroNormalizado}`);
            
            console.log(`[WORKER] ✅ ${decoded.nombre} online | Rubro: ${rubroNormalizado} | Sala: rubro_${rubroNormalizado}`);
            
            // Actualizar DB
            if (Usuario) {
                await Usuario.findByIdAndUpdate(decoded.userId, {
                    isOnline: true,
                    lastSocketId: socket.id,
                    rubro: rubroNormalizado
                });
            }
            
            socket.emit('conectado_ok', { 
                userId: decoded.userId, 
                rubro: rubroNormalizado,
                socketId: socket.id 
            });
            
        } catch (err) {
            console.error(`[WORKER] ❌ Error conexión:`, err.message);
            socket.emit('error', { mensaje: err.message });
        }
    });
    
    // CLIENTE conecta
    socket.on('cliente_conectado', async (data) => {
        try {
            const { token } = data;
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            socket.join(`cliente_${decoded.userId}`);
            console.log(`[CLIENTE] ✅ ${decoded.nombre} conectado`);
            socket.emit('conectado_ok', { tipo: 'cliente', userId: decoded.userId });
        } catch (err) {
            socket.emit('error', { mensaje: err.message });
        }
    });
    
    // Aceptar trabajo
    socket.on('aceptar_trabajo', async (data) => {
        try {
            const { pedidoId, token } = data;
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            
            console.log(`[ACEPTAR] ${decoded.nombre} quiere pedido ${pedidoId}`);
            
            const { aceptarTrabajo } = require('./controllers/notificationController');
            const result = await aceptarTrabajo(pedidoId, decoded.userId);
            
            if (result.ok) {
                socket.emit('trabajo_ok', result);
                console.log(`[ACEPTAR] ✅ Pedido ${pedidoId} asignado a ${decoded.nombre}`);
            } else {
                socket.emit('trabajo_error', result);
                console.log(`[ACEPTAR] ❌ ${result.error}`);
            }
            
        } catch (err) {
            socket.emit('trabajo_error', { error: err.message });
        }
    });
    
    // Desconexión
    socket.on('disconnect', async () => {
        const worker = trabajadoresOnline[socket.id];
        if (worker) {
            console.log(`[WORKER] 🔴 ${worker.nombre} desconectado`);
            if (Usuario) {
                await Usuario.findByIdAndUpdate(worker.userId, { isOnline: false });
            }
            delete trabajadoresOnline[socket.id];
        }
    });
});

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('✅ MongoDB conectado'))
    .catch(err => console.error('❌ MongoDB:', err.message));

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 SERVIRED en puerto ${PORT}`);
    console.log(`📡 Socket.IO activo`);
    console.log(`👥 Workers online: ${Object.keys(trabajadoresOnline).length}`);
});

module.exports = { app, server, io };
