/**
 * SERVIRED - ACTIVATION FIX (REAL ENTRYPOINT)
 * Engancha job_request al runtime vivo del server
 */

const fs = require('fs');

const file = './server.js';

if (!fs.existsSync(file)) {
  console.log('[ERROR] server.js no encontrado');
  process.exit(1);
}

let code = fs.readFileSync(file, 'utf8');

/**
 * 🔥 INYECCIÓN EN ENTRYPOINT REAL
 */
const patch = `

// ===== SERVIRED REAL SOCKET ACTIVATION =====
const { handleSocketEvents } = require('./src/core/services/socketHandlers');

io.on("connection", (socket) => {

  console.log("[SR ACTIVE SOCKET]", socket.id);

  socket.on("job_request", (data) => {
    console.log("[SR ENTRY job_request]", data);

    // 👉 pasa al runtime REAL del sistema
    handleSocketEvents?.("job_request", data, io);
  });

});
// ===== END ACTIVATION =====

`;

if (!code.includes('SR ACTIVE SOCKET')) {
  fs.writeFileSync(file, code + patch, 'utf8');
  console.log('[OK] server.js activado correctamente');
} else {
  console.log('[SKIP] ya estaba activo');
}
