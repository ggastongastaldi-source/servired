const express = require('express');
const app = express();
const path = require('path');
const fs = require('fs');

app.use(express.json());
app.use(express.static('public'));

// Base de datos en memoria
let usuarios = [];
let trabajadores = [];
let pedidos = [];
let nextId = 1;

// ============ RUTAS DE API ============

// Registro Cliente
app.post('/api/registro/cliente', (req, res) => {
    const { nombre, email, telefono, password } = req.body;
    if (!nombre || !email || !telefono || !password) {
        return res.json({ success: false, error: 'Faltan campos' });
    }
    const usuario = { id: nextId++, nombre, email, telefono, password, tipo: 'cliente' };
    usuarios.push(usuario);
    res.json({ success: true, usuario });
});

// Registro Trabajador
app.post('/api/registro/trabajador', (req, res) => {
    const { nombre, email, telefono, especialidades, cbu, password } = req.body;
    if (!nombre || !email || !telefono || !especialidades || !cbu || !password) {
        return res.json({ success: false, error: 'Faltan campos' });
    }
    const trabajador = {
        id: nextId++,
        nombre,
        email,
        telefono,
        especialidades: especialidades || [],
        cbu,
        password,
        disponible: true,
        calificacion: 5,
        pedidosCompletados: 0,
        tipo: 'trabajador'
    };
    trabajadores.push(trabajador);
    res.json({ success: true, trabajador });
});

// Login
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    let usuario = usuarios.find(u => u.email === email && u.password === password);
    let trabajador = trabajadores.find(t => t.email === email && t.password === password);
    if (usuario) {
        res.json({ success: true, tipo: 'cliente', data: usuario });
    } else if (trabajador) {
        res.json({ success: true, tipo: 'trabajador', data: trabajador });
    } else {
        res.json({ success: false, error: 'Credenciales incorrectas' });
    }
});

// Crear pedido
app.post('/api/pedido', (req, res) => {
    const { clienteId, servicio, direccion, lat, lng } = req.body;
    const pedido = {
        id: nextId++,
        clienteId,
        servicio,
        direccion,
        ubicacion: { lat: lat || -34.6037, lng: lng || -58.3816 },
        estado: 'pendiente',
        trabajadorId: null,
        createdAt: new Date()
    };
    pedidos.push(pedido);
    res.json({ success: true, pedido });
});

// Obtener pedidos
app.get('/api/pedidos', (req, res) => {
    res.json(pedidos.filter(p => p.estado === 'pendiente'));
});

// Aceptar pedido
app.post('/api/pedido/aceptar', (req, res) => {
    const { pedidoId, trabajadorId } = req.body;
    const pedido = pedidos.find(p => p.id == pedidoId);
    if (pedido) {
        pedido.estado = 'asignado';
        pedido.trabajadorId = trabajadorId;
        res.json({ success: true });
    } else {
        res.json({ success: false });
    }
});

// Healthcheck
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
});

// Servir el frontend - SIN usar comodines (*)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Para cualquier otra ruta que no sea API, servir el index.html
app.use((req, res, next) => {
    if (req.path.startsWith('/api/') || req.path === '/health') {
        next();
    } else {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`🚀 SERVIRED corriendo en http://localhost:${PORT}`);
});

// ══════════════════════════════════════════════════════
// SOCKET.IO — Triángulo Cliente / Trabajador / Admin
// ══════════════════════════════════════════════════════
const trabajadoresOnline = {};
const pedidosActivos = {};

