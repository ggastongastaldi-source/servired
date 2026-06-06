const mongoose  = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const { postLedgerEntry, Ledger } = require('./ledgerService');
const { calculateSettlement }     = require('./settlementEngine');
const FinancialTransaction        = require('../models/FinancialTransaction');
const Usuario                     = require('../models/Usuario');
const Pedido                      = require('../models/Pedido');

// ─── capturePayment ───────────────────────────────────────────────────────────
async function capturePayment({ provider, provider_transaction_id, order_id, amount }, externalSession, _attempt = 0) {
  const ownSession = !externalSession;
  const session = externalSession || await mongoose.startSession();
  if (ownSession) session.startTransaction();

  try {
    const transaction_id = `txn_srv_${uuidv4().replace(/-/g,'').substring(0,13)}`;
    const { platformFee, workerPayout } = calculateSettlement(amount);

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

    await postLedgerEntry({ transaction_id, provider_transaction_id, order_id, account: 'ESCROW_PLATFORM',  delta: +amount,        event_type: 'PAYMENT_CAPTURED' }, session);
    await postLedgerEntry({ transaction_id, provider_transaction_id, order_id, account: 'WORKER_PENDING',   delta: -workerPayout,  event_type: 'PAYMENT_CAPTURED' }, session);
    await postLedgerEntry({ transaction_id, provider_transaction_id, order_id, account: 'SERVIRED_REVENUE', delta: -platformFee,   event_type: 'PAYMENT_CAPTURED' }, session);

    // Wallet: acreditar pending al trabajador — mismo ACID
    const pedido = await Pedido.findById(order_id).session(session).lean();
    if (pedido && pedido.worker) {
      await Usuario.findByIdAndUpdate(
        pedido.worker,
        { $inc: { wallet_pending: workerPayout } },
        { session }
      );
    }

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
      if (_attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, 50 + Math.random() * 100));
        return capturePayment({ provider, provider_transaction_id, order_id, amount }, undefined, _attempt + 1);
      }
    }
    throw err;
  }
}

// ─── releaseWorkerFunds ───────────────────────────────────────────────────────
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
    await postLedgerEntry({ transaction_id, order_id: ft.order_id, account: 'WORKER_PENDING',   delta: +ft.workerPayout, event_type: 'WORKER_FUNDS_RELEASED' }, session);
    await postLedgerEntry({ transaction_id, order_id: ft.order_id, account: 'WORKER_AVAILABLE', delta: -ft.workerPayout, event_type: 'WORKER_FUNDS_RELEASED' }, session);

    // Wallet: mover pending -> available — mismo ACID
    const pedido = await Pedido.findById(ft.order_id).session(session).lean();
    if (pedido && pedido.worker) {
      await Usuario.findByIdAndUpdate(
        pedido.worker,
        { $inc: { wallet_pending: -ft.workerPayout, wallet_available: ft.workerPayout } },
        { session }
      );
    }

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

// ─── refundPayment ────────────────────────────────────────────────────────────
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

    // Wallet: revertir pending del trabajador — mismo ACID
    const pedido = await Pedido.findById(ft.order_id).session(session).lean();
    if (pedido && pedido.worker) {
      await Usuario.findByIdAndUpdate(
        pedido.worker,
        { $inc: { wallet_pending: -ft.workerPayout } },
        { session }
      );
    }

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

// ─── withdrawWorkerFunds ──────────────────────────────────────────────────────
// Mueve fondos de WORKER_AVAILABLE hacia afuera (retiro real).
// El pago bancario efectivo ocurre fuera de esta funcion.
async function withdrawWorkerFunds({ worker_id, amount }) {
  if (!worker_id || !amount || amount <= 0) throw new Error('withdrawWorkerFunds: worker_id y amount positivo requeridos');

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Guard atomico: debitar solo si saldo suficiente — una sola operacion
    // Previene race condition: findOneAndUpdate con condicion es atomico en MongoDB
    // También inicializa wallet_available a 0 si el campo no existe (docs legacy)
    const worker = await Usuario.findOneAndUpdate(
      { _id: worker_id, $or: [
          { wallet_available: { $gte: amount } },
        ]
      },
      { $inc: { wallet_available: -amount } },
      { session, new: false }
    );

    if (!worker) {
      // Puede ser: worker no existe, saldo insuficiente, o campo no inicializado
      const workerCheck = await Usuario.findById(worker_id).session(session).select('wallet_available');
      await session.abortTransaction();
      session.endSession();
      if (!workerCheck) throw new Error('Worker no encontrado');
      const available = workerCheck.wallet_available ?? 0;
      return { success: false, reason: 'INSUFFICIENT_FUNDS', available, requested: amount };
    }

    const transaction_id = `wdw_srv_${uuidv4().replace(/-/g,'').substring(0,13)}`;
    const order_id = `withdrawal_${worker_id}_${transaction_id}`;

    // Asientos: WORKER_AVAILABLE libera, ESCROW_PLATFORM recibe (para transferencia)
    // Suma: +amount - amount = 0
    await postLedgerEntry({ transaction_id, order_id, account: 'WORKER_AVAILABLE', delta: +amount, event_type: 'WORKER_WITHDRAWAL' }, session);
    await postLedgerEntry({ transaction_id, order_id, account: 'ESCROW_PLATFORM',  delta: -amount, event_type: 'WORKER_WITHDRAWAL' }, session);

    // Validacion balance global del evento
    const entries = await Ledger.find({ transaction_id }).session(session);
    const balance = entries.reduce((s, e) => s + e.delta, 0);
    if (balance !== 0) throw new Error(`Ledger imbalance detected after withdrawal: ${balance}`);

    await session.commitTransaction();
    session.endSession();
    return { success: true, transaction_id, worker_id, amount };

  } catch(err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
}

