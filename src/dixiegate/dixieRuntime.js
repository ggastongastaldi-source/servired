// dixieRuntime.js — DixieGate proyectivo: u_t = Π_C(u_ref)
// C(X) = { u : ∇J^T u ≤ -α||∇J||, ||u|| ≤ δ }

const ALPHA = 0.3;  // margen de descenso mínimo
const DELTA = 0.5;  // bound de control máximo

function project(gradJ, uRef) {
  // condición de descenso: ∇J^T u ≤ -α||∇J||
  const dot    = gradJ * uRef;
  const norm   = Math.abs(gradJ);
  const descent = -ALPHA * norm;

  let u = uRef;

  // si viola descenso → proyectar al cono
  if (dot > descent) {
    // u_proj = u - ((∇J^T u - threshold) / ||∇J||²) * ∇J
    const correction = (dot - descent) / (norm * norm + 1e-9);
    u = uRef - correction * gradJ;
  }

  // clamp a [-δ, δ]
  u = Math.max(-DELTA, Math.min(DELTA, u));
  return u;
}

function evaluate(graph, eventPayload) {
  const { target_node, u_ref, type, actor, risk } = eventPayload;

  const node  = graph.nodes.get(target_node);
  if (!node) return { decision: 'DENY', reason: 'nodo desconocido', u: 0 };

  const J_before = graph.energy();
  const gradJ    = graph.gradJ(target_node);

  // proyección QP
  const u_proj   = project(gradJ, u_ref || 0);
  const energy_delta = gradJ * u_proj;

  // clasificación
  let decision, reason;
  if (risk >= 0.95) {
    decision = 'DENY';
    reason   = `risk=${risk} supera umbral absoluto`;
  } else if (energy_delta > 0) {
    decision = 'VETO';
    reason   = `∇J^T·u = ${energy_delta.toFixed(4)} > 0 — incrementa energía`;
  } else if (Math.abs(energy_delta) < ALPHA * Math.abs(gradJ) && risk >= 0.7) {
    decision = 'ESCALATE';
    reason   = `descenso insuficiente + riesgo elevado`;
  } else {
    decision = 'ALLOW';
    reason   = `∇J^T·u = ${energy_delta.toFixed(4)} — descenso garantizado`;
  }

  return {
    decision,
    reason,
    u: decision === 'ALLOW' ? u_proj : 0,
    J_before: +J_before.toFixed(4),
    energy_delta: +energy_delta.toFixed(4),
    grad: +gradJ.toFixed(4),
    target_node,
  };
}

module.exports = { evaluate, project };
