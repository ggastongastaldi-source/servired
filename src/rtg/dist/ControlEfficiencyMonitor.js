"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ControlEfficiencyMonitor = void 0;
class ControlEfficiencyMonitor {
    sumU2 = 0;
    sumDJ = 0;
    n = 0;
    record(u, dJ) {
        this.sumU2 += u * u;
        this.sumDJ += Math.abs(dJ);
        this.n++;
    }
    efficiency() {
        return this.sumU2 < 1e-9 ? 0 : this.sumDJ / this.sumU2;
    }
    classify() {
        const e = this.efficiency();
        if (e > 1.5)
            return 'OPTIMAL';
        if (e < 0.3)
            return 'OVERCONTROL';
        return 'PASSIVE';
    }
    report() {
        return {
            E_control: +this.sumU2.toFixed(4),
            sum_dJ: +this.sumDJ.toFixed(4),
            efficiency: +this.efficiency().toFixed(4),
            class: this.classify(),
            n: this.n,
        };
    }
}
exports.ControlEfficiencyMonitor = ControlEfficiencyMonitor;
