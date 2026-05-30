"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RegimeTransitionGraph = void 0;
class RegimeTransitionGraph {
    counts = new Map();
    totals = new Map();
    records = [];
    record(from, to, t) {
        if (from === to)
            return;
        const key = `${from}→${to}`;
        this.counts.set(key, (this.counts.get(key) ?? 0) + 1);
        this.totals.set(from, (this.totals.get(from) ?? 0) + 1);
        this.records.push({ from, to, t });
    }
    probability(from, to) {
        const c = this.counts.get(`${from}→${to}`) ?? 0;
        const t = this.totals.get(from) ?? 0;
        return t === 0 ? 0 : c / t;
    }
    // detectar estados absorbentes (alta auto-retención)
    absorbingStates() {
        const absorbing = [];
        for (const [from, total] of this.totals) {
            let selfExit = 0;
            for (const [key, count] of this.counts) {
                if (key.startsWith(`${from}→`))
                    selfExit += count;
            }
            if (selfExit / total < 0.2)
                absorbing.push(from);
        }
        return absorbing;
    }
    // escalación predictiva: probabilidad de llegar a estado peligroso
    escalationRisk(current) {
        const dangerous = ['CASCADE_GROWING', 'CHAOTIC'];
        return dangerous.reduce((s, d) => s + this.probability(current, d), 0);
    }
    matrix() {
        const out = {};
        for (const [key, count] of this.counts) {
            const from = key.split('→')[0];
            const total = this.totals.get(from) ?? 1;
            out[key] = +(count / total).toFixed(3);
        }
        return out;
    }
}
exports.RegimeTransitionGraph = RegimeTransitionGraph;
