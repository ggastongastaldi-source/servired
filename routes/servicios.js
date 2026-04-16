const express = require('express');
const router = express.Router();
const { verificarToken } = require('../middleware/auth');

// POST /api/servicios - Crear servicio y notificar workers
router.post('/', async (req, res) => {
    try {
        console.log('[API] 📥 Nuevo servicio recibido:', JSON.stringify(req.body));
        
        const { prestador, rubro, descripcion, cliente, moneda, ubicacion } = req.body;
        
        // Validación
        if (!prestador || !rubro || !descripcion) {
            console.log('[API] ❌ Faltan datos');
            return res.status(400).json({ 
                ok: false, 
                error: 'Faltan datos: prestador, rubro, descripcion' 
            });
        }

        // Normalizar rubro (mayúsculas, sin acentos)
        const rubroNormalizado = rubro
            .toString()
            .toUpperCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim();

        console.log('[API] 🔍 Rubro normalizado:', rubroNormalizado);

        // Obtener io y trabajadores del app
        const io = req.app.get('io');
        const trabajadoresOnline = req.app.get('trabajadoresOnline') || {};
        
        console.log('[SOCKET] 📡 Workers conectados:', Object.keys(trabajadoresOnline).length);
        console.log('[SOCKET] Lista:', Object.values(trabajadoresOnline).map(w => `${w.nombre}(${w.rubro})`));

        // Buscar workers del mismo rubro
        let notificados = 0;
        const workersNotificados = [];
        
        for (const [socketId, worker] of Object.entries(trabajadoresOnline)) {
            const workerRubro = (worker.rubro || '')
                .toUpperCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '');
            
            console.log(`[SOCKET] Comparando: Worker=${workerRubro} vs Servicio=${rubroNormalizado}`);
            
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

        const respuesta = {
            ok: true,
            mensaje: 'Servicio procesado',
            servicio: {
                prestador,
                rubro: rubroNormalizado,
                descripcion,
                cliente
            },
            notificados: notificados,
            workersNotificados: workersNotificados,
            totalWorkersOnline: Object.keys(trabajadoresOnline).length
        };

        console.log('[API] ✅ Respuesta:', JSON.stringify(respuesta));
        res.json(respuesta);

    } catch (err) {
        console.error('[API] ❌ Error:', err);
        res.status(500).json({ ok: false, error: err.message });
    }
});

// GET /api/servicios - Test
router.get('/', (req, res) => {
    res.json({ ok: true, mensaje: 'Ruta de servicios activa' });
});

module.exports = router;
