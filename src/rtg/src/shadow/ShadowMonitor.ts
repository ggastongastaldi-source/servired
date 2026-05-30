// ShadowMonitor.ts — observer puro, NO interfiere con ServiRed
// Se engancha al MessageBus existente y registra sin side effects
import { ControlLoop }      from '../ControlLoop';
import { AnalyticsService } from '../AnalyticsService';
import { MessageBus }       from '../MessageBus';
import { ServiRedAdapter }  from './ServiRedAdapter';
import * as fs from 'fs';
import * as path from 'path';

const SHADOW_LOG = path.join(__dirname, '../../../../.shadow_rtg.jsonl');

export class ShadowMonitor {
  private bus      = new MessageBus();
  private loop     = new ControlLoop(this.bus);
  private analytics= new AnalyticsService(this.bus);
  private adapter  = new ServiRedAdapter();
  private count    = 0;

  // punto de entrada — llamar desde notificationController o socketHandlers
  observe(eventName: string, payload: Record<string, unknown> = {}): void {
    try {
      const event   = this.adapter.adapt(eventName, payload);
      const J_after = event.J; // en shadow mode J_after = J actual (no proyectamos)
      const result  = this.loop.process(event, J_after);
      this.count++;

      const logEntry = {
        ts:        Date.now(),
        t:         event.t,
        event:     eventName,
        J:         +event.J.toFixed(4),
        decision:  result.decision,
        regime:    result.regime,
        mode:      result.mode,
        confidence:result.confidence,
        phase_shift: result.phase_shift,
        pressure:  this.adapter.pressureSnapshot(),
      };

      fs.appendFileSync(SHADOW_LOG, JSON.stringify(logEntry) + '\n');

      // log cada 10 eventos para no saturar
      if (this.count % 10 === 0 || result.phase_shift || result.decision === 'DENY') {
        console.log(`[Shadow] t=${event.t} ${eventName} → ${result.decision} regime=${result.regime} J=${event.J.toFixed(3)}${result.phase_shift ? ' ⚡SHIFT' : ''}`);
      }
    } catch (_) {
      // shadow mode: nunca propaga errores al sistema principal
    }
  }

  report() {
    return this.analytics.report();
  }

  // stats del shadow log
  stats(): { events: number; log: string } {
    return { events: this.count, log: SHADOW_LOG };
  }
}
