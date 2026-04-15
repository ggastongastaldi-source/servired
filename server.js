const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// Socket.IO config
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
  pingTimeout: 60000,
  pingInterval: 25000
});

global.io = io;

// Workers en memoria
const trabajadoresOnline = {};

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Modelos (lazy load para evitar errores si no existen)
let Usuario, Pedido;
try {
  Usuario = require('./models/Usuario');
  Pedido = require('./models/Pedido');
} catch(e) {
  console.log('⚠️ Modelos no cargados aún');
}

// Rutas API
app.use('/api/auth', require('./routes/auth'));
app.use('/api/pedidos', require('./routes/pedidos'));
app.use('/api/smart-quote', require('./routes/smartQuote'));

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    mongo: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    workersOnline: Object.keys(trabajadoresOnline).length,
    timestamp: new Date().toISOString()
  });
});

// ========== SOCKET.IO ==========
io.on('connection', (socket) => {
  console.log(`[SOCKET] Conectado: ${socket.id}`);

  // WORKER conecta
  socket.on('worker_conectado', async (data) => {
    try {
      const { token, rubro, lat, lng } = data;
      if (!token) return socket.emit('error_auth', { mensaje: 'Token requerido' });

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded.rol !== 'WORKER') return socket.emit('error_auth', { mensaje: 'No es worker' });

      trabajadoresOnline[socket.id] = {
        socketId: socket.id,
        userId: decoded.userId,
        nombre: decoded.nombre,
        rubro: rubro || decoded.rubro
      };

      socket.join('workers');
      socket.join(`worker_${decoded.userId}`);
      if (rubro || decoded.rubro) {
        socket.join(`rubro_${rubro || decoded.rubro}`);
      }

      // Actualizar DB
      if (Usuario) {
        await Usuario.findByIdAndUpdate(decoded.userId, { 
          isOnline: true, 
          lastSocketId: socket.id,
          rubro: rubro || decoded.rubro
        });
      }

      socket.emit('conectado_ok', { socketId: socket.id, rubro: rubro });
      io.to('admins').emit('worker_online', { userId: decoded.userId, nombre: decoded.nombre });

    } catch (error) {
      socket.emit('error_auth', { mensaje: error.message });
    }
  });

  // CLIENTE conecta
  socket.on('cliente_conectado', async (data) => {
    try {
      const { token } = data;
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.join(`cliente_${decoded.userId}`);
      socket.emit('conectado_ok', { tipo: 'cliente' });
    } catch (error) {
      socket.emit('error_auth', { mensaje: error.message });
    }
  });

  // ADMIN conecta
  socket.on('admin_conectado', async (data) => {
    try {
      const { token } = data;
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded.rol !== 'ADMIN') return;
      socket.join('admins');
      socket.emit('workers_online', Object.values(trabajadoresOnline));
    } catch (error) {}
  });

  // ACEPTAR TRABAJO
  socket.on('aceptar_trabajo', async (data) => {
    try {
      const { pedidoId, token } = data;
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const { aceptarTrabajo } = require('./controllers/notificationController');
      const result = await aceptarTrabajo(pedidoId, decoded.userId);
      socket.emit(result.ok ? 'trabajo_aceptado_ok' : 'trabajo_aceptado_error', result);
    } catch (error) {
      socket.emit('trabajo_aceptado_error', { ok: false, error: error.message });
    }
  });

  // DESCONEXIÓN
  socket.on('disconnect', async () => {
    if (trabajadoresOnline[socket.id]) {
      const w = trabajadoresOnline[socket.id];
      if (Usuario) {
        await Usuario.findByIdAndUpdate(w.userId, { isOnline: false });
      }
      io.to('admins').emit('worker_offline', { userId: w.userId });
      delete trabajadoresOnline[socket.id];
    }
  });
});

// MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB conectado'))
  .catch(err => console.error('❌ MongoDB:', err.message));

// Iniciar
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 SERVIRED en puerto ${PORT}`);
  console.log(`📡 Socket.IO listo`);
});

module.exports = { app, server, io };
