function getMongoUri() {
  const candidates = ['MONGODB_URI', 'MONGO_URI', 'DATABASE_URL'];
  for (const key of candidates) {
    if (process.env[key]) return process.env[key];
  }
  const found = Object.keys(process.env)
    .filter(k => k.toLowerCase().includes('mongo') || k.toLowerCase().includes('database'))
    .join(', ') || '(ninguna detectada)';
  throw new Error(
    `MongoDB connection string not found.\n` +
    `Expected: ${candidates.join(', ')}\n` +
    `Variables compatibles detectadas: ${found}`
  );
}

module.exports = { getMongoUri };
