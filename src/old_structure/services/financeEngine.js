const mongoose  = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const { postLedgerEntry, Ledger } = require('./ledgerService');
const { calculateSettlement }     = require('./settlementEngine');
const FinancialTransaction        = require('../models/FinancialTransaction');

async function capturePayment({ provider, provider_transaction_id, order_id, amount }, _retries = 5) {
  if (_retries === 0) throw new Error('capturePayment: max retries exceeded (TransientTransactionError)');
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const transaction_id = `txn_srv_${uuidv4().replace(/-/g,'').substring(0,13)}`;
    const { platformFee, workerPayout } = calculateSettlement(amount);

    // Idempotencia
    const existing = await FinancialTransaction.findOne({ provider, provider_transaction_id }).session(session);
    if (existing) {
      await session.abortTransaction();
      session.endSession();
      return { success: true, reason: 'DUPLICATE_REQUEST_IGNORED', transaction_id: existing.transaction_id };
    }

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

    // Asientos doble entrada
    await postLedgerEntry({ transaction_id, provider_transaction_id, order_id, account: 'ESCROW_PLATFORM',  delta: +amount,      event_type: 'PAYMENT_CAPTURED' }, session);
    await postLedgerEntry({ transaction_id, provider_transaction_id, order_id, account: 'WORKER_PENDING',   delta: -workerPayout, event_type: 'PAYMENT_CAPTURED' }, session);
    await postLedgerEntry({ transaction_id, provider_transaction_id, order_id, account: 'SERVIRED_REVENUE', delta: -platformFee,  event_type: 'PAYMENT_CAPTURED' }, session);

    // Validación balance
    const entries = await Ledger.find({ transaction_id }).session(session);
    const balance = entries.reduce((sum, e) => sum + e.delta, 0);
    if (balance !== 0) throw new Error('Ledger imbalance detected');

    await session.commitTransaction();
    session.endSession();
    return { success: true, transaction_id, platformFee, workerPayout };

  } catch(err) {
    await session.abortTransaction();
    session.endSession();
    if (err.code === 11000) return { success: true, reason: 'DUPLICATE_REQUEST_IGNORED' };
    if (err.errorLabels && err.errorLabels.includes('TransientTransactionError')) {
      await new Promise(r => setTimeout(r, 50 + Math.random() * 100));
      return capturePayment({ provider, provider_transaction_id, order_id, amount }, _retries - 1);
    }
    throw err;
  }
}

async function releaseWorkerFunds({ transaction_id }) {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const ft = await FinancialTransaction.findOne({ transaction_id }).session(session);
    if (!ft) throw new Error('Transaction not found');
    if (ft.status === 'RELEASED') {
      await session.abortTransaction(); session.endSession();
      return { success: true, reason: 'DUPLICATE_REQUEST_IGNORED' };
    }

    // Compensar WORKER_PENDING y acreditar WORKER_AVAILABLE
    await postLedgerEntry({ transaction_id, order_id: ft.order_id, account: 'WORKER_PENDING',   delta: +ft.workerPayout, event_type: 'WORKER_FUNDS_RELEASED' }, session);
    await postLedgerEntry({ transaction_id, order_id: ft.order_id, account: 'WORKER_AVAILABLE', delta: +ft.workerPayout, event_type: 'WORKER_FUNDS_RELEASED' }, session);
    await FinancialTransaction.findOneAndUpdate({ transaction_id }, { status: 'RELEASED', updated_at: new Date() }, { session });

    await session.commitTransaction();
    session.endSession();
    return { success: true, transaction_id };
  } catch(err) {
    await session.abortTransaction(); session.endSession();
    throw err;
  }
}

async function refundPayment({ transaction_id }) {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const ft = await FinancialTransaction.findOne({ transaction_id }).session(session);
    if (!ft) throw new Error('Transaction not found');
    if (ft.status === 'REFUNDED') {
      await session.abortTransaction(); session.endSession();
      return { success: true, reason: 'DUPLICATE_REQUEST_IGNORED' };
    }

    await postLedgerEntry({ transaction_id, order_id: ft.order_id, account: 'ESCROW_PLATFORM',  delta: -ft.amount,      event_type: 'PAYMENT_REFUNDED' }, session);
    await postLedgerEntry({ transaction_id, order_id: ft.order_id, account: 'WORKER_PENDING',   delta: +ft.workerPayout, event_type: 'PAYMENT_REFUNDED' }, session);
    await postLedgerEntry({ transaction_id, order_id: ft.order_id, account: 'SERVIRED_REVENUE', delta: +ft.platformFee,  event_type: 'PAYMENT_REFUNDED' }, session);
    await FinancialTransaction.findOneAndUpdate({ transaction_id }, { status: 'REFUNDED', updated_at: new Date() }, { session });

    await session.commitTransaction();
    session.endSession();
    return { success: true, transaction_id };
  } catch(err) {
    await session.abortTransaction(); session.endSession();
    throw err;
  }
}

async function runForensicAudit() {
  const issues = [];
  const transactions = await FinancialTransaction.find({});

  for (const ft of transactions) {
    const entries = await Ledger.find({ transaction_id: ft.transaction_id });

    if (entries.length === 0) {
      issues.push({ transaction_id: ft.transaction_id, issue: 'NO_LEDGER_ENTRIES' });
      continue;
    }

    const balance = entries.reduce((sum, e) => sum + e.delta, 0);
    if (balance !== 0) {
      issues.push({ transaction_id: ft.transaction_id, issue: 'LEDGER_IMBALANCE', balance });
    }

    const escrow = entries.find(e => e.account === 'ESCROW_PLATFORM' && e.event_type === 'PAYMENT_CAPTURED');
    if (escrow && escrow.delta !== ft.amount) {
      issues.push({ transaction_id: ft.transaction_id, issue: 'AMOUNT_MISMATCH', expected: ft.amount, found: escrow.delta });
    }
  }

  return issues;
}

module.exports = { capturePayment, releaseWorkerFunds, refundPayment, runForensicAudit };
