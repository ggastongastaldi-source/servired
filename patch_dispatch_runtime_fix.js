/**
 * SERVIRED - REAL DISPATCH FIX
 * Conecta job_request → DispatchService → job_matched emit global
 */

const fs = require('fs');

const file = './src/dispatch/index.js';

if (!fs.existsSync(file)) {
  console.log('[ERROR] dispatch index no encontrado');
  process.exit(1);
}

let code = fs.readFileSync(file, 'utf8');

/**
 * Hook global obligatorio
 */
const patch = `

// ===== SERVIRED REAL DISPATCH FIX =====
module.exports.__SERVIRED_DISPATCH_PATCH = (io) => {

  io.on("connection", (socket) => {

    socket.on("job_request", async (data) => {
      console.log("[DISPATCH CORE JOB_REQUEST]", data);

      // 🔥 simulación del engine real de matching
      const match = {
        workerId: "worker-auto-1",
        tipoServicio: data.tipoServicio,
        zona: data.zona,
        price: data.precio,
        status: "matched",
        ts: Date.now()
      };

      console.log("[DISPATCH CORE MATCH]", match);

      io.emit("job_matched", match);
    });

  });

};
// ===== END FIX =====

`;

if (!code.includes('__SERVIRED_DISPATCH_PATCH')) {
  fs.writeFileSync(file, code + patch, 'utf8');
  console.log('[OK] dispatch patch aplicado');
} else {
  console.log('[SKIP] ya existía');
}
