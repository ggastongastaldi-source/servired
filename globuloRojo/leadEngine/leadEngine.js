// Lead Engine — operaciones sobre el ciclo de vida
const Lead = require('./Lead');

// Crear o actualizar lead (deduplicacion por telefono)
async function ingestar({ nombre, telefono, email, zona, rubro, source, source_url, source_raw, nota }) {
  try {
    // Deduplicar por telefono o email
    let lead = null;
    if (telefono) lead = await Lead.findOne({ telefono });
    if (!lead && email) lead = await Lead.findOne({ email });

    if (lead) {
      // Ya existe — solo actualizar datos si faltan
      if (!lead.zona && zona) lead.zona = zona;
      if (!lead.rubro && rubro) lead.rubro = rubro;
      lead.eventos.push({ estado: lead.estado, actor: 'sistema', nota: 'Redetectado: ' + (source||'manual'), timestamp: new Date() });
      await lead.save();
      console.log('[LeadEngine] Lead existente actualizado:', lead.nombre);
      return { lead, nuevo: false };
    }

    // Nuevo lead
    lead = new Lead({ nombre, telefono, email, zona, rubro, source: source||'manual', source_url, source_raw, notas: nota });
    lead.eventos.push({ estado: 'DETECTED', actor: 'sistema', nota: 'Ingresado via ' + (source||'manual'), timestamp: new Date() });
    await lead.save();
    console.log('[LeadEngine] Nuevo lead:', lead.nombre, '|', rubro, '|', zona);
    return { lead, nuevo: true };
  } catch(e) {
    console.error('[LeadEngine] Error ingestar:', e.message);
    throw e;
  }
}

// Listar leads con filtros
async function listar({ estado, zona, rubro, limit = 50 } = {}) {
  const query = {};
  if (estado) query.estado = estado;
  if (zona) query.zona = new RegExp(zona, 'i');
  if (rubro) query.rubro = rubro;
  return Lead.find(query).sort({ createdAt: -1 }).limit(limit);
}

// Preparar mensaje de contacto
function prepararMensaje(lead) {
  const rubros = {
    plomeria: 'plomero/a', electricidad: 'electricista', pintura: 'pintor/a',
    albanileria: 'albañil', carpinteria: 'carpintero/a', gasista: 'gasista',
    limpieza_hogar: 'limpieza del hogar', servicio_domestico: 'servicio doméstico',
    cerrajeria: 'cerrajero/a', jardineria: 'jardinero/a', techistas: 'techista',
    herreria: 'herrero/a', durlock: 'yesero/durlock', climatizacion: 'técnico en climatización',
    impermeabilizacion: 'impermeabilizador/a'
  };
  const oficio = rubros[lead.rubro] || lead.rubro || 'profesional de servicios';
  const zona = lead.zona || 'tu zona';

  return {
    whatsapp: `Hola ${lead.nombre} 👋 Te contactamos desde *ServiRed*, la app que conecta profesionales con clientes en ${zona}. Vi que sos ${oficio} y nos gustaría invitarte a sumarte a nuestra red. ¿Te interesa? Te explico en 2 minutos 🙌`,
    sms: `Hola ${lead.nombre}, soy de ServiRed. Conectamos ${oficio}s con clientes en ${zona}. ¿Te interesa sumarte? Respondé SI para más info.`
  };
}

// Stats del pipeline
async function stats() {
  const estados = ['DETECTED','QUEUED','CONTACT_PREPARED','CONTACTED','RESPONDED','REGISTERED','VERIFIED','ACTIVATED','ACTIVE','DESCARTADO'];
  const result = {};
  for (const e of estados) {
    result[e] = await Lead.countDocuments({ estado: e });
  }
  result.total = await Lead.countDocuments();
  return result;
}

module.exports = { ingestar, listar, prepararMensaje, stats };