// ─── runForensicAudit ─────────────────────────────────────────────────────────
async function runForensicAudit() {
  const issues = [];

  // ── BLOQUE 1: auditar FinancialTransactions (pagos normales) ─────────────
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

    const escrow = entries.find(e => e.account === 'ESCROW_PLATFORM' && e.event_type === 'PAYMENT_CAPTURED');
    if (escrow && escrow.delta !== ft.amount) {
      issues.push({ transaction_id: ft.transaction_id, issue: 'AMOUNT_MISMATCH', expected: ft.amount, found: escrow.delta });
    }

    if (ft.status === 'RELEASED') {
      const workerAvailable = entries.find(e => e.account === 'WORKER_AVAILABLE' && e.event_type === 'WORKER_FUNDS_RELEASED');
      if (!workerAvailable) {
        issues.push({ transaction_id: ft.transaction_id, issue: 'MISSING_WORKER_AVAILABLE_ENTRY' });
      }
    }
  }

  // ── BLOQUE 2: auditar retiros (wdw_*) — invisibles para FinancialTransaction
  // Obtener todos los transaction_id unicos del Ledger con prefijo wdw_
  const withdrawalIds = await Ledger.distinct('transaction_id', {
    transaction_id: { $regex: /^wdw_srv_/ }
  });

  for (const txnId of withdrawalIds) {
    const entries = await Ledger.find({ transaction_id: txnId });

    if (entries.length === 0) {
      issues.push({ transaction_id: txnId, issue: 'NO_LEDGER_ENTRIES' });
      continue;
    }

    const balance = entries.reduce((sum, e) => sum + e.delta, 0);
    if (balance !== 0) {
      issues.push({ transaction_id: txnId, issue: 'LEDGER_IMBALANCE', balance });
    }

    // Retiro debe tener exactamente dos asientos: WORKER_AVAILABLE y ESCROW_PLATFORM
    const hasWorkerAvailable = entries.some(e => e.account === 'WORKER_AVAILABLE' && e.event_type === 'WORKER_WITHDRAWAL');
    const hasEscrow          = entries.some(e => e.account === 'ESCROW_PLATFORM'  && e.event_type === 'WORKER_WITHDRAWAL');
    if (!hasWorkerAvailable || !hasEscrow) {
      issues.push({ transaction_id: txnId, issue: 'INCOMPLETE_WITHDRAWAL_ENTRIES' });
    }
  }

  // ── BLOQUE 3: reconciliacion Wallet vs Ledger ────────────────────────────
  // Invariante: Σ(wallet_available workers) debe ser consistente con
  // el neto de WORKER_AVAILABLE en el Ledger (con signo invertido por convencion)
  const ledgerAgg = await Ledger.aggregate([
    { $match: { account: 'WORKER_AVAILABLE' } },
    { $group: { _id: null, total: { $sum: '$delta' } } }
  ]);
  const walletAgg = await Usuario.aggregate([
    { $match: { roles: 'TRABAJADOR' } },
    { $group: { _id: null, total: { $sum: '$wallet_available' } } }
  ]);

  const ledgerAvailable = ledgerAgg[0]?.total ?? 0;
  const walletAvailable = walletAgg[0]?.total ?? 0;

  // El Ledger usa convencion negativa para WORKER_AVAILABLE (debito al sistema)
  // wallet_available debe ser igual al absoluto del neto del Ledger
  const ledgerAbsolute = Math.abs(ledgerAvailable);
  const diff = Math.abs(ledgerAbsolute - walletAvailable);

  // Tolerancia de 1 ARS por redondeo de punto flotante
  if (diff > 1) {
    issues.push({
      transaction_id: 'GLOBAL',
      issue: 'WALLET_LEDGER_RECONCILIATION_MISMATCH',
      balance: diff,
      detail: { ledger_available: ledgerAbsolute, wallet_available: walletAvailable }
    });
  }

  return issues;
}


// ─── getGlobalBalances ────────────────────────────────────────────────────────
// Fuente de verdad: coleccion ledger (aggregate $sum delta por cuenta).
// Transaccion.js y Payment.js son auxiliares — no son fuente contable.
async function getGlobalBalances() {
  const agg = await Ledger.aggregate([
    { $group: { _id: '$account', balance: { $sum: '$delta' } } }
  ]);

  const result = {
    ESCROW_PLATFORM:  0,
    WORKER_PENDING:   0,
    WORKER_AVAILABLE: 0,
    PLATFORM_REVENUE: 0,
  };

  for (const row of agg) {
    if (row._id === 'ESCROW_PLATFORM')  result.ESCROW_PLATFORM  = row.balance;
    if (row._id === 'WORKER_PENDING')   result.WORKER_PENDING   = row.balance;
    if (row._id === 'WORKER_AVAILABLE') result.WORKER_AVAILABLE = row.balance;
    if (row._id === 'SERVIRED_REVENUE') result.PLATFORM_REVENUE = row.balance;
  }

  return result;
}

module.exports = { capturePayment, releaseWorkerFunds, refundPayment, withdrawWorkerFunds, runForensicAudit, getGlobalBalances };
