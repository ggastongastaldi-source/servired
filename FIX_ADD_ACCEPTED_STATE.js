/**
 * SERVIRED - MINIMAL LIFECYCLE EXTENSION
 * agrega ACCEPTED sin romper flujo actual
 */

const fs = require('fs');
const file = './server.js';

let code = fs.readFileSync(file, 'utf8');

const PATCH = `
/**
 * === LIFECYCLE EXTENSION (MINIMAL) ===
 * MATCHED → ACCEPTED
 */

async function __servired_extend_lifecycle(io) {
  if (!io || io.__lifecycle_extended) return;
  io.__lifecycle_extended = true;

  console.log('[SR LIFECYCLE] ACCEPTED stage enabled');

  io.on('connection', (socket) => {

    /**
     * worker acepta job
     */
    socket.on('job_accept', async (data) => {

      const event = {
        jobId: data.jobId,
        status: 'accepted',
        workerId: data.workerId || 'unknown',
        ts: Date.now()
      };

      console.log('[JOB ACCEPTED]', event);

      /**
       * notifica al cliente/flujo
       */
      socket.emit('job_accepted', event);

      /**
       * broadcast opcional (no rompe nada existente)
       */
      socket.broadcast.emit('job_accepted', event);
    });

  });
}

module.exports.__servired_extend_lifecycle = __servired_extend_lifecycle;
`;

if (!code.includes('__servired_extend_lifecycle')) {
  code += "\n\n" + PATCH;
  fs.writeFileSync(file, code, 'utf8');
  console.log('[OK] ACCEPTED STATE agregado');
} else {
  console.log('[SKIP] ya existe ACCEPTED');
}
