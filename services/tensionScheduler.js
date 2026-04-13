const { correrActualizacion } = require('./preciosMarket');

// Ejecutar al arrancar el servidor (después de 30s para no bloquear startup)
setTimeout(async () => {
  console.log('[scheduler] 🕐 Ejecutando actualización inicial de precios...');
  try { await correrActualizacion(); }
  catch(e) { console.error('[scheduler] Error en actualización inicial:', e.message); }
}, 30000);

// Ejecutar cada 7 días
const SEMANA_MS = 7 * 24 * 60 * 60 * 1000;
setInterval(async () => {
  console.log('[scheduler] 🔄 Actualización semanal de precios de mercado...');
  try { await correrActualizacion(); }
  catch(e) { console.error('[scheduler] Error en actualización semanal:', e.message); }
}, SEMANA_MS);

console.log('[scheduler] ✅ Scheduler de precios activo (actualiza cada 7 días)');
module.exports = {};
