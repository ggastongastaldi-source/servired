// ServiRedAdapter.ts — convierte eventos reales de ServiRed en ControlEvent
// J real = función de presión operacional del sistema vivo
// NO modifica comportamiento — solo observa (shadow mode)

import { ControlEvent } from '../types';
import * as crypto from 'crypto';

// ── estado de presión del sistema ────────────────────────────────────────────
interface SystemPressure {
  pendingJobs:    number;   // jobs sin match
  activeWorkers:  number;   // workers disponibles
  cancelRate:     number;   // tasa de cancelación (EMA)
  matchLatency:   number;   // latencia promedio de match (ms, EMA)
  failedMatches:  number;   // matches fallidos acumulados
  t:              number;
}

const EMA_ALPHA = 0.3;

function ema(prev: number, next: number): number {
  return EMA_ALPHA * next + (1 - EMA_ALPHA) * prev;
}

// ── J real: energía estructural derivada de carga operacional ────────────────
// J = w1*mismatch + w2*cancelPressure + w3*latencyStress + w4*workerScarcity
function computeJ(p: SystemPressure): number {
  const mismatch      = p.pendingJobs / Math.max(p.activeWorkers, 1);
  const cancelPress   = p.cancelRate * 3;
  const latencyStress = Math.min(p.matchLatency / 10000, 1); // normalizado a 10s
  const scarcity      = p.activeWorkers === 0 ? 2 : 1 / p.activeWorkers;

  return 0.4 * mismatch + 0.3 * cancelPress + 0.2 * latencyStress + 0.1 * scarcity;
}

// ── gradJ aproximado: derivada numérica por diferencia finita ────────────────
function computeGradJ(J: number, JPrev: number): number {
  return J - JPrev; // ΔJ ≈ ∇J en sistema escalar
}

// ── mapeo de eventos ServiRed → u_ref y risk ─────────────────────────────────
function mapEvent(eventName: string, payload: Record<string, unknown>): {
  type: string; u_ref: number; risk: number; actor: string; target_node: string;
} {
  switch (eventName) {
    case 'nueva_oportunidad':
      return { type: 'job_request', u_ref: 0.3, risk: 0.2,
               actor: 'cliente', target_node: String(payload.zona || 'global') };

    case 'trabajo_aceptado':
      return { type: 'match_success', u_ref: -0.4, risk: 0.1,
               actor: 'worker', target_node: String(payload.workerId || 'worker') };

    case 'pedido_cancelado':
      return { type: 'job_cancelled', u_ref: 0.6, risk: 0.65,
               actor: 'system', target_node: String(payload.pedidoId || 'job') };

    case 'estado_pedido': {
      const estado = String(payload.estado || '');
      const riskMap: Record<string, number> = {
        PENDIENTE: 0.3, BUSCANDO: 0.4, EN_CAMINO: 0.2,
        EN_PROCESO: 0.15, REALIZADA: 0.05, CANCELADA: 0.7,
      };
      return { type: `state_${estado.toLowerCase()}`,
               u_ref: estado === 'CANCELADA' ? 0.5 : -0.2,
               risk: riskMap[estado] ?? 0.3,
               actor: 'fsm', target_node: String(payload.pedidoId || 'job') };
    }

    case 'pedido_tomado':
      return { type: 'job_taken', u_ref: -0.3, risk: 0.15,
               actor: 'worker', target_node: String(payload.pedidoId || 'job') };

    case 'alerta_worker':
      return { type: 'worker_alert', u_ref: 0.8, risk: 0.85,
               actor: 'meritocracy', target_node: String(payload.workerId || 'worker') };

    case 'trabajador_verificado':
      return { type: 'worker_verified', u_ref: -0.2, risk: 0.05,
               actor: 'admin', target_node: String(payload.id || 'worker') };

    default:
      return { type: eventName, u_ref: 0.1, risk: 0.3,
               actor: 'unknown', target_node: 'global' };
  }
}

// ── Adapter principal ────────────────────────────────────────────────────────
export class ServiRedAdapter {
  private pressure: SystemPressure = {
    pendingJobs: 0, activeWorkers: 1, cancelRate: 0,
    matchLatency: 500, failedMatches: 0, t: 0,
  };
  private JPrev = 0;

  // llamar cuando un job entra al sistema
  onJobCreated()   { this.pressure.pendingJobs++; }
  onJobMatched(latencyMs: number) {
    this.pressure.pendingJobs  = Math.max(0, this.pressure.pendingJobs - 1);
    this.pressure.matchLatency = ema(this.pressure.matchLatency, latencyMs);
  }
  onJobCancelled() {
    this.pressure.pendingJobs  = Math.max(0, this.pressure.pendingJobs - 1);
    this.pressure.cancelRate   = ema(this.pressure.cancelRate, 1);
    this.pressure.failedMatches++;
  }
  onWorkerOnline()  { this.pressure.activeWorkers++; }
  onWorkerOffline() { this.pressure.activeWorkers = Math.max(0, this.pressure.activeWorkers - 1); }

  // convierte evento Socket.io en ControlEvent
  adapt(eventName: string, payload: Record<string, unknown> = {}): ControlEvent {
    // actualizar presión según evento
    if (eventName === 'nueva_oportunidad') this.onJobCreated();
    if (eventName === 'trabajo_aceptado')  this.onJobMatched(Date.now() % 5000);
    if (eventName === 'pedido_cancelado')  this.onJobCancelled();

    const J     = computeJ(this.pressure);
    const gradJ = computeGradJ(J, this.JPrev);
    this.JPrev  = J;
    this.pressure.t++;

    const mapped = mapEvent(eventName, payload);

    return {
      id:          crypto.randomUUID().slice(0, 8),
      t:           this.pressure.t,
      J,
      gradJ,
      ...mapped,
    };
  }

  pressureSnapshot(): SystemPressure & { J: number } {
    return { ...this.pressure, J: computeJ(this.pressure) };
  }
}
