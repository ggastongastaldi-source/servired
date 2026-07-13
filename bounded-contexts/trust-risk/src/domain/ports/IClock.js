class IClock {
  now() { throw new Error('IClock.now() must be implemented'); }
  nowMs() { return this.now().getTime(); }
}
module.exports = { IClock };
