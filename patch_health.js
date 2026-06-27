const fs = require("fs");

const file = "./server.js";
let code = fs.readFileSync(file, "utf8");

/**
 * 1. eliminar cualquier /health existente
 */
code = code.replace(/app\.get\(['"]\/health['"][\s\S]*?\n\}\);/g, "");

/**
 * 2. nuevo endpoint estable
 */
const patch = `
const bus = require("./runtime/systemStateBus");

app.get('/health', (req, res) => {
  const state = bus.getState ? bus.getState() : {};

  res.json({
    status: (state.system && state.system.status) || 'unknown',
    score: (state.system && state.system.score) || 0,

    process: state.process || {
      pid: null,
      alive: false,
      cpu: 0,
      mem: 0
    },

    services: state.services || {
      mongo: 'unknown',
      nexus: 'unknown',
      sinapsis: 'unknown',
      aladdin: 'unknown'
    },

    governance: state.governance || null,
    timestamp: state.timestamp || Date.now()
  });
});
`;

fs.writeFileSync(file, code.trim() + "\n\n" + patch);

console.log("[P9] /health unified OK");
