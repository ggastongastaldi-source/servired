"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RegimeDetector = void 0;
const WINDOW = 20;
const MIN_CONF = 0.6;
const DECAY = 0.92;
const THRESHOLD = 2.5;
class RegimeDetector {
    history = [];
    dHistory = [];
    regimes = [];
    _current = null;
    t = 0;
    features(J) {
        const n = this.history.length;
        const dJ = n > 0 ? J - this.history[n - 1] : 0;
        const d2J = this.dHistory.length > 0
            ? dJ - this.dHistory[this.dHistory.length - 1] : 0;
        const win = this.history.slice(-8);
        const mu = win.reduce((s, v) => s + v, 0) / (win.length || 1);
        const variance = win.reduce((s, v) => s + (v - mu) ** 2, 0) / (win.length || 1);
        return [J, dJ, d2J, variance];
    }
    distance(feat, r) {
        return feat.reduce((s, f, i) => {
            const sigma = Math.sqrt((r.sigma2[i] ?? 0.1) + 1e-6);
            return s + ((f - (r.mu[i] ?? 0)) / sigma) ** 2;
        }, 0) / feat.length;
    }
    updateCentroid(r, feat) {
        r.visits++;
        const lr = Math.min(1 - DECAY, 1 / r.visits);
        feat.forEach((f, i) => {
            const delta = f - (r.mu[i] ?? 0);
            r.mu[i] = (r.mu[i] ?? 0) + lr * delta;
            r.sigma2[i] = DECAY * (r.sigma2[i] ?? 0.1) + (1 - DECAY) * delta ** 2;
        });
    }
    label(mu) {
        const [J = 0, dJ = 0, d2J = 0, variance = 0] = mu;
        if (J < 0.5 && Math.abs(dJ) < 0.05)
            return 'ATTRACTOR_STABLE';
        if (J > 2.0 && dJ > 0.1)
            return 'CASCADE_GROWING';
        if (J > 1.5 && Math.abs(dJ) < 0.1)
            return 'HIGH_ENERGY_PLATEAU';
        if (dJ < -0.1)
            return 'DESCENT_ACTIVE';
        if (Math.abs(d2J) > 0.2)
            return 'PHASE_TRANSITION';
        if (variance > 0.3)
            return 'CHAOTIC';
        return 'TRANSIENT';
    }
    observe(J) {
        const feat = this.features(J);
        this.history.push(J);
        this.dHistory.push(feat[1] ?? 0);
        if (this.history.length > WINDOW)
            this.history.shift();
        if (this.dHistory.length > WINDOW)
            this.dHistory.shift();
        this.t++;
        if (this.history.length < 4) {
            return { regime: 'INITIALIZING', regime_id: -1, confidence: 0,
                phase_shift: false, prev_regime: null };
        }
        let best = null;
        let bestDist = Infinity;
        for (const r of this.regimes) {
            const d = this.distance(feat, r);
            if (d < bestDist) {
                bestDist = d;
                best = r;
            }
        }
        if (!best || bestDist > THRESHOLD) {
            best = { id: this.regimes.length, mu: [...feat],
                sigma2: feat.map(() => 0.1), visits: 1,
                label: this.label(feat), born_t: this.t };
            this.regimes.push(best);
            bestDist = 0;
        }
        else {
            this.updateCentroid(best, feat);
            best.label = this.label(best.mu);
        }
        const confidence = Math.min(1, 1 / (1 + bestDist));
        const phase_shift = !!this._current &&
            this._current.id !== best.id &&
            confidence > MIN_CONF;
        const prev = this._current;
        if (confidence > MIN_CONF)
            this._current = best;
        return { regime: best.label, regime_id: best.id,
            confidence: +confidence.toFixed(3),
            phase_shift, prev_regime: prev?.label ?? null };
    }
    summary() {
        return this.regimes.map(r => ({
            id: r.id, label: r.label, visits: r.visits,
            J_mu: +r.mu[0].toFixed(4), dJ_mu: +r.mu[1].toFixed(4),
        }));
    }
    get current() { return this._current; }
}
exports.RegimeDetector = RegimeDetector;
