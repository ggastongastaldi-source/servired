/**
 * Catálogo de Obras Complejas — ServiRed OS v1
 * Obras que requieren múltiples rubros coordinados
 * Consumido por Presupuesto Inteligente y Aladdín
 * requiresMultiTrade: true — nunca cotizar en GIA directamente
 */

const OBRAS = [
  {
    id: 'bano_completo',
    nombre: 'Refacción de Baño Completo',
    requiresMultiTrade: true,
    rubros: ['albanileria', 'plomeria', 'electricidad', 'pisos_revestimientos', 'pintura_interior'],
    descripcion: 'Refacción integral de baño: demolición, plomería, electricidad, revestimientos y pintura',
    complejidad: 'media',
    duracionEstimadaDias: { min: 7, max: 21 }
  },
  {
    id: 'cocina_completa',
    nombre: 'Refacción de Cocina Completa',
    requiresMultiTrade: true,
    rubros: ['albanileria', 'plomeria', 'electricidad', 'durlock', 'pisos_revestimientos', 'pintura_interior'],
    descripcion: 'Refacción integral de cocina: plomería, electricidad, revestimientos, durlock y pintura',
    complejidad: 'media',
    duracionEstimadaDias: { min: 10, max: 25 }
  },
  {
    id: 'refaccion_integral',
    nombre: 'Refacción Integral de Vivienda',
    requiresMultiTrade: true,
    rubros: ['albanileria', 'plomeria', 'electricidad', 'durlock', 'pintura_interior', 'pisos_revestimientos', 'carpinteria'],
    descripcion: 'Reforma completa de vivienda incluyendo todas las especialidades',
    complejidad: 'alta',
    duracionEstimadaDias: { min: 30, max: 90 }
  },
  {
    id: 'local_comercial',
    nombre: 'Acondicionamiento de Local Comercial',
    requiresMultiTrade: true,
    rubros: ['albanileria', 'electricidad', 'durlock', 'pintura_interior', 'pisos_revestimientos', 'cctv', 'alarmas'],
    descripcion: 'Habilitación y acondicionamiento de local comercial',
    complejidad: 'alta',
    duracionEstimadaDias: { min: 15, max: 45 }
  },
  {
    id: 'edificio',
    nombre: 'Obra de Edificio',
    requiresMultiTrade: true,
    rubros: ['ingenieria', 'arquitectura', 'albanileria', 'electricidad', 'plomeria', 'pintura_edificios', 'silleteros', 'seguridad_industrial', 'ascensoristas'],
    descripcion: 'Construcción o reforma de edificio — requiere profesionales habilitados',
    complejidad: 'muy_alta',
    duracionEstimadaDias: { min: 180, max: 730 }
  },
  {
    id: 'techo_impermeabilizacion',
    nombre: 'Techo e Impermeabilización',
    requiresMultiTrade: true,
    rubros: ['impermeabilizacion', 'albanileria'],
    descripcion: 'Reparación o renovación de techo con membrana impermeabilizante',
    complejidad: 'media',
    duracionEstimadaDias: { min: 2, max: 7 }
  },
  {
    id: 'ampliacion',
    nombre: 'Ampliación de Vivienda',
    requiresMultiTrade: true,
    rubros: ['arquitectura', 'albanileria', 'electricidad', 'plomeria', 'pintura_interior', 'pisos_revestimientos'],
    descripcion: 'Ampliación con nueva habitación, galería o planta',
    complejidad: 'alta',
    duracionEstimadaDias: { min: 30, max: 120 }
  }
];

function getById(id) {
  return OBRAS.find(o => o.id === id) || null;
}

function getPorRubro(rubroId) {
  return OBRAS.filter(o => o.rubros.includes(rubroId));
}

function getPorComplejidad(complejidad) {
  return OBRAS.filter(o => o.complejidad === complejidad);
}

module.exports = { OBRAS, getById, getPorRubro, getPorComplejidad };
