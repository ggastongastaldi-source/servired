"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalyticsService = void 0;
// AnalyticsService.ts — cold path, nunca bloquea hot path
const RegimeTransitionGraph_1 = require("./RegimeTransitionGraph");
const ControlEfficiencyMonitor_1 = require("./ControlEfficiencyMonitor");
class AnalyticsService {
    rtg = new RegimeTransitionGraph_1.RegimeTransitionGraph();
    monitor = new ControlEfficiencyMonitor_1.ControlEfficiencyMonitor();
    prevRegime = null;
    constructor(bus) {
        bus.subscribe('control:result', r => this.ingest(r));
    }
    ingest(r) {
        this.monitor.record(r.u, r.dJ);
        if (r.phase_shift && this.prevRegime) {
            this.rtg.record(this.prevRegime, r.regime, Date.now());
        }
        this.prevRegime = r.regime;
    }
    report() {
        const eff = this.monitor.report();
        const matrix = this.rtg.matrix();
        const absorbing = this.rtg.absorbingStates();
        const regimes = ['ATTRACTOR_STABLE', 'DESCENT_ACTIVE', 'CASCADE_GROWING',
            'HIGH_ENERGY_PLATEAU', 'PHASE_TRANSITION', 'CHAOTIC', 'TRANSIENT'];
        const escalation_risk = {};
        regimes.forEach(r => {
            const risk = this.rtg.escalationRisk(r);
            if (risk > 0)
                escalation_risk[r] = +risk.toFixed(3);
        });
        let verdict;
        if (eff.class === 'OPTIMAL')
            verdict = 'OPTIMAL';
        else if (eff.class === 'OVERCONTROL')
            verdict = 'INEFFICIENT';
        else if (absorbing.includes('CASCADE_GROWING'))
            verdict = 'STRUCTURAL_RISK';
        else
            verdict = 'UNRESPONSIVE';
        return { efficiency: eff, rtg_matrix: matrix, absorbing, escalation_risk, verdict };
    }
}
exports.AnalyticsService = AnalyticsService;
