const registry = require('../contracts/registry');

const toApiResponse = (entity, rawData) => {
  const contract = registry.get(entity);
  if (!contract) throw new Error(`Contrato no definido para: ${entity}`);

  const cleanData = Array.isArray(rawData) ? rawData.map(contract) : contract(rawData);

  return {
    success: true,
    entity,
    timestamp: new Date().toISOString(),
    // Escudo Legacy: asegura que siempre haya un string para el sistema viejo
    _legacy: Array.isArray(rawData) 
      ? rawData.map(item => typeof item === 'string' ? item : (item.nombre || item.id || item)) 
      : (typeof rawData === 'string' ? rawData : (rawData.nombre || rawData.id || rawData)),
    data: cleanData
  };
};

module.exports = { toApiResponse };
