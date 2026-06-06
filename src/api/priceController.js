'use strict';
const { calcular, listarRubros } = require('../core/aladdin/aladdinEngine');
function listarRubrosHandler(req, res) {
  res.json({ ok: true, rubros: listarRubros() });
}
function calcularPrecioHandler(req, res) {
  const { tipoServicio, zona, complejidad, horas } = req.body || {};
  if (!tipoServicio || !zona) return res.status(400).json({ ok: false, error: 'tipoServicio y zona son requeridos' });
  const resultado = calcular(tipoServicio, zona, complejidad, horas ? Number(horas) : undefined);
  if (!resultado.ok) return res.status(404).json(resultado);
  res.json(resultado);
}
module.exports = { listarRubrosHandler, calcularPrecioHandler };
