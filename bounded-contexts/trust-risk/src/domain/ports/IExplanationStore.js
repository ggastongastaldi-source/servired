class IExplanationStore {
  async append(explanation) { throw new Error('not implemented'); }
  async getByProfile(trustProfileId, limit) { throw new Error('not implemented'); }
  async getByEvidenceId(evidenceId) { throw new Error('not implemented'); }
}
module.exports = { IExplanationStore };
