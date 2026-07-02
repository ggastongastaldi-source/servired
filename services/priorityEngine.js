/**
 * PriorityEngine v1.0 — G.I.A. Core
 *
 * Función pura. Sin efectos secundarios. Sin escrituras.
 * Entrada:  UserState (snapshot del estado actual del usuario)
 * Salida:   priorityAction (la siguiente mejor acción)
 *
 * Nunca modifica el Core.
 * Nunca escribe en base de datos.
 * Nunca llama a servicios externos.
 * Solo decide.
 *
 * Indicadores constitucionales que optimiza (en orden):
 *   1. Confianza   — acciones que reducen incertidumbre
 *   2. Conversión  — acciones que acercan al cobro/pago
 *   3. Retención   — acciones que generan valor recurrente
 *   4. Ingresos    — acciones que maximizan flujo económico
 */

'use strict';

// ── Tipos de acción (enum exhaustivo) ─────────────────────────────────────
const ACTION_TYPES = Object.freeze({
  // Worker
  TRABAJO_CONFIRMAR_LLEGADA:  'TRABAJO_CONFIRMAR_LLEGADA',
  TRABAJO_EN_CURSO:           'TRABAJO_EN_CURSO',
  TRABAJO_FINALIZAR:          'TRABAJO_FINALIZAR',
  COBRAR_SALDO:               'COBRAR_SALDO',
  MATCH_DISPONIBLE:           'MATCH_DISPONIBLE',
  COMPLETAR_PERFIL_WORKER:    'COMPLETAR_PERFIL_WORKER',
  ZONA_SIN_ACTIVIDAD:         'ZONA_SIN_ACTIVIDAD',

  // Cliente
  SEGUIR_PRESTADOR:           'SEGUIR_PRESTADOR',
  CALIFICAR_TRABAJO:          'CALIFICAR_TRABAJO',
  RESOLVER_PROBLEMA:          'RESOLVER_PROBLEMA',
  PEDIDO_SIN_MATCH:           'PEDIDO_SIN_MATCH',

  // Merchant
  RENOVAR_CAMPANIA:           'RENOVAR_CAMPANIA',
  COMPLETAR_PERFIL_MERCHANT:  'COMPLETAR_PERFIL_MERCHANT',
  SOLICITUDES_PENDIENTES:     'SOLICITUDES_PENDIENTES',
  CATALOGO_VACIO:             'CATALOGO_VACIO',
  AUMENTAR_VISIBILIDAD:       'AUMENTAR_VISIBILIDAD',

  // Estado vacío
  SIN_ACCION_CRITICA:         'SIN_ACCION_CRITICA'
});

// ── Niveles de urgencia ────────────────────────────────────────────────────
const URGENCIA = Object.freeze({
  CRITICA: 'CRITICA',   // requiere acción inmediata
  ALTA:    'ALTA',      // importante, hoy
  MEDIA:   'MEDIA',     // esta semana
  BAJA:    'BAJA'       // oportunidad de crecimiento
});

// ── Función principal (pura) ───────────────────────────────────────────────
/**
 * @param {UserState} state - estado completo del usuario
 * @returns {PriorityAction} - la única acción recomendada
 */
function computePriorityAction(state) {
  if (!state || !state.rol) {
    return accionVacia('Rol no identificado');
  }

  switch (state.rol) {
    case 'worker':   return priorizarWorker(state);
    case 'cliente':  return priorizarCliente(state);
    case 'merchant': return priorizarMerchant(state);
    default:         return accionVacia(`Rol desconocido: ${state.rol}`);
  }
}

