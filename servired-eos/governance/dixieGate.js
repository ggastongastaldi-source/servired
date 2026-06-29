import { Policies } from "./policies.js";

const lastExec = new Map();

export function dixieGate(event) {
  const policy = Policies[event.policy_id];
  if (!policy) return false;

  const now = Date.now();
  const last = lastExec.get(event.policy_id) || 0;

  if (now - last < policy.cooldownMs) return false;

  if (typeof event.confidence === "number") {
    if (event.confidence < policy.minConfidence) return false;
  }

  lastExec.set(event.policy_id, now);
  return true;
}
