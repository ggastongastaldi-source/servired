/**
 * SERVIRED - RUNTIME SOCKET FIX (FINAL LOOP CLOSURE)
 * Cierra: job_request → matching → job_matched → worker fanout
 */

const fs = require('fs');

const file = './server.js'; // entry real del backend en tu repo

if (!fs.existsSync(file)) {
  console.log('[ERROR] server.js no encontrado');
  process.exit(1);
}

let code = fs.readFileSync(file, 'utf8');

/**
 * FIX 1: ensure socket io fanout exists
 */
const injection = `

// ===== SERVIRED SOCKET FANOUT FIX =====
io.on("connection", (socket) => {
  console.log("[SR CONNECT]", socket.id);

  socket.on("job_request", (data) => {
    console.log("[SR JOB_REQUEST]", data);

    // forward into system pipeline
    io.emit("job_request", data);
  });

  socket.on("nueva_oportunidad", (data) => {
    console.log("[SR NUEVA_OP]", data);

    io.emit("nueva_oportunidad", data);
  });
});
// ===== END FIX =====

`;

if (!code.includes('SR SOCKET FANOUT FIX')) {
  code += injection;
  fs.writeFileSync(file, code, 'utf8');
  console.log('[OK] server.js patch aplicado');
} else {
  console.log('[SKIP] ya aplicado');
}
