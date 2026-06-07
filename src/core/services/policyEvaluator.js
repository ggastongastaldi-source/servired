/**
 * policyEvaluator.js — Aladdín Kernel v2
 * Event Sourcing / Proyección pura
 * INVARIANTE: δ solo muta priceCents + trace. breakdown = π_f(trace)
 */
'use strict';

function _makeTraceEvent(action, stateDelta, prevHash = null) {
  return { ts: Date.now(), action, stateDelta, _prevHash: prevHash, _eventHash: null };
}

function _transition(state, action) {
  const { type, payload = {} } = action;
  switch (type) {
    case 'SET_BASE_PRICE': {
      const delta = payload.priceCents - state.priceCents;
      return { ...state, priceCents: payload.priceCents, trace: [...state.trace, _makeTraceEvent(action, { priceCents: delta })] };
    }
    case 'APPLY_SURCHARGE': {
      const newPrice = state.priceCents + payload.amountCents;
      return { ...state, priceCents: newPrice, trace: [...state.trace, _makeTraceEvent(action, { priceCents: payload.amountCents })] };
    }
    case 'APPLY_DISCOUNT': {
      const newPrice = Math.max(0, state.priceCents - payload.amountCents);
      const actual = state.priceCents - newPrice;
      return { ...state, priceCents: newPrice, trace: [...state.trace, _makeTraceEvent(action, { priceCents: -actual })] };
    }
    case 'APPLY_ALADDIN_FACTOR': {
      const newPrice = Math.round(state.priceCents * payload.factor);
      const delta = newPrice - state.priceCents;
      return { ...state, priceCents: newPrice, trace: [...state.trace, _makeTraceEvent(action, { priceCents: delta })] };
    }
    default:
      return { ...state, trace: [...state.trace, _makeTraceEvent(action, null)] };
  }
}

function _projectFinancial(trace) {
  let basePrice = 0, surcharges = 0, discounts = 0, aladdin = 0;
  for (const event of trace) {
    const { type, payload = {} } = event.action;
    switch (type) {
      case 'SET_BASE_PRICE':    basePrice = payload.priceCents; break;
      case 'APPLY_SURCHARGE':   surcharges += payload.amountCents; break;
      case 'APPLY_DISCOUNT':    discounts += payload.amountCents; break;
      case 'APPLY_ALADDIN_FACTOR': aladdin += event.stateDelta?.priceCents ?? 0; break;
    }
  }
  return { basePrice, surcharges, discounts, aladdinAdjustment: aladdin, total: Math.max(0, basePrice + surcharges - discounts + aladdin) };
}

function _projectState(ctx = {}, trace = []) {
  const actionTypes = trace.map(e => e.action.type);
  return { ...ctx, hasAladdinFactor: actionTypes.includes('APPLY_ALADDIN_FACTOR'), hasSurcharge: actionTypes.includes('APPLY_SURCHARGE'), hasDiscount: actionTypes.includes('APPLY_DISCOUNT'), eventCount: trace.length };
}

function _validateBreakdown(result) {
  const expected = _projectFinancial(result.trace);
  for (const f of ['basePrice', 'surcharges', 'discounts', 'aladdinAdjustment', 'total']) {
    if (result.breakdown[f] !== expected[f]) {
      throw new Error(`[DixieGate/A1] Breakdown divergence "${f}": got ${result.breakdown[f]}, expected ${expected[f]}`);
    }
  }
}

function applyActions(initialState = {}, actions = [], ctx = {}) {
  const base = { priceCents: initialState.priceCents ?? 0, trace: initialState.trace ?? [] };
  const finalState = actions.reduce((s, a) => _transition(s, a), base);
  const breakdown = _projectFinancial(finalState.trace);
  const derivedState = _projectState(ctx, finalState.trace);
  const snapshot = Object.freeze({ priceCents: finalState.priceCents, trace: Object.freeze([...finalState.trace]), breakdown: Object.freeze(breakdown), derivedState: Object.freeze(derivedState) });
  _validateBreakdown(snapshot);
  return snapshot;
}

module.exports = { applyActions, _transition, _projectFinancial, _projectState, _validateBreakdown };
