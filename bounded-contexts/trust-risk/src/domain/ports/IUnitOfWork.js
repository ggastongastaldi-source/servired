class IUnitOfWork {
  get trustProfiles() { throw new Error('not implemented'); }
  get riskCases() { throw new Error('not implemented'); }
  async commit() { throw new Error('not implemented'); }
  async publish() { throw new Error('not implemented'); }
  async rollback() { throw new Error('not implemented'); }
}
module.exports = { IUnitOfWork };
