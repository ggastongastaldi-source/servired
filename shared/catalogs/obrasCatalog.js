/**
 * Catálogo de Obras Complejas — ServiRed OS v1
 * Obras que requieren múltiples rubros coordinados
 * Consumido por Presupuesto Inteligente y Aladdín
 * requiresMultiTrade: true — nunca cotizar en GIA directamente
 */

const OBRAS = [
  {
    id: 'bano_completo',
    keywords: ['baño completo', 'remodelar baño', 'refaccion baño', 'refacción baño', 'baño entero', 'baño nuevo', 'renovar baño', 'arreglar baño completo'],
    nombre: 'Refacción de Baño Completo',
    requiresMultiTrade: true,
    rubros: ['albanileria', 'plomeria', 'electricidad', 'pisos_revestimientos', 'pintura_interior'],
    descripcion: 'Refacción integral de baño: demolición, plomería, electricidad, revestimientos y pintura',
    complejidad: 'media',
    duracionEstimadaDias: { min: 7, max: 21 }
  },
  {
    id: 'cocina_completa',
    keywords: ['cocina completa', 'remodelar cocina', 'refaccion cocina', 'refacción cocina', 'cocina nueva', 'renovar cocina', 'reforma cocina'],
    nombre: 'Refacción de Cocina Completa',
    requiresMultiTrade: true,
    rubros: ['albanileria', 'plomeria', 'electricidad', 'durlock', 'pisos_revestimientos', 'pintura_interior'],
    descripcion: 'Refacción integral de cocina: plomería, electricidad, revestimientos, durlock y pintura',
    complejidad: 'media',
    duracionEstimadaDias: { min: 10, max: 25 }
  },
  {
    id: 'refaccion_integral',
    keywords: ['refaccion integral', 'refacción integral', 'reforma integral', 'remodelar casa', 'renovar casa', 'refaccionar vivienda', 'reforma completa'],
    nombre: 'Refacción Integral de Vivienda',
    requiresMultiTrade: true,
    rubros: ['albanileria', 'plomeria', 'electricidad', 'durlock', 'pintura_interior', 'pisos_revestimientos', 'carpinteria'],
    descripcion: 'Reforma completa de vivienda incluyendo todas las especialidades',
    complejidad: 'alta',
    duracionEstimadaDias: { min: 30, max: 90 }
  },
  {
    id: 'local_comercial',
    keywords: ['local comercial', 'acondicionar local', 'habilitacion local', 'abrir local', 'local nuevo', 'reforma local'],
    nombre: 'Acondicionamiento de Local Comercial',
    requiresMultiTrade: true,
    rubros: ['albanileria', 'electricidad', 'durlock', 'pintura_interior', 'pisos_revestimientos', 'cctv', 'alarmas'],
    descripcion: 'Habilitación y acondicionamiento de local comercial',
    complejidad: 'alta',
    duracionEstimadaDias: { min: 15, max: 45 }
  },
  {
    id: 'edificio',
    keywords: ['edificio', 'obra de edificio', 'construccion edificio', 'edificio nuevo', 'torre', 'propiedad horizontal'],
    nombre: 'Obra de Edificio',
    requiresMultiTrade: true,
    rubros: ['ingenieria', 'arquitectura', 'albanileria', 'electricidad', 'plomeria', 'pintura_edificios', 'silleteros', 'seguridad_industrial', 'ascensoristas'],
    descripcion: 'Construcción o reforma de edificio — requiere profesionales habilitados',
    complejidad: 'muy_alta',
    duracionEstimadaDias: { min: 180, max: 730 }
  },
  {
    id: 'techo_impermeabilizacion',
    keywords: ['techo', 'gotera', 'impermeabilizar techo', 'membrana techo', 'techo nuevo', 'filtración techo', 'azotea'],
    nombre: 'Techo e Impermeabilización',
    requiresMultiTrade: true,
    rubros: ['impermeabilizacion', 'albanileria'],
    descripcion: 'Reparación o renovación de techo con membrana impermeabilizante',
    complejidad: 'media',
    duracionEstimadaDias: { min: 2, max: 7 }
  },
  {
    id: 'ampliacion',
    keywords: ['ampliacion', 'ampliar casa', 'habitacion nueva', 'cuarto nuevo', 'agregar piso', 'galeria', 'quincho'],
    nombre: 'Ampliación de Vivienda',
    requiresMultiTrade: true,
    rubros: ['arquitectura', 'albanileria', 'electricidad', 'plomeria', 'pintura_interior', 'pisos_revestimientos'],
    descripcion: 'Ampliación con nueva habitación, galería o planta',
    complejidad: 'alta',
    duracionEstimadaDias: { min: 30, max: 120 }
  }
];

/**
 * clasificarObra(texto) — detecta obra compleja desde lenguaje de usuario
 * Nivel 2 de clasificación — complementa clasificar() de rubrosCatalog
 */
// Normalización Unicode — elimina tildes, ñ→n, lowercase
function _normalize(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/ñ/g, 'n')
    .replace(/ü/g, 'u')
    .trim();
}

// Sinónimos de intención de obra compleja
const OBRA_INTENT_WORDS = [
  'remodelar','remodelacion','reformar','reforma','refaccionar',
  'refaccion','renovar','renovacion','rehacer','reconstruir',
  'completo','completa','entero','entera','integral','total',
  'nuevo','nueva','desde cero',
  'ampliar','ampliacion','ampliacion','expansion','expandir',
  'agrandar','construir','agregar piso','sumar habitacion'
];

function clasificarObra(texto) {
  const norm = _normalize(texto);

  return OBRAS.filter(o => {
    // Nivel 1: match directo por keywords normalizadas
    const kwMatch = o.keywords && o.keywords.some(kw =>
      norm.includes(_normalize(kw))
    );
    if (kwMatch) return true;

    // Nivel 2: intent semántico — verbo de obra + palabra del nombre/rubros
    const hasIntent = OBRA_INTENT_WORDS.some(w => norm.includes(w));
    if (!hasIntent) return false;

    // Verificar que mencione algo relacionado con la obra
    // Extraer tokens significativos del input (>3 chars)
    const inputTokens = norm.split(/\s+/).filter(t => t.length > 3);

    const obraTerms = [
      ...(o.keywords || []),
      o.nombre,
      ...o.rubros
    ].map(_normalize);

    // Match si algún token del input aparece en algún término de la obra
    // O si algún término de la obra aparece en el input
    return inputTokens.some(token =>
      obraTerms.some(t => t.includes(token) || norm.includes(t))
    );
  });
}

/**
 * clasificarIntent(texto) — clasificación unificada rubro + obra
 * Retorna { rubros, obras, esObraCompleja }
 * Punto de entrada único para GIA y Matching Engine
 */
function clasificarIntent(texto) {
  const { clasificar } = require('./rubrosCatalog');
  const rubros = clasificar(texto);
  const obras  = clasificarObra(texto);
  return {
    rubros,
    obras,
    esObraCompleja: obras.length > 0
  };
}

function getById(id) {
  return OBRAS.find(o => o.id === id) || null;
}

function getPorRubro(rubroId) {
  return OBRAS.filter(o => o.rubros.includes(rubroId));
}

function getPorComplejidad(complejidad) {
  return OBRAS.filter(o => o.complejidad === complejidad);
}

module.exports = { OBRAS, getById, getPorRubro, getPorComplejidad, clasificarObra, clasificarIntent };
