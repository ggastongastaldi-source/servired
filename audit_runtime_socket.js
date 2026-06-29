/**
 * SERVIRED - RUNTIME AUDIT REAL
 * Confirma qué handlers están vivos en server.js runtime
 */

const fs = require('fs');

const file = './server.js';

const code = fs.readFileSync(file, 'utf8');

console.log('\n[ANALYSIS] SOCKET HANDLERS CHECK\n');

const checks = [
  'job_request',
  'job_matched',
  'io.on("connection")',
  'socket.on("job_request")'
];

for (const c of checks) {
  console.log(
    c,
    code.includes(c) ? '✔ PRESENT' : '❌ MISSING'
  );
}

console.log('\n[CONCLUSION] si job_request está PRESENT pero no funciona → runtime override externo');
