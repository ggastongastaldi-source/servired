const https = require("https");

const BASE = "servired-production.up.railway.app";
const TOKEN = process.argv[2] || "";

if (!TOKEN) {
  console.log("Uso: node scripts/stress_test.js <TOKEN_CLIENTE>");
  process.exit(1);
}

const RUBROS = ["plomeria","electricidad","gasista","albanileria","pintura",
                "carpinteria","cerrajeria","jardineria","fumigacion","servicio_domestico"];

function crearPedido(rubro, i) {
  return new Promise((resolve) => {
    const body = JSON.stringify({
      tipoServicio: rubro, zona: "GBA",
      descripcion: "Stress test #" + i,
      direccion: "Av. Test 1234", complejidad: "baja",
      lat: -34.6037, lng: -58.3816
    });
    const req = https.request({
      hostname: BASE, path: "/api/pedidos",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + TOKEN,
        "Content-Length": Buffer.byteLength(body)
      }
    }, (res) => {
      let data = "";
      res.on("data", d => data += d);
      res.on("end", () => {
        try {
          const r = JSON.parse(data);
          resolve({ rubro, ok: r.ok, id: r.pedido?._id || null, precio: r.pedido?.total_estimado });
        } catch(e) {
          resolve({ rubro, ok: false, error: data.slice(0,100) });
        }
      });
    });
    req.on("error", e => resolve({ rubro, ok: false, error: e.message }));
    req.write(body);
    req.end();
  });
}

async function run() {
  console.log("\n=== STRESS TEST - 10 PEDIDOS CONCURRENTES ===\n");
  const promesas = RUBROS.map((r, i) => crearPedido(r, i+1));
  const resultados = await Promise.all(promesas);
  let ok = 0, fail = 0;
  resultados.forEach(r => {
    if (r.ok) {
      console.log("✅ " + r.rubro.padEnd(25) + " id:" + r.id + " precio:$" + (r.precio||0).toLocaleString());
      ok++;
    } else {
      console.log("❌ " + r.rubro + " ERROR: " + (r.error||"sin respuesta"));
      fail++;
    }
  });
  console.log("\n=== RESULTADO: " + ok + "/10 OK ===");
}

run();