io.on('connection', (socket) => {
  socket.on('worker_conectado', async (data) => {
    try {
      const decoded = jwt.verify(data.token, process.env.JWT_SECRET);
      socket.userId = decoded.id;
      socket.join('workers');
      trabajadoresOnline[socket.id] = { userId: decoded.id, nombre: decoded.nombre || 'Trabajador', online: false };
    } catch(e) {}
  });
  socket.on('cambiar_estado_trabajador', (data) => {
    if (trabajadoresOnline[socket.id]) {
      trabajadoresOnline[socket.id].online = data.online;
      io.to('admins').emit(data.online ? 'worker_online' : 'worker_offline', { nombre: trabajadoresOnline[socket.id].nombre });
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
      const decoded = jwt.verify(data.token, process.env.JWT_SECRET);
      if (decoded.rol === 'ADMIN') socket.join('admins');
    } catch(e) {}
  });
  socket.on('nuevo_pedido', async (data) => {
    try {
      const decoded = jwt.verify(data.token, process.env.JWT_SECRET);
      const Pedido = require('./models/Pedido');
      const pedido = await Pedido.create({ cliente: decoded.id, tipoServicio: data.servicio, direccion: data.direccion, precio: data.precio, estado: 'PENDIENTE' });
      const pid = pedido._id.toString();
      pedidosActivos[pid] = { pedidoId: pid, clienteSocketId: socket.id, clienteNombre: decoded.nombre, servicio: data.servicio, direccion: data.direccion, precio: data.precio };
      Object.entries(trabajadoresOnline).filter(([,w]) => w.online).forEach(([sid]) => {
        io.to(sid).emit('nuevo_pedido_disponible', { pedidoId: pid, servicio: data.servicio, direccion: data.direccion, precio: data.precio, clienteNombre: decoded.nombre });
      });
      io.to('admins').emit('nuevo_pedido_admin', { pedidoId: pid, servicio: data.servicio, precio: data.precio });
    } catch(e) { console.error('nuevo_pedido:', e.message); }
  });
  socket.on('aceptar_pedido', async (data) => {
    try {
      const decoded = jwt.verify(data.token, process.env.JWT_SECRET);
      const Pedido = require('./models/Pedido');
      await Pedido.findByIdAndUpdate(data.pedidoId, { estado: 'ACEPTADA', trabajador: decoded.id });
      const pedido = pedidosActivos[data.pedidoId];
      if (pedido) {
        pedido.trabajadorSocketId = socket.id;
        const w = trabajadoresOnline[socket.id];
        io.to(pedido.clienteSocketId).emit('pedido_aceptado', { pedidoId: data.pedidoId, trabajador: { nombre: decoded.nombre, lat: w?.lat || -34.6037, lng: w?.lng || -58.3816 }, eta: Math.floor(Math.random()*15)+5 });
        io.to('admins').emit('pedido_aceptado_admin', { pedidoId: data.pedidoId, trabajadorNombre: decoded.nombre });
      }
    } catch(e) { console.error('aceptar_pedido:', e.message); }
  });
  socket.on('rechazar_pedido', () => {});
  socket.on('cambiar_estado_pedido', async (data) => {
    try {
      const Pedido = require('./models/Pedido');
      await Pedido.findByIdAndUpdate(data.pedidoId, { estado: data.estado });
      const pedido = pedidosActivos[data.pedidoId];
      if (pedido) {
        io.to(pedido.clienteSocketId).emit('estado_pedido_actualizado', { estado: data.estado });
        io.to('admins').emit('estado_pedido_admin', { pedidoId: data.pedidoId, estado: data.estado });
        if (data.estado === 'PAGADA') {
          io.to(pedido.clienteSocketId).emit('pedido_completado');
          io.to('admins').emit('pedido_completado_admin', { pedidoId: data.pedidoId, precio: pedido.precio });
          delete pedidosActivos[data.pedidoId];
        }
      }
    } catch(e) {}
  });
  socket.on('cancelar_pedido', async (data) => {
    try {
      const Pedido = require('./models/Pedido');
      await Pedido.findByIdAndUpdate(data.pedidoId, { estado: 'CANCELADA' });
      const pedido = pedidosActivos[data.pedidoId];
      if (pedido?.trabajadorSocketId) io.to(pedido.trabajadorSocketId).emit('pedido_cancelado');
      delete pedidosActivos[data.pedidoId];
    } catch(e) {}
  });
  socket.on('disconnect', () => {
    if (trabajadoresOnline[socket.id]) {
      io.to('admins').emit('worker_offline', { nombre: trabajadoresOnline[socket.id].nombre });
      delete trabajadoresOnline[socket.id];
    }
  });
});

// ══════════════════════════════════════════════════════
// SOCKET.IO — Triángulo Cliente / Trabajador / Admin
// ══════════════════════════════════════════════════════
const trabajadoresOnline = {};
const pedidosActivos = {};

