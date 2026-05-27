// config/archetypeRegistry.js
// Física operacional de los rubros del AMBA

const RUBROS_MAP = {
  // REALTIME_CRITICAL
  'cerrajeria':            'REALTIME_CRITICAL',
  'gasista':               'REALTIME_CRITICAL',
  'electricista':          'HYBRID_TEMPORAL',
  'plomeria':              'HYBRID_TEMPORAL',
  'techista':              'HYBRID_TEMPORAL',
  'refrigeracion':         'HYBRID_TEMPORAL',
  'camaras_seguridad':     'HYBRID_TEMPORAL',
  // PROGRAMMABLE
  'limpieza_hogar':        'PROGRAMMABLE',
  'servicio_domestico':    'PROGRAMMABLE',
  'jardineria':            'PROGRAMMABLE',
  'peluqueria_canina':     'PROGRAMMABLE',
  'cuidado_adultos':       'PROGRAMMABLE',
  'cuidado_ninos':         'PROGRAMMABLE',
  'clases_particulares':   'PROGRAMMABLE',
  'masajes':               'PROGRAMMABLE',
  'mudanzas':              'PROGRAMMABLE',
  // PROJECT_LONG_TERM
  'albanileria':           'PROJECT_LONG_TERM',
  'pintura':               'PROJECT_LONG_TERM',
  'carpinteria':           'PROJECT_LONG_TERM',
  'herreria':              'PROJECT_LONG_TERM',
  'instalaciones_gas':     'PROJECT_LONG_TERM',
  'instalaciones_elect':   'PROJECT_LONG_TERM',
};

const ARCHETYPE_POLICIES = {
  REALTIME_CRITICAL: {
    requiresNightPact:          false,
    requiresTwoHourCheckpoint:  false,
    requiresImmediateDispatch:  true,
    gracePeriodMinutes:         0,
    baseFrictionFeeARS:         0,
    reputationPenalty: {
      lateCancel:   0,
      noShow:       50
    }
  },
  HYBRID_TEMPORAL: {
    requiresNightPact:          true,
    requiresTwoHourCheckpoint:  true,
    requiresImmediateDispatch:  false,
    gracePeriodMinutes:         30,
    baseFrictionFeeARS:         4500,   // ~1 Big Mac
    reputationPenalty: {
      nightCancel:  15,
      lateCancel:   35,
      noShow:       50
    }
  },
  PROGRAMMABLE: {
    requiresNightPact:          true,
    requiresTwoHourCheckpoint:  true,
    requiresImmediateDispatch:  false,
    gracePeriodMinutes:         60,
    baseFrictionFeeARS:         6000,   // ~1.5 Big Macs
    reputationPenalty: {
      nightCancel:  15,
      lateCancel:   35,
      noShow:       50
    }
  },
  PROJECT_LONG_TERM: {
    requiresNightPact:          false,
    requiresTwoHourCheckpoint:  false,
    requiresImmediateDispatch:  false,
    gracePeriodMinutes:         120,
    baseFrictionFeeARS:         12000,  // ~3 Big Macs (quiebre de fase)
    reputationPenalty: {
      phaseBreak:   40,
      noShow:       50
    }
  }
};

function resolveArchetype(rubro, serviceMode) {
  // Urgencia siempre override al archetype del rubro
  if (serviceMode === 'URGENT') return 'REALTIME_CRITICAL';
  return RUBROS_MAP[rubro] || 'HYBRID_TEMPORAL';
}

function getPolicy(rubro, serviceMode) {
  const archetype = resolveArchetype(rubro, serviceMode);
  return { archetype, ...ARCHETYPE_POLICIES[archetype] };
}

module.exports = { RUBROS_MAP, ARCHETYPE_POLICIES, resolveArchetype, getPolicy };
