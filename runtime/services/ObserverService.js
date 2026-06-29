'use strict';

/**
 * ServiRed OS — ObserverService
 *
 * Observa todos los eventos del dominio.
 * Nunca escribe estado de dominio.
 * Produce:
 *   - Métricas de throughput por tipo de evento
 *   - Latencia entre eventos relacionados (ej: JOB_CREATED → JOB_COMPLETED)
 *   - Snapshots periódicos del estado del bus
 *   - Feed para GIA (global.observerSnapshot)
 *
 * Principio: solo lee, nunca escribe al dominio.
 */

const ALL_DOMAIN_EVENTS = [
  // Job lifecycle
  'JOB_CREATED', 'JOB_STARTED', 'JOB_COMPLETED', 'JOB_PAID',
  // Quote / Auction
  'QUOTE_SENT', 'QUOTE_SELECTED', 'QUOTE_REJECTED',
  'AUCTION_COMPLETED', 'AUCTION_FALLBACK', 'PRICE_SUBMITTED',
  // Payment
  'PAYMENT_CONFIRMED', 'PAYMENT_CAPTURED', 'PAYMENT_REFUNDED',
  'WORKER_FUNDS_RELEASED', 'WORKER_WITHDRAWAL', 'BOOST_PURCHASED',
  // Worker / Commerce
  'WORKER_ACTIVATED', 'WORKER_AVAILABLE',
  'COMMERCE_REGISTERED', 'CATALOGO_ITEM_CREATED',
  'SERVICE_COMPLETED', 'SERVICE_REQUESTED',
  // System
  'DISPATCH_ANOMALY_DETECTED', 'SNAPSHOT_DIVERGENCE_DETECTED',
  'CIRCUIT_STATE_CHANGED', 'ZONE_OVERHEATED', 'ZONE_RECOVERED', 'ZONE_UNDERSUPPLIED',
  'GIA_ROUTER_DECISION', 'INTENT_TRANSITION', 'ASSISTANT_CONTEXT_BUILD',
  'FAULT_INJECTED', 'BACKPRESSURE_REJECTED',
];

// Pares para medir latencia entre eventos del mismo aggregate
const LATENCY_PAIRS = [
  { from: 'JOB_CREATED',    to: 'JOB_COMPLETED'  },
  { from: 'QUOTE_SENT', to: 'QUOTE_SELECTED' },
  { from: 'PAYMENT_CAPTURED', to: 'WORKER_FUNDS_RELEASED' },
];

const SNAPSHOT_INTERVAL_MS = 60 * 1000; // cada 60 segundos

class ObserverService {
  constructor() {
    this.name     = 'ObserverService';
    this._unsub   = null;
    this._timer   = null;

    // Métricas en memoria — se resetean con el proceso
    this._counts    = {};   // eventType → count
    this._lastSeen  = {};   // eventType → timestamp
    this._latency   = {};   // 'FROM→TO' → [ms, ...]  (max 100 muestras)
    this._pending   = {};   // aggregateId → { eventType, ts }
    this._errors    = 0;
    this._startedAt = null;
  }

  async start(bus) {
    this._startedAt = Date.now();
    this._unsub = bus.on(ALL_DOMAIN_EVENTS, event => this._observe(event));
    this._timer = setInterval(() => this._snapshot(), SNAPSHOT_INTERVAL_MS);
    // Snapshot inicial
    this._snapshot();
  }

  async stop() {
    if (this._unsub) this._unsub();
    if (this._timer) clearInterval(this._timer);
  }

  _observe(event) {
    try {
      console.log('[Observer] evento recibido:', type);
    const { type, payload = {}, ts = Date.now() } = event;

      // Throughput
      this._counts[type]   = (this._counts[type] || 0) + 1;
      this._lastSeen[type] = ts;

      // Latencia — registrar inicio
      for (const pair of LATENCY_PAIRS) {
        if (type === pair.from && payload.aggregateId) {
          this._pending[payload.aggregateId] = { type, ts, pair };
        }
        if (type === pair.to && payload.aggregateId) {
          const start = this._pending[payload.aggregateId];
          if (start && start.pair.to === type) {
            const key = `${pair.from}→${pair.to}`;
            if (!this._latency[key]) this._latency[key] = [];
            this._latency[key].push(ts - start.ts);
            if (this._latency[key].length > 100) this._latency[key].shift();
            delete this._pending[payload.aggregateId];
          }
        }
      }
    } catch (err) {
      this._errors++;
      console.error('[Observer] error observando evento:', err.message);
    }
  }

  _snapshot() {
    const now     = Date.now();
    const uptimeS = Math.round((now - this._startedAt) / 1000);
    const total   = Object.values(this._counts).reduce((a, b) => a + b, 0);

    const latencyStats = {};
    for (const [key, samples] of Object.entries(this._latency)) {
      if (!samples.length) continue;
      const sorted = [...samples].sort((a, b) => a - b);
      latencyStats[key] = {
        count:  samples.length,
        avg_ms: Math.round(samples.reduce((a, b) => a + b, 0) / samples.length),
        p50_ms: sorted[Math.floor(sorted.length * 0.5)],
        p95_ms: sorted[Math.floor(sorted.length * 0.95)],
        max_ms: sorted[sorted.length - 1],
      };
    }

    const snapshot = {
      ts:        new Date().toISOString(),
      uptime_s:  uptimeS,
      total_events: total,
      throughput_per_min: uptimeS > 0 ? Math.round(total / (uptimeS / 60) * 10) / 10 : 0,
      counts:    { ...this._counts },
      latency:   latencyStats,
      errors:    this._errors,
    };

    // Exponer al proceso para GIA y dashboards
    global.observerSnapshot = snapshot;

    if (total > 0) {
      console.log(`[Observer] snapshot | total:${total} | tpm:${snapshot.throughput_per_min} | latency pairs:${Object.keys(latencyStats).length}`);
    }
  }

  // API pública para health endpoint y GIA
  getSnapshot() {
    return global.observerSnapshot || null;
  }
}

module.exports = ObserverService;
