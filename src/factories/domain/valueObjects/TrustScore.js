'use strict';

const EVIDENCE_WEIGHTS = {
  CUIT_VALIDO:       20,
  AFIP_ACTIVO:       25,
  DIRECCION_FISICA:  10,
  CERTIFICACION:     15,
  TRAYECTORIA_1ANO:  10,
  TRAYECTORIA_3ANOS: 15,
  TRAYECTORIA_5ANOS: 20,
};

const MAX_CERT_WEIGHT = 20;
const MAX_SCORE       = 100;

class TrustScore {
  #evidences;
  #score;

  constructor(evidences = []) {
    const seen     = new Set();
    let certWeight = 0;
    let total      = 0;

    for (const ev of evidences) {
      if (!Object.prototype.hasOwnProperty.call(EVIDENCE_WEIGHTS, ev))
        throw new Error('TrustScore: evidencia desconocida "' + ev + '"');
      if (seen.has(ev))
        throw new Error('TrustScore: evidencia duplicada "' + ev + '"');
      seen.add(ev);

      if (ev === 'CERTIFICACION') {
        const available = Math.max(0, MAX_CERT_WEIGHT - certWeight);
        const toAdd     = Math.min(EVIDENCE_WEIGHTS.CERTIFICACION, available);
        certWeight += toAdd;
        total      += toAdd;
      } else {
        total += EVIDENCE_WEIGHTS[ev];
      }
    }

    this.#evidences = new Set(seen);
    this.#score     = Math.min(total, MAX_SCORE);
    Object.freeze(this);
  }

  get score()     { return this.#score; }
  get evidences() { return [...this.#evidences]; }

  hasEvidence(type) { return this.#evidences.has(type); }

  withEvidence(type) {
    if (this.#evidences.has(type))
      throw new Error('TrustScore: evidencia "' + type + '" ya registrada');
    return new TrustScore([...this.#evidences, type]);
  }

  equals(other) {
    return other instanceof TrustScore && other.score === this.#score;
  }

  static get EVIDENCE_TYPES() { return Object.keys(EVIDENCE_WEIGHTS); }
  static get WEIGHTS()        { return { ...EVIDENCE_WEIGHTS }; }

  toString() { return 'TrustScore(' + this.#score + ')'; }
}

const DEFAULT_THRESHOLDS = [
  { min: 80, state: 'VERIFICADO_PLENO' },
  { min: 60, state: 'VERIFICADO'       },
  { min: 40, state: 'EN_PROCESO'       },
  { min:  0, state: 'SIN_VERIFICAR'    },
];

class VerificationPolicy {
  #thresholds;

  constructor(thresholds = DEFAULT_THRESHOLDS) {
    this.#thresholds = [...thresholds].sort((a, b) => b.min - a.min);
    Object.freeze(this);
  }

  evaluate(trustScore) {
    if (!(trustScore instanceof TrustScore))
      throw new Error('VerificationPolicy.evaluate: requiere un TrustScore');
    return this.#thresholds.find(t => trustScore.score >= t.min)?.state ?? 'SIN_VERIFICAR';
  }

  static get default() { return new VerificationPolicy(); }
}

module.exports = { TrustScore, VerificationPolicy, EVIDENCE_WEIGHTS, DEFAULT_THRESHOLDS };
