/**
 * SERVIRED - PERSISTENT JOB STATE (MONGODB)
 * Evita pérdida de estado en restart / scale
 */

const fs = require('fs');
const file = './server.js';

let code = fs.readFileSync(file, 'utf8');

const PATCH = `
/**
 * === SERVIRED PERSISTED STATE (MONGO LAYER) ===
 */

const mongoose = require('mongoose');

const JobStateSchema = new mongoose.Schema({
  jobId: { type: String, unique: true },
  status: String,
  data: Object,
  createdAt: { type: Date, default: Date.now }
});

const JobState = mongoose.model('JobState', JobStateSchema);

/**
 * init connection (safe guard)
 */
async function __init_state_db() {
  if (mongoose.connection.readyState === 1) return;

  const uri = process.env.MONGO_URL;
  if (!uri) {
    console.log('[STATE] MONGO_URL missing → fallback to memory only');
    return;
  }

  await mongoose.connect(uri);
  console.log('[STATE] Mongo connected');
}

/**
 * id generator
 */
function __getJobId(data) {
  return data.jobId || (data.zona + '_' + data.tipoServicio + '_' + Date.now());
}

/**
 * check if exists
 */
async function __isDuplicate(jobId) {
  const existing = await JobState.findOne({ jobId });
  return !!existing;
}

/**
 * persist state
 */
async function __saveState(jobId, status, data) {
  await JobState.updateOne(
    { jobId },
    { jobId, status, data },
    { upsert: true }
  );
}

/**
 * SOCKET SAFE LAYER
 */
async function __servired_persistent_socket(io) {
  if (!io || io.__mongo_state) return;
  io.__mongo_state = true;

  await __init_state_db();

  io.on('connection', (socket) => {

    socket.on('job_request', async (data) => {

      const jobId = __getJobId(data);

      if (await __isDuplicate(jobId)) {
        console.log('[DUPLICATE BLOCKED (DB)]', jobId);
        return;
      }

      const matched = {
        jobId,
        ...data,
        status: 'matched'
      };

      await __saveState(jobId, 'MATCHED', data);

      socket.emit('job_matched', matched);
    });

  });
}

module.exports.__servired_persistent_socket = __servired_persistent_socket;
`;
if (!code.includes('__servired_persistent_socket')) {
  code += "\n\n" + PATCH;
  fs.writeFileSync(file, code, 'utf8');
  console.log('[OK] PERSISTENT STATE FIX aplicado');
} else {
  console.log('[SKIP] ya existe persistencia');
}
