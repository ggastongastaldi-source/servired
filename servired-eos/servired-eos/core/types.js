import { randomUUID } from "crypto";

export const EventType = {
  REAL: "E_REAL",
  CONTROL: "E_CONTROL",
  OBSERVATION: "E_OBSERVATION",
};

export function createEvent({
  type,
  payload,
  policy_id = null,
  trigger_state = null,
}) {
  return Object.freeze({
    id: randomUUID(),
    ts: Date.now(),
    type,
    payload,
    policy_id,
    trigger_state,
  });
}
