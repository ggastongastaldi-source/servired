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
