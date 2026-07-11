#!/usr/bin/env bash
set -euo pipefail

TOTAL=6
WL="middleware/schemaWhitelist.js"
RT="routes/merchantRoutes.js"
MC="controllers/merchantController.js"

echo "=== Verificando archivos ==="
for f in "$WL" "$RT" "$MC"; do
  [[ -f "$f" ]] || { echo "ERROR: no existe '$f' — ejecutar desde ~/servired"; exit 1; }
  echo "  OK: $f"
done

echo "=== Creando backups ==="
cp "$WL" "${WL}.bak" && echo "  ${WL}.bak"
cp "$RT" "${RT}.bak" && echo "  ${RT}.bak"
cp "$MC" "${MC}.bak" && echo "  ${MC}.bak"

aplicar() {
  local paso="$1"; local tmpf
  tmpf=$(mktemp /data/data/com.termux/files/home/servired/srv402_XXXXXX.js)
  cat > "$tmpf"
  node "$tmpf" || { rm -f "$tmpf"; echo "ABORTANDO en paso $paso/$TOTAL"; exit 1; }
  rm -f "$tmpf"
}

# PASO 1/6 — schemaWhitelist.js: agregar CATALOG_ITEM_FIELDS
aplicar 1 << 'JSEOF'
const fs = require('fs');
const f = 'middleware/schemaWhitelist.js';
let src = fs.readFileSync(f, 'utf8');
const OLD = `module.exports = { whitelistBody, BUSINESS_PROFILE_FIELDS };`;
const NEW = `// Whitelist de CatalogItem — segun models/CatalogItem.js
// Campos PROTEGIDOS que nunca deben venir del cliente:
// merchantId, usuarioId, metricas, activoDesde, ultimaVenta, creadoEn, actualizadoEn
const CATALOG_ITEM_FIELDS = [
  'nombre',
  'descripcion',
  'precioARS',
  'rubroId',
  'stock',
  'estado',
  'enPromocion',
  'precioPromo'
];

module.exports = { whitelistBody, BUSINESS_PROFILE_FIELDS, CATALOG_ITEM_FIELDS };`;
const n = src.split(OLD).length - 1;
if (n !== 1) { process.stderr.write('ERROR 1: patron encontrado ' + n + ' veces (esperado 1)\n'); process.exit(1); }
fs.writeFileSync(f, src.split(OLD).join(NEW), 'utf8');
console.log('OK 1/6: ' + f);
JSEOF

# PASO 2/6 — merchantRoutes.js: import + guardCatalogWrite + route guards (3 sub-reemplazos)
aplicar 2 << 'JSEOF'
const fs = require('fs');
const f = 'routes/merchantRoutes.js';
let src = fs.readFileSync(f, 'utf8');

const OLD_A = `const { whitelistBody, BUSINESS_PROFILE_FIELDS } = require('../middleware/schemaWhitelist');`;
const NEW_A = `const { whitelistBody, BUSINESS_PROFILE_FIELDS, CATALOG_ITEM_FIELDS } = require('../middleware/schemaWhitelist');`;
let nA = src.split(OLD_A).length - 1;
if (nA !== 1) { process.stderr.write('ERROR 2A: patron import encontrado ' + nA + ' veces\n'); process.exit(1); }
src = src.split(OLD_A).join(NEW_A);

const OLD_B = `const guardProfileWrite = [rateGuard({ windowMs: 15 * 60 * 1000, limit: 10 }), whitelistBody(BUSINESS_PROFILE_FIELDS)];`;
const NEW_B = `const guardProfileWrite = [rateGuard({ windowMs: 15 * 60 * 1000, limit: 10 }), whitelistBody(BUSINESS_PROFILE_FIELDS)];
// Mismo principio P-2 aplicado a CatalogItem — antes estas rutas no
// filtraban el body en absoluto.
const guardCatalogWrite = [rateGuard({ windowMs: 15 * 60 * 1000, limit: 30 }), whitelistBody(CATALOG_ITEM_FIELDS)];`;
let nB = src.split(OLD_B).length - 1;
if (nB !== 1) { process.stderr.write('ERROR 2B: patron guardProfileWrite encontrado ' + nB + ' veces\n'); process.exit(1); }
src = src.split(OLD_B).join(NEW_B);