io.on('connection', (socket) => {
  socket.on('worker_conectado', async (data) => {
    try {
      const decoded = jwt.verify(data.token, process.env.JWT_SECRET);
      socket.userId = decoded.id;
      socket.join('workers');
      trabajadoresOnline[socket.id] = { userId: decoded.id, nombre: decoded.nombre || 'Trabajador', online: false };
    } catch(e) {}
  });
  socket.on('cambiar_estado_trabajador', (data) => {
    if (trabajadoresOnline[socket.id]) {
      trabajadoresOnline[socket.id].online = data.online;
      io.to('admins').emit(data.online ? 'worker_online' : 'worker_offline', { nombre: trabajadoresOnline[socket.id].nombre });
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
      const decoded = jwt.verify(data.token, process.env.JWT_SECRET);
      if (decoded.rol === 'ADMIN') socket.join('admins');
    } catch(e) {}
  });
  socket.on('nuevo_pedido', async (data) => {
    try {
      const decoded = jwt.verify(data.token, process.env.JWT_SECRET);
      const Pedido = require('./models/Pedido');
      const pedido = await Pedido.create({ cliente: decoded.id, tipoServicio: data.servicio, direccion: data.direccion, precio: data.precio, estado: 'PENDIENTE' });
      const pid = pedido._id.toString();
      pedidosActivos[pid] = { pedidoId: pid, clienteSocketId: socket.id, clienteNombre: decoded.nombre, servicio: data.servicio, direccion: data.direccion, precio: data.precio };
      Object.entries(trabajadoresOnline).filter(([,w]) => w.online).forEach(([sid]) => {
        io.to(sid).emit('nuevo_pedido_disponible', { pedidoId: pid, servicio: data.servicio, direccion: data.direccion, precio: data.precio, clienteNombre: decoded.nombre });
      });
      io.to('admins').emit('nuevo_pedido_admin', { pedidoId: pid, servicio: data.servicio, precio: data.precio });
    } catch(e) { console.error('nuevo_pedido:', e.message); }
  });
  socket.on('aceptar_pedido', async (data) => {
    try {
      const decoded = jwt.verify(data.token, process.env.JWT_SECRET);
      const Pedido = require('./models/Pedido');
      await Pedido.findByIdAndUpdate(data.pedidoId, { estado: 'ACEPTADA', trabajador: decoded.id });
      const pedido = pedidosActivos[data.pedidoId];
      if (pedido) {
        pedido.trabajadorSocketId = socket.id;
        const w = trabajadoresOnline[socket.id];
        io.to(pedido.clienteSocketId).emit('pedido_aceptado', { pedidoId: data.pedidoId, trabajador: { nombre: decoded.nombre, lat: w?.lat || -34.6037, lng: w?.lng || -58.3816 }, eta: Math.floor(Math.random()*15)+5 });
        io.to('admins').emit('pedido_aceptado_admin', { pedidoId: data.pedidoId, trabajadorNombre: decoded.nombre });
      }
    } catch(e) { console.error('aceptar_pedido:', e.message); }
  });
  socket.on('rechazar_pedido', () => {});
  socket.on('cambiar_estado_pedido', async (data) => {
    try {
      const Pedido = require('./models/Pedido');
      await Pedido.findByIdAndUpdate(data.pedidoId, { estado: data.estado });
      const pedido = pedidosActivos[data.pedidoId];
      if (pedido) {
        io.to(pedido.clienteSocketId).emit('estado_pedido_actualizado', { estado: data.estado });
        io.to('admins').emit('estado_pedido_admin', { pedidoId: data.pedidoId, estado: data.estado });
        if (data.estado === 'PAGADA') {
          io.to(pedido.clienteSocketId).emit('pedido_completado');
          io.to('admins').emit('pedido_completado_admin', { pedidoId: data.pedidoId, precio: pedido.precio });
          delete pedidosActivos[data.pedidoId];
        }
      }
    } catch(e) {}
  });
  socket.on('cancelar_pedido', async (data) => {
    try {
      const Pedido = require('./models/Pedido');
      await Pedido.findByIdAndUpdate(data.pedidoId, { estado: 'CANCELADA' });
      const pedido = pedidosActivos[data.pedidoId];
      if (pedido?.trabajadorSocketId) io.to(pedido.trabajadorSocketId).emit('pedido_cancelado');
      delete pedidosActivos[data.pedidoId];
    } catch(e) {}
  });
  socket.on('disconnect', () => {
    if (trabajadoresOnline[socket.id]) {
      io.to('admins').emit('worker_offline', { nombre: trabajadoresOnline[socket.id].nombre });
      delete trabajadoresOnline[socket.id];
    }
  });
});

// ══════════════════════════════════════════════════════
// SOCKET.IO — Triángulo Cliente / Trabajador / Admin
// ══════════════════════════════════════════════════════
const trabajadoresOnline = {};
const pedidosActivos = {};

