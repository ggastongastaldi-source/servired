'use strict';

/**
 * trustRiskBridge.js
 * Puente entre el Nexus Observer y el Bounded Context Trust & Risk.
 *
 * Responsabilidades:
 * - Inicializar TrustRiskDB (Event Store, repos, proyecciones)
 * - Exponer procesarTrustEvent() para el observer
 * - Shadow mode: procesa pero NO bloquea operaciones todavía
 *
 * ADR-001: Trust & Risk no conoce el Kernel.
 *          El Kernel no conoce los internos de Trust & Risk.
 *          Solo este bridge los conecta.
 */

const { TrustRiskDB }         = require('../../bounded-contexts/trust-risk/src/infrastructure/TrustRiskDB');
const { TrustEventIngester }  = require('../../bounded-contexts/trust-risk/src/integration/sinapsis/TrustEventIngester');
const { EventRouter }         = require('../../bounded-contexts/trust-risk/src/integration/sinapsis/EventRouter');
const { CreateTrustProfile }  = require('../../bounded-contexts/trust-risk/src/application/useCases/CreateTrustProfile');
const { ProcessDomainEvent }  = require('../../bounded-contexts/trust-risk/src/application/useCases/ProcessDomainEvent');
const { EvaluateRisk }        = require('../../bounded-contexts/trust-risk/src/application/useCases/EvaluateRisk');

// Mapa de eventos del Kernel → tipo canónico de Trust & Risk
const KERNEL_TO_TRUST_EVENT = {
  // Jobs
  'JOB_CREATED':    'JobCreated',
  'JOB_ACCEPTED':   'JobAccepted',
  'JOB_CANCELLED':  'JobCancelled',
  'JOB_COMPLETED':  'JobCompleted',
  // Pagos
  'PAYMENT_COMPLETED': 'PaymentCompleted',
  'PAYMENT_FAILED':    'PaymentFailed',
  // Usuarios
  'USER_REGISTERED':   'UserRegistered',
  'LOGIN_SUCCEEDED':   'LoginSucceeded',
  'LOGIN_FAILED':      'LoginFailed',
  // Reviews
  'REVIEW_SUBMITTED':  'ReviewSubmitted',
  // Pedidos (legacy)
  'JOB_REQUESTED':  'JobCreated',
  'PEDIDO_CREADO':  'JobCreated',
};

// Mapa entityType → campo actorId en el evento del Kernel
const ACTOR_ID_FIELD = {
  job:     ['workerId', 'clienteId', 'userId'],
  worker:  ['workerId', 'aggregateId'],
  payment: ['userId', 'workerId', 'clienteId'],
  user:    ['userId', 'aggregateId'],
};

let _trustDB   = null;
let _ingester  = null;
let _shadowMode = true;  // Shadow mode hasta activación explícita

async function initTrustRisk(mongoose) {
  if (_ingester) return _ingester;

  try {
    const db = mongoose.connection.db;

    // Publisher stub — en shadow mode solo loguea
    const shadowPublisher = {
      async publish(events) {
        for (const e of events) {
          console.log(`[TrustRisk-Shadow] 📤 ${e.type} | actor:${e.actorId} | score:${e.newScore || e.severity || ''}`);
        }
      }
    };

    _trustDB = await TrustRiskDB.initialize(db, shadowPublisher);

    const makeUoW = () => _trustDB.createUnitOfWork();

    const createUC = new CreateTrustProfile({
      unitOfWork:     makeUoW(),
      policyRegistry: _trustDB.policyRegistry,
      clock:          _trustDB.clock,
      idGenerator:    () => require('crypto').randomUUID(),
    });

    const processUC = new ProcessDomainEvent({
      unitOfWork:       makeUoW(),
      policyRegistry:   _trustDB.policyRegistry,
      evidenceStore:    _trustDB.evidenceStore,
      explanationStore: _trustDB.explanationStore,
      clock:            _trustDB.clock,
      idGenerator:      () => require('crypto').randomUUID(),
    });

    const router   = new EventRouter({ createTrustProfile: createUC, processDomainEvent: processUC });
    _ingester = new TrustEventIngester({
      eventRouter: router,
      logger: {
        info:  (msg, ...a) => console.log('[TrustRisk]', msg, ...a),
        debug: (msg, ...a) => console.log('[TrustRisk-Debug]', msg, ...a),
        error: (msg, ...a) => console.error('[TrustRisk-Error]', msg, ...a),
      }
    });

    console.log('[TrustRisk] ✅ Bounded Context inicializado — Shadow Mode:', _shadowMode);
    return _ingester;

  } catch (err) {
    console.error('[TrustRisk] ❌ Error inicializando:', err.message);
    return null;
  }
}

/**
 * Procesa un evento del Kernel en Trust & Risk.
 * Llamado desde changeStreamObserver.
 * Fail-safe: nunca lanza, nunca bloquea el observer.
 */
async function procesarTrustEvent(kernelEvent) {
  if (!_ingester) return;

  try {
    const trustType = KERNEL_TO_TRUST_EVENT[kernelEvent.type];
    if (!trustType) return;

    const actorId = _extractActorId(kernelEvent);
    if (!actorId) return;

    const normalized = {
      type:      trustType,
      id:        kernelEvent._id?.toString() || kernelEvent.aggregateId,
      actorId,
      actorType: _extractActorType(kernelEvent),
      jobId:     kernelEvent.jobId || kernelEvent.aggregateId,
      occurredAt: kernelEvent.timestamp || kernelEvent.createdAt || new Date().toISOString(),
    };

    await _ingester.ingest(normalized);

  } catch (err) {
    console.error('[TrustRisk] Error procesando evento:', kernelEvent.type, err.message);
  }
}

function _extractActorId(event) {
  return event.workerId?.toString()
    || event.userId?.toString()
    || event.clienteId?.toString()
    || event.aggregateId?.toString()
    || null;
}

function _extractActorType(event) {
  if (event.entityType === 'worker') return 'WORKER';
  if (event.entityType === 'payment') return 'CLIENT';
  if (event.rol) return event.rol.toUpperCase();
  return 'CLIENT';
}

function getTrustDB()   { return _trustDB; }
function isReady()      { return !!_ingester; }
function isShadowMode() { return _shadowMode; }

module.exports = { initTrustRisk, procesarTrustEvent, getTrustDB, isReady, isShadowMode };
