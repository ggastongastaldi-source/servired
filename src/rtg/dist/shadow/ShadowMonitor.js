"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShadowMonitor = void 0;
// ShadowMonitor.ts — observer puro, NO interfiere con ServiRed
// Se engancha al MessageBus existente y registra sin side effects
const ControlLoop_1 = require("../ControlLoop");
const AnalyticsService_1 = require("../AnalyticsService");
const MessageBus_1 = require("../MessageBus");
const ServiRedAdapter_1 = require("./ServiRedAdapter");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const SHADOW_LOG = path.join(__dirname, '../../../../.shadow_rtg.jsonl');
class ShadowMonitor {
    bus = new MessageBus_1.MessageBus();
    loop = new ControlLoop_1.ControlLoop(this.bus);
    analytics = new AnalyticsService_1.AnalyticsService(this.bus);
    adapter = new ServiRedAdapter_1.ServiRedAdapter();
    count = 0;
    // punto de entrada — llamar desde notificationController o socketHandlers
    observe(eventName, payload = {}) {
        try {
            const event = this.adapter.adapt(eventName, payload);
            const J_after = event.J; // en shadow mode J_after = J actual (no proyectamos)
            const result = this.loop.process(event, J_after);
            this.count++;
            const logEntry = {
                ts: Date.now(),
                t: event.t,
                event: eventName,
                J: +event.J.toFixed(4),
                decision: result.decision,
                regime: result.regime,
                mode: result.mode,
                confidence: result.confidence,
                phase_shift: result.phase_shift,
                pressure: this.adapter.pressureSnapshot(),
            };
            fs.appendFileSync(SHADOW_LOG, JSON.stringify(logEntry) + '\n');
            // log cada 10 eventos para no saturar
            if (this.count % 10 === 0 || result.phase_shift || result.decision === 'DENY') {
                console.log(`[Shadow] t=${event.t} ${eventName} → ${result.decision} regime=${result.regime} J=${event.J.toFixed(3)}${result.phase_shift ? ' ⚡SHIFT' : ''}`);
            }
        }
        catch (_) {
            // shadow mode: nunca propaga errores al sistema principal
        }
    }
    report() {
        return this.analytics.report();
    }
    // stats del shadow log
    stats() {
        return { events: this.count, log: SHADOW_LOG };
    }
}
exports.ShadowMonitor = ShadowMonitor;
