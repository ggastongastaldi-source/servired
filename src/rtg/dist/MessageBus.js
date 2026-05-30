"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageBus = void 0;
class MessageBus {
    subs = new Map();
    publish(channel, payload) {
        const handlers = this.subs.get(channel);
        if (!handlers)
            return;
        // cold path: async, no bloquea hot path
        setTimeout(() => handlers.forEach(h => {
            try {
                h(payload);
            }
            catch (_) { }
        }));
    }
    publishSync(channel, payload) {
        // hot path: síncrono, solo para control loop
        const handlers = this.subs.get(channel);
        if (!handlers)
            return;
        handlers.forEach(h => { try {
            h(payload);
        }
        catch (_) { } });
    }
    subscribe(channel, handler) {
        const list = this.subs.get(channel) ?? [];
        list.push(handler);
        this.subs.set(channel, list);
    }
}
exports.MessageBus = MessageBus;
