class IRiskCaseRepository {
  async findById(riskCaseId) { throw new Error('not implemented'); }
  async findOpenByProfileId(trustProfileId) { throw new Error('not implemented'); }
  async save(riskCase) { throw new Error('not implemented'); }
}
module.exports = { IRiskCaseRepository };
