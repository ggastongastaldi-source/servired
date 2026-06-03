const mongoose  = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const { postLedgerEntry, Ledger } = require('./ledgerService');
const { calculateSettlement }     = require('./settlementEngine');
const FinancialTransaction        = require('../models/FinancialTransaction');

// ─── capturePayment ─────────────────────────────────────────────────────
// Acepta session externa. Si no recibe ninguna, crea la propia (uso standalone).
async function capturePayment({ provider, provider_transaction_id, order_id, amount }, externalSession) {
  const ownSession = !externalSession;
  const session = externalSession || await mongoose.startSession();
  if (ownSession) session.startTransaction();

  try {
    const transaction_id = `txn_srv_${uuidv4().replace(/-/g,'').substring(0,13)}`;
    const { platformFee, workerPayout } = calculateSettlement(amount);

    // Idempotencia via indice unico -- E11000 = duplicado
    await FinancialTransaction.create([{
      transaction_id,
      provider,
      provider_transaction_id,
      order_id,
      amount,
      platformFee,
      workerPayout,
      status: 'CAPTURED',
    }], { session });

    // Asientos: ESCROW recibe, WORKER_PENDING y REVENUE son pasivos
    await postLedgerEntry({ transaction_id, provider_transaction_id, order_id, account: 'ESCROW_PLATFORM',  delta: +amount,        event_type: 'PAYMENT_CAPTURED' }, session);
    await postLedgerEntry({ transaction_id, provider_transaction_id, order_id, account: 'WORKER_PENDING',   delta: -workerPayout,  event_type: 'PAYMENT_CAPTURED' }, session);
    await postLedgerEntry({ transaction_id, provider_transaction_id, order_id, account: 'SERVIRED_REVENUE', delta: -platformFee,   event_type: 'PAYMENT_CAPTURED' }, session);

    // Validacion balance dentro de la sesion
    const entries = await Ledger.find({ transaction_id }).session(session);
    const balance = entries.reduce((sum, e) => sum + e.delta, 0);
    if (balance !== 0) throw new Error(`Ledger imbalance detected after capture: ${balance}`);

    if (ownSession) { await session.commitTransaction(); session.endSession(); }
    return { success: true, transaction_id, platformFee, workerPayout };

  } catch(err) {
    if (ownSession) { await session.abortTransaction(); session.endSession(); }
    if (err.code === 11000) return { success: true, reason: 'DUPLICATE_REQUEST_IGNORED' };
    if (ownSession && err.errorLabels && err.errorLabels.includes('TransientTransactionError')) {
      const MAX_RETRIES = 3;
      const attempt = (capturePayment.__retryCount || 0) + 1;
      if (attempt <= MAX_RETRIES) {
        capturePayment.__retryCount = attempt;
        await new Promise(r => setTimeout(r, 50 + Math.random() * 100));
        const result = await capturePayment({ provider, provider_transaction_id, order_id, amount });
        capturePayment.__retryCount = 0;
        return result;
      }
      capturePayment.__retryCount = 0;
    }
    throw err;
  }
}

// ─── releaseWorkerFunds ────────────────────────────────────────────
// Acepta session externa. Usa la misma sesion para leer FT creado en la misma tx.
async function releaseWorkerFunds({ transaction_id }, externalSession) {
  const ownSession = !externalSession;
  const session = externalSession || await mongoose.startSession();
  if (ownSession) session.startTransaction();

  try {
    const ft = await FinancialTransaction.findOne({ transaction_id }).session(session);
    if (!ft) throw new Error(`releaseWorkerFunds: FinancialTransaction no encontrada -- txn: ${transaction_id}`);

    // FSM: estados terminales
    if (ft.status === 'RELEASED') {
      if (ownSession) { await session.abortTransaction(); session.endSession(); }
      return { success: true, reason: 'DUPLICATE_REQUEST_IGNORED' };
    }
    if (ft.status === 'REFUNDED') {
      if (ownSession) { await session.abortTransaction(); session.endSession(); }
      throw new Error('Invalid transition: REFUNDED -> RELEASED');
    }

    // Reclasificacion interna: WORKER_PENDING -> WORKER_AVAILABLE
    // Suma del evento: +workerPayout - workerPayout = 0 (conservacion de valor)
    await postLedgerEntry({ transaction_id, order_id: ft.order_id, account: 'WORKER_PENDING',   delta: +ft.workerPayout, event_type: 'WORKER_FUNDS_RELEASED' }, session);
    await postLedgerEntry({ transaction_id, order_id: ft.order_id, account: 'WORKER_AVAILABLE', delta: -ft.workerPayout, event_type: 'WORKER_FUNDS_RELEASED' }, session);

    // Validacion balance global (igual que capturePayment)
    const releaseEntries = await Ledger.find({ transaction_id }).session(session);
    const releaseBalance = releaseEntries.reduce((s, e) => s + e.delta, 0);
    if (releaseBalance !== 0) throw new Error(`Ledger imbalance detected after release: ${releaseBalance}`);

    await FinancialTransaction.findOneAndUpdate(
      { transaction_id },
      { status: 'RELEASED', updated_at: new Date() },
      { session }
    );

    if (ownSession) { await session.commitTransaction(); session.endSession(); }
    return { success: true, transaction_id };

  } catch(err) {
    if (ownSession) { await session.abortTransaction(); session.endSession(); }
    throw err;
  }
}

