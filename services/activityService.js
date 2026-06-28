const ActivityLog = require('../models/ActivityLog');

async function registrarEvento({
  comercioId,
  tipo,
  modulo = 'sistema',
  descripcion,
  actor = { tipo: 'sistema', nombre: 'Sistema' },
  nivelRiesgo = 'info',
  estado,
  payload = {},
  accionUrl
}) {
  try {
    const estadoFinal = estado || (nivelRiesgo === 'requiere_confirmacion' ? 'pendiente' : 'informativo');
    const evento = new ActivityLog({
      comercioId, tipo, modulo, descripcion,
      actor, nivelRiesgo, estado: estadoFinal, payload, accionUrl
    });
    await evento.save();
    return evento;
  } catch (err) {
    console.error('[ActivityService] Error registrando evento:', err.message);
  }
}

module.exports = { registrarEvento };
