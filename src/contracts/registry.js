const rubroContract = require('./rubro.contract');

const registry = new Map([
  ['rubro', rubroContract],
  ['rubros', rubroContract]
]);

module.exports = {
  get: (entity) => registry.get(entity)
};