// ── Árbol de prioridades: WORKER ───────────────────────────────────────────
function priorizarWorker(state) {
  const { pedidoActivo, saldo, matches, perfil } = state.worker || {};

  // 1. Trabajo activo — mayor prioridad absoluta
  if (pedidoActivo) {
    if (pedidoActivo.etapa === 'ASIGNADO' && !pedidoActivo.llegadaConfirmada) {
      return accion({
        tipo:        ACTION_TYPES.TRABAJO_CONFIRMAR_LLEGADA,
        urgencia:    URGENCIA.CRITICA,
        titulo:      'Confirmar llegada',
        descripcion: `${pedidoActivo.servicio} — ${pedidoActivo.direccion}`,
        cta:         'Confirmar que llegué',
        payload:     { pedidoId: pedidoActivo.id },
        metrica:     'confianza'
      });
    }

    if (pedidoActivo.etapa === 'EN_CURSO') {
      return accion({
        tipo:        ACTION_TYPES.TRABAJO_EN_CURSO,
        urgencia:    URGENCIA.CRITICA,
        titulo:      'Trabajo en curso',
        descripcion: `${pedidoActivo.servicio} — iniciado hace ${pedidoActivo.minutos_transcurridos} min`,
        cta:         'Ir al trabajo',
        payload:     { pedidoId: pedidoActivo.id },
        metrica:     'conversion'
      });
    }

    if (pedidoActivo.etapa === 'FINALIZADO' && !pedidoActivo.pagoCobrado) {
      return accion({
        tipo:        ACTION_TYPES.COBRAR_SALDO,
        urgencia:    URGENCIA.CRITICA,
        titulo:      'Trabajo finalizado',
        descripcion: `${formatARS(pedidoActivo.montoFinal)} disponibles para cobrar`,
        cta:         'Cobrar ahora',
        payload:     { pedidoId: pedidoActivo.id, monto: pedidoActivo.montoFinal },
        metrica:     'ingresos'
      });
    }
  }

  // 2. Saldo disponible sin cobrar
  if (saldo && saldo.disponible > 0) {
    return accion({
      tipo:        ACTION_TYPES.COBRAR_SALDO,
      urgencia:    URGENCIA.ALTA,
      titulo:      'Saldo disponible',
      descripcion: `${formatARS(saldo.disponible)} listos para retirar`,
      cta:         'Cobrar ahora',
      payload:     { monto: saldo.disponible },
      metrica:     'ingresos'
    });
  }

  // 3. Match nuevo disponible
  if (matches && matches.length > 0) {
    const top = matches[0];
    return accion({
      tipo:        ACTION_TYPES.MATCH_DISPONIBLE,
      urgencia:    URGENCIA.ALTA,
      titulo:      'Trabajo disponible',
      descripcion: `${top.servicio} — ${top.zona} — ${formatARS(top.estimado)}`,
      cta:         'Ver trabajo',
      payload:     { matchId: top.id },
      metrica:     'conversion'
    });
  }

  // 4. Perfil incompleto
  if (perfil && perfil.completitud < 80) {
    return accion({
      tipo:        ACTION_TYPES.COMPLETAR_PERFIL_WORKER,
      urgencia:    URGENCIA.MEDIA,
      titulo:      'Completá tu perfil',
      descripcion: `Tu perfil está al ${perfil.completitud}% — los clientes eligen trabajadores con perfil completo`,
      cta:         'Completar ahora',
      payload:     { completitud: perfil.completitud },
      metrica:     'retencion'
    });
  }

  // 5. Sin actividad crítica
  return accion({
    tipo:        ACTION_TYPES.ZONA_SIN_ACTIVIDAD,
    urgencia:    URGENCIA.BAJA,
    titulo:      'Listo para trabajar',
    descripcion: 'No hay pedidos en tu zona ahora. Te avisamos cuando aparezca uno.',
    cta:         'Ver mi zona',
    payload:     { zonaId: state.worker?.perfil?.zonaId },
    metrica:     'retencion'
  });
}

// ── Árbol de prioridades: CLIENTE ──────────────────────────────────────────
function priorizarCliente(state) {
  const { pedidoActivo, pendienteCalificar, ultimoProblema } = state.cliente || {};

  // 1. Prestador en camino — seguimiento
  if (pedidoActivo && pedidoActivo.etapa === 'EN_CAMINO') {
    return accion({
      tipo:        ACTION_TYPES.SEGUIR_PRESTADOR,
      urgencia:    URGENCIA.CRITICA,
      titulo:      'Tu prestador está en camino',
      descripcion: `${pedidoActivo.workerNombre} llega en aprox. ${pedidoActivo.etaMinutos} min`,
      cta:         'Seguir en mapa',
      payload:     { pedidoId: pedidoActivo.id, workerId: pedidoActivo.workerId },
      metrica:     'confianza'
    });
  }

  // 2. Trabajo finalizado sin calificar (ventana de 24hs)
  if (pendienteCalificar) {
    const horasRestantes = Math.max(0,
      Math.round((new Date(pendienteCalificar.expiraEn) - Date.now()) / 3600000)
    );
    return accion({
      tipo:        ACTION_TYPES.CALIFICAR_TRABAJO,
      urgencia:    URGENCIA.ALTA,
      titulo:      'Calificá el trabajo',
      descripcion: `¿Cómo estuvo ${pendienteCalificar.workerNombre}? Expira en ${horasRestantes}h`,
      cta:         'Calificar ahora',
      payload:     { pedidoId: pendienteCalificar.id },
      metrica:     'confianza'
    });
  }

  // 3. Problema sin resolver
  if (ultimoProblema && ultimoProblema.estado === 'ABIERTO') {
    return accion({
      tipo:        ACTION_TYPES.RESOLVER_PROBLEMA,
      urgencia:    URGENCIA.ALTA,
      titulo:      '¿Pudiste resolver tu problema?',
      descripcion: ultimoProblema.descripcion,
      cta:         'Buscar prestador',
      payload:     { problemaId: ultimoProblema.id },
      metrica:     'conversion'
    });
  }

  // 4. Sin actividad
  return accion({
    tipo:        ACTION_TYPES.RESOLVER_PROBLEMA,
    urgencia:    URGENCIA.BAJA,
    titulo:      '¿Qué necesitás resolver hoy?',
    descripcion: 'Encontrá el prestador ideal para tu zona en minutos',
    cta:         'Buscar prestador',
    payload:     {},
    metrica:     'conversion'
  });
}

