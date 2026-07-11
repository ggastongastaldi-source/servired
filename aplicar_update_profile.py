path = "controllers/merchantController.js"
with open(path, "r", encoding="utf-8") as f:
    contenido = f.read()

viejo = """exports.updateProfile = async (req, res) => {
  res.status(501).json({ error: 'updateProfile no implementado aun' });
};"""
nuevo = """exports.updateProfile = async (req, res) => {
  try {
    if (!req.body || Object.keys(req.body).length === 0)
      return res.status(400).json({ error: 'BODY_REQUIRED' });

    const profile = await BusinessProfile.findOne({ usuarioId: req.userId });
    if (!profile) return res.status(404).json({ error: 'Perfil no encontrado' });

    Object.assign(profile, req.body);
    await profile.save();

    // Mismo patron fire-and-forget que createProfile - no bloquea la
    // respuesta HTTP si el emisor falla. MerchantProjectionReactor ya
    // escucha MERCHANT_PROFILE_UPDATED (ver EVENTOS_RELEVANTES) y
    // reconstruye la MerchantProjection completa desde este BusinessProfile
    // - la projection nunca se toca directamente desde el controller.
    try {
      emitEvent({
        entityType: 'merchant',
        type: 'MERCHANT_PROFILE_UPDATED',
        aggregateId: String(profile._id),
        payload: {
          merchantId: String(profile._id),
          usuarioId: String(req.userId),
          rubroId: profile.rubroId,
          zonaId: profile.zonaId
        }
      });
    } catch (e) {
      console.warn('[merchant] Nexus emitEvent fallo (no critico):', e.message);
    }

    res.json({ profile });
  } catch (e) {
    console.error('[merchant] updateProfile:', e);
    if (e.name === 'ValidationError') {
      return res.status(400).json({ error: e.message });
    }
    res.status(500).json({ error: 'Error al actualizar perfil' });
  }
};"""
n = contenido.count(viejo)
assert n == 1, f"Se esperaba 1 coincidencia, se encontraron {n}. No se modifica nada."
contenido = contenido.replace(viejo, nuevo, 1)

with open(path, "w", encoding="utf-8") as f:
    f.write(contenido)

print("OK: updateProfile implementado en", path)
