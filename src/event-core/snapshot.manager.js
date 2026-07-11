const fs = require('fs');
const path = require('path');

class SnapshotManager {
  static save(workerName, data, lastEventId) {
    const filePath = path.join(__dirname, `snapshots/${workerName}.snap.json`);
    const payload = { lastEventId, data };
    fs.writeFileSync(filePath, JSON.stringify(payload));
  }

  static load(workerName) {
    const filePath = path.join(__dirname, `snapshots/${workerName}.snap.json`);
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  }
}

module.exports = SnapshotManager;
