/**
 * FIX 2: Anti-Loop (máximo 5 intentos de búsqueda)
 * Protege contra búsquedas infinitas sin tocar tu lógica
 */

const MAX_INTENTOS = 5;
const intentosPorPedido = new Map();
const timestampsPorPedido = new Map();

module.exports = {
    patch: (io) => {
        io.on('connection', (socket) => {
            
            // Interceptar registrar_pedido
            socket.on('registrar_pedido', (data, callback) => {
                const pedidoId = data?.pedidoId || 'unknown';
                const ahora = Date.now();
                
                // Limpiar intentos antiguos (más de 5 minutos)
                for (const [pid, tiempo] of timestampsPorPedido.entries()) {
                    if (ahora - tiempo > 300000) {
                        intentosPorPedido.delete(pid);
                        timestampsPorPedido.delete(pid);
                    }
                }
                
                // Contar intento
                const actuales = (intentosPorPedido.get(pedidoId) || 0) + 1;
                intentosPorPedido.set(pedidoId, actuales);
                timestampsPorPedido.set(pedidoId, ahora);
                
                console.log('[LOOP-GUARD] Pedido', pedidoId, 'intento', actuales, '/', MAX_INTENTOS);
                
                if (actuales > MAX_INTENTOS) {
                    console.error('[LOOP-GUARD] 🚨 BLOQUEADO - Demasiados intentos para pedido:', pedidoId);
                    if (callback && typeof callback === 'function') {
                        callback({ error: 'Demasiados intentos de búsqueda', bloqueado: true });
                    }
                    return;
                }
                
                // Continuar con el handler original si existe
                if (socket._events && socket._events['registrar_pedido']) {
                    // El handler original se ejecutará después
                }
            });
            
            // Limpiar al completar pedido
            socket.on('trabajo_completado', (data) => {
                const pedidoId = data?.pedidoId;
                if (pedidoId) {
                    intentosPorPedido.delete(pedidoId);
                    timestampsPorPedido.delete(pedidoId);
                    console.log('[LOOP-GUARD] Pedido', pedidoId, 'limpiado de intentos');
                }
            });
            
        });
        console.log('[LOOP-GUARD] Plugin activo - Max intentos:', MAX_INTENTOS);
    }
};
