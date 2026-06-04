const mongoose = require('mongoose');

const WorkerMobilityProfileSchema = new mongoose.Schema({
  workerId:          { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true, unique: true },
  acceptanceRate:    { type: Number, default: 0.5, min: 0, max: 1 },
  avgTravelKm:       { type: Number, default: 0 },
  maxAcceptedKm:     { type: Number, default: 0 },
  preferredZones:    [{ type: String }],
  nightShiftScore:   { type: Number, default: 0.5, min: 0, max: 1 },
  completedJobsCount:{ type: Number, default: 0 },
  updatedAt:         { type: Date,   default: Date.now },
}, { timestamps: false });

WorkerMobilityProfileSchema.index({ workerId: 1 }, { unique: true });

module.exports = mongoose.models.WorkerMobilityProfile ||
  mongoose.model('WorkerMobilityProfile', WorkerMobilityProfileSchema, 'worker_mobility_profiles');
