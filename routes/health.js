const router = require('express').Router();
const mongoose = require('mongoose');
router.get('/', async (req, res) => {
  const start = Date.now();
  let db_status = 'down';
  try { await mongoose.connection.db.admin().ping(); db_status = 'up'; } catch(e) {}
  res.json({ status: db_status==='up'?'operational':'degraded', timestamp: new Date().toISOString(), db_status, uptime: Math.floor(process.uptime()), response_time_ms: Date.now()-start });
});
module.exports = router;
