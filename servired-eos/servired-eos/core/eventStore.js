class EventStore {
  constructor() {
    this.events = [];
  }

  append(event) {
    this.events.push(event);
    return event;
  }

  getAll() {
    return [...this.events];
  }

  getByType(type) {
    return this.events.filter(e => e.type === type);
  }
}

export const eventStore = new EventStore();
