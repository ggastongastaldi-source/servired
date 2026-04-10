const { buscarTrabajadores } = require('../globuloRojo/motorInfiltracion');
const aladdin                = require('../services/aladdinEngine');

async function buscar(req, res) {
  try {
    const {
      descripcion, especialidad,
      lat, lon,
      zona        = 'CABA',
      complejidad = 'baja',
      radioKm     = 15,
    } = req.query;

    if (!especialidad && !descripcion) {
      return res.status(400).json({ ok: false, error: 'Enviá especialidad o descripcion' });
    }

    const resultado = await buscarTrabajadores({ descripcion, especialidad, lat, lon, radioKm, zona });

    let presupuesto = null;
    try {
      presupuesto = aladdin.calcularPresupuesto(resultado.rubro, complejidad);
    } catch (_) {}

    return res.json({ ok: true, ...resultado, presupuesto_estimado: presupuesto });
  } catch (err) {
    console.error('[Matching]', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}

async function listarRubros(req, res) {
  res.json({ ok: true, rubros: aladdin.listarRubros() });
}

module.exports = { buscar, listarRubros };
