// ControlLoop.ts — HOT PATH: low latency, no IO
import { RegimeDetector }        from './RegimeDetector';
import { DwellTimeGate }         from './DwellTimeGate';
import { PolicyRegistry }        from './PolicyRegistry';
import { AdaptiveDixieGate }     from './AdaptiveDixieGate';
import { PredictivePolicyLoader } from './PredictivePolicyLoader';
import { RegimeTransitionGraph }  from './RegimeTransitionGraph';
import { MessageBus }            from './MessageBus';
import { ControlEvent, ControlResult } from './types';

export class ControlLoop {
  private detector = new RegimeDetector();
  private dwell    = new DwellTimeGate();
  private registry = new PolicyRegistry();
  private gate     = new AdaptiveDixieGate();
  private rtg      = new RegimeTransitionGraph();
  private loader:   PredictivePolicyLoader;

  constructor(private bus: MessageBus) {
    this.loader = new PredictivePolicyLoader(this.registry, this.rtg);
  }

  // HOT PATH — síncrono, sin IO
  process(event: ControlEvent, J_after: number): ControlResult {
    const regimeState = this.detector.observe(event.J);
    const dwellState  = this.dwell.update(regimeState.regime, event.J);
    const policy      = this.loader.load(regimeState.regime);

    const gateResult  = this.gate.evaluate(event.gradJ, event.u_ref, event.risk, {
      alpha:       policy.alpha,
      delta:       policy.delta,
      alpha_scale: dwellState.alpha_scale,
      delta_scale: dwellState.delta_scale,
    });

    const dJ = J_after - event.J;

    const result: ControlResult = {
      decision:     gateResult.decision,
      u:            gateResult.u,
      J_before:     event.J,
      J_after,
      dJ,
      energy_delta: gateResult.energy_delta,
      regime:       regimeState.regime,
      mode:         dwellState.mode,
      efficiency:   'OPTIMAL',
      confidence:   regimeState.confidence,
      phase_shift:  regimeState.phase_shift,
    };

    // cold path: async via bus
    this.bus.publish('control:result', result);
    return result;
  }
}
