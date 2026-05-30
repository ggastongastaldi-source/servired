// ledgerRuntime.js — ledger append-only para el runtime U-DR
const fs   = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '../../.dixie_ledger.jsonl');

function append(record) {
  const entry = { ts: Date.now(), ...record };
  fs.appendFileSync(FILE, JSON.stringify(entry) + '\n');
  return entry;
}

function tail(n = 5) {
  if (!fs.existsSync(FILE)) return [];
  const lines = fs.readFileSync(FILE, 'utf8').trim().split('\n').filter(Boolean);
  return lines.slice(-n).map(l => { try { return JSON.parse(l); } catch(_) { return null; } }).filter(Boolean);
}

module.exports = { append, tail };
