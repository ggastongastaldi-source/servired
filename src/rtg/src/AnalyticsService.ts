// AnalyticsService.ts — cold path, nunca bloquea hot path
import { RegimeTransitionGraph }   from './RegimeTransitionGraph';
import { ControlEfficiencyMonitor } from './ControlEfficiencyMonitor';
import { MessageBus }              from './MessageBus';
import { ControlResult, SystemVerdict, Regime } from './types';

export class AnalyticsService {
  private rtg     = new RegimeTransitionGraph();
  private monitor = new ControlEfficiencyMonitor();
  private prevRegime: Regime | null = null;

  constructor(bus: MessageBus) {
    bus.subscribe<ControlResult>('control:result', r => this.ingest(r));
  }

  private ingest(r: ControlResult): void {
    this.monitor.record(r.u, r.dJ);
    if (r.phase_shift && this.prevRegime) {
      this.rtg.record(this.prevRegime, r.regime, Date.now());
    }
    this.prevRegime = r.regime;
  }

  report(): {
    efficiency:    ReturnType<ControlEfficiencyMonitor['report']>;
    rtg_matrix:    Record<string, number>;
    absorbing:     Regime[];
    escalation_risk: Record<string, number>;
    verdict:       SystemVerdict;
  } {
    const eff       = this.monitor.report();
    const matrix    = this.rtg.matrix();
    const absorbing = this.rtg.absorbingStates();

    const regimes: Regime[] = ['ATTRACTOR_STABLE','DESCENT_ACTIVE','CASCADE_GROWING',
      'HIGH_ENERGY_PLATEAU','PHASE_TRANSITION','CHAOTIC','TRANSIENT'];
    const escalation_risk: Record<string, number> = {};
    regimes.forEach(r => {
      const risk = this.rtg.escalationRisk(r);
      if (risk > 0) escalation_risk[r] = +risk.toFixed(3);
    });

    let verdict: SystemVerdict;
    if (eff.class === 'OPTIMAL')      verdict = 'OPTIMAL';
    else if (eff.class === 'OVERCONTROL') verdict = 'INEFFICIENT';
    else if (absorbing.includes('CASCADE_GROWING')) verdict = 'STRUCTURAL_RISK';
    else verdict = 'UNRESPONSIVE';

    return { efficiency: eff, rtg_matrix: matrix, absorbing, escalation_risk, verdict };
  }
}
