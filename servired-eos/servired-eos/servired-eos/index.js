import { eventStore } from "./core/eventStore.js";
import { reducerF } from "./core/reducers/reducerF.js";
import { reducerG } from "./core/reducers/reducerG.js";
import { aladdinGenerate } from "./engine/aladdin.js";
import { sinapsis } from "./memory/sinapsis.js";

eventStore.append({
  type: "E_REAL",
  payload: { market: "active", zone: "BA" }
});

const controlEvent = aladdinGenerate({ intensity: 0.8 });
eventStore.append(controlEvent);

const state = reducerF(eventStore.getAll());
const effects = reducerG(eventStore.getAll());

eventStore.getAll().forEach(e => sinapsis.persist(e));

console.log(JSON.stringify({ state, effects }, null, 2));
