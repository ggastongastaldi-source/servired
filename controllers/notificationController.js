const Pedido = require('../models/Pedido');
const Usuario = require('../models/Usuario');

// Buscar workers disponibles (versión flexible)
async function buscarWorkersDisponibles(rubro, zona, lat, lng) {
    console.log(`[BUSCAR] Rubro: ${rubro} | Zona: ${zona} | Ubicación: ${lat},${lng}`);
    
    // Normalizar rubro (todo a minúscula, sin espacios)
    const rubroNormalizado = (rubro || '').toString().toLowerCase().trim();
    
    console.log(`[BUSCAR] Rubro normalizado: ${rubroNormalizado}`);
    
    // Buscar TODOS los workers online del rubro (sin filtro GPS por ahora)
    const workers = await Usuario.find({
        rol: 'WORKER',
        isOnline: true,
        rubro: { $regex: rubroNormalizado, $options: 'i' } // Búsqueda flexible
    });
    
    console.log(`[BUSCAR] Workers encontrados: ${workers.length}`);
    workers.forEach(w => console.log(`   - ${w.nombre} (${w.rubro})`));
    
    return workers;
}

// Iniciar flujo de búsqueda
async function iniciarFlujoBusqueda(pedidoId) {
    try {
        const pedido = await Pedido.findById(pedidoId).populate('cliente');
        if (!pedido) return;
        
        console.log(`[FLUJO] Pedido ${pedidoId} - ${pedido.tipoServicio} en ${pedido.zona}`);
        
        // Buscar workers
        const workers = await buscarWorkersDisponibles(
            pedido.tipoServicio,
            pedido.zona,
            pedido.ubicacion?.coordinates?.[1],
            pedido.ubicacion?.coordinates?.[0]
        );
        
        if (workers.length === 0) {
            console.log(`[FLUJO] ❌ No hay workers disponibles`);
            
            // Notificar al cliente que no hay nadie
            const io = global.io;
            if (io) {
                io.to(`cliente_${pedido.cliente._id}`).emit('estado_pedido', {
                    fase: 'SIN_WORKERS',
                    titulo: 'Sin especialistas disponibles',
                    mensaje: 'No hay trabajadores de este rubro conectados ahora'
                });
            }
            return;
        }
        
        // Notificar a cada worker
        const io = global.io;
        let notificados = 0;
        
        for (const worker of workers) {
            // Enviar por socket si está conectado
            io.to(`worker_${worker._id}`).emit('nueva_oportunidad', {
                pedidoId: pedido._id,
                rubro: pedido.tipoServicio,
                zona: pedido.zona,
                precio: pedido.total_estimado,
                descripcion: pedido.descripcion,
                direccion: pedido.direccion
            });
            notificados++;
            
            // Guardar que fue notificado
            await Pedido.findByIdAndUpdate(pedidoId, {
                $addToSet: { workersNotificados: worker._id }
            });
        }
        
        console.log(`[FLUJO] ✅ Notificados ${notificados} workers`);
        
        // Actualizar estado del pedido
        await Pedido.findByIdAndUpdate(pedidoId, { estado: 'SEARCHING' });
        
        // Notificar al cliente
        io.to(`cliente_${pedido.cliente._id}`).emit('estado_pedido', {
            fase: 'SEARCHING',
            titulo: 'Buscando especialista',
            mensaje: `Hay ${notificados} trabajadores disponibles`
        });
        
    } catch (error) {
        console.error(`[FLUJO] Error:`, error);
    }
}

// Aceptar trabajo
async function aceptarTrabajo(pedidoId, workerId) {
    try {
        const pedido = await Pedido.findById(pedidoId);
        if (!pedido) return { ok: false, error: 'Pedido no existe' };
        
        if (pedido.estado === 'ACEPTADO') {
            return { ok: false, error: 'Ya fue tomado por otro' };
        }
        
        pedido.worker = workerId;
        pedido.estado = 'ACEPTADO';
        await pedido.save();
        
        // Notificar al cliente
        const io = global.io;
        io.to(`cliente_${pedido.cliente}`).emit('trabajo_aceptado', {
            pedidoId: pedido._id,
            mensaje: '¡Tu pedido fue aceptado!'
        });
        
        return { ok: true, pedido };
        
    } catch (error) {
        return { ok: false, error: error.message };
    }
}

module.exports = { 
    iniciarFlujoBusqueda, 
    aceptarTrabajo,
    buscarWorkersDisponibles 
};
