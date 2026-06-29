export function reducerG(events) {
  const now = Date.now();

  return events
    .filter(e => e.type === "E_CONTROL")
    .filter(e => !e.ttl || now < e.ts + e.ttl)
    .map(e => ({
      effect: e.payload.effect,
      intensity: e.payload.intensity,
      policy_id: e.policy_id,
    }));
}
