"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PolicyRegistry = void 0;
const POLICIES = {
    ATTRACTOR_STABLE: { alpha: 0.1, delta: 0.3, label: 'conservative' },
    DESCENT_ACTIVE: { alpha: 0.3, delta: 0.5, label: 'standard' },
    CASCADE_GROWING: { alpha: 0.8, delta: 0.2, label: 'aggressive' },
    HIGH_ENERGY_PLATEAU: { alpha: 0.6, delta: 0.4, label: 'firm' },
    PHASE_TRANSITION: { alpha: 0.5, delta: 0.3, label: 'cautious' },
    CHAOTIC: { alpha: 0.9, delta: 0.1, label: 'minimal' },
    TRANSIENT: { alpha: 0.3, delta: 0.5, label: 'standard' },
    INITIALIZING: { alpha: 0.3, delta: 0.5, label: 'standard' },
};
class PolicyRegistry {
    get(regime) {
        return POLICIES[regime] ?? POLICIES['TRANSIENT'];
    }
    blend(r1, r2, weight) {
        const p1 = this.get(r1);
        const p2 = this.get(r2);
        return {
            alpha: p1.alpha * (1 - weight) + p2.alpha * weight,
            delta: p1.delta * (1 - weight) + p2.delta * weight,
            label: `blend(${p1.label},${p2.label})`,
        };
    }
}
exports.PolicyRegistry = PolicyRegistry;