const OLD_C = `router.post  ('/catalog',           auth, mc.createItem);\nrouter.patch ('/catalog/:itemId',   auth, mc.updateItem);`;
const NEW_C = `router.post  ('/catalog',           auth, ...guardCatalogWrite, mc.createItem);\nrouter.patch ('/catalog/:itemId',   auth, ...guardCatalogWrite, mc.updateItem);`;
let nC = src.split(OLD_C).length - 1;
if (nC !== 1) { process.stderr.write('ERROR 2C: patron catalog routes encontrado ' + nC + ' veces\n'); process.exit(1); }
src = src.split(OLD_C).join(NEW_C);

fs.writeFileSync(f, src, 'utf8');
console.log('OK 2/6: ' + f + ' (3 sub-reemplazos)');
JSEOF

# PASO 3/6 — merchantController.js: listCatalog
aplicar 3 << 'JSEOF'
const fs = require('fs');
const f = 'controllers/merchantController.js';
let src = fs.readFileSync(f, 'utf8');
const OLD = `exports.listCatalog = async (req, res) => {\n  res.status(501).json({ error: 'listCatalog no implementado aun' });\n};`;
const NEW = `exports.listCatalog = async (req, res) => {
  try {
    const profile = await BusinessProfile.findOne({ usuarioId: req.userId }).lean();
    if (!profile) return res.status(404).json({ error: 'Perfil no encontrado' });

    const filter = { merchantId: profile._id };
    const estado = req.query.estado;
    if (estado && estado !== 'TODOS') filter.estado = estado;

    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const items = await CatalogItem.find(filter).sort({ actualizadoEn: -1 }).limit(limit).lean();

    res.json({ items });
  } catch (e) {
    console.error('[merchant] listCatalog:', e);
    res.status(500).json({ error: 'Error al listar catalogo' });
  }
};`;
const n = src.split(OLD).length - 1;
if (n !== 1) { process.stderr.write('ERROR 3: stub listCatalog encontrado ' + n + ' veces\n'); process.exit(1); }
fs.writeFileSync(f, src.split(OLD).join(NEW), 'utf8');
console.log('OK 3/6: listCatalog');
JSEOF

# PASO 4/6 — merchantController.js: createItem
aplicar 4 << 'JSEOF'
const fs = require('fs');
const f = 'controllers/merchantController.js';
let src = fs.readFileSync(f, 'utf8');
const OLD = `exports.createItem = async (req, res) => {\n  res.status(501).json({ error: 'createItem no implementado aun' });\n};`;
const NEW = `exports.createItem = async (req, res) => {
  try {
    if (!req.body || Object.keys(req.body).length === 0)
      return res.status(400).json({ error: 'BODY_REQUIRED' });

    const profile = await BusinessProfile.findOne({ usuarioId: req.userId }).lean();
    if (!profile) return res.status(404).json({ error: 'Perfil no encontrado' });

    // merchantId y usuarioId se asignan server-side — nunca del cliente.
    // El whitelist ya descarto cualquier intento de inyeccion desde el body.
    const item = await new CatalogItem({
      ...req.body,
      rubroId: req.body.rubroId || profile.rubroId,
      merchantId: profile._id,
      usuarioId: req.userId
    }).save();

    try {
      emitEvent({
        entityType: 'merchant',
        type: 'CATALOG_ITEM_CREATED',
        aggregateId: String(item._id),
        payload: { merchantId: String(profile._id), usuarioId: String(req.userId), itemId: String(item._id) }
      });
    } catch (e) {
      console.warn('[merchant] Nexus emitEvent fallo (no critico):', e.message);
    }

    res.status(201).json({ item });
  } catch (e) {
    console.error('[merchant] createItem:', e);
    if (e.name === 'ValidationError') return res.status(400).json({ error: e.message });
    res.status(500).json({ error: 'Error al crear producto' });
  }
};`;
const n = src.split(OLD).length - 1;
if (n !== 1) { process.stderr.write('ERROR 4: stub createItem encontrado ' + n + ' veces\n'); process.exit(1); }
fs.writeFileSync(f, src.split(OLD).join(NEW), 'utf8');
console.log('OK 4/6: createItem');
JSEOF

