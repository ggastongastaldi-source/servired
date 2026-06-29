export function reducerF(events) {
  return events.reduce((state, event) => {
    if (event.type !== "E_REAL") return state;
    return { ...state, ...event.payload, lastUpdate: event.ts };
  }, {});
}
