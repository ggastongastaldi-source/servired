/**
 * territoryMap.js — Modelo Territorial Oficial del Market Operating System
 *
 * FUENTE ÚNICA DE VERDAD para toda referencia geográfica en ServiRed.
 * Consumido por: SEO, SINAPSIS, GIA, Analytics, Pricing Engine,
 *                Market Intelligence, seoEventEnricher, futuros BCs.
 */

const TERRITORY_MAP = {

  // ── CABA — Tier 1 ──────────────────────────────────────────────────────────
  ciudad_de_buenos_aires: { label: 'Ciudad de Buenos Aires', corridor: 'CABA', municipality: 'Ciudad Autónoma de Buenos Aires', neighborhood: null, province: 'CABA', region: 'AMBA', tier: 1 },
  palermo:      { label: 'Palermo',      corridor: 'CABA', municipality: 'Ciudad Autónoma de Buenos Aires', neighborhood: 'Palermo',      province: 'CABA', region: 'AMBA', tier: 1 },
  belgrano:     { label: 'Belgrano',     corridor: 'CABA', municipality: 'Ciudad Autónoma de Buenos Aires', neighborhood: 'Belgrano',     province: 'CABA', region: 'AMBA', tier: 1 },
  nunez:        { label: 'Núñez',        corridor: 'CABA', municipality: 'Ciudad Autónoma de Buenos Aires', neighborhood: 'Núñez',        province: 'CABA', region: 'AMBA', tier: 1 },
  recoleta:     { label: 'Recoleta',     corridor: 'CABA', municipality: 'Ciudad Autónoma de Buenos Aires', neighborhood: 'Recoleta',     province: 'CABA', region: 'AMBA', tier: 1 },
  retiro:       { label: 'Retiro',       corridor: 'CABA', municipality: 'Ciudad Autónoma de Buenos Aires', neighborhood: 'Retiro',       province: 'CABA', region: 'AMBA', tier: 1 },
  puerto_madero:{ label: 'Puerto Madero',corridor: 'CABA', municipality: 'Ciudad Autónoma de Buenos Aires', neighborhood: 'Puerto Madero',province: 'CABA', region: 'AMBA', tier: 1 },
  las_canitas:  { label: 'Las Cañitas',  corridor: 'CABA', municipality: 'Ciudad Autónoma de Buenos Aires', neighborhood: 'Las Cañitas',  province: 'CABA', region: 'AMBA', tier: 1 },
  colegiales:   { label: 'Colegiales',   corridor: 'CABA', municipality: 'Ciudad Autónoma de Buenos Aires', neighborhood: 'Colegiales',   province: 'CABA', region: 'AMBA', tier: 1 },
  villa_urquiza:{ label: 'Villa Urquiza',corridor: 'CABA', municipality: 'Ciudad Autónoma de Buenos Aires', neighborhood: 'Villa Urquiza',province: 'CABA', region: 'AMBA', tier: 1 },
  saavedra:     { label: 'Saavedra',     corridor: 'CABA', municipality: 'Ciudad Autónoma de Buenos Aires', neighborhood: 'Saavedra',     province: 'CABA', region: 'AMBA', tier: 1 },
  coghlan:      { label: 'Coghlan',      corridor: 'CABA', municipality: 'Ciudad Autónoma de Buenos Aires', neighborhood: 'Coghlan',      province: 'CABA', region: 'AMBA', tier: 1 },
  caballito:    { label: 'Caballito',    corridor: 'CABA', municipality: 'Ciudad Autónoma de Buenos Aires', neighborhood: 'Caballito',    province: 'CABA', region: 'AMBA', tier: 1 },
  almagro:      { label: 'Almagro',      corridor: 'CABA', municipality: 'Ciudad Autónoma de Buenos Aires', neighborhood: 'Almagro',      province: 'CABA', region: 'AMBA', tier: 1 },
  villa_crespo: { label: 'Villa Crespo', corridor: 'CABA', municipality: 'Ciudad Autónoma de Buenos Aires', neighborhood: 'Villa Crespo', province: 'CABA', region: 'AMBA', tier: 1 },
  flores:       { label: 'Flores',       corridor: 'CABA', municipality: 'Ciudad Autónoma de Buenos Aires', neighborhood: 'Flores',       province: 'CABA', region: 'AMBA', tier: 1 },

  // ── Corredor Norte — Tier 1 ────────────────────────────────────────────────
  vicente_lopez:   { label: 'Vicente López',    corridor: 'Norte', municipality: 'Vicente López', neighborhood: null,              province: 'Buenos Aires', region: 'AMBA', tier: 1 },
  olivos:          { label: 'Olivos',           corridor: 'Norte', municipality: 'Vicente López', neighborhood: 'Olivos',          province: 'Buenos Aires', region: 'AMBA', tier: 1 },
  la_lucila:       { label: 'La Lucila',        corridor: 'Norte', municipality: 'Vicente López', neighborhood: 'La Lucila',       province: 'Buenos Aires', region: 'AMBA', tier: 1 },
  florida:         { label: 'Florida',          corridor: 'Norte', municipality: 'Vicente López', neighborhood: 'Florida',         province: 'Buenos Aires', region: 'AMBA', tier: 1 },
  munro:           { label: 'Munro',            corridor: 'Norte', municipality: 'Vicente López', neighborhood: 'Munro',           province: 'Buenos Aires', region: 'AMBA', tier: 1 },
  san_isidro:      { label: 'San Isidro',       corridor: 'Norte', municipality: 'San Isidro',   neighborhood: null,              province: 'Buenos Aires', region: 'AMBA', tier: 1 },
  martinez:        { label: 'Martínez',         corridor: 'Norte', municipality: 'San Isidro',   neighborhood: 'Martínez',        province: 'Buenos Aires', region: 'AMBA', tier: 1 },
  acassuso:        { label: 'Acassuso',         corridor: 'Norte', municipality: 'San Isidro',   neighborhood: 'Acassuso',        province: 'Buenos Aires', region: 'AMBA', tier: 1 },
  beccar:          { label: 'Beccar',           corridor: 'Norte', municipality: 'San Isidro',   neighborhood: 'Beccar',          province: 'Buenos Aires', region: 'AMBA', tier: 1 },
  boulogne:        { label: 'Boulogne',         corridor: 'Norte', municipality: 'San Isidro',   neighborhood: 'Boulogne',        province: 'Buenos Aires', region: 'AMBA', tier: 1 },
  san_fernando:    { label: 'San Fernando',     corridor: 'Norte', municipality: 'San Fernando', neighborhood: null,              province: 'Buenos Aires', region: 'AMBA', tier: 1 },
  tigre:           { label: 'Tigre',            corridor: 'Norte', municipality: 'Tigre',        neighborhood: null,              province: 'Buenos Aires', region: 'AMBA', tier: 1 },
  nordelta:        { label: 'Nordelta',         corridor: 'Norte', municipality: 'Tigre',        neighborhood: 'Nordelta',        province: 'Buenos Aires', region: 'AMBA', tier: 1 },
  don_torcuato:    { label: 'Don Torcuato',     corridor: 'Norte', municipality: 'Tigre',        neighborhood: 'Don Torcuato',    province: 'Buenos Aires', region: 'AMBA', tier: 1 },
  general_pacheco: { label: 'General Pacheco',  corridor: 'Norte', municipality: 'Tigre',        neighborhood: 'General Pacheco', province: 'Buenos Aires', region: 'AMBA', tier: 1 },

  // ── Tier 2 ─────────────────────────────────────────────────────────────────
  san_martin:      { label: 'General San Martín', corridor: 'Oeste', municipality: 'General San Martín', neighborhood: null, province: 'Buenos Aires', region: 'AMBA', tier: 2 },
  tres_de_febrero: { label: 'Tres de Febrero',    corridor: 'Oeste', municipality: 'Tres de Febrero',    neighborhood: null, province: 'Buenos Aires', region: 'AMBA', tier: 2 },
  avellaneda:      { label: 'Avellaneda',         corridor: 'Sur',   municipality: 'Avellaneda',         neighborhood: null, province: 'Buenos Aires', region: 'AMBA', tier: 2 },
  lanus:           { label: 'Lanús',              corridor: 'Sur',   municipality: 'Lanús',              neighborhood: null, province: 'Buenos Aires', region: 'AMBA', tier: 2 },
  quilmes:         { label: 'Quilmes',            corridor: 'Sur',   municipality: 'Quilmes',            neighborhood: null, province: 'Buenos Aires', region: 'AMBA', tier: 2 },
  lomas_de_zamora: { label: 'Lomas de Zamora',   corridor: 'Sur',   municipality: 'Lomas de Zamora',    neighborhood: null, province: 'Buenos Aires', region: 'AMBA', tier: 2 },
  florencio_varela:{ label: 'Florencio Varela',  corridor: 'Sur',   municipality: 'Florencio Varela',   neighborhood: null, province: 'Buenos Aires', region: 'AMBA', tier: 2 },

  // ── Tier 3 ─────────────────────────────────────────────────────────────────
  la_matanza:      { label: 'La Matanza',     corridor: 'Oeste', municipality: 'La Matanza',  neighborhood: null,              province: 'Buenos Aires', region: 'AMBA', tier: 3 },
  isidro_casanova: { label: 'Isidro Casanova',corridor: 'Oeste', municipality: 'La Matanza',  neighborhood: 'Isidro Casanova', province: 'Buenos Aires', region: 'AMBA', tier: 3 },
  moron:           { label: 'Morón',          corridor: 'Oeste', municipality: 'Morón',        neighborhood: null,              province: 'Buenos Aires', region: 'AMBA', tier: 3 },
  ituzaingo:       { label: 'Ituzaingó',      corridor: 'Oeste', municipality: 'Ituzaingó',   neighborhood: null,              province: 'Buenos Aires', region: 'AMBA', tier: 3 },
  hurlingham:      { label: 'Hurlingham',     corridor: 'Oeste', municipality: 'Hurlingham',  neighborhood: null,              province: 'Buenos Aires', region: 'AMBA', tier: 3 },
  merlo:           { label: 'Merlo',          corridor: 'Oeste', municipality: 'Merlo',        neighborhood: null,              province: 'Buenos Aires', region: 'AMBA', tier: 3 },
  moreno:          { label: 'Moreno',         corridor: 'Oeste', municipality: 'Moreno',       neighborhood: null,              province: 'Buenos Aires', region: 'AMBA', tier: 3 },

  // ── Nodo meta ─────────────────────────────────────────────────────────────
  gran_buenos_aires: { label: 'Gran Buenos Aires', corridor: 'AMBA', municipality: null, neighborhood: null, province: 'Buenos Aires', region: 'AMBA', tier: 3 },
};

const LOCALIDADES = Object.fromEntries(
  Object.entries(TERRITORY_MAP).map(([slug, d]) => [slug, d.label])
);

function getTerritoryNode(slug) { return TERRITORY_MAP[slug] ?? null; }
function getCorridorSlugs(corridor) { return Object.entries(TERRITORY_MAP).filter(([,d]) => d.corridor === corridor).map(([s]) => s); }
function getTierSlugs(tier) { return Object.entries(TERRITORY_MAP).filter(([,d]) => d.tier === tier).map(([s]) => s); }

module.exports = { TERRITORY_MAP, LOCALIDADES, getTerritoryNode, getCorridorSlugs, getTierSlugs };
