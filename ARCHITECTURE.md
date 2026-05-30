# ServiRed — Architecture Invariants (v1)

## Truth Invariant
Ledger is the only source of truth.
System state = event-sourcing reconstruction.
Infrastructure is disposable. History is permanent.
`src/sep/ledgerPg.js` | `src/sep/drivers/ledger.*`

## Governance Invariant
No execution without explicit decision: ALLOW / ESCALATE / DENY.
Dixie is the only authorization point.
`src/sinapsis/dixie.js`

## Convergence Invariant
Every divergence between runtime and ledger is detected.
System can auto-correct or auto-halt on truth corruption.
`src/sinapsis/reconciliation.js`

## Production Rule
The system is not designed to avoid failures.
It detects, contains, and reconstructs truth after failure.

## Correctness Criteria
- Global idempotency guaranteed
- Ledger never diverges undetected
- Every crash recoverable without causal loss
- Reconciliation always converges to deterministic state

## Status: PRODUCTION
