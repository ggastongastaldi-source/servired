/**
 * Zones Catalog — ServiRed OS Geomesh v1
 * Eje ontológico 2: DÓNDE ocurre la actividad económica
 * Fuente única de verdad territorial — Mongo solo proyecta, este catálogo manda
 *
 * Cobertura inicial: AMBA (Área Metropolitana de Buenos Aires)
 * Jerarquía: region > partido > zona
 */

// ── Sentinel de zona no resuelta ──────────────────────────────
const UNKNOWN_ZONE = 'UNKNOWN_ZONE';

const ZONES = [

  // ── CABA ──────────────────────────────────────────────────
  { id: 'caba',             name: 'Ciudad Autónoma de Buenos Aires', parentZoneId: null,        active: true,
    aliases: ['caba','capital federal','capital','buenos aires capital','ciudad de buenos aires','cf'] },
  { id: 'palermo',          name: 'Palermo',          parentZoneId: 'caba',          active: true,
    aliases: ['palermo','palermo soho','palermo hollywood','palermo_soho','palermo_hollywood','palm'] },
  { id: 'belgrano',         name: 'Belgrano',          parentZoneId: 'caba',         active: true,
    aliases: ['belgrano','belgrano r','belgrano c'] },
  { id: 'flores',           name: 'Flores',            parentZoneId: 'caba',         active: true,
    aliases: ['flores','flores sur','floresta'] },
  { id: 'caballito',        name: 'Caballito',         parentZoneId: 'caba',         active: true,
    aliases: ['caballito'] },
  { id: 'villa_urquiza',    name: 'Villa Urquiza',     parentZoneId: 'caba',         active: true,
    aliases: ['villa urquiza','urquiza','villa_urquiza'] },
  { id: 'liniers',          name: 'Liniers',           parentZoneId: 'caba',         active: true,
    aliases: ['liniers'] },
  { id: 'mataderos',        name: 'Mataderos',         parentZoneId: 'caba',         active: true,
    aliases: ['mataderos'] },
  { id: 'villa_lugano',     name: 'Villa Lugano',      parentZoneId: 'caba',         active: true,
    aliases: ['villa lugano','lugano','villa_lugano'] },
  { id: 'barracas',         name: 'Barracas',          parentZoneId: 'caba',         active: true,
    aliases: ['barracas'] },
  { id: 'la_boca',          name: 'La Boca',           parentZoneId: 'caba',         active: true,
    aliases: ['la boca','boca','la_boca'] },
  { id: 'san_telmo',        name: 'San Telmo',         parentZoneId: 'caba',         active: true,
    aliases: ['san telmo','san_telmo','monserrat'] },
  { id: 'recoleta',         name: 'Recoleta',          parentZoneId: 'caba',         active: true,
    aliases: ['recoleta','barrio norte'] },
  { id: 'retiro',           name: 'Retiro',            parentZoneId: 'caba',         active: true,
    aliases: ['retiro'] },
  { id: 'once',             name: 'Once / Balvanera',  parentZoneId: 'caba',         active: true,
    aliases: ['once','balvanera','abasto'] },
  { id: 'villa_del_parque', name: 'Villa del Parque',  parentZoneId: 'caba',         active: true,
    aliases: ['villa del parque','villa_del_parque','villa devoto','devoto'] },

  // ── GBA NORTE ─────────────────────────────────────────────
  { id: 'san_isidro',       name: 'San Isidro',        parentZoneId: 'gba_norte',    active: true,
    aliases: ['san isidro','san_isidro','si'] },
  { id: 'tigre',            name: 'Tigre',             parentZoneId: 'gba_norte',    active: true,
    aliases: ['tigre','del viso','rincon de milberg'] },
  { id: 'vicente_lopez',    name: 'Vicente López',     parentZoneId: 'gba_norte',    active: true,
    aliases: ['vicente lopez','vicente_lopez','florida','olivos','munro','villa martelli'] },
  { id: 'san_martin',       name: 'General San Martín',parentZoneId: 'gba_norte',    active: true,
    aliases: ['san martin','gral san martin','general san martin','villa lynch','palermo del norte'] },
  { id: 'tres_de_febrero',  name: 'Tres de Febrero',   parentZoneId: 'gba_norte',    active: true,
    aliases: ['tres de febrero','3 de febrero','caseros','ciudadela','el palomar','haedo'] },

  // ── GBA OESTE ─────────────────────────────────────────────
  { id: 'la_matanza',       name: 'La Matanza',        parentZoneId: 'gba_oeste',    active: true,
    aliases: ['la matanza','lamatanza','la_matanza','san justo','ramos mejia','tapiales',
              'tablada','villa luzuriaga','gonzalez catan','isidro casanova','gregorio de laferrere',
              'ciudad evita','villa turdera','aldo bonzi','lomas del mirador'] },
  { id: 'moron',            name: 'Morón',             parentZoneId: 'gba_oeste',    active: true,
    aliases: ['moron','morón','castelar','ituzaingo','ituzaingó','moreaux'] },
  { id: 'merlo',            name: 'Merlo',             parentZoneId: 'gba_oeste',    active: true,
    aliases: ['merlo','mariano acosta','libertad','san antonio de padua'] },
  { id: 'marcos_paz',       name: 'Marcos Paz',        parentZoneId: 'gba_oeste',    active: true,
    aliases: ['marcos paz','marcos_paz'] },
  { id: 'lujan',            name: 'Luján',             parentZoneId: 'gba_oeste',    active: true,
    aliases: ['lujan','luján'] },

  // ── GBA SUR ───────────────────────────────────────────────
  { id: 'lomas_de_zamora',  name: 'Lomas de Zamora',   parentZoneId: 'gba_sur',      active: true,
    aliases: ['lomas de zamora','lomas','lomas_de_zamora','temperley','banfield','turdera'] },
  { id: 'lanus',            name: 'Lanús',             parentZoneId: 'gba_sur',      active: true,
    aliases: ['lanus','lanús','lanus este','lanus oeste','remedios de escalada','monte chingolo'] },
  { id: 'avellaneda',       name: 'Avellaneda',        parentZoneId: 'gba_sur',      active: true,
    aliases: ['avellaneda','wilde','dock sud','sarandi','sarandí'] },
  { id: 'quilmes',          name: 'Quilmes',           parentZoneId: 'gba_sur',      active: true,
    aliases: ['quilmes','bernal','ezpeleta','quilmes oeste','don bosco'] },
  { id: 'almirante_brown',  name: 'Almirante Brown',   parentZoneId: 'gba_sur',      active: true,
    aliases: ['almirante brown','adrogué','adrogue','burzaco','longchamps','malvinas argentinas'] },
  { id: 'esteban_echeverria',name:'Esteban Echeverría', parentZoneId: 'gba_sur',     active: true,
    aliases: ['esteban echeverria','monte grande','el jagüel','el jagueel','9 de abril','canning'] },
  { id: 'florencio_varela', name: 'Florencio Varela',  parentZoneId: 'gba_sur',      active: true,
    aliases: ['florencio varela','varela','ingeniero allan','bosques'] },
  { id: 'berazategui',      name: 'Berazategui',       parentZoneId: 'gba_sur',      active: true,
    aliases: ['berazategui','berazátegui','ranelagh','hudson','pereyra'] },

  // ── GBA ESTE ──────────────────────────────────────────────
  { id: 'lomas_de_zamora_este', name: 'Zona Este GBA', parentZoneId: 'gba_este',     active: true,
    aliases: ['gba este','zona este'] },
  { id: 'san_fernando',     name: 'San Fernando',      parentZoneId: 'gba_norte',    active: true,
    aliases: ['san fernando','victoria'] },
  { id: 'pilar',            name: 'Pilar',             parentZoneId: 'gba_norte',    active: true,
    aliases: ['pilar','del viso','fátima','fatima','manzanares'] },

  // ── REGIONES PADRE (no geográficas operativas, solo jerarquía) ──
  { id: 'gba_norte',        name: 'GBA Norte',         parentZoneId: 'amba',         active: true,
    aliases: ['gba norte','norte gba','zona norte'] },
  { id: 'gba_oeste',        name: 'GBA Oeste',         parentZoneId: 'amba',         active: true,
    aliases: ['gba oeste','oeste gba','zona oeste'] },
  { id: 'gba_sur',          name: 'GBA Sur',           parentZoneId: 'amba',         active: true,
    aliases: ['gba sur','sur gba','zona sur'] },
  { id: 'gba_este',         name: 'GBA Este',          parentZoneId: 'amba',         active: true,
    aliases: ['gba este','este gba','zona este gba'] },
  { id: 'amba',             name: 'AMBA',              parentZoneId: null,           active: true,
    aliases: ['amba','area metropolitana','gran buenos aires','gba','conurbano'] },
];

