const PRECIOS = {
  'pintura': 95000, 'pintura latex': 95000, 'pintura al agua': 85000,
  'pintura exterior': 110000, 'rodillo': 8500, 'rodillo de pintura': 8500,
  'pincel': 4500, 'lona': 6000, 'cinta adhesiva': 2500, 'diluyente': 12000,
  'enduido': 35000, 'sellador': 28000, 'lija': 1500,
  'caño': 15000, 'canilla': 45000, 'sifon': 12000, 'llave de paso': 18000,
  'cinta teflon': 800, 'pegamento para caños': 3500,
  'cable': 12000, 'interruptor': 8000, 'tomacorriente': 7500,
  'disyuntor': 25000, 'caja de luz': 4000, 'cinta aisladora': 1200,
  'cemento': 18000, 'arena': 8000, 'cal': 6500, 'ladrillo': 850,
  'mezcla': 14000, 'pastina': 5000,
  'recuplast': 280000, 'membrana': 95000, 'impermeabilizante': 75000, 'hidrofugo': 45000,
  'bisagra': 3500, 'tornillo': 1200, 'madera': 35000, 'barniz': 28000, 'laca': 32000,
  'guantes': 3500, 'mascara': 4500, 'escalera': 85000,
};

function obtenerPrecio(nombreMaterial) {
  const key = nombreMaterial.toLowerCase().trim();
  if (PRECIOS[key] !== undefined) return PRECIOS[key];
  for (const [k, v] of Object.entries(PRECIOS)) {
    if (key === k || key.includes(` ${k}`) || key.includes(`${k} `) || key.startsWith(k)) return v;
  }
  return 15000;
}

module.exports = { obtenerPrecio, PRECIOS };
