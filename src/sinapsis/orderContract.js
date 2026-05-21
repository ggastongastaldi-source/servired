// SINAPSIS OrderContract v1.0.0
// Normalización de pedidos legacy → formato canónico

function normalize(raw) {
  if (!raw) throw new Error('[ORDER_CONTRACT] Payload nulo');

  const total = raw.total ?? raw.amount ?? raw.precio ?? raw.total_estimado ?? 0;
  const totalCents = Math.round(parseFloat(total) * 100);

  if (isNaN(totalCents)) throw new Error('[ORDER_CONTRACT] total inválido: ' + total);

  return {
    id:          String(raw._id || raw.id || raw.pedidoId || 'unknown'),
    totalCents,
    currency:    raw.currency || 'ARS',
    status:      raw.estado   || raw.status || 'PENDIENTE',
    rubro:       raw.tipoServicio || raw.rubro || 'unknown',
    zona:        raw.zona || 'unknown',
    timestamp:   raw.fechaCreacion || raw.createdAt || new Date().toISOString(),
    rawVersion:  '1.0.0'
  };
}

function validate(contract) {
  const errors = [];
  if (!contract.id || contract.id === 'unknown') errors.push('id ausente');
  if (contract.totalCents < 0) errors.push('totalCents negativo');
  if (!contract.currency)      errors.push('currency ausente');
  if (!contract.status)        errors.push('status ausente');
  if (errors.length) throw new Error('[ORDER_CONTRACT] Validación fallida: ' + errors.join(', '));
  return true;
}

module.exports = { normalize, validate };
