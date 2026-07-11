# ServiRed Architecture

## System model

Event → DIXIE (validation) → SINAPSIS (persistence) → Projections (read models)

## Core components

### SINAPSIS
SQLite-based cognitive graph layer for event storage and reconstruction.

### DIXIE
Deterministic governance engine for validating system transitions.

### Events
Immutable append-only log of system changes.
