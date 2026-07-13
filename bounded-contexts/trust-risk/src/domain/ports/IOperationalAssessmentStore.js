class IOperationalAssessmentStore {
  async save(assessment) { throw new Error('not implemented'); }
  async findById(assessmentId) { throw new Error('not implemented'); }
  async markConsumed(assessmentId) { throw new Error('not implemented'); }
  async findByOperationId(operationId) { throw new Error('not implemented'); }
}
module.exports = { IOperationalAssessmentStore };
