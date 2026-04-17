/**
 * FIX 3: GPS Batería-Eficiente
 * Modo IDLE (120s) vs ACTIVO (8s) automático
 */

const INTERVALO_IDLE = 120000;   // 2 minutos
const INTERVALO_ACTIVO = 8000;   // 8 segundos
const modoPorWorker = new Map();

module.exports = {
    patch: (io) => {
        io.on('connection', (socket) => {
            const workerId = socket.id;
            
            // Al conectar worker, iniciar en modo IDLE
            socket.on('worker_conectado', (data) => {
                modoPorWorker.set(workerId, 'IDLE');
                
                socket.emit('modo_gps', {
                    modo: 'IDLE',
                    intervalo: INTERVALO_IDLE,
                    mensaje: 'Disponible - GPS cada 2 min'
                });
                console.log('[GPS-MANAGER]', workerId, 'en modo IDLE');
            });

            // Cuando acepta trabajo, cambiar a ACTIVO
            socket.on('aceptar_trabajo', (data) => {
                modoPorWorker.set(workerId, 'ACTIVO');
                
                socket.emit('modo_gps', {
                    modo: 'ACTIVO',
                    intervalo: INTERVALO_ACTIVO,
                    mensaje: 'En servicio - GPS en tiempo real'
                });
                console.log('[GPS-MANAGER]', workerId, 'en modo ACTIVO');
            });

            // Cuando completa, volver a IDLE
            socket.on('trabajo_completado', () => {
                modoPorWorker.set(workerId, 'IDLE');
                
                socket.emit('modo_gps', {
                    modo: 'IDLE',
                    intervalo: INTERVALO_IDLE,
                    mensaje: 'Disponible - GPS cada 2 min'
                });
                console.log('[GPS-MANAGER]', workerId, 'vuelve a IDLE');
            });

            // Limpiar al desconectar
            socket.on('disconnect', () => {
                modoPorWorker.delete(workerId);
                console.log('[GPS-MANAGER]', workerId, 'desconectado, limpiado');
            });
        });

        console.log('[GPS-MANAGER] Plugin activo - IDLE:', INTERVALO_IDLE/1000 + 's, ACTIVO:', INTERVALO_ACTIVO/1000 + 's');
    }
};
