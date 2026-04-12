const express = require("express");
const router = express.Router();
const aladdin = require("../services/aladdinEngine");

router.post("/", (req, res) => {
  try {
    const { rubro, complejidad } = req.body;
    if (!rubro) return res.json({ ok: false, error: "falta rubro", total_estimado: 0 });

    const result = aladdin.calcularPresupuesto(rubro, complejidad || "baja");

    return res.json({
      ok: true,
      total_estimado:  result.precio_total,
      mano_de_obra:    result.pago_trabajador,
      materiales:      Math.round(result.precio_total * 0.3),
      comision:        result.comision,
      big_mac_base:    result.big_mac_base,
      coeficiente:     result.coeficiente,
    });
  } catch (e) {
    return res.json({ ok: false, error: e.message, total_estimado: 0 });
  }
});

module.exports = router;