io.on('connection', (socket) => {
  socket.on('worker_conectado', async (data) => {
    try {
      const decoded = jwt.verify(data.token, process.env.JWT_SECRET);
      socket.userId = decoded.id;
      socket.join('workers');
      trabajadoresOnline[socket.id] = { userId: decoded.id, nombre: decoded.nombre || 'Trabajador', online: false };
    } catch(e) {}
  });
  socket.on('cambiar_estado_trabajador', (data) => {
    if (trabajadoresOnline[socket.id]) {
      trabajadoresOnline[socket.id].online = data.online;
      io.to('admins').emit(data.online ? 'worker_online' : 'worker_offline', { nombre: trabajadoresOnline[socket.id].nombre });
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
      const decoded = jwt.verify(data.token, process.env.JWT_SECRET);
      if (decoded.rol === 'ADMIN') socket.join('admins');
    } catch(e) {}
  });
  socket.on('nuevo_pedido', async (data) => {
    try {
      const decoded = jwt.verify(data.token, process.env.JWT_SECRET);
      const Pedido = require('./models/Pedido');
      const pedido = await Pedido.create({ cliente: decoded.id, tipoServicio: data.servicio, direccion: data.direccion, precio: data.precio, estado: 'PENDIENTE' });
      const pid = pedido._id.toString();
      pedidosActivos[pid] = { pedidoId: pid, clienteSocketId: socket.id, clienteNombre: decoded.nombre, servicio: data.servicio, direccion: data.direccion, precio: data.precio };
      Object.entries(trabajadoresOnline).filter(([,w]) => w.online).forEach(([sid]) => {
        io.to(sid).emit('nuevo_pedido_disponible', { pedidoId: pid, servicio: data.servicio, direccion: data.direccion, precio: data.precio, clienteNombre: decoded.nombre });
      });
      io.to('admins').emit('nuevo_pedido_admin', { pedidoId: pid, servicio: data.servicio, precio: data.precio });
    } catch(e) { console.error('nuevo_pedido:', e.message); }
  });
  socket.on('aceptar_pedido', async (data) => {
    try {
      const decoded = jwt.verify(data.token, process.env.JWT_SECRET);
      const Pedido = require('./models/Pedido');
      await Pedido.findByIdAndUpdate(data.pedidoId, { estado: 'ACEPTADA', trabajador: decoded.id });
      const pedido = pedidosActivos[data.pedidoId];
      if (pedido) {
        pedido.trabajadorSocketId = socket.id;
        const w = trabajadoresOnline[socket.id];
        io.to(pedido.clienteSocketId).emit('pedido_aceptado', { pedidoId: data.pedidoId, trabajador: { nombre: decoded.nombre, lat: w?.lat || -34.6037, lng: w?.lng || -58.3816 }, eta: Math.floor(Math.random()*15)+5 });
        io.to('admins').emit('pedido_aceptado_admin', { pedidoId: data.pedidoId, trabajadorNombre: decoded.nombre });
      }
    } catch(e) { console.error('aceptar_pedido:', e.message); }
  });
  socket.on('rechazar_pedido', () => {});
  socket.on('cambiar_estado_pedido', async (data) => {
    try {
      const Pedido = require('./models/Pedido');
      await Pedido.findByIdAndUpdate(data.pedidoId, { estado: data.estado });
      const pedido = pedidosActivos[data.pedidoId];
      if (pedido) {
        io.to(pedido.clienteSocketId).emit('estado_pedido_actualizado', { estado: data.estado });
        io.to('admins').emit('estado_pedido_admin', { pedidoId: data.pedidoId, estado: data.estado });
        if (data.estado === 'PAGADA') {
          io.to(pedido.clienteSocketId).emit('pedido_completado');
          io.to('admins').emit('pedido_completado_admin', { pedidoId: data.pedidoId, precio: pedido.precio });
          delete pedidosActivos[data.pedidoId];
        }
      }
    } catch(e) {}
  });
  socket.on('cancelar_pedido', async (data) => {
    try {
      const Pedido = require('./models/Pedido');
      await Pedido.findByIdAndUpdate(data.pedidoId, { estado: 'CANCELADA' });
      const pedido = pedidosActivos[data.pedidoId];
      if (pedido?.trabajadorSocketId) io.to(pedido.trabajadorSocketId).emit('pedido_cancelado');
      delete pedidosActivos[data.pedidoId];
    } catch(e) {}
  });
  socket.on('disconnect', () => {
    if (trabajadoresOnline[socket.id]) {
      io.to('admins').emit('worker_offline', { nombre: trabajadoresOnline[socket.id].nombre });
      delete trabajadoresOnline[socket.id];
    }
  });
});
