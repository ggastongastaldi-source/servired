#!/usr/bin/env bash
set -euo pipefail

F="nexus/reactive/changeStreamObserver.js"
[ -f "$F" ] || { echo "ERROR: no existe $F"; exit 1; }
cp "$F" "${F}.bak"

node -e "
const fs = require('fs');
const f = '$F';
let src = fs.readFileSync(f, 'utf8');

const OLD_A = \`{ streamId: 'universal_events_stream' }\`;
const NEW_A = \`{ targetCollection: 'events' }\`;
let nA = src.split(OLD_A).length - 1;
if (nA !== 2) { process.stderr.write('ERROR A: patron encontrado ' + nA + ' veces (esperado 2)\\n'); process.exit(1); }
src = src.split(OLD_A).join(NEW_A);

fs.writeFileSync(f, src, 'utf8');
console.log('OK: streamId -> targetCollection en ' + f + ' (' + nA + ' reemplazos)');
"

node -c "$F" && echo "sintaxis OK"
echo ""
echo "FIX APLICADO"
echo "Rollback: cp ${F}.bak $F"
