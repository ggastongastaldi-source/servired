"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ControlLoop = void 0;
// ControlLoop.ts — HOT PATH: low latency, no IO
const RegimeDetector_1 = require("./RegimeDetector");
const DwellTimeGate_1 = require("./DwellTimeGate");
const PolicyRegistry_1 = require("./PolicyRegistry");
const AdaptiveDixieGate_1 = require("./AdaptiveDixieGate");
const PredictivePolicyLoader_1 = require("./PredictivePolicyLoader");
const RegimeTransitionGraph_1 = require("./RegimeTransitionGraph");
class ControlLoop {
    bus;
    detector = new RegimeDetector_1.RegimeDetector();
    dwell = new DwellTimeGate_1.DwellTimeGate();
    registry = new PolicyRegistry_1.PolicyRegistry();
    gate = new AdaptiveDixieGate_1.AdaptiveDixieGate();
    rtg = new RegimeTransitionGraph_1.RegimeTransitionGraph();
    loader;
    constructor(bus) {
        this.bus = bus;
        this.loader = new PredictivePolicyLoader_1.PredictivePolicyLoader(this.registry, this.rtg);
    }
    // HOT PATH — síncrono, sin IO
    process(event, J_after) {
        const regimeState = this.detector.observe(event.J);
        const dwellState = this.dwell.update(regimeState.regime, event.J);
        const policy = this.loader.load(regimeState.regime);
        const gateResult = this.gate.evaluate(event.gradJ, event.u_ref, event.risk, {
            alpha: policy.alpha,
            delta: policy.delta,
            alpha_scale: dwellState.alpha_scale,
            delta_scale: dwellState.delta_scale,
        });
        const dJ = J_after - event.J;
        const result = {
            decision: gateResult.decision,
            u: gateResult.u,
            J_before: event.J,
            J_after,
            dJ,
            energy_delta: gateResult.energy_delta,
            regime: regimeState.regime,
            mode: dwellState.mode,
            efficiency: 'OPTIMAL',
            confidence: regimeState.confidence,
            phase_shift: regimeState.phase_shift,
        };
        // cold path: async via bus
        this.bus.publish('control:result', result);
        return result;
    }
}
exports.ControlLoop = ControlLoop;
