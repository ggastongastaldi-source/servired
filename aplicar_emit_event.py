import re

path = "src/core/routes/commerce.js"
with open(path, "r", encoding="utf-8") as f:
    contenido = f.read()

# --- Cambio 1: capturar el resultado de BusinessProfile.create ---
viejo1 = "    await BusinessProfile.create([{"
nuevo1 = "    const [businessProfile] = await BusinessProfile.create([{"
n1 = contenido.count(viejo1)
assert n1 == 1, f"Cambio 1: se esperaba 1 coincidencia, se encontraron {n1}. No se modifica nada."
contenido = contenido.replace(viejo1, nuevo1, 1)

# --- Cambio 2: emitir MERCHANT_PROFILE_CREATED después del commit ---
viejo2 = """    await session.commitTransaction();

    try {
      const rtmil = require('../../../services/rtmilIngest');"""
nuevo2 = """    await session.commitTransaction();

    try {
      const { emitEvent } = require('../../../nexus/events/emitEvent');
      emitEvent({
        entityType: 'merchant',
        type: 'MERCHANT_PROFILE_CREATED',
        aggregateId: String(businessProfile._id),
        payload: {
          merchantId: String(businessProfile._id),
          usuarioId: String(usuario._id),
          rubroId: businessProfile.rubroId,
        },
      });
    } catch (e) {
      console.warn('[Commerce] Nexus emitEvent falló (no crítico):', e.message);
    }

    try {
      const rtmil = require('../../../services/rtmilIngest');"""
n2 = contenido.count(viejo2)
assert n2 == 1, f"Cambio 2: se esperaba 1 coincidencia, se encontraron {n2}. No se modifica nada."
contenido = contenido.replace(viejo2, nuevo2, 1)

with open(path, "w", encoding="utf-8") as f:
    f.write(contenido)

print("OK: 2 cambios aplicados correctamente en", path)
