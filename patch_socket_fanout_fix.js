/**
 * SERVIRED - SOCKET FANOUT FIX
 * Cierra el loop: entrada → router → broadcast workers
 */

const fs = require('fs');

const file = './src/shared/events/eventRouter.js';

if (!fs.existsSync(file)) {
  console.log('[ERROR] eventRouter no encontrado:', file);
  process.exit(1);
}

let code = fs.readFileSync(file, 'utf8');

const hook = `
/**
 * AUTO-FIX FANOUT (Socket broadcast)
 */
function ensureSocketFanout(io) {
  if (!io) return;

  io.on('connection', (socket) => {
    socket.on('nueva_oportunidad', (data) => {
      console.log('[FANOUT FIX] broadcasting:', data);
      io.emit('nueva_oportunidad', data);
    });
  });
}

module.exports.ensureSocketFanout = ensureSocketFanout;
`;

if (!code.includes('ensureSocketFanout')) {
  fs.writeFileSync(file, code + '\n\n' + hook);
  console.log('[OK] PATCH aplicado en eventRouter');
} else {
  console.log('[SKIP] ya existía el fix');
}
