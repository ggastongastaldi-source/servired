// PredictivePolicyLoader.ts — blending basado en RTG
import { PolicyRegistry }       from './PolicyRegistry';
import { RegimeTransitionGraph } from './RegimeTransitionGraph';
import { Regime }               from './types';

export class PredictivePolicyLoader {
  constructor(
    private registry: PolicyRegistry,
    private rtg:      RegimeTransitionGraph,
  ) {}

  load(current: Regime): { alpha: number; delta: number; label: string } {
    const risk = this.rtg.escalationRisk(current);
    if (risk > 0.5) {
      // blend hacia política agresiva
      return this.registry.blend(current, 'CASCADE_GROWING', risk);
    }
    return this.registry.get(current);
  }
}
