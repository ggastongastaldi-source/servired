/**
 * SERVIRED - ENTRYPOINT TRACE
 * Detecta qué archivo REAL está corriendo en Render
 */

const fs = require('fs');
const path = require('path');

const candidates = [
  './server.js',
  './src/index.js',
  './src/app.js',
  './src/server.js',
  './src/core/index.js',
  './dist/server.js',
  './dist/index.js'
];

console.log('\n[TRACE] buscando entrypoint activo...\n');

for (const f of candidates) {
  if (fs.existsSync(f)) {
    console.log('[FOUND FILE]', f);
    try {
      const content = fs.readFileSync(f, 'utf8');
      if (content.includes('socket') || content.includes('io.on')) {
        console.log('[LIKELY SOCKET SERVER]', f);
      }
    } catch (e) {}
  }
}

console.log('\n[INFO] ahora revisá Render entrypoint real en logs.');
