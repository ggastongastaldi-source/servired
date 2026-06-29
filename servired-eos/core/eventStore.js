class EventStore {
  constructor() {
    this.events = [];
  }

  append(event) {
    this.events.push(Object.freeze(event));
    return event;
  }

  getAll() {
    return [...this.events];
  }

  clear() {
    this.events = [];
  }
}

export const eventStore = new EventStore();