// ── Árbol de prioridades: MERCHANT ─────────────────────────────────────────
function priorizarMerchant(state) {
  const { projection, campanias, marketContext } = state.merchant || {};

  // 1. Perfil DRAFT — sin esto nada funciona
  if (!projection || projection.estado === 'DRAFT') {
    return accion({
      tipo:        ACTION_TYPES.COMPLETAR_PERFIL_MERCHANT,
      urgencia:    URGENCIA.CRITICA,
      titulo:      'Completá el perfil de tu negocio',
      descripcion: 'Para aparecer en ServiRed necesitás completar tu perfil',
      cta:         'Completar perfil',
      payload:     {},
      metrica:     'conversion'
    });
  }

  // 2. Solicitudes sin responder (alta conversión en riesgo)
  if (projection.actividad?.solicitudesHoy > 0) {
    return accion({
      tipo:        ACTION_TYPES.SOLICITUDES_PENDIENTES,
      urgencia:    URGENCIA.ALTA,
      titulo:      `${projection.actividad.solicitudesHoy} solicitud${projection.actividad.solicitudesHoy > 1 ? 'es' : ''} hoy`,
      descripcion: 'Respondé rápido para mejorar tu tasa de conversión',
      cta:         'Ver solicitudes',
      payload:     { cantidad: projection.actividad.solicitudesHoy },
      metrica:     'conversion'
    });
  }

  // 3. Campaña vencida con ROI positivo (oportunidad)
  if (campanias?.vencidaConROI) {
    return accion({
      tipo:        ACTION_TYPES.RENOVAR_CAMPANIA,
      urgencia:    URGENCIA.ALTA,
      titulo:      'Tu campaña generó resultados',
      descripcion: `${campanias.vencidaConROI.vistasGeneradas} vistas — renová para mantener la visibilidad`,
      cta:         'Renovar campaña',
      payload:     { campaniaId: campanias.vencidaConROI.id },
      metrica:     'ingresos',
      explicacion:       explicarMercado(marketContext),
      resultadoEsperado: proyectarResultado(marketContext)
    });
  }

  // 4. Catálogo vacío
  if (!projection.catalogo || projection.catalogo.totalItems === 0) {
    return accion({
      tipo:        ACTION_TYPES.CATALOGO_VACIO,
      urgencia:    URGENCIA.MEDIA,
      titulo:      'Cargá tus productos',
      descripcion: 'Los comercios con catálogo reciben 3x más consultas',
      cta:         'Cargar primer producto',
      payload:     {},
      metrica:     'retencion'
    });
  }

  // 5. Sin actividad — oportunidad de boost
  return accion({
    tipo:        ACTION_TYPES.AUMENTAR_VISIBILIDAD,
    urgencia:    URGENCIA.BAJA,
    titulo:      'Aumentá tu visibilidad',
    descripcion: `Tu negocio tuvo ${projection.actividad?.vistasHoy ?? 0} vistas hoy`,
    cta:         'Activar Boost',
    payload:     { zonaId: projection.zonaId },
    metrica:     'ingresos',
    explicacion:       explicarMercado(marketContext),
    resultadoEsperado: proyectarResultado(marketContext)
  });
}