// ─── refundPayment ────────────────────────────────────────────────
async function refundPayment({ transaction_id }, externalSession) {
  const ownSession = !externalSession;
  const session = externalSession || await mongoose.startSession();
  if (ownSession) session.startTransaction();

  try {
    const ft = await FinancialTransaction.findOne({ transaction_id }).session(session);
    if (!ft) throw new Error('Transaction not found');

    // FSM: estados terminales
    if (ft.status === 'REFUNDED') {
      if (ownSession) { await session.abortTransaction(); session.endSession(); }
      return { success: true, reason: 'DUPLICATE_REQUEST_IGNORED' };
    }
    if (ft.status === 'RELEASED') {
      if (ownSession) { await session.abortTransaction(); session.endSession(); }
      throw new Error('Invalid transition: RELEASED -> REFUNDED');
    }

    await postLedgerEntry({ transaction_id, order_id: ft.order_id, account: 'ESCROW_PLATFORM',  delta: -ft.amount,       event_type: 'PAYMENT_REFUNDED' }, session);
    await postLedgerEntry({ transaction_id, order_id: ft.order_id, account: 'WORKER_PENDING',   delta: +ft.workerPayout, event_type: 'PAYMENT_REFUNDED' }, session);
    await postLedgerEntry({ transaction_id, order_id: ft.order_id, account: 'SERVIRED_REVENUE', delta: +ft.platformFee,  event_type: 'PAYMENT_REFUNDED' }, session);

    // Validacion balance global (igual que capturePayment)
    const refundEntries = await Ledger.find({ transaction_id }).session(session);
    const refundBalance = refundEntries.reduce((s, e) => s + e.delta, 0);
    if (refundBalance !== 0) throw new Error(`Ledger imbalance detected after refund: ${refundBalance}`);

    await FinancialTransaction.findOneAndUpdate(
      { transaction_id },
      { status: 'REFUNDED', updated_at: new Date() },
      { session }
    );

    if (ownSession) { await session.commitTransaction(); session.endSession(); }
    return { success: true, transaction_id };

  } catch(err) {
    if (ownSession) { await session.abortTransaction(); session.endSession(); }
    throw err;
  }
}

// ─── runForensicAudit ───────────────────────────────────────────────
async function runForensicAudit() {
  const issues = [];
  const transactions = await FinancialTransaction.find({});

  for (const ft of transactions) {
    const entries = await Ledger.find({ transaction_id: ft.transaction_id });

    if (entries.length === 0) {
      issues.push({ transaction_id: ft.transaction_id, issue: 'NO_LEDGER_ENTRIES' });
      continue;
    }

    // Balance global de TODOS los asientos debe ser 0
    const balance = entries.reduce((sum, e) => sum + e.delta, 0);
    if (balance !== 0) {
      issues.push({ transaction_id: ft.transaction_id, issue: 'LEDGER_IMBALANCE', balance });
    }

    // Monto capturado debe coincidir
    const escrow = entries.find(e => e.account === 'ESCROW_PLATFORM' && e.event_type === 'PAYMENT_CAPTURED');
    if (escrow && escrow.delta !== ft.amount) {
      issues.push({ transaction_id: ft.transaction_id, issue: 'AMOUNT_MISMATCH', expected: ft.amount, found: escrow.delta });
    }

    // Si esta RELEASED: debe existir asiento WORKER_AVAILABLE con delta negativo
    if (ft.status === 'RELEASED') {
      const workerAvailable = entries.find(e => e.account === 'WORKER_AVAILABLE' && e.event_type === 'WORKER_FUNDS_RELEASED');
      if (!workerAvailable) {
        issues.push({ transaction_id: ft.transaction_id, issue: 'MISSING_WORKER_AVAILABLE_ENTRY' });
      }
      // Balance global ya garantiza integridad total
    }
  }

  return issues;
}

module.exports = { capturePayment, releaseWorkerFunds, refundPayment, runForensicAudit };
