const mongoose = require('mongoose');

const zoneStateSchema = new mongoose.Schema({
  zoneId:          { type: String, required: true, unique: true, index: true },
  demand:          { type: Number, default: 0 },
  supply:          { type: Number, default: 0 },
  amplification:   { type: Number, default: 1 },
  marketPressure:  { type: Number, default: 0 },
  zoneState:       { type: String, enum: ['SHORTAGE','BALANCED','SURPLUS'], default: 'BALANCED' },
  eventCount:      { type: Number, default: 0 },
  lastUpdated:     { type: Date, default: Date.now }
}, { collection: 'zone_states' });

zoneStateSchema.methods.toOutput = function() {
  return {
    zoneId:         this.zoneId,
    demand:         +this.demand.toFixed(4),
    supply:         +this.supply.toFixed(4),
    amplification:  +this.amplification.toFixed(4),
    marketPressure: +this.marketPressure.toFixed(4),
    zoneState:      this.zoneState,
    lastUpdated:    this.lastUpdated
  };
};

module.exports = mongoose.model('ZoneState', zoneStateSchema);
