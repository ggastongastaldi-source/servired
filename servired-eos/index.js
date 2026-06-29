import { eventStore } from "./core/eventStore.js";
import { reducerF } from "./core/reducers/reducerF.js";
import { reducerG } from "./core/reducers/reducerG.js";
import { aladdinGenerate } from "./engine/aladdin.js";
import { sinapsis } from "./memory/sinapsis.js";
import { dixieGate } from "./governance/dixieGate.js";
import { observer } from "./observation/observer.js";

eventStore.clear();

eventStore.append({
  type: "E_REAL",
  payload: { market: "active", zone: "BA" }
});

const controlEvent = aladdinGenerate({ intensity: 0.8 });

if (dixieGate(controlEvent)) {
  eventStore.append(controlEvent);
}

const events = eventStore.getAll();

const state = reducerF(events);
const effects = reducerG(events);

events.forEach(e => sinapsis.persist(e));

observer.capture(state, effects, {
  memory_size: sinapsis.size(),
  ttl_mode: true,
  decay_mode: true,
  kernel: "HARD_LOCKED_v5"
});

console.log(JSON.stringify({
  state,
  effects,
  observation: observer.last(),
  kernel: "HARD_LOCKED_v5"
}, null, 2));
