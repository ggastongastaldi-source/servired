// streams.js — Redis Streams emulado con MongoDB capped collection
// Swap a ioredis: reemplazar esta clase, misma interfaz
const mongoose = require('mongoose');

const streamSchema = new mongoose.Schema({
  stream:    { type: String, index: true },
  event:     Object,
  consumer_group: String,
  ack:       { type: Boolean, default: false },
  attempts:  { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now, expires: 86400 }, // TTL 24h
}, { capped: { size: 10485760, max: 10000 } }); // 10MB cap

const Stream = mongoose.models.SepStream || mongoose.model('SepStream', streamSchema);

async function publish(streamName, event) {
  await Stream.create({ stream: streamName, event });
}

async function consume(streamName, group, batchSize = 10) {
  // lee no-ack del grupo
  return Stream.find({
    stream: streamName,
    consumer_group: { $ne: group },
    ack: false,
  }).limit(batchSize).lean();
}

async function ack(id, group) {
  await Stream.updateOne({ _id: id }, { $set: { ack: true, consumer_group: group } });
}

async function nack(id) {
  await Stream.updateOne({ _id: id }, { $inc: { attempts: 1 } });
}

module.exports = { publish, consume, ack, nack };
