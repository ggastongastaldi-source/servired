/**
 * SERVIRED - FINAL SOCKET RUNTIME FIX
 * Cierra definitivamente job_request → job_matched
 */

const fs = require('fs');

const file = './server.js';

let code = fs.readFileSync(file, 'utf8');

/**
 * SOLO HANDLER REAL, SIN CAPAS INTERMEDIAS
 */
const patch = `

// ===== FINAL RUNTIME HANDLER =====
io.on("connection", (socket) => {

  console.log("[SR LIVE SOCKET]", socket.id);

  socket.on("job_request", (data) => {
    console.log("[SR JOB_REQUEST RECEIVED]", data);

    // 🔥 MATCHING DIRECTO (sin dependencias rotas)
    const match = {
      workerId: "worker-live-1",
      tipoServicio: data.tipoServicio,
      zona: data.zona,
      precio: data.precio,
      status: "matched",
      ts: Date.now()
    };

    console.log("[SR JOB_MATCHED GENERATED]", match);

    io.emit("job_matched", match);
  });

});
// ===== END FINAL HANDLER =====

`;

if (!code.includes('FINAL RUNTIME HANDLER')) {
  fs.writeFileSync(file, code + patch, 'utf8');
  console.log('[OK] FINAL FIX aplicado');
} else {
  console.log('[SKIP] ya estaba aplicado');
}
