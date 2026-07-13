class IEvidenceStore {
  async append(evidence) { throw new Error('not implemented'); }
  async getHistory(trustProfileId, from, to) { throw new Error('not implemented'); }
  async getRecent(trustProfileId, limit) { throw new Error('not implemented'); }
}
module.exports = { IEvidenceStore };
