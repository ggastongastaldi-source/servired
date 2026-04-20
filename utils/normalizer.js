// Normalizador de rubros - fuente unica de verdad
const MAPA = {
  // Plomeria
  plomero:'plomeria', plomería:'plomeria', plomeria:'plomeria',
  // Electricidad
  electricista:'electricidad', electrico:'electricidad', electricidad:'electricidad',
  // Gasista
  gasista:'gasista', gas:'gasista',
  // Albanileria
  albanil:'albanileria', albañil:'albanileria', albanileria:'albanileria', albañileria:'albanileria',
  // Pintura
  pintor:'pintura', pintura:'pintura',
  // Carpinteria
  carpintero:'carpinteria', carpinteria:'carpinteria',
  // Herreria
  herrero:'herreria', herreria:'herreria', herrería:'herreria',
  // Cerrajeria
  cerrajero:'cerrajeria', cerrajeria:'cerrajeria',
  // Techista
  techista:'techista', techistas:'techista', techo:'techista',
  // Durlock
  durlock:'durlock', yesero:'durlock', drywall:'durlock',
  // Jardineria
  jardinero:'jardineria', jardineria:'jardineria',
  // Fumigacion
  fumigador:'fumigacion', fumigacion:'fumigacion', fumigación:'fumigacion',
  // Servicio domestico
  domestica:'servicio_domestico', doméstica:'servicio_domestico',
  limpieza:'servicio_domestico', limpieza_hogar:'servicio_domestico',
  servicio_domestico:'servicio_domestico',
  // Limpieza alfombras
  limpieza_alfombras:'limpieza_alfombras', alfombras:'limpieza_alfombras',
  // Camaras
  camaras:'camaras', alarmas:'camaras', camaras_seguridad:'camaras', seguridad:'camaras',
  // Climatizacion
  climatizacion:'climatizacion', aire_acondicionado:'climatizacion', refrigeracion:'climatizacion',
  // Paneles solares
  paneles_solares:'paneles_solares', solar:'paneles_solares',
  // Domotica
  domotica:'domotica', domotica_automatizacion:'domotica', automatizacion:'domotica',
  // Fletes
  fletes:'fletes', mudanza:'fletes', mudanzas:'fletes', flete:'fletes', fletes_mudanzas:'fletes',
  // Mecanica
  mecanica:'mecanica', mecanico:'mecanica', mecanica_auxilio:'mecanica', gomeria:'mecanica',
  // Tecnico PC
  tecnico_pc:'tecnico_pc', informatico:'tecnico_pc', redes:'tecnico_pc',
  // Electrodomesticos
  electrodomesticos:'electrodomesticos', electrodomestico:'electrodomesticos',
  // Peluqueria canina
  peluqueria_canina:'peluqueria_canina', peluquero:'peluqueria_canina',
  // Decoracion
  decoracion:'decoracion', decoración:'decoracion', domotica_deco:'decoracion',
  // Hormigon
  hormigon:'hormigon', hormigón:'hormigon',
  // Antihumedad
  antihumedad:'antihumedad', humedad:'antihumedad', impermeabilizacion:'antihumedad',
  // Revestimientos
  revestimientos:'revestimientos', pisos:'revestimientos', pisos_revestimientos:'revestimientos',
  revestimientos_pvc:'revestimientos',
  // Consorcios
  consorcios:'consorcios', consorcio:'consorcios', mantenimiento_consorcios:'consorcios',
  // Ascensores
  ascensores:'ascensores', ascensor:'ascensores', bombas:'ascensores',
};

function normalizar(rubro) {
  if (!rubro) return null;
  const key = rubro.toString().toLowerCase().trim().replace(/ /g,"_");
  return MAPA[key] || key;
}

module.exports = { normalizar, MAPA };
