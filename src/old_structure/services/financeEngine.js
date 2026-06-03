const mongoose  = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const { postLedgerEntry, Ledger } = require('./ledgerService');
const { calculateSettlement }     = require('./settlementEngine');
const FinancialTransaction        = require('../models/FinancialTransaction');

// ─── capturePayment ───────────────────────────────────────────────────────────
// Acepta session externa. Si no recibe ninguna, crea la propia (uso standalone).
async function capturePayment({ provider, provider_transaction_id, order_id, amount }, externalSession) {
  const ownSession = !externalSession;
  const session = externalSession || await mongoose.startSession();
  if (ownSession) session.startTransaction();

  try {
    const transaction_id = `txn_srv_${uuidv4().replace(/-/g,'').substring(0,13)}`;
    const { platformFee, workerPayout } = calculateSettlement(amount);

    // Idempotencia via índice único — E11000 = duplicado
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

    // Validación balance dentro de la sesión
    const entries = await Ledger.find({ transaction_id }).session(session);
    const balance = entries.reduce((sum, e) => sum + e.delta, 0);
    if (balance !== 0) throw new Error(`Ledger imbalance detected after capture: ${balance}`);

    if (ownSession) { await session.commitTransaction(); session.endSession(); }
    return { success: true, transaction_id, platformFee, workerPayout };

  } catch(err) {
    if (ownSession) { await session.abortTransaction(); session.endSession(); }
    if (err.code === 11000) return { success: true, reason: 'DUPLICATE_REQUEST_IGNORED' };
    if (ownSession && err.errorLabels?.includes('TransientTransactionError')) {
      await new Promise(r => setTimeout(r, 50 + Math.random() * 100));
      return capturePayment({ provider, provider_transaction_id, order_id, amount });
    }
    throw err;
  }
}

// ─── releaseWorkerFunds ───────────────────────────────────────────────────────
// Acepta session externa. Usa la misma sesión para leer FT creado en la misma tx.
async function releaseWorkerFunds({ transaction_id }, externalSession) {
  const ownSession = !externalSession;
  const session = externalSession || await mongoose.startSession();
  if (ownSession) session.startTransaction();

  try {
    const ft = await FinancialTransaction.findOne({ transaction_id }).session(session);
    if (!ft) throw new Error(`releaseWorkerFunds: FinancialTransaction no encontrada — txn: ${transaction_id}`);
    if (ft.status === 'RELEASED') {
      if (ownSession) { await session.abortTransaction(); session.endSession(); }
      return { success: true, reason: 'DUPLICATE_REQUEST_IGNORED' };
    }

    // Asientos correctos:
    // ESCROW_PLATFORM libera el monto total
    // WORKER_PENDING se cancela (positivo compensa el negativo del capture)
    // WORKER_AVAILABLE acredita el pago al trabajador
    await postLedgerEntry({ transaction_id, order_id: ft.order_id, account: 'ESCROW_PLATFORM',  delta: -ft.amount,      event_type: 'WORKER_FUNDS_RELEASED' }, session);
    await postLedgerEntry({ transaction_id, order_id: ft.order_id, account: 'WORKER_PENDING',   delta: +ft.workerPayout, event_type: 'WORKER_FUNDS_RELEASED' }, session);
    await postLedgerEntry({ transaction_id, order_id: ft.order_id, account: 'WORKER_AVAILABLE', delta: +ft.workerPayout, event_type: 'WORKER_FUNDS_RELEASED' }, session);

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

// ─── refundPayment ────────────────────────────────────────────────────────────
async function refundPayment({ transaction_id }, externalSession) {
  const ownSession = !externalSession;
  const session = externalSession || await mongoose.startSession();
  if (ownSession) session.startTransaction();

  try {
    const ft = await FinancialTransaction.findOne({ transaction_id }).session(session);
    if (!ft) throw new Error('Transaction not found');
    if (ft.status === 'REFUNDED') {
      if (ownSession) { await session.abortTransaction(); session.endSession(); }
      return { success: true, reason: 'DUPLICATE_REQUEST_IGNORED' };
    }

    await postLedgerEntry({ transaction_id, order_id: ft.order_id, account: 'ESCROW_PLATFORM',  delta: -ft.amount,      event_type: 'PAYMENT_REFUNDED' }, session);
    await postLedgerEntry({ transaction_id, order_id: ft.order_id, account: 'WORKER_PENDING',   delta: +ft.workerPayout, event_type: 'PAYMENT_REFUNDED' }, session);
    await postLedgerEntry({ transaction_id, order_id: ft.order_id, account: 'SERVIRED_REVENUE', delta: +ft.platformFee,  event_type: 'PAYMENT_REFUNDED' }, session);
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

// ─── runForensicAudit ─────────────────────────────────────────────────────────
async function runForensicAudit() {
  const issues = [];
  const transactions = await FinancialTransaction.find({});

  for (const ft of transactions) {
    const entries = await Ledger.find({ transaction_id: ft.transaction_id });

    if (entries.length === 0) {
      issues.push({ transaction_id: ft.transaction_id, issue: 'NO_LEDGER_ENTRIES' });
      continue;
    }

    // Balance global debe ser 0
    const balance = entries.reduce((sum, e) => sum + e.delta, 0);
    if (balance !== 0) {
      issues.push({ transaction_id: ft.transaction_id, issue: 'LEDGER_IMBALANCE', balance });
    }

    // Monto capturado debe coincidir
    const escrow = entries.find(e => e.account === 'ESCROW_PLATFORM' && e.event_type === 'PAYMENT_CAPTURED');
    if (escrow && escrow.delta !== ft.amount) {
      issues.push({ transaction_id: ft.transaction_id, issue: 'AMOUNT_MISMATCH', expected: ft.amount, found: escrow.delta });
    }

    // Si está RELEASED: debe existir asiento WORKER_AVAILABLE
    if (ft.status === 'RELEASED') {
      const workerAvailable = entries.find(e => e.account === 'WORKER_AVAILABLE' && e.event_type === 'WORKER_FUNDS_RELEASED');
      if (!workerAvailable) {
        issues.push({ transaction_id: ft.transaction_id, issue: 'MISSING_WORKER_AVAILABLE_ENTRY' });
      }
      // ESCROW_PLATFORM neto debe ser 0 tras release
      const escrowNet = entries.filter(e => e.account === 'ESCROW_PLATFORM').reduce((s,e) => s + e.delta, 0);
      if (escrowNet !== 0) {
        issues.push({ transaction_id: ft.transaction_id, issue: 'ESCROW_NOT_ZERO_AFTER_RELEASE', escrowNet });
      }
    }
  }

  return issues;
}

module.exports = { capturePayment, releaseWorkerFunds, refundPayment, runForensicAudit };
