const SnapshotManager = require('../event-core/snapshot.manager');
const eventStore = require('../event-core/event.store');

class RankingWorker {
  constructor() {
    this.scores = new Map();
    this.lastEventId = null;
    this.init();
  }

  init() {
    const snap = SnapshotManager.load('ranking');

    if (snap) {
      this.scores = new Map(Object.entries(snap.data));
      this.lastEventId = snap.lastEventId;
    }

    this.replay();
  }

  replay() {
    const events = eventStore.getAll();

    const startIndex = this.lastEventId
      ? events.findIndex(e => e.eventId === this.lastEventId) + 1
      : 0;

    for (let i = startIndex; i < events.length; i++) {
      this.process(events[i]);
      this.lastEventId = events[i].eventId;
    }

    SnapshotManager.save(
      'ranking',
      Object.fromEntries(this.scores),
      this.lastEventId
    );
  }

  process(event) {
    if (event.type === "ServiceRequested") {
      const id = event.aggregateId;
      const v = this.scores.get(id) || 0;
      this.scores.set(id, v + 1);
    }

    if (event.type === "ProviderAssigned") {
      const id = event.payload.providerId;
      const v = this.scores.get(id) || 0;
      this.scores.set(id, v + 5);
    }
  }
}

module.exports = new RankingWorker();
