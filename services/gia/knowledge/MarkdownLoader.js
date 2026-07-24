'use strict';
const fs   = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..', '..'); // raiz del repo

// Cache simple en memoria — se recarga solo si cambia mtime del archivo
const cache = new Map();

function loadDocument(entry) {
  const fullPath = path.join(ROOT, entry.path);
  let stat;
  try {
    stat = fs.statSync(fullPath);
  } catch (e) {
    return { ...entry, content: null, error: `No encontrado: ${entry.path}` };
  }

  const cached = cache.get(entry.path);
  if (cached && cached.mtimeMs === stat.mtimeMs) {
    return cached.doc;
  }

  const content = fs.readFileSync(fullPath, 'utf8');
  const doc = { ...entry, content, error: null };
  cache.set(entry.path, { mtimeMs: stat.mtimeMs, doc });
  return doc;
}

function loadAll(manifest) {
  return manifest.map(loadDocument);
}

module.exports = { loadAll, loadDocument };
