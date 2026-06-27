const fs = require("fs");

const file = "./server.js";
let code = fs.readFileSync(file, "utf8");

// eliminar cualquier /health previo
code = code.replace(/app\.get\(['"]\/health['"][\s\S]*?\}\);/g, "");

const patch = `
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'ServiRed',
    uptime: process.uptime(),
    timestamp: Date.now(),
    memory: process.memoryUsage(),
    env: process.env.NODE_ENV || 'development'
  });
});
`;

fs.writeFileSync(file, code.trim() + "\n\n" + patch);

console.log("[PROD] /health aplicado OK");
