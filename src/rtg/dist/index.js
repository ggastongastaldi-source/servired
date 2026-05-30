"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// index.ts — entry point ejecutable
const MessageBus_1 = require("./MessageBus");
const ControlLoop_1 = require("./ControlLoop");
const AnalyticsService_1 = require("./AnalyticsService");
const C = {
    reset: '\x1b[0m', green: '\x1b[32m', red: '\x1b[31m',
    yellow: '\x1b[33m', cyan: '\x1b[36m', bold: '\x1b[1m', dim: '\x1b[2m',
};
function dc(d) {
    return d === 'ALLOW' ? C.green : d === 'VETO' || d === 'DENY' ? C.red : C.yellow;
}
// ── grafo simulado mínimo (sin IO) ──────────────────────────────────────────
function simJ(t, u, prevJ) {
    const noise = (Math.random() - 0.5) * 0.1;
    return Math.max(0, prevJ * 0.85 + u * 0.3 + noise);
}
function simGradJ(J) {
    return 2 * 0.6 * J + (Math.random() - 0.5) * 0.2;
}
const EVENTS = [
    { id: 'E001', type: 'job_match', actor: 'system', target_node: 'C1', u_ref: 0.3, risk: 0.2 },
    { id: 'E002', type: 'hub_override', actor: 'admin', target_node: 'H1', u_ref: 0.8, risk: 0.75 },
    { id: 'E003', type: 'cascade_push', actor: 'edge', target_node: 'S1', u_ref: 1.2, risk: 0.5 },
    { id: 'E004', type: 'critical_op', actor: 'unknown', target_node: 'H2', u_ref: 0.9, risk: 0.97 },
    { id: 'E005', type: 'stabilize', actor: 'system', target_node: 'C3', u_ref: -0.4, risk: 0.1 },
    { id: 'E006', type: 'cascade_push', actor: 'edge', target_node: 'S1', u_ref: 1.5, risk: 0.6 },
    { id: 'E007', type: 'job_match', actor: 'system', target_node: 'C2', u_ref: 0.2, risk: 0.15 },
    { id: 'E008', type: 'stabilize', actor: 'system', target_node: 'C1', u_ref: -0.5, risk: 0.05 },
];
async function main() {
    const bus = new MessageBus_1.MessageBus();
    const loop = new ControlLoop_1.ControlLoop(bus);
    const analytics = new AnalyticsService_1.AnalyticsService(bus);
    console.log(`\n${C.bold}${C.cyan}╔══════════════════════════════════════════════════╗`);
    console.log(`║  DixieGate RTG — Closed-Loop Adaptive Control    ║`);
    console.log(`║  TypeScript Production Runtime v2.0              ║`);
    console.log(`╚══════════════════════════════════════════════════╝${C.reset}\n`);
    let J = 2.04;
    for (let i = 0; i < EVENTS.length; i++) {
        const raw = EVENTS[i];
        const gradJ = simGradJ(J);
        const event = { ...raw, J, gradJ, t: i };
        const J_after = simJ(i, 0, J);
        const result = loop.process(event, J_after);
        J = J_after;
        const dColor = dc(result.decision);
        console.log(`${C.bold}── t=${i} │ ${raw.id} │ ${raw.type}${C.reset}`);
        console.log(`   decision : ${dColor}${C.bold}${result.decision}${C.reset}  mode=${result.mode}  regime=${result.regime}`);
        console.log(`   J        : ${result.J_before.toFixed(3)} → ${result.J_after.toFixed(3)}  Δ=${result.dJ >= 0 ? C.red : C.green}${result.dJ.toFixed(3)}${C.reset}`);
        console.log(`   conf     : ${result.confidence}  phase_shift=${result.phase_shift ? C.yellow + 'YES' + C.reset : 'no'}\n`);
        await new Promise(r => setTimeout(r, 200));
    }
    // esperar cold path
    await new Promise(r => setTimeout(r, 100));
    const report = analytics.report();
    console.log(`${C.bold}${C.cyan}╔══════════════════════════════════════════════════╗`);
    console.log(`║  ANALYTICS REPORT                                ║`);
    console.log(`╚══════════════════════════════════════════════════╝${C.reset}`);
    console.log(`   verdict       : ${C.bold}${report.verdict}${C.reset}`);
    console.log(`   efficiency    : ${report.efficiency.efficiency} (${report.efficiency.class})`);
    console.log(`   E_control     : ${report.efficiency.E_control}`);
    console.log(`   absorbing     : ${report.absorbing.join(', ') || 'none'}`);
    console.log(`   RTG matrix    :`, Object.keys(report.rtg_matrix).length > 0
        ? JSON.stringify(report.rtg_matrix) : 'insufficient transitions');
    console.log(`   escalation    :`, JSON.stringify(report.escalation_risk));
    console.log('');
}
main().catch(console.error);
