console.log('\n🧞 ALADÍN - Test de presupuestos\n');
const { calcularPresupuesto } = require('./services/aladdinEngine');

const casos = [
  ['plomeria',    'basico',     { zona: 'CABA',      horas: 2 }],
  ['electricidad','complejo',   { zona: 'GBA_NORTE',  horas: 3 }],
  ['gasista',     'intermedio', { zona: 'CABA',       horas: 1 }],
  ['servicio_domestico','basico',{ zona: 'GBA_SUR',  horas: 4 }],
];
casos.forEach(([rubro, comp, opts]) => {
  const r = calcularPresupuesto(rubro, comp, opts);
  console.log(`${r.rubro} | ${r.zona} | ${r.complejidad} | ${r.horas}h`);
  console.log(`  💰 Total:      ARS ${r.precio_total.toLocaleString('es-AR')}`);
  console.log(`  🏦 Comisión:   ARS ${r.comision.toLocaleString('es-AR')}`);
  console.log(`  👷 Trabajador: ARS ${r.pago_trabajador.toLocaleString('es-AR')}\n`);
});

console.log('🔴 GLÓBULO ROJO + MÉTODO BRIONES - Test de ranking\n');
const { rankearTrabajadores } = require('./globuloRojo/briones');

const trabajadores = [
  { nombre: 'Carlos Méndez',  bio: 'Plomero con 10 años en CABA, urgencias 24hs', trabajosCompletados: 45, verificado: true,  tarifaHora: 4500, ultimaActividad: new Date(), rating: 4.8 },
  { nombre: 'Roberto Silva',  bio: 'Plomero',                                       trabajosCompletados:  3, verificado: false, tarifaHora: null, ultimaActividad: null,      rating: 3.0 },
  { nombre: 'Diego Torres',   bio: 'Gasista matriculado, presupuesto sin cargo',    trabajosCompletados: 22, verificado: true,  tarifaHora: 5000, ultimaActividad: new Date(Date.now()-2*86400000), rating: 4.5 },
  { nombre: 'Marcelo Ruiz',   bio: '',                                               trabajosCompletados:  0, verificado: false, tarifaHora: 3000, ultimaActividad: null,      rating: 0 },
];

rankearTrabajadores(trabajadores).forEach((t, i) => {
  console.log(`${i + 1}. ${t.nombre} — Score Briones: ${t.scoreBriones}/100`);
  console.log(`   Verificado: ${t.verificado ? '✅' : '❌'} | Jobs: ${t.trabajosCompletados} | Rating: ${t.rating}\n`);
});
