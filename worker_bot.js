const io = require('socket.io-client');
const rubro = process.argv[2];
const zona = process.argv[3];
const id = process.argv[4];

const socket = io('https://servired-production.up.railway.app', {
    transports: ['websocket'],
    auth: { token: 'SIMULATED_TOKEN' } // El backend debe permitir bypass o usar un token genérico
});

socket.on('connect', () => {
    console.log(`[Worker ${id}] Conectado - Rubro: ${rubro} | Zona: ${zona}`);
    socket.emit('worker_conectado', { userId: `bot_${id}`, rubro, zona, estado: 'disponible' });
});

socket.on('nueva_oportunidad', (data) => {
    console.log(`[Worker ${id}] 🔔 RECIBIDO: Pedido ${data.pedidoId} en ${rubro}`);
    // Simular reacción rápida
    setTimeout(() => {
        socket.emit('aceptar_trabajo', { pedidoId: data.pedidoId, trabajadorId: `bot_${id}` });
    }, Math.random() * 2000); 
});

socket.on('disconnect', () => console.log(`[Worker ${id}] Desconectado.`));
