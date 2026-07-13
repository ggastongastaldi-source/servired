class TrustRiskError extends Error {
  constructor(message, code) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
  }
}
class TrustProfileNotFoundError extends TrustRiskError {
  constructor(id) { super(`TrustProfile not found: ${id}`, 'TRUST_PROFILE_NOT_FOUND'); this.id = id; }
}
class RiskCaseNotFoundError extends TrustRiskError {
  constructor(id) { super(`RiskCase not found: ${id}`, 'RISK_CASE_NOT_FOUND'); this.id = id; }
}
class InvalidProfileTransitionError extends TrustRiskError {
  constructor(from, to) { super(`Invalid profile transition: ${from} -> ${to}`, 'INVALID_PROFILE_TRANSITION'); this.from = from; this.to = to; }
}
class InvalidCaseTransitionError extends TrustRiskError {
  constructor(from, to) { super(`Invalid case transition: ${from} -> ${to}`, 'INVALID_CASE_TRANSITION'); this.from = from; this.to = to; }
}
class InvalidDimensionWeightsError extends TrustRiskError {
  constructor(sum) { super(`Dimension weights must sum to 1.0, got ${sum}`, 'INVALID_DIMENSION_WEIGHTS'); this.sum = sum; }
}
class InvalidScoreRangeError extends TrustRiskError {
  constructor(value) { super(`TrustScore must be 0-100, got ${value}`, 'INVALID_SCORE_RANGE'); this.value = value; }
}
class ConcurrencyError extends TrustRiskError {
  constructor(aggregateId, expected, actual) { super(`Concurrency conflict on ${aggregateId}: expected v${expected}, got v${actual}`, 'CONCURRENCY_CONFLICT'); this.aggregateId = aggregateId; this.expected = expected; this.actual = actual; }
}
class InsufficientConfidenceError extends TrustRiskError {
  constructor(current, required) { super(`Insufficient confidence to quarantine: ${current} < required ${required}`, 'INSUFFICIENT_CONFIDENCE'); this.current = current; this.required = required; }
}
class InvalidRehabilitationError extends TrustRiskError {
  constructor(currentStatus) { super(`Cannot rehabilitate profile with status: ${currentStatus}`, 'INVALID_REHABILITATION'); this.currentStatus = currentStatus; }
}
class DuplicateTrustProfileError extends TrustRiskError {
  constructor(actorId) { super(`TrustProfile already exists for actor: ${actorId}`, 'DUPLICATE_TRUST_PROFILE'); this.actorId = actorId; }
}
class PolicyNotFoundError extends TrustRiskError {
  constructor(version) { super(`TrustPolicy not found: ${version}`, 'POLICY_NOT_FOUND'); this.version = version; }
}
class AssessmentExpiredError extends TrustRiskError {
  constructor(assessmentId) { super(`Assessment expired or consumed: ${assessmentId}`, 'ASSESSMENT_EXPIRED'); this.assessmentId = assessmentId; }
}
module.exports = { TrustRiskError, TrustProfileNotFoundError, RiskCaseNotFoundError, InvalidProfileTransitionError, InvalidCaseTransitionError, InvalidDimensionWeightsError, InvalidScoreRangeError, ConcurrencyError, InsufficientConfidenceError, InvalidRehabilitationError, DuplicateTrustProfileError, PolicyNotFoundError, AssessmentExpiredError };