// ── Índice de aliases para resolución O(1) ─────────────────────
const _aliasIndex = new Map();
for (const zone of ZONES) {
  for (const alias of zone.aliases) {
    _aliasIndex.set(_normalize(alias), zone.id);
  }
  // El id siempre resuelve a sí mismo
  _aliasIndex.set(zone.id, zone.id);
}

function _normalize(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/ñ/g, 'n')
    .replace(/[^a-z0-9\s_]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ── Zone Resolution Layer (ZRL) ────────────────────────────────
/**
 * resolveZone(input) → zoneId canónico o UNKNOWN_ZONE
 * Determinístico. Sin IO. Sin inferencia AI.
 * Loguea espurios para expansión controlada del catálogo.
 */
function resolveZone(input) {
  if (!input || typeof input !== 'string') return UNKNOWN_ZONE;
  const norm = _normalize(input);
  if (!norm) return UNKNOWN_ZONE;

  // Match exacto por alias normalizado
  if (_aliasIndex.has(norm)) return _aliasIndex.get(norm);

  // Match parcial: buscar si algún alias está contenido en el input
  for (const [alias, zoneId] of _aliasIndex) {
    if (norm.includes(alias) || alias.includes(norm)) {
      return zoneId;
    }
  }

  // Sin resolución — loguear para expansión controlada
  _logUnresolved(input, norm);
  return UNKNOWN_ZONE;
}

// ── Log de zonas no resueltas (expansión controlada) ──────────
const _unresolvedLog = [];
function _logUnresolved(original, normalized) {
  const entry = { original, normalized, timestamp: new Date().toISOString() };
  _unresolvedLog.push(entry);
  if (_unresolvedLog.length <= 100) { // evitar memory leak en prod
    console.warn(`[Geomesh] ⚠️  Zona no resuelta: "${original}" → UNKNOWN_ZONE`);
  }
}
function getUnresolvedLog() { return [..._unresolvedLog]; }

// ── API del catálogo ───────────────────────────────────────────
function getById(id)           { return ZONES.find(z => z.id === id) || null; }
function getActivas()          { return ZONES.filter(z => z.active); }
function getByParent(parentId) { return ZONES.filter(z => z.parentZoneId === parentId && z.active); }
function getHierarchy(zoneId) {
  const result = [];
  let current = getById(zoneId);
  while (current) {
    result.unshift(current);
    current = current.parentZoneId ? getById(current.parentZoneId) : null;
  }
  return result;
}

module.exports = {
  ZONES,
  UNKNOWN_ZONE,
  resolveZone,
  getById,
  getActivas,
  getByParent,
  getHierarchy,
  getUnresolvedLog
};
