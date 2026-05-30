// RegimeTransitionGraph.ts — grafo probabilístico de transiciones
import { Regime, TransitionRecord } from './types';

export class RegimeTransitionGraph {
  private counts = new Map<string, number>();
  private totals = new Map<Regime, number>();
  private records: TransitionRecord[] = [];

  record(from: Regime, to: Regime, t: number): void {
    if (from === to) return;
    const key = `${from}→${to}`;
    this.counts.set(key, (this.counts.get(key) ?? 0) + 1);
    this.totals.set(from, (this.totals.get(from) ?? 0) + 1);
    this.records.push({ from, to, t });
  }

  probability(from: Regime, to: Regime): number {
    const c = this.counts.get(`${from}→${to}`) ?? 0;
    const t = this.totals.get(from) ?? 0;
    return t === 0 ? 0 : c / t;
  }

  // detectar estados absorbentes (alta auto-retención)
  absorbingStates(): Regime[] {
    const absorbing: Regime[] = [];
    for (const [from, total] of this.totals) {
      let selfExit = 0;
      for (const [key, count] of this.counts) {
        if (key.startsWith(`${from}→`)) selfExit += count;
      }
      if (selfExit / total < 0.2) absorbing.push(from);
    }
    return absorbing;
  }

  // escalación predictiva: probabilidad de llegar a estado peligroso
  escalationRisk(current: Regime): number {
    const dangerous: Regime[] = ['CASCADE_GROWING','CHAOTIC'];
    return dangerous.reduce((s, d) => s + this.probability(current, d), 0);
  }

  matrix(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const [key, count] of this.counts) {
      const from = key.split('→')[0] as Regime;
      const total = this.totals.get(from) ?? 1;
      out[key] = +(count / total).toFixed(3);
    }
    return out;
  }
}
