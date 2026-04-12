const express = require("express");
const router = express.Router();
const { execSync } = require("child_process");

router.get("/", async (req, res) => {
  try {

    // Ejecuta el motor bash (ruta relativa al repo)
    const out = execSync("bash ./smart_quote.sh").toString();

    console.log("SALIDA MOTOR:", out);

    const parsed = JSON.parse(out);

    return res.json({
      ok: true,
      total_estimado: parsed.total
    });

  } catch (e) {
    console.log("ERROR MOTOR:", e.message);

    return res.json({
      ok: false,
      total_estimado: 0,
      error: "motor_fail"
    });
  }
});

module.exports = router;
