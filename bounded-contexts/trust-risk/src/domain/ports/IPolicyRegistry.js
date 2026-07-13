class IPolicyRegistry {
  async getActivePolicy() { throw new Error('not implemented'); }
  async getByVersion(version) { throw new Error('not implemented'); }
  async getHistory() { throw new Error('not implemented'); }
}
module.exports = { IPolicyRegistry };
