const Commerce = require('../models/Commerce');

/**
 * Devuelve comercios activos, boosted primero, luego por fecha de creación desc.
 * @param {object} filter - filtros adicionales (locality, etc.)
 * @param {number} limit
 */
async function getCommerceFeed(filter = {}, limit = 20) {
  const base = { active: true, ...filter };
  const now = new Date();

  const boosted = await Commerce.find({
    ...base,
    is_boosted: true,
    boost_expires_at: { $gt: now }
  }).sort({ boost_expires_at: 1 }).limit(limit).lean();

  const remaining = limit - boosted.length;
  const boostedIds = boosted.map(c => c._id);

  const organic = await Commerce.find({
    ...base,
    _id: { $nin: boostedIds }
  }).sort({ createdAt: -1 }).limit(remaining).lean();

  return [...boosted, ...organic];
}

module.exports = { getCommerceFeed };
