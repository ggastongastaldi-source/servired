const { runCommand } = require('../core/commandRunner');

async function emergencyBroadcast(req, res) {
  return await runCommand('EMERGENCY_BROADCAST', req, async (cid) => {
    const isDryRun = req.headers['x-dry-run'] === 'true';
    const { mensaje, zona } = req.body;

    // Lógica simulada para el conteo
    const workersCount = 45; // Aquí iría la consulta real a DB

    if (isDryRun) {
      return { 
        mode: 'DRY_RUN', 
        notificados: 0, 
        potenciales: workersCount,
        mensaje: "[SIMULACIÓN] No se enviaron mensajes reales."
      };
    }

    // Si no es Dry-Run, aquí Clau inyectará el loop de sockets
    return { mode: 'LIVE', notificados: workersCount };
  });
}

module.exports = { emergencyBroadcast };
