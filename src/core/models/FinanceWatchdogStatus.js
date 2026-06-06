const mongoose = require('mongoose');

const FinanceWatchdogStatusSchema = new mongoose.Schema({
  service:          { type: String, default: 'FinanceWatchdog' },
  status:           { type: String, enum: ['HEALTHY','ERROR','INITIALIZING'], default: 'INITIALIZING' },
  last_run_at:      { type: Date, default: null },
  last_success_at:  { type: Date, default: null },
  last_issue_count: { type: Number, default: 0 },
  last_error:       { type: String, default: null },
}, { timestamps: false });

module.exports = mongoose.models.FinanceWatchdogStatus ||
  mongoose.model('FinanceWatchdogStatus', FinanceWatchdogStatusSchema, 'finance_watchdog_status');
