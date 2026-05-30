// types.ts — contratos del sistema
export type Decision = 'ALLOW' | 'VETO' | 'ESCALATE' | 'DENY';
export type Regime   = 'ATTRACTOR_STABLE' | 'DESCENT_ACTIVE' | 'CASCADE_GROWING' |
                       'HIGH_ENERGY_PLATEAU' | 'PHASE_TRANSITION' | 'CHAOTIC' |
                       'TRANSIENT' | 'INITIALIZING';
export type SystemVerdict = 'OPTIMAL' | 'STRUCTURAL_RISK' | 'INEFFICIENT' | 'UNRESPONSIVE';
export type ControlMode   = 'NORMAL' | 'LOCK' | 'FREEZE';
export type EfficiencyClass = 'OPTIMAL' | 'OVERCONTROL' | 'PASSIVE';

export interface ControlEvent {
  id:          string;
  type:        string;
  actor:       string;
  target_node: string;
  u_ref:       number;
  risk:        number;
  J:           number;
  gradJ:       number;
  t:           number;
}

export interface ControlResult {
  decision:     Decision;
  u:            number;
  J_before:     number;
  J_after:      number;
  dJ:           number;
  energy_delta: number;
  regime:       Regime;
  mode:         ControlMode;
  efficiency:   EfficiencyClass;
  confidence:   number;
  phase_shift:  boolean;
}

export interface RegimeState {
  regime:      Regime;
  regime_id:   number;
  confidence:  number;
  phase_shift: boolean;
  prev_regime: Regime | null;
}

export interface TransitionRecord {
  from: Regime;
  to:   Regime;
  t:    number;
}

export interface BusMessage<T = unknown> {
  channel: string;
  payload: T;
  ts:      number;
}
