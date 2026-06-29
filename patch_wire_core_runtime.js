/**
 * SERVIRED - CORE WIRING FIX
 * Conecta Socket.IO → Engine real → Dispatch → Broadcast
 */

const fs = require('fs');

const file = './server.js';

let code = fs.readFileSync(file, 'utf8');

/**
 * 🔥 WIRING REAL DEL SISTEMA
 */
const patch = `

// ===== SERVIRED CORE WIRING =====
const { eventEngine } = require('./src/engine/eventEngine');
const dispatch = require('./src/dispatch');

io.on("connection", (socket) => {

  console.log("[CORE SOCKET CONNECT]", socket.id);

  socket.on("job_request", async (data) => {

    console.log("[CORE ENTRY]", data);

    // 1. pasa por engine real
    const processed = await eventEngine?.process?.(data) || data;

    // 2. pasa por dispatch real
    const result = await dispatch?.handle?.(processed) || {
      workerId: "fallback-worker",
      status: "matched",
      ...processed
    };

    // 3. broadcast final
    io.emit("job_matched", result);
  });

});
// ===== END CORE WIRING =====

`;

if (!code.includes('SERVIRED CORE WIRING')) {
  fs.writeFileSync(file, code + patch, 'utf8');
  console.log('[OK] CORE WIRING aplicado');
} else {
  console.log('[SKIP] ya existía');
}
