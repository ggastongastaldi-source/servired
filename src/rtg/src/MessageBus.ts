// MessageBus.ts — event bus in-process, hot path nunca bloquea
type Handler<T> = (payload: T) => void;

export class MessageBus {
  private subs = new Map<string, Handler<unknown>[]>();

  publish<T>(channel: string, payload: T): void {
    const handlers = this.subs.get(channel);
    if (!handlers) return;
    // cold path: async, no bloquea hot path
    setTimeout(() => handlers.forEach(h => {
      try { h(payload as unknown); } catch (_) {}
    }));
  }

  publishSync<T>(channel: string, payload: T): void {
    // hot path: síncrono, solo para control loop
    const handlers = this.subs.get(channel);
    if (!handlers) return;
    handlers.forEach(h => { try { h(payload as unknown); } catch (_) {} });
  }

  subscribe<T>(channel: string, handler: Handler<T>): void {
    const list = this.subs.get(channel) ?? [];
    list.push(handler as Handler<unknown>);
    this.subs.set(channel, list);
  }
}
