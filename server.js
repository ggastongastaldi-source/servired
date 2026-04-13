const express = require('express');
const http = require('http');
const socketio = require('socket.io');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const path = require('path');
const dns = require('dns');

dns.setServers(['8.8.8.8', '8.8.4.4']);

const app = express();
require('./services/tensionScheduler');
const server = http.createServer(app);
const io = socketio(server, { cors: { origin: '*' } });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'), {
  etag: false,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
    }
  }
}));

// ✅ Lee MONGODB_URI (Railway) con fallback a MONGO_URI y luego hardcoded
const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb+srv://ggastonnet_db_user:servired2024@cluster0.fjqkqhf.mongodb.net/servired?retryWrites=true&w=majority';
console.log('🔗 Conectando a:', MONGO_URI.replace(/:([^@]+)@/, ':***@'));

mongoose.connect(MONGO_URI, { family: 4 })
  .then(() => console.log('✅ MongoDB conectado'))
  .catch(e => console.error('❌ MongoDB error:', e.message));

// ✅ Rutas con manejo de error de importación
// Socket global para notificaciones
global._io = io;

try {
  app.use('/api/auth', require('./routes/auth'));
} catch(e) { console.error('❌ routes/auth falló:', e.message); }

try {
  app.use('/api/admin', require('./routes/admin'));
} catch(e) { console.error('❌ routes/admin falló:', e.message); }

try {
  app.use('/api/pedidos', require('./routes/pedidos'));
} catch(e) { console.error('❌ routes/pedidos falló:', e.message); }

try {
  app.use('/api/matching', require('./routes/matching'));
} catch(e) { console.error('❌ routes/matching falló:', e.message); }

try {
  app.use('/api/smart-quote', require('./routes/smartQuote'));
} catch(e) { console.error('❌ routes/matching falló:', e.message); }

app.get('/go',(req,res)=>{
  res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body><script>
    const d=sessionStorage.getItem('destino')||'/';
    sessionStorage.removeItem('destino');
    window.location.replace(d);
  </scr`+`ipt></body></html>`);
});
app.get('/cliente.html',(req,res)=>res.sendFile(path.join(__dirname,'public','cliente.html')));
app.get('/trabajador.html',(req,res)=>res.sendFile(path.join(__dirname,'public','trabajador.html')));
app.get('/admin.html',(req,res)=>res.sendFile(path.join(__dirname,'public','admin.html')));
app.get('/redir.html',(req,res)=>res.sendFile(path.join(__dirname,'public','redir.html')));
app.get('/cliente2.html',(req,res)=>res.sendFile(path.join(__dirname,'public','cliente2.html')));
app.get('/health', (req, res) => res.json({ status: 'ok', mongo: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' }));

app.use((req, res) => {
  if (!req.path.startsWith('/api/')) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  } else {
    res.status(404).json({ error: 'Not found' });
  }
});

const trabajadoresOnline = {};
const pedidosActivos = {};

io.on('connection', (socket) => {
  socket.on('worker_conectado', async (data) => {
    try {
      const decoded = jwt.verify(data.token, process.env.JWT_SECRET || 'servired_secret');
      socket.userId = decoded.id;
      socket.join('workers');
      trabajadoresOnline[socket.id] = { userId: decoded.id, nombre: decoded.nombre || 'Trabajador', online: false };
    } catch(e) {}
  });
  socket.on('cambiar_estado_trabajador', async (data) => {
    if (trabajadoresOnline[socket.id]) {
      trabajadoresOnline[socket.id].online = data.online;
      const nombre = trabajadoresOnline[socket.id].nombre;
      io.to('admins').emit(data.online ? 'worker_online' : 'worker_offline', { nombre });
      // Persistir en MongoDB
      try {
        const Usuario = require('./models/Usuario');
        await Usuario.findByIdAndUpdate(trabajadoresOnline[socket.id].userId, { disponible: data.online });
        io.to('admins').emit('worker_estado_actualizado', { userId: trabajadoresOnline[socket.id].userId, online: data.online, nombre });
      } catch(e) { console.error('[Socket] Error actualizando disponible:', e.message); }
    }
  });
  socket.on('ubicacion_trabajador', (data) => {
    if (trabajadoresOnline[socket.id]) {
      trabajadoresOnline[socket.id].lat = data.lat;
      trabajadoresOnline[socket.id].lng = data.lng;
      const pedido = Object.values(pedidosActivos).find(p => p.trabajadorSocketId === socket.id);
      if (pedido) io.to(pedido.clienteSocketId).emit('ubicacion_trabajador', { lat: data.lat, lng: data.lng });
      io.to('admins').emit('ubicacion_trabajador', { trabajadorId: socket.id, nombre: trabajadoresOnline[socket.id].nombre, lat: data.lat, lng: data.lng });
    }
  });
  socket.on('admin_conectado', (data) => {
    try {
      const decoded = jwt.verify(data.token, process.env.JWT_SECRET || 'servired_secret');
      if (decoded.rol === 'ADMIN') socket.join('admins');
    } catch(e) {}
  });
  socket.on('disconnect', () => {
    if (trabajadoresOnline[socket.id]) {
      io.to('admins').emit('worker_offline', { nombre: trabajadoresOnline[socket.id].nombre });
      delete trabajadoresOnline[socket.id];
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => console.log(`🚀 SERVIRED en puerto ${PORT}`));
// cache-bust 1776058351
