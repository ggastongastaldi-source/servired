// ServiRed — Context Propagation Middleware v1.0
// Propaga correlationId por HTTP, Socket.IO y retries
// Principio 5 del prompt maestro

const crypto = require('crypto');
const { runWithContext, startCorrelation } = require('../events/emitEvent');

// Express middleware
function httpContextMiddleware(req, res, next) {
  const correlationId = req.headers['x-correlation-id'] || crypto.randomUUID();
  const rootCauseId   = req.headers['x-root-cause-id']  || correlationId;
  const zone          = req.headers['x-zone']            || 'AMBA';
  const channel       = req.headers['x-channel']         || 'http';

  const ctx = startCorrelation(correlationId, rootCauseId);
  ctx.zone    = zone;
  ctx.channel = channel;
  ctx.traceDepth = 0;

  // Propagar en response headers
  res.setHeader('x-correlation-id', correlationId);
  res.setHeader('x-root-cause-id', rootCauseId);

  runWithContext(ctx, next);
}

// Socket.IO middleware
function socketContextMiddleware(socket, next) {
  const correlationId = socket.handshake.headers['x-correlation-id'] || crypto.randomUUID();
  const rootCauseId   = socket.handshake.headers['x-root-cause-id']  || correlationId;

  const ctx = startCorrelation(correlationId, rootCauseId);
  ctx.channel = 'socket';
  ctx.zone    = socket.handshake.query?.zona || 'AMBA';
  ctx.traceDepth = 0;

  socket._ctx = ctx;
  next();
}

module.exports = { httpContextMiddleware, socketContextMiddleware };
