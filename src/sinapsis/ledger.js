// ledger.js — append-only, en memoria con dump a archivo
const fs   = require('fs');
const path = require('path');

const LEDGER_FILE = path.join(__dirname, '../../.ledger.jsonl');
const entries = [];

function append(record) {
  const entry = { ...record, timestamp: Date.now() };
  entries.push(entry);
  fs.appendFileSync(LEDGER_FILE, JSON.stringify(entry) + '\n');
  return entry;
}

function last() {
  return entries[entries.length - 1] || null;
}

function all() {
  return [...entries];
}

module.exports = { append, last, all };
