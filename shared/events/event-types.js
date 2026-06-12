// Catálogo congelado de tipos de evento de ServiRed OS.
// No agregar tipos nuevos sin actualizar event.schema.json (enum de event_type).

const EVENT_TYPES = Object.freeze({
  QR_SCANNED: 'qr_scanned',
  LANDING_VIEWED: 'landing_viewed',
  SHELL_OPENED: 'shell_opened',
  REGISTER_STARTED: 'register_started',
  REGISTER_COMPLETED: 'register_completed',
  CASE_CREATED: 'case_created',
  CASE_ABANDONED: 'case_abandoned',
  JOB_REQUESTED: 'job_requested',
  JOB_COMPLETED: 'job_completed',
  JOB_UNFULFILLED: 'job_unfulfilled',
  WALLET_OPENED: 'wallet_opened',
  LEAD_ATTRIBUTED: 'lead_attributed'
});

module.exports = { EVENT_TYPES };
