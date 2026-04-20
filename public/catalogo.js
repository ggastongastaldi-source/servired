// ============================================================
// CATALOGO MAESTRO SERVIRED - Fuente unica de verdad
// Usado por: cliente.html, trabajador.html, aladdinEngine.js
// ============================================================
const CATALOGO = [
  { id:"plomeria",              label:"Plomeria",               icon:"🔧", precio:70000,  unidad:"visita"   },
  { id:"electricidad",          label:"Electricidad",           icon:"⚡", precio:70000,  unidad:"visita"   },
  { id:"gasista",               label:"Gasista",                icon:"🔥", precio:85000,  unidad:"visita"   },
  { id:"albanileria",           label:"Albanileria",            icon:"🧱", precio:80000,  unidad:"jornada"  },
  { id:"pintura",               label:"Pintura",                icon:"🎨", precio:80000,  unidad:"jornada"  },
  { id:"carpinteria",           label:"Carpinteria",            icon:"🪚", precio:70000,  unidad:"visita"   },
  { id:"herreria",              label:"Herreria",               icon:"⚙️", precio:75000,  unidad:"visita"   },
  { id:"cerrajeria",            label:"Cerrajeria",             icon:"🔑", precio:50000,  unidad:"visita"   },
  { id:"techista",              label:"Techista",               icon:"🏠", precio:110000, unidad:"visita"   },
  { id:"durlock",               label:"Durlock",                icon:"🪣", precio:85000,  unidad:"jornada"  },
  { id:"jardineria",            label:"Jardineria",             icon:"🌿", precio:35000,  unidad:"visita"   },
  { id:"fumigacion",            label:"Fumigacion",             icon:"🐛", precio:60000,  unidad:"visita"   },
  { id:"servicio_domestico",    label:"Servicio Domestico",     icon:"🧹", precio:8000,   unidad:"hora", minHoras:4 },
  { id:"limpieza_alfombras",    label:"Limpieza Alfombras",     icon:"🧽", precio:45000,  unidad:"visita"   },
  { id:"camaras",               label:"Camaras y Alarmas",      icon:"📷", precio:65000,  unidad:"punto"    },
  { id:"climatizacion",         label:"Aire Acondicionado",     icon:"❄️", precio:120000, unidad:"unidad"   },
  { id:"paneles_solares",       label:"Paneles Solares",        icon:"☀️", precio:150000, unidad:"visita"   },
  { id:"domotica",              label:"Domotica",               icon:"🏡", precio:90000,  unidad:"visita"   },
  { id:"fletes",                label:"Fletes y Mudanzas",      icon:"🚛", precio:45000,  unidad:"viaje"    },
  { id:"mecanica",              label:"Mecanica",               icon:"🔩", precio:70000,  unidad:"visita"   },
  { id:"tecnico_pc",            label:"Tecnico PC y Redes",     icon:"💻", precio:55000,  unidad:"visita"   },
  { id:"electrodomesticos",     label:"Electrodomesticos",      icon:"📺", precio:50000,  unidad:"visita"   },
  { id:"peluqueria_canina",     label:"Peluqueria Canina",      icon:"🐶", precio:25000,  unidad:"servicio" },
  { id:"decoracion",            label:"Decoracion",             icon:"🛋️", precio:70000,  unidad:"visita"   },
  { id:"hormigon",              label:"Hormigon Armado",        icon:"🏗️", precio:95000,  unidad:"jornada"  },
  { id:"antihumedad",           label:"Antihumedad",            icon:"💧", precio:80000,  unidad:"visita"   },
  { id:"revestimientos",        label:"Revestimientos",         icon:"🪟", precio:70000,  unidad:"jornada"  },
  { id:"consorcios",            label:"Mantenimiento Consorcio",icon:"🏢", precio:60000,  unidad:"visita"   },
  { id:"ascensores",            label:"Ascensores y Bombas",    icon:"🛗", precio:90000,  unidad:"visita"   },
];

if (typeof module !== "undefined") module.exports = { CATALOGO };
