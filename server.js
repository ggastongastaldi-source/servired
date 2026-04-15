const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// ===== CONFIGURACIÓN SOCKET.IO =====
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
  pingTimeout: 60000,
  pingInterval: 25000
});

// EXPORTAR IO GLOBAL PARA CONTROLADORES
global.io = io;

// Modelos
const Usuario = require('./models/Usuario');
const Pedido = require('./models/Pedido');

// Workers online en memoria
const trabajadoresOnline = {};

// ===== MIDDLEWARES =====
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// ===== RUTAS =====
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

// ===== SOCKET.IO EVENTOS =====
io.on('connection', (socket) => {
  console.log(`[SOCKET] 🔌 Conectado: ${socket.id}`);

  // ========== WORKER ==========
  socket.on('worker_conectado', async (data) => {
    try {
      const { token, rubro, ubicacion, lat, lng } = data;
      
      if (!token) {
        socket.emit('error_auth', { mensaje: 'Token requerido' });
        return;
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      if (decoded.rol !== 'WORKER') {
        socket.emit('error_auth', { mensaje: 'No es worker' });
        return;
      }

      // Guardar en memoria
      trabajadoresOnline[socket.id] = {
        socketId: socket.id,
        userId: decoded.userId,
        nombre: decoded.nombre,
        rubro: rubro || decoded.rubro,
        conectado: new Date()
      };

      // Unir a salas específicas
      socket.join('workers'); // Sala general
      socket.join(`worker_${decoded.userId}`); // Sala personal
      
      if (rubro || decoded.rubro) {
        const r = rubro || decoded.rubro;
        socket.join(`rubro_${r}`); // Sala por rubro (ej: rubro_plomeria)
        console.log(`[SOCKET] Worker ${decoded.nombre} unido a rubro_${r}`);
      }

      // Actualizar en BD
      const updateData = { 
        isOnline: true, 
        lastSocketId: socket.id,
        lastConnection: new Date()
      };
      if (rubro) updateData.rubro = rubro;
      if ((lat && lng) || ubicacion) {
        updateData.ubicacion = {
          type: 'Point',
          coordinates: ubicacion || [lng, lat]
        };
      }
      
      await Usuario.findByIdAndUpdate(decoded.userId, updateData);

      console.log(`[SOCKET] ✅ Worker ONLINE: ${decoded.nombre} (${rubro || 'sin rubro'})`);

      // Confirmar al worker
      socket.emit('conectado_ok', {
        socketId: socket.id,
        rubro: rubro,
        mensaje: 'Conectado correctamente. Esperando oportunidades...'
      });

      // Notificar a admins
      io.to('admins').emit('worker_online', {
        userId: decoded.userId,
        nombre: decoded.nombre,
        rubro: rubro,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('[SOCKET] ❌ Error worker_conectado:', error.message);
      socket.emit('error_auth', { mensaje: error.message });
    }
  });

  // ========== CLIENTE ==========
  socket.on('cliente_conectado', async (data) => {
    try {
      const { token } = data;
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      socket.join(`cliente_${decoded.userId}`);
      console.log(`[SOCKET] 👤 Cliente conectado: ${decoded.nombre}`);

      socket.emit('conectado_ok', { tipo: 'cliente', userId: decoded.userId });

    } catch (error) {
      console.error('[SOCKET] ❌ Error cliente_conectado:', error.message);
      socket.emit('error_auth', { mensaje: error.message });
    }
  });

  // ========== ADMIN ==========
  socket.on('admin_conectado', async (data) => {
    try {
      const { token } = data;
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      if (decoded.rol !== 'ADMIN') {
        socket.emit('error_auth', { mensaje: 'No es admin' });
        return;
      }

      socket.join('admins');
      console.log(`[SOCKET] 👑 Admin conectado: ${decoded.nombre}`);

      // Enviar lista de workers online
      socket.emit('workers_online', Object.values(trabajadoresOnline));
      socket.emit('stats_sistema', {
        workersOnline: Object.keys(trabajadoresOnline).length,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('[SOCKET] ❌ Error admin_conectado:', error.message);
    }
  });

  // ========== WORKER ACEPTA TRABAJO ==========
  socket.on('aceptar_trabajo', async (data) => {
    const { pedidoId, token } = data;
    
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const { aceptarTrabajo } = require('./controllers/notificationController');
      
      const result = await aceptarTrabajo(pedidoId, decoded.userId);
      
      if (result.ok) {
        socket.emit('trabajo_aceptado_ok', {
          pedidoId,
          mensaje: '¡Felicitaciones! Asignaste el trabajo. Contacta al cliente.'
        });
        
        // Notificar a otros workers que ya fue tomado
        io.to(`rubro_${result.pedido.tipoServicio}`).emit('pedido_tomado', {
          pedidoId,
          mensaje: 'Este pedido ya fue asignado'
        });
        
      } else {
        socket.emit('trabajo_aceptado_error', result);
      }

    } catch (error) {
      console.error('[SOCKET] ❌ Error aceptar_trabajo:', error.message);
      socket.emit('trabajo_aceptado_error', { ok: false, error: error.message });
    }
  });

  // ========== ACTUALIZAR UBICACIÓN ==========
  socket.on('actualizar_ubicacion', async (data) => {
    try {
      const { token, lat, lng } = data;
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      await Usuario.findByIdAndUpdate(decoded.userId, {
        ubicacion: {
          type: 'Point',
          coordinates: [lng, lat]
        },
        lastLocationUpdate: new Date()
      });

    } catch (error) {
      console.error('[SOCKET] Error actualizar_ubicacion:', error.message);
    }
  });

  // ========== CAMBIAR ESTADO (disponible/ocupado) ==========
  socket.on('cambiar_estado', async (data) => {
    try {
      const { disponible, token } = data;
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      await Usuario.findByIdAndUpdate(decoded.userId, { isOnline: disponible });
      
      if (trabajadoresOnline[socket.id]) {
        trabajadoresOnline[socket.id].disponible = disponible;
      }

      io.to('admins').emit('worker_estado_actualizado', {
        userId: decoded.userId,
        online: disponible,
        nombre: decoded.nombre
      });

      console.log(`[SOCKET] Worker ${decoded.nombre} ahora ${disponible ? 'DISPONIBLE' : 'OCUPADO'}`);

    } catch (error) {
      console.error('[SOCKET] Error cambiar_estado:', error.message);
    }
  });

  // ========== DESCONEXIÓN ==========
  socket.on('disconnect', async (reason) => {
    console.log(`[SOCKET] 🔌 Desconectado: ${socket.id} (${reason})`);
    
    if (trabajadoresOnline[socket.id]) {
      const worker = trabajadoresOnline[socket.id];
      
      // Marcar offline en BD (con delay de 30 seg para reconexiones rápidas)
      setTimeout(async () => {
        // Verificar si se reconectó con otro socket
        const workerActual = await Usuario.findById(worker.userId);
        if (workerActual?.lastSocketId === socket.id) {
          await Usuario.findByIdAndUpdate(worker.userId, { isOnline: false });
          
          io.to('admins').emit('worker_offline', {
            userId: worker.userId,
            nombre: worker.nombre,
            timestamp: new Date().toISOString()
          });
          
          console.log(`[SOCKET] ❌ Worker OFFLINE: ${worker.nombre}`);
        }
      }, 30000);
      
      delete trabajadoresOnline[socket.id];
    }
  });
});

// ===== CONEXIÓN MONGODB =====
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB conectado'))
  .catch(err => {
    console.error('❌ MongoDB error:', err.message);
    process.exit(1);
  });

// ===== INICIAR SERVIDOR =====
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 SERVIRED en puerto ${PORT}`);
  console.log(`📡 Socket.IO activo - Esperando conexiones...`);
  console.log(`🔔 Sistema de notificaciones: LISTO`);
});

module.exports = { app, server, io };
