const Commerce = require('../src/core/models/Commerce');

async function getCommerceFeed(filter = {}, limit = 20) {
  return Commerce.find(filter)
    .sort({ is_boosted: -1, createdAt: -1 })
    .limit(limit)
    .lean();
}

module.exports = { getCommerceFeed };
