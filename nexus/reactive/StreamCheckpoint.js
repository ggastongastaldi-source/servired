// Resume tokens — para no perder eventos en reinicios
const mongoose = require('mongoose');

const StreamCheckpointSchema = new mongoose.Schema({
  targetCollection: { type: String, required: true, unique: true },
  resumeToken: { type: mongoose.Schema.Types.Mixed },
  updatedAt:   { type: Date, default: Date.now }
});

module.exports = mongoose.models.StreamCheckpoint || mongoose.model('StreamCheckpoint', StreamCheckpointSchema);
