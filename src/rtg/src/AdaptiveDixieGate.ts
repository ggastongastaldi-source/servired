// AdaptiveDixieGate.ts — control proyectivo con u(t) smoothing
import { Decision, Regime } from './types';

interface GateParams { alpha: number; delta: number; alpha_scale: number; delta_scale: number; }

export class AdaptiveDixieGate {
  private uPrev = 0;
  private SMOOTH = 0.3; // EMA smoothing de u

  evaluate(gradJ: number, uRef: number, risk: number, params: GateParams)
    : { decision: Decision; u: number; energy_delta: number; reason: string } {

    const alpha = params.alpha * params.alpha_scale;
    const delta = params.delta * params.delta_scale;

    // FREEZE → veto total
    if (params.alpha_scale === 0) {
      return { decision: 'DENY', u: 0, energy_delta: 0, reason: 'FREEZE mode — veto total' };
    }

    if (risk >= 0.95) {
      return { decision: 'DENY', u: 0, energy_delta: 0, reason: `risk=${risk} > umbral absoluto` };
    }

    // proyección QP: u_proj = u_ref - correction * ∇J
    const dot       = gradJ * uRef;
    const norm      = Math.abs(gradJ);
    const threshold = -alpha * norm;
    let u = uRef;
    if (dot > threshold) {
      const correction = (dot - threshold) / (norm * norm + 1e-9);
      u = uRef - correction * gradJ;
    }
    u = Math.max(-delta, Math.min(delta, u));

    // EMA smoothing
    u = this.SMOOTH * u + (1 - this.SMOOTH) * this.uPrev;
    this.uPrev = u;

    const energy_delta = gradJ * u;
    let decision: Decision;
    let reason: string;

    if (energy_delta > 0) {
      decision = 'VETO';
      reason   = `∇J·u=${energy_delta.toFixed(4)} > 0`;
    } else if (risk >= 0.7 && Math.abs(energy_delta) < alpha * norm) {
      decision = 'ESCALATE';
      reason   = `descenso insuficiente + risk=${risk}`;
    } else {
      decision = 'ALLOW';
      reason   = `∇J·u=${energy_delta.toFixed(4)} — descenso OK`;
    }

    return { decision, u: decision === 'ALLOW' ? u : 0, energy_delta, reason };
  }
}
