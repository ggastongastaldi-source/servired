// ControlEfficiencyMonitor.ts — E_control = Σu², efficiency = |ΔJ|/E_control
import { EfficiencyClass } from './types';

export class ControlEfficiencyMonitor {
  private sumU2 = 0;
  private sumDJ = 0;
  private n     = 0;

  record(u: number, dJ: number): void {
    this.sumU2 += u * u;
    this.sumDJ += Math.abs(dJ);
    this.n++;
  }

  efficiency(): number {
    return this.sumU2 < 1e-9 ? 0 : this.sumDJ / this.sumU2;
  }

  classify(): EfficiencyClass {
    const e = this.efficiency();
    if (e > 1.5)  return 'OPTIMAL';
    if (e < 0.3)  return 'OVERCONTROL';
    return 'PASSIVE';
  }

  report() {
    return {
      E_control:  +this.sumU2.toFixed(4),
      sum_dJ:     +this.sumDJ.toFixed(4),
      efficiency: +this.efficiency().toFixed(4),
      class:      this.classify(),
      n:          this.n,
    };
  }
}
