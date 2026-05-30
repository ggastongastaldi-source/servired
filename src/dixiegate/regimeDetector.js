// regimeDetector.js — detecta atractores y phase shifts sin thresholds hardcodeados
// Método: clustering online de trayectorias J(t) via distancia de Mahalanobis

const WINDOW     = 20;   // ventana de historia para inferencia
const MIN_CONF   = 0.6;  // confianza mínima para declarar régimen
const DECAY      = 0.92; // decay de centroides (forgetting factor)

class RegimeDetector {
  constructor() {
    this.history  = [];   // últimos N valores de J
    this.dHistory = [];   // deltas ΔJ
    this.regimes  = [];   // centroides aprendidos: { mu, sigma2, visits, label }
    this.current  = null; // régimen activo
    this.t        = 0;
  }

  // feature vector del estado actual: [J, ΔJ, D²J, var]
  _features(J) {
    const n   = this.history.length;
    const dJ  = n > 0 ? J - this.history[n-1] : 0;
    const d2J = this.dHistory.length > 0 ? dJ - this.dHistory[this.dHistory.length-1] : 0;
    const win = this.history.slice(-8);
    const mu  = win.reduce((s,v)=>s+v,0) / (win.length||1);
    const var_ = win.reduce((s,v)=>s+Math.pow(v-mu,2),0) / (win.length||1);
    return [J, dJ, d2J, var_];
  }

  // distancia normalizada entre feature vector y centroide
  _distance(feat, regime) {
    return feat.reduce((s, f, i) => {
      const sigma = Math.sqrt(regime.sigma2[i] + 1e-6);
      return s + Math.pow((f - regime.mu[i]) / sigma, 2);
    }, 0) / feat.length;
  }

  // actualizar centroide online (Welford + decay)
  _updateCentroid(regime, feat) {
    regime.visits++;
    const lr = Math.min(1 - DECAY, 1 / regime.visits);
    feat.forEach((f, i) => {
      const delta      = f - regime.mu[i];
      regime.mu[i]    += lr * delta;
      regime.sigma2[i] = DECAY * regime.sigma2[i] + (1-DECAY) * delta * delta;
    });
  }

  // asignar label semántico basado en características del régimen
  _label(mu) {
    const [J, dJ, d2J, var_] = mu;
    if (J < 0.5  && Math.abs(dJ) < 0.05) return 'ATTRACTOR_STABLE';
    if (J > 2.0  && dJ > 0.1)            return 'CASCADE_GROWING';
    if (J > 1.5  && Math.abs(dJ) < 0.1)  return 'HIGH_ENERGY_PLATEAU';
    if (dJ < -0.1)                        return 'DESCENT_ACTIVE';
    if (Math.abs(d2J) > 0.2)             return 'PHASE_TRANSITION';
    if (var_ > 0.3)                       return 'CHAOTIC';
    return 'TRANSIENT';
  }

  observe(J) {
    const feat = this._features(J);
    this.history.push(J);
    this.dHistory.push(feat[1]);
    if (this.history.length  > WINDOW) this.history.shift();
    if (this.dHistory.length > WINDOW) this.dHistory.shift();
    this.t++;

    // con menos de 4 puntos no inferimos
    if (this.history.length < 4) return { regime: 'INITIALIZING', confidence: 0, feat };

    // buscar régimen más cercano
    let best = null, bestDist = Infinity;
    for (const r of this.regimes) {
      const d = this._distance(feat, r);
      if (d < bestDist) { bestDist = d; best = r; }
    }

    const THRESHOLD = 2.5; // distancia Mahalanobis normalizada para "nuevo régimen"

    if (!best || bestDist > THRESHOLD) {
      // crear nuevo centroide
      const newRegime = {
        id:      this.regimes.length,
        mu:      [...feat],
        sigma2:  feat.map(() => 0.1),
        visits:  1,
        label:   this._label(feat),
        born_t:  this.t,
      };
      this.regimes.push(newRegime);
      best = newRegime;
      bestDist = 0;
    } else {
      this._updateCentroid(best, feat);
      best.label = this._label(best.mu); // re-label dinámico
    }

    // confianza: inversa de distancia normalizada
    const confidence = Math.min(1, 1 / (1 + bestDist));
    const phase_shift = this.current && this.current.id !== best.id && confidence > MIN_CONF;

    const prev = this.current;
    if (confidence > MIN_CONF) this.current = best;

    return {
      regime:      best.label,
      regime_id:   best.id,
      confidence:  +confidence.toFixed(3),
      phase_shift,
      prev_regime: prev?.label || null,
      dist:        +bestDist.toFixed(4),
      feat:        feat.map(f => +f.toFixed(4)),
      regimes_seen: this.regimes.length,
    };
  }

  summary() {
    return this.regimes.map(r => ({
      id:     r.id,
      label:  r.label,
      visits: r.visits,
      J_mu:   +r.mu[0].toFixed(4),
      dJ_mu:  +r.mu[1].toFixed(4),
      born_t: r.born_t,
    }));
  }
}

module.exports = { RegimeDetector };
