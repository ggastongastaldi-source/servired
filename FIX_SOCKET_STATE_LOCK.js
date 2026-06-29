/**
 * SERVIRED - MINIMAL STATE MACHINE FIX
 * Evita duplicados y agrega control de ciclo de vida
 */

const fs = require('fs');
const file = './server.js';

let code = fs.readFileSync(file, 'utf8');

/**
 * GUARD GLOBAL SIMPLE (runtime memory)
 * clave: jobId -> estado
 */
const PATCH = `
/**
 * === SERVIRED STATE LAYER (MINIMAL) ===
 * job lifecycle control
 */

const __jobState = new Map();

function __getJobId(data) {
  return data.jobId || (data.zona + '_' + data.tipoServicio + '_' + Date.now());
}

function __canProcess(jobId) {
  return !__jobState.has(jobId);
}

function __setState(jobId, state) {
  __jobState.set(jobId, state);
}

function __servired_safe_socket(io) {
  if (!io || io.__safe_state) return;
  io.__safe_state = true;

  io.on('connection', (socket) => {

    socket.on('job_request', (data) => {

      const jobId = __getJobId(data);

      if (!__canProcess(jobId)) {
        console.log('[DUPLICATE BLOCKED]', jobId);
        return;
      }

      __setState(jobId, 'MATCHED');

      const matched = {
        jobId,
        ...data,
        status: 'matched'
      };

      socket.emit('job_matched', matched);
    });

  });
}

module.exports.__servired_safe_socket = __servired_safe_socket;
`;

if (!code.includes('__servired_safe_socket')) {
  code += "\n\n" + PATCH;
  fs.writeFileSync(file, code, 'utf8');
  console.log('[OK] STATE FIX aplicado');
} else {
  console.log('[SKIP] ya existe state fix');
}
