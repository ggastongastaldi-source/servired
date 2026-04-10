console.log('\n🧞 ALADÍN v3 - Los 26 rubros\n');
const aladdin = require('./services/aladdinEngine');

const casos = [
  ['plomeria',           'baja'],
  ['electricidad',       'alta'],
  ['gasista',            'baja'],
  ['albanileria',        'alta'],
  ['limpieza_hogar',     'baja'],
  ['fletes_mudanzas',    'baja'],
  ['desinfeccion_plagas','alta'],
];

casos.forEach(([rubro, comp]) => {
  const r = aladdin.calcularPresupuesto(rubro, comp);
  console.log(`${rubro} [${comp}] → ARS ${r.precio_total.toLocaleString('es-AR')} | Trabajador: ${r.pago_trabajador.toLocaleString('es-AR')} | Plataforma: ${r.comision.toLocaleString('es-AR')}`);
});

console.log('\n🔴 BRIONES - Ranking\n');
const { rankearTrabajadores } = require('./globuloRojo/briones');
const trabajadores = [
  { nombre: 'Carlos Méndez',  bio: 'Plomero con 10 años en CABA, urgencias 24hs', trabajosCompletados: 45, verificado: true,  tarifaHora: 4500, ultimaActividad: new Date(), rating: 4.8 },
  { nombre: 'Roberto Silva',  bio: 'Plomero',  trabajosCompletados: 3,  verificado: false, tarifaHora: null, ultimaActividad: null, rating: 3.0 },
  { nombre: 'Diego Torres',   bio: 'Gasista matriculado, presupuesto sin cargo', trabajosCompletados: 22, verificado: true, tarifaHora: 5000, ultimaActividad: new Date(Date.now()-2*86400000), rating: 4.5 },
];
rankearTrabajadores(trabajadores).forEach((t, i) =>
  console.log(`${i+1}. ${t.nombre} — ${t.scoreBriones}/100`)
);

console.log('\n✅ Todos los módulos cargaron correctamente\n');