// ── Explicación e impacto esperado (Fase 2) ─────────────────────────────────
// Funciones puras: interpretan el marketContext ya calculado por
// giaStateReader. No consultan nada, no importan Mongo ni servicios —
// reciben datos, devuelven texto/objeto. Mantienen priorityEngine.js
// desacoplado de motores externos.
function explicarMercado(mc) {
  if (!mc || !mc.marketField) return null;
  const { zoneState, marketPressure } = mc.marketField;
  const pct = Math.round(Math.abs(marketPressure || 0) * 100);
  if (zoneState === 'SHORTAGE') return `Hay alta demanda en tu zona (presión de mercado +${pct}%) y pocos comercios cubriéndola.`;
  if (zoneState === 'SURPLUS')  return `Tu zona tiene más oferta que demanda en este momento (presión -${pct}%).`;
  return 'Tu zona está en equilibrio entre oferta y demanda.';
}

function proyectarResultado(mc) {
  if (!mc || !mc.pricing || mc.pricing.suggestedPrice == null) return null;
  return {
    precioSugerido: mc.pricing.suggestedPrice,
    confianza:      mc.pricing.confidence,
    fuente:         mc.pricing.sampleSize
      ? `basado en ${mc.pricing.sampleSize} operaciones recientes en tu zona`
      : 'estimación de mercado'
  };
}

// ── Constructores ──────────────────────────────────────────────────────────
function accion({ tipo, urgencia, titulo, descripcion, cta, payload, metrica, explicacion, resultadoEsperado }) {
  return Object.freeze({
    actionId:    `${tipo}_${Date.now()}`,
    tipo,
    urgencia,
    titulo,
    descripcion,
    cta,
    payload:     Object.freeze(payload || {}),
    metrica,
    // Fase 2 (julio 2026) — ciclo cognitivo: explicacion responde "¿por qué?",
    // resultadoEsperado responde "¿qué resultado espero?". Ambos opcionales —
    // null si el state no trae marketContext (worker/cliente aún no lo usan).
    explicacion:       explicacion || null,
    resultadoEsperado: resultadoEsperado || null,
    computadaEn: new Date().toISOString()
  });
}

function accionVacia(razon) {
  return accion({
    tipo:        ACTION_TYPES.SIN_ACCION_CRITICA,
    urgencia:    URGENCIA.BAJA,
    titulo:      'Todo al día',
    descripcion: razon || 'No hay acciones pendientes',
    cta:         null,
    payload:     {},
    metrica:     'retencion'
  });
}

// ── Utils ──────────────────────────────────────────────────────────────────
function formatARS(n) {
  if (!n) return '$0';
  return new Intl.NumberFormat('es-AR', {
    style: 'currency', currency: 'ARS', maximumFractionDigits: 0
  }).format(n);
}

