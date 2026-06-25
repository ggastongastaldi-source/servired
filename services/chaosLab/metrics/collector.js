'use strict';
class MetricsCollector {
  constructor(runId, scenario) {
    this.runId = runId; this.scenario = scenario; this.startedAt = Date.now();
    this._baselinePrices = []; this._effectivePrices = [];
    this._totalEvents = 0; this._chaosEvents = 0;
    this._injectedAt = {}; this._detectedAt = {};
    this._trustSamples = [];
  }
  recordEvent({ isChaos }) { this._totalEvents++; if (isChaos) this._chaosEvents++; }
  recordPrice({ baseline, effective }) { this._baselinePrices.push(baseline); this._effectivePrices.push(effective); }
  recordInjection(eventId) { this._injectedAt[eventId] = Date.now(); }
  recordDetection(eventId) { if (this._injectedAt[eventId]) this._detectedAt[eventId] = Date.now(); }
  recordTrustSample(score) { this._trustSamples.push({ t: Date.now() - this.startedAt, score }); }
  _computeMDI() {
    if (!this._baselinePrices.length) return null;
    let d = 0;
    for (let i = 0; i < this._baselinePrices.length; i++) {
      const b = this._baselinePrices[i], e = this._effectivePrices[i] ?? b;
      d += Math.abs(b - e) / (b || 1);
    }
    return d / this._baselinePrices.length;
  }
  _computeContaminationRatio() { return this._totalEvents ? this._chaosEvents / this._totalEvents : 0; }
  _computeDetectionLatency() {
    const l = Object.keys(this._detectedAt).filter(id => this._injectedAt[id]).map(id => this._detectedAt[id] - this._injectedAt[id]);
    return l.length ? l.reduce((a,b)=>a+b,0)/l.length : null;
  }
  _computeStabilityScore() {
    const mdi = this._computeMDI() ?? 0;
    const lat = Math.min((this._computeDetectionLatency() ?? 0) / 10000, 1);
    return Math.max(0, Math.min(1, 1 - (mdi * 0.7 + lat * 0.3)));
  }
  report() {
    return {
      runId: this.runId, scenario: this.scenario,
      durationMs: Date.now() - this.startedAt,
      totalEvents: this._totalEvents, chaosEvents: this._chaosEvents,
      metrics: {
        MarketDeviationIndex: this._computeMDI(),
        ContaminationRatio: this._computeContaminationRatio(),
        DetectionLatencyMs: this._computeDetectionLatency(),
        TrustDecayCurve: this._trustSamples,
        SystemStabilityScore: this._computeStabilityScore(),
      },
    };
  }
}
module.exports = MetricsCollector;
