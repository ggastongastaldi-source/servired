"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DwellTimeGate = void 0;
const DWELL = {
    NORMAL_TO_LOCK: 3,
    LOCK_TO_FREEZE: 2,
    FREEZE_TO_LOCK: 4,
    LOCK_TO_NORMAL: 5,
};
class DwellTimeGate {
    mode = 'NORMAL';
    counter = 0;
    target = 'NORMAL';
    update(regime, J) {
        const desired = this.desiredMode(regime, J);
        if (desired !== this.mode) {
            if (desired !== this.target) {
                this.target = desired;
                this.counter = 0;
            }
            this.counter++;
            const key = `${this.mode}_TO_${desired}`;
            const needed = DWELL[key] ?? 3;
            if (this.counter >= needed) {
                this.mode = desired;
                this.counter = 0;
            }
        }
        else {
            this.target = this.mode;
            this.counter = 0;
        }
        return {
            mode: this.mode,
            alpha_scale: this.mode === 'FREEZE' ? 0 : this.mode === 'LOCK' ? 0.5 : 1.0,
            delta_scale: this.mode === 'FREEZE' ? 0 : this.mode === 'LOCK' ? 0.3 : 1.0,
        };
    }
    desiredMode(regime, J) {
        if (regime === 'CASCADE_GROWING' || J > 3.0)
            return 'FREEZE';
        if (regime === 'CHAOTIC' || regime === 'PHASE_TRANSITION')
            return 'LOCK';
        return 'NORMAL';
    }
    getMode() { return this.mode; }
}
exports.DwellTimeGate = DwellTimeGate;
