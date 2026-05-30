"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PredictivePolicyLoader = void 0;
class PredictivePolicyLoader {
    registry;
    rtg;
    constructor(registry, rtg) {
        this.registry = registry;
        this.rtg = rtg;
    }
    load(current) {
        const risk = this.rtg.escalationRisk(current);
        if (risk > 0.5) {
            // blend hacia política agresiva
            return this.registry.blend(current, 'CASCADE_GROWING', risk);
        }
        return this.registry.get(current);
    }
}
exports.PredictivePolicyLoader = PredictivePolicyLoader;