# PASO 5/6 — merchantController.js: updateItem
aplicar 5 << 'JSEOF'
const fs = require('fs');
const f = 'controllers/merchantController.js';
let src = fs.readFileSync(f, 'utf8');
const OLD = `exports.updateItem = async (req, res) => {\n  res.status(501).json({ error: 'updateItem no implementado aun' });\n};`;
const NEW = `exports.updateItem = async (req, res) => {
  try {
    if (!req.body || Object.keys(req.body).length === 0)
      return res.status(400).json({ error: 'BODY_REQUIRED' });

    const profile = await BusinessProfile.findOne({ usuarioId: req.userId }).lean();
    if (!profile) return res.status(404).json({ error: 'Perfil no encontrado' });

    // Scoping por merchantId propio — nunca editar item de otro comercio.
    const item = await CatalogItem.findOne({ _id: req.params.itemId, merchantId: profile._id });
    if (!item) return res.status(404).json({ error: 'Producto no encontrado' });

    // Object.assign es seguro aqui: el whitelist ya filtro el body antes de llegar al controller.
    Object.assign(item, req.body);
    await item.save();

    try {
      emitEvent({
        entityType: 'merchant',
        type: 'CATALOG_ITEM_UPDATED',
        aggregateId: String(item._id),
        payload: { merchantId: String(profile._id), usuarioId: String(req.userId), itemId: String(item._id) }
      });
    } catch (e) {
      console.warn('[merchant] Nexus emitEvent fallo (no critico):', e.message);
    }

    res.json({ item });
  } catch (e) {
    console.error('[merchant] updateItem:', e);
    if (e.name === 'ValidationError') return res.status(400).json({ error: e.message });
    res.status(500).json({ error: 'Error al actualizar producto' });
  }
};`;
const n = src.split(OLD).length - 1;
if (n !== 1) { process.stderr.write('ERROR 5: stub updateItem encontrado ' + n + ' veces\n'); process.exit(1); }
fs.writeFileSync(f, src.split(OLD).join(NEW), 'utf8');
console.log('OK 5/6: updateItem');
JSEOF

# PASO 6/6 — merchantController.js: deleteItem
aplicar 6 << 'JSEOF'
const fs = require('fs');
const f = 'controllers/merchantController.js';
let src = fs.readFileSync(f, 'utf8');
const OLD = `exports.deleteItem = async (req, res) => {\n  res.status(501).json({ error: 'deleteItem no implementado aun' });\n};`;
const NEW = `exports.deleteItem = async (req, res) => {
  try {
    const profile = await BusinessProfile.findOne({ usuarioId: req.userId }).lean();
    if (!profile) return res.status(404).json({ error: 'Perfil no encontrado' });

    // Scoping por merchantId propio — nunca borrar item de otro comercio.
    const item = await CatalogItem.findOneAndDelete({ _id: req.params.itemId, merchantId: profile._id });
    if (!item) return res.status(404).json({ error: 'Producto no encontrado' });

    try {
      emitEvent({
        entityType: 'merchant',
        type: 'CATALOG_ITEM_REMOVED',
        aggregateId: String(item._id),
        payload: { merchantId: String(profile._id), usuarioId: String(req.userId), itemId: String(item._id) }
      });
    } catch (e) {
      console.warn('[merchant] Nexus emitEvent fallo (no critico):', e.message);
    }

    res.json({ ok: true });
  } catch (e) {
    console.error('[merchant] deleteItem:', e);
    res.status(500).json({ error: 'Error al eliminar producto' });
  }
};`;
const n = src.split(OLD).length - 1;
if (n !== 1) { process.stderr.write('ERROR 6: stub deleteItem encontrado ' + n + ' veces\n'); process.exit(1); }
fs.writeFileSync(f, src.split(OLD).join(NEW), 'utf8');
console.log('OK 6/6: deleteItem');
JSEOF

echo "=== Verificando sintaxis ==="
node -c "$WL" && echo "  OK: $WL"
node -c "$RT" && echo "  OK: $RT"
node -c "$MC" && echo "  OK: $MC"

echo ""
echo "TODO APLICADO CORRECTAMENTE (6/6)"
echo "Rollback disponible: cp ${WL}.bak $WL && cp ${RT}.bak $RT && cp ${MC}.bak $MC"
