/**
 * SERVIRED - SINGLE SOURCE SOCKET FIX
 * Cierra loop real: job_request → job_matched
 * SIN duplicar listeners
 */

const fs = require('fs');
const path = './server.js';

let code = fs.readFileSync(path, 'utf8');

/**
 * 1. ASEGURAR SOCKET.IO SERVER BOOTSTRAP
 * (sin esto, todo fanout es humo)
 */
if (!code.includes('socket.io')) {
  console.log('[ERROR] socket.io no inicializado en server.js');
  process.exit(1);
}

/**
 * 2. INYECTAR HANDLER CANÓNICO SOLO SI NO EXISTE
 */
const FIX_BLOCK = `
/**
 * === SERVIRED SOCKET CORE FIX (AUTO) ===
 * WARNING: single registration guard
 */
function __servired_socket_fix(io) {
  if (!io || io.__servired_fixed) return;
  io.__servired_fixed = true;

  console.log('[SR SOCKET FIX] fanout activado');

  io.on('connection', (socket) => {

    socket.on('job_request', (data) => {
      console.log('[SR job_request]', data);

      const matched = {
        jobId: 'job_' + Date.now(),
        ...data,
        status: 'matched'
      };

      socket.emit('job_matched', matched);
    });

  });
}

module.exports.__servired_socket_fix = __servired_socket_fix;
`;

if (!code.includes('__servired_socket_fix')) {
  code += "\n\n" + FIX_BLOCK;
  fs.writeFileSync(path, code, 'utf8');
  console.log('[OK] FIX aplicado en server.js');
} else {
  console.log('[SKIP] ya existe fix');
}
