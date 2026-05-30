#!/usr/bin/env node
// demo.js — Unified Decision Runtime (U-DR) terminal demo
// flujo: evento → grafo → J(t) → DixieGate → ledger → output

const { Graph }         = require('./graph');
const { evaluate }      = require('./dixieRuntime');
const ledger            = require('./ledgerRuntime');

// ── construcción del grafo adversarial ──────────────────────────────────────
function buildGraph() {
  const g = new Graph();

  // hubs (alta conectividad, críticos)
  ['H1','H2'].forEach(id => g.addNode(id, 'hub', 0.6));

  // clusters operativos
  ['C1','C2','C3','C4'].forEach(id => g.addNode(id, 'cluster', 0.3));

  // borde estocástico
  ['B1','B2'].forEach(id => g.addNode(id, 'borde', 0.1));

  // singularidades
  ['S1'].forEach(id => g.addNode(id, 'singular', 0.9));

  // edges
  [['H1','C1',1.2],['H1','C2',1.0],['H2','C3',1.1],['H2','C4',0.9],
   ['C1','B1',0.7],['C2','B2',0.6],['C3','S1',1.5],['H1','H2',0.8],
   ['S1','H1',1.3],['B1','C3',0.5]].forEach(([i,j,w]) => g.addEdge(i,j,w));

  return g;
}

// ── eventos de test ──────────────────────────────────────────────────────────
const EVENTS = [
  { id:'EVT-001', type:'job_match',    actor:'system',  domain:'RUNTIME',  target_node:'C1', u_ref:  0.3, risk: 0.2 },
  { id:'EVT-002', type:'hub_override', actor:'admin',   domain:'CONTROL',  target_node:'H1', u_ref:  0.8, risk: 0.75 },
  { id:'EVT-003', type:'cascade_push', actor:'edge',    domain:'RUNTIME',  target_node:'S1', u_ref:  1.2, risk: 0.5 },
  { id:'EVT-004', type:'critical_op',  actor:'unknown', domain:'WATCHDOG', target_node:'H2', u_ref:  0.9, risk: 0.97 },
  { id:'EVT-005', type:'stabilize',    actor:'system',  domain:'CONTROL',  target_node:'C3', u_ref: -0.4, risk: 0.1 },
];

// ── colores terminal ─────────────────────────────────────────────────────────
const C = {
  reset:  '\x1b[0m',
  green:  '\x1b[32m',
  red:    '\x1b[31m',
  yellow: '\x1b[33m',
  cyan:   '\x1b[36m',
  bold:   '\x1b[1m',
  dim:    '\x1b[2m',
};

function bar(value, max = 5, width = 20) {
  const filled = Math.round(Math.min(Math.abs(value), max) / max * width);
  return '[' + '█'.repeat(filled) + '░'.repeat(width - filled) + ']';
}

function decisionColor(d) {
  return d === 'ALLOW'    ? C.green
       : d === 'VETO'     ? C.red
       : d === 'ESCALATE' ? C.yellow
       : C.red;
}

// ── main loop ────────────────────────────────────────────────────────────────
async function main() {
  const graph = buildGraph();

  console.log(`\n${C.bold}${C.cyan}╔══════════════════════════════════════════════════╗`);
  console.log(`║      DIXIEGATE — Unified Decision Runtime        ║`);
  console.log(`║      Terminal Demo v1.0                          ║`);
  console.log(`╚══════════════════════════════════════════════════╝${C.reset}\n`);

  console.log(`${C.dim}Grafo: ${graph.nodes.size} nodos | ${graph.edges.size} edges${C.reset}`);
  console.log(`${C.dim}J(0) = ${graph.energy().toFixed(4)} — energía inicial${C.reset}\n`);

  let t = 0;
  for (const event of EVENTS) {
    // step del grafo + ruido
    graph.step(0.05);
    const J_before = graph.energy();

    // DixieGate evalúa
    const result = evaluate(graph, event);

    // aplicar control si ALLOW
    if (result.decision === 'ALLOW') {
      graph.applyControl(event.target_node, result.u);
    }

    const J_after  = graph.energy();
    const dJ       = J_after - J_before;

    // ledger
    const entry = ledger.append({
      event_id:     event.id,
      type:         event.type,
      actor:        event.actor,
      target_node:  event.target_node,
      risk:         event.risk,
      decision:     result.decision,
      reason:       result.reason,
      J_before:     +J_before.toFixed(4),
      J_after:      +J_after.toFixed(4),
      dJ:           +dJ.toFixed(4),
      energy_delta: result.energy_delta,
      u_applied:    result.u,
      t,
    });

    // output
    const dc = decisionColor(result.decision);
    console.log(`${C.bold}── t=${t} │ ${event.id} │ ${event.type}${C.reset}`);
    console.log(`   actor      : ${event.actor} @ ${event.target_node}`);
    console.log(`   risk       : ${event.risk}`);
    console.log(`   decision   : ${dc}${C.bold}${result.decision}${C.reset}  — ${result.reason}`);
    console.log(`   J(t)       : ${J_before.toFixed(4)} → ${J_after.toFixed(4)}  Δ=${dJ >= 0 ? C.red : C.green}${dJ.toFixed(4)}${C.reset}`);
    console.log(`   energy bar : ${dJ >= 0 ? C.red : C.green}${bar(J_after)}${C.reset} ${J_after.toFixed(2)}`);
    console.log(`   u_applied  : ${result.u.toFixed(4)}`);
    console.log(`   ledger ts  : ${C.dim}${entry.ts}${C.reset}\n`);

    t++;
    await new Promise(r => setTimeout(r, 400));
  }

  // resumen final
  const finalJ = graph.energy();
  const history = ledger.tail(EVENTS.length);
  const vetos   = history.filter(e => e.decision === 'VETO' || e.decision === 'DENY').length;
  const allows  = history.filter(e => e.decision === 'ALLOW').length;

  console.log(`${C.bold}${C.cyan}╔══════════════════════════════════════════════════╗`);
  console.log(`║  AUDIT SUMMARY                                   ║`);
  console.log(`╚══════════════════════════════════════════════════╝${C.reset}`);
  console.log(`   eventos procesados : ${EVENTS.length}`);
  console.log(`   ALLOW              : ${C.green}${allows}${C.reset}`);
  console.log(`   VETO/DENY          : ${C.red}${vetos}${C.reset}`);
  console.log(`   J final            : ${finalJ.toFixed(4)}`);
  console.log(`   sistema            : ${finalJ < 3 ? C.green + 'ESTABLE' : C.red + 'BAJO ESTRÉS'}${C.reset}`);
  console.log(`   ledger             : .dixie_ledger.jsonl\n`);
}

main().catch(console.error);
