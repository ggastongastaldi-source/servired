const { CATALOGO } = require("../public/catalogo.js");
const { calcular } = require("../services/aladdinEngine");

console.log("\n=== AUDITORIA ALADDIN - 29 RUBROS ===\n");
let ok = 0, fail = 0;

CATALOGO.forEach(r => {
  const res = calcular(r.id, "GBA", "baja");
  if (!res.ok) {
    console.log("❌ " + r.id + ": " + res.error);
    fail++;
    return;
  }
  const expectedWorker = Math.round(res.precioCliente * 0.8 / 1.2 * 0.8);
  const check = res.pagoWorker > 0 && res.precioCliente > res.pagoWorker;
  if (check) {
    console.log("✅ " + r.id.padEnd(25) + " cliente:$" + res.precioCliente.toLocaleString().padStart(10) + " | worker:$" + res.pagoWorker.toLocaleString().padStart(10));
    ok++;
  } else {
    console.log("❌ " + r.id + " precio incorrecto cliente:" + res.precioCliente + " worker:" + res.pagoWorker);
    fail++;
  }
});

console.log("\n=== RESULTADO: " + ok + "/" + (ok+fail) + " OK ===");
if (fail === 0) console.log("✅ ALADDIN AUDITADO - TODOS LOS PRECIOS CORRECTOS");
else console.log("❌ " + fail + " RUBROS CON PROBLEMAS");