// ── Tests unitarios inline (node priorityEngine.js para correr) ────────────
function runTests() {
  const assert = (desc, cond) => {
    if (!cond) throw new Error(`FAIL: ${desc}`);
    console.log(`  ✓ ${desc}`);
  };

  console.log('\n[PriorityEngine] Tests\n');

  // T1: Worker con trabajo en curso
  const r1 = computePriorityAction({
    rol: 'worker',
    worker: { pedidoActivo: { id: '1', etapa: 'EN_CURSO', servicio: 'Plomería', minutos_transcurridos: 30 } }
  });
  assert('Worker EN_CURSO → TRABAJO_EN_CURSO', r1.tipo === ACTION_TYPES.TRABAJO_EN_CURSO);
  assert('Worker EN_CURSO urgencia CRITICA', r1.urgencia === URGENCIA.CRITICA);

  // T2: Worker con saldo disponible (sin trabajo activo)
  const r2 = computePriorityAction({
    rol: 'worker',
    worker: { saldo: { disponible: 8500 } }
  });
  assert('Worker saldo → COBRAR_SALDO', r2.tipo === ACTION_TYPES.COBRAR_SALDO);
  assert('COBRAR_SALDO metrica ingresos', r2.metrica === 'ingresos');

  // T3: Worker con trabajo FINALIZADO sin cobrar (mayor prioridad que saldo genérico)
  const r3 = computePriorityAction({
    rol: 'worker',
    worker: {
      pedidoActivo: { id: '3', etapa: 'FINALIZADO', pagoCobrado: false, montoFinal: 12000, servicio: 'Electricidad' },
      saldo: { disponible: 8500 }
    }
  });
  assert('Worker FINALIZADO → COBRAR_SALDO (trabajo específico)', r3.tipo === ACTION_TYPES.COBRAR_SALDO);
  assert('Monto correcto en payload', r3.payload.monto === 12000);

  // T4: Cliente con prestador en camino
  const r4 = computePriorityAction({
    rol: 'cliente',
    cliente: { pedidoActivo: { id: '4', etapa: 'EN_CAMINO', workerNombre: 'Carlos', etaMinutos: 12 } }
  });
  assert('Cliente EN_CAMINO → SEGUIR_PRESTADOR', r4.tipo === ACTION_TYPES.SEGUIR_PRESTADOR);
  assert('SEGUIR_PRESTADOR urgencia CRITICA', r4.urgencia === URGENCIA.CRITICA);

  // T5: Merchant con perfil DRAFT
  const r5 = computePriorityAction({
    rol: 'merchant',
    merchant: { projection: { estado: 'DRAFT' } }
  });
  assert('Merchant DRAFT → COMPLETAR_PERFIL_MERCHANT', r5.tipo === ACTION_TYPES.COMPLETAR_PERFIL_MERCHANT);

  // T6: Merchant ACTIVE con catálogo vacío
  const r6 = computePriorityAction({
    rol: 'merchant',
    merchant: { projection: { estado: 'ACTIVE', catalogo: { totalItems: 0 }, actividad: { solicitudesHoy: 0 } } }
  });
  assert('Merchant catálogo vacío → CATALOGO_VACIO', r6.tipo === ACTION_TYPES.CATALOGO_VACIO);

  // T7: Merchant con solicitudes hoy
  const r7 = computePriorityAction({
    rol: 'merchant',
    merchant: {
      projection: { estado: 'ACTIVE', catalogo: { totalItems: 5 }, actividad: { solicitudesHoy: 3, vistasHoy: 10 } }
    }
  });
  assert('Merchant solicitudesHoy → SOLICITUDES_PENDIENTES', r7.tipo === ACTION_TYPES.SOLICITUDES_PENDIENTES);
  assert('Cantidad en payload', r7.payload.cantidad === 3);

  // T8: Rol desconocido → acción vacía
  const r8 = computePriorityAction({ rol: 'admin' });
  assert('Rol desconocido → SIN_ACCION_CRITICA', r8.tipo === ACTION_TYPES.SIN_ACCION_CRITICA);

  // T9: Pureza — mismo input → mismo output (determinismo)
  const input = { rol: 'worker', worker: { saldo: { disponible: 5000 } } };
  const ra = computePriorityAction(input);
  const rb = computePriorityAction(input);
  assert('Determinismo: tipo igual', ra.tipo === rb.tipo);
  assert('Determinismo: urgencia igual', ra.urgencia === rb.urgencia);
  assert('Determinismo: cta igual', ra.cta === rb.cta);

  // T10: Output inmutable
  const r10 = computePriorityAction({ rol: 'worker', worker: {} });
  let threw = false;
  try { r10.tipo = 'HACK'; } catch(e) { threw = true; }
  assert('Output es inmutable (Object.freeze)', threw || r10.tipo !== 'HACK');

  // T11: Merchant sin marketContext (rama boost) — explicacion/resultadoEsperado null
  const r11 = computePriorityAction({
    rol: 'merchant',
    merchant: { projection: { estado: 'ACTIVE', catalogo: { totalItems: 5 }, actividad: { solicitudesHoy: 0, vistasHoy: 20 }, zonaId: 'la_matanza' } }
  });
  assert('Merchant sin marketContext → AUMENTAR_VISIBILIDAD', r11.tipo === ACTION_TYPES.AUMENTAR_VISIBILIDAD);
  assert('Sin marketContext → explicacion null', r11.explicacion === null);
  assert('Sin marketContext → resultadoEsperado null', r11.resultadoEsperado === null);

  // T12: Merchant con marketContext SHORTAGE — explicacion y resultadoEsperado poblados
  const r12 = computePriorityAction({
    rol: 'merchant',
    merchant: {
      projection: { estado: 'ACTIVE', catalogo: { totalItems: 5 }, actividad: { solicitudesHoy: 0, vistasHoy: 20 }, zonaId: 'la_matanza' },
      marketContext: {
        zonaId: 'la_matanza', rubroId: 'plomeria',
        marketField: { zoneState: 'SHORTAGE', marketPressure: 0.42 },
        pricing: { suggestedPrice: 8500, confidence: 0.7, sampleSize: 12 },
        insight: null
      }
    }
  });
  assert('Merchant con marketContext SHORTAGE → explicacion definida', typeof r12.explicacion === 'string' && r12.explicacion.includes('demanda'));
  assert('Merchant con marketContext → resultadoEsperado.precioSugerido', r12.resultadoEsperado && r12.resultadoEsperado.precioSugerido === 8500);

  console.log('\n✅ 12/12 tests pasaron\n');
}

module.exports = {
  computePriorityAction,
  ACTION_TYPES,
  URGENCIA,
  runTests
};

// Correr tests si se ejecuta directamente
if (require.main === module) runTests();
