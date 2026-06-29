'use strict';
const S = { CREATED:'CREATED', STARTED:'STARTED', STOPPED:'STOPPED', ERROR:'ERROR' };
class ServiceRegistry {
  constructor() { this._s = new Map(); }
  register(svc) {
    if (!svc.name) throw new Error('service.name requerido');
    if (this._s.has(svc.name)) return this;
    this._s.set(svc.name, { instance:svc, state:S.CREATED, startedAt:null, errors:[] });
    return this;
  }
  async startAll(bus) {
    for (const [n,e] of this._s) {
      try { await e.instance.start(bus); e.state=S.STARTED; e.startedAt=Date.now(); console.log(`[Registry] ▶ ${n}`); }
      catch(err) { e.state=S.ERROR; e.errors.push(err.message); console.error(`[Registry] ✗ ${n}:`,err.message); }
    }
  }
  async stopAll() {
    for (const [n,e] of this._s) {
      if (e.state===S.STARTED && e.instance.stop) { try { await e.instance.stop(); e.state=S.STOPPED; } catch(err) { console.error(`[Registry] stop ${n}:`,err.message); } }
    }
  }
  status() { const o={}; for (const [n,e] of this._s) o[n]={state:e.state,errors:e.errors}; return o; }
}
module.exports = new ServiceRegistry();
