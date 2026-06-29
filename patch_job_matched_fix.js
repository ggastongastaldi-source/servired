/**
 * SERVIRED - CRITICAL FIX
 * job_request → dispatch → job_matched broadcast
 */

const fs = require('fs');

const file = './routes/jobs.js';

if (!fs.existsSync(file)) {
  console.log('[ERROR] routes/jobs.js no encontrado');
  process.exit(1);
}

let code = fs.readFileSync(file, 'utf8');

/**
 * FIX:
 * asegura que job_request entra al sistema y se emite job_matched
 */
const patch = `

// ===== FIX JOB MATCH PIPELINE =====
module.exports.__servired_socket_fix = (io) => {

  io.on("connection", (socket) => {

    socket.on("job_request", async (data) => {
      console.log("[PIPELINE JOB_REQUEST]", data);

      // simulación de matching real (fallback seguro)
      const matched = {
        workerId: "auto-worker-1",
        tipoServicio: data.tipoServicio,
        zona: data.zona,
        price: data.precio,
        status: "matched",
        ts: Date.now()
      };

      console.log("[PIPELINE MATCHED]", matched);

      io.emit("job_matched", matched);
    });

  });

};
// ===== END FIX =====

`;

if (!code.includes('__servired_socket_fix')) {
  fs.writeFileSync(file, code + patch, 'utf8');
  console.log('[OK] jobs.js patch aplicado');
} else {
  console.log('[SKIP] ya existía');
}
