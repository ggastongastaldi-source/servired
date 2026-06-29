'use strict';
class EventBus {
  constructor() { this._handlers = new Map(); this._middleware = []; this._dead = []; }
  use(fn) { this._middleware.push(fn); return this; }
  on(eventType, handler) {
    const types = Array.isArray(eventType) ? eventType : [eventType];
    for (const t of types) { if (!this._handlers.has(t)) this._handlers.set(t, new Set()); this._handlers.get(t).add(handler); }
    return () => types.forEach(t => this._handlers.get(t)?.delete(handler));
  }
  async publish(event) {
    if (!event || !event.type) return;
    let i = 0;
    const next = async () => { if (i < this._middleware.length) await this._middleware[i++](event, next); else await this._dispatch(event); };
    await next();
  }
  async _dispatch(event) {
    const hs = this._handlers.get(event.type);
    if (!hs || !hs.size) { this._dead.push({ event, ts: Date.now() }); return; }
    const res = await Promise.allSettled([...hs].map(h => h(event)));
    for (const r of res) if (r.status === 'rejected') console.error(`[EventBus] ${event.type}:`, r.reason?.message);
  }
  deadLetters() { return [...this._dead]; }
  stats() { const s = {}; for (const [t,h] of this._handlers) s[t]=h.size; return { subscriptions:s, deadLetters:this._dead.length }; }
}
module.exports = new EventBus();
