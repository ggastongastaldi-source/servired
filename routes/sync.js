'use strict';
const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const { verificarToken } = require('../src/core/middleware/auth');
const IdempotencyRecord = require('../models/IdempotencyRecord');
const Event = require('../models/Event');
const { ACTOR_TYPES } = require('../constants/eventTaxonomy');

/**
 * routes/sync.js — POST /api/sync/command (RFC-SYNC-001B)
 * actorId siempre viene del JWT (req.user.userId), nunca del body.
 */

const COMMAND_CONTRACT = {
  TriggerMaterialReservation: { eventType: 'MaterialReservationRequested', actorType: ACTOR_TYPES.WORKER },
  PublishWorkProgress: { eventType: 'WorkProgressReported', actorType: ACTOR_TYPES.WORKER },
  ConfirmReservation: { eventType: 'ReservationConfirmed', actorType: ACTOR_TYPES.BUSINESS },
  RejectReservation: { eventType: 'ReservationRejected', actorType: ACTOR_TYPES.BUSINESS }
};

router.post('/command', verificarToken, async (req, res) => {
  const actorId = req.user.userId;
  const { commandId, commandType, payload, deviceId, clientSequence } = req.body;

  if (!commandId || !commandType || !deviceId || typeof clientSequence !== 'number') {
    return res.status(400).json({ ok: false, error: 'campos_requeridos_faltantes' });
  }

  const contract = COMMAND_CONTRACT[commandType];
  if (!contract) {
    return res.status(400).json({ ok: false, error: 'commandType_desconocido' });
  }

  const ultimo = await IdempotencyRecord
    .findOne({ actorId, deviceId })
    .sort({ clientSequence: -1 })
    .lean();

  if (ultimo && clientSequence <= ultimo.clientSequence) {
    const yaExiste = await IdempotencyRecord.findOne({ commandId }).lean();
    if (!yaExiste) {
      return res.status(409).json({
        ok: false,
        error: 'out_of_order',
        expectedSequence: ultimo.clientSequence + 1
      });
    }
  }

  const session = await mongoose.startSession();
  let eventId;
  try {
    await session.withTransaction(async () => {
      const created = await Event.create([{
        eventType: contract.eventType,
        actorType: contract.actorType,
        actorId,
        correlationId: commandId,
        payload: payload || {}
      }], { session });

      eventId = created[0]._id;

      await IdempotencyRecord.create([{
        commandId,
        actorId,
        deviceId,
        clientSequence,
        commandType,
        status: 'processed',
        eventId
      }], { session });
    });

    return res.json({ ok: true, eventId, status: 'processed' });

  } catch (err) {
    if (err.code === 11000) {
      const existente = await IdempotencyRecord.findOne({ commandId }).lean();
      if (existente) {
        return res.json({ ok: true, eventId: existente.eventId, status: 'already_processed' });
      }
    }
    return res.status(500).json({ ok: false, error: err.message });
  } finally {
    session.endSession();
  }
});

module.exports = router;
