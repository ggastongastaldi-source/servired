"use strict";
const mongoose = require("mongoose");

// Read model propio de Aladdin Intelligence — NO es fuente de verdad.
// Trazabilidad completa: sourceEventIds apunta a sinapsis_bus_log.
const AladdinInsightSchema = new mongoose.Schema({
  insightId:      { type: String, required: true },
  insightType:    { type: String, required: true },
  zonaId:         { type: String, default: null },
  rubroId:        { type: String, default: null },
  requestId:      { type: String, default: null },
  confidence:     { type: Number, min: 0, max: 1, required: true },
  message:        { type: String, required: true },
  sourceEventIds: [{ type: String }],
  status:         { type: String, enum: ["active", "dismissed"], default: "active" },
  generatedAt:    { type: Date, required: true },
  version:        { type: Number, default: 1 },
}, { collection: "aladdin_insights" });

AladdinInsightSchema.index({ insightId: 1 }, { unique: true });
AladdinInsightSchema.index({ insightType: 1, generatedAt: -1 });
AladdinInsightSchema.index({ zonaId: 1 });

module.exports = mongoose.models.AladdinInsight ||
  mongoose.model("AladdinInsight", AladdinInsightSchema);
