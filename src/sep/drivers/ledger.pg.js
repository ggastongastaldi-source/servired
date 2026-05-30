// ledger.pg.js — Postgres append-only real
const { Pool } = require('pg');

let pool;
function getPool() {
  if (!pool) pool = new Pool({ connectionString: process.env.POSTGRES_URL });
  return pool;
}

const INIT_SQL = `
CREATE TABLE IF NOT EXISTS sep_ledger (
  id               SERIAL PRIMARY KEY,
  idempotency_key  TEXT NOT NULL,
  entity_id        TEXT NOT NULL,
  causal_seq       INT  NOT NULL,
  event            JSONB,
  decision         TEXT,
  result           JSONB,
  ts               TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (entity_id, causal_seq)
);
CREATE INDEX IF NOT EXISTS idx_sep_ledger_entity ON sep_ledger(entity_id, causal_seq);
`;

let initialized = false;
async function init() {
  if (initialized) return;
  await getPool().query(INIT_SQL);
  initialized = true;
}

async function append({ idempotency_key, entity_id, causal_seq, event, decision, result }) {
  await init();
  try {
    const res = await getPool().query(
      `INSERT INTO sep_ledger (idempotency_key, entity_id, causal_seq, event, decision, result)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [idempotency_key, entity_id, causal_seq, JSON.stringify(event), decision, JSON.stringify(result)]
    );
    return res.rows[0];
  } catch(e) {
    if (e.code === '23505') return null; // duplicate — idempotente
    throw e;
  }
}

async function lastSeq(entity_id) {
  await init();
  const res = await getPool().query(
    'SELECT MAX(causal_seq) as seq FROM sep_ledger WHERE entity_id=$1',
    [entity_id]
  );
  return res.rows[0]?.seq ?? -1;
}

async function history(entity_id) {
  await init();
  const res = await getPool().query(
    'SELECT * FROM sep_ledger WHERE entity_id=$1 ORDER BY causal_seq ASC',
    [entity_id]
  );
  return res.rows;
}

module.exports = { append, lastSeq, history };
