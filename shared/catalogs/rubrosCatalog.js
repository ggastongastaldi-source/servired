/**
 * Catálogo de Rubros — ServiRed OS v1
 * Fuente única de verdad para GIA, Aladdín, Geomesh, Nexus,
 * Matching Engine, Comercios, Trabajadores, Command Center
 * NUNCA hardcodear rubros fuera de este archivo
 */

const RUBROS = [

  // ── CONSTRUCCIÓN ───────────────────────────────────────────
  {
    id: 'albanileria',
    nombre: 'Albañilería',
    categoria: 'construccion',
    activo: true,
    keywords: ['pared','revoque','contrapiso','hormigon','ladrillo','fisura','humedad','zarpeo','mamposteria','obra','reforma'],
    rolesPermitidos: ['worker'],
    requierePresupuestoInteligente: true,
    admiteEmergencia: false,
    admiteGeolocalizacion: true,
    admiteComercio: false,
    admiteAds: true,
    admiteBoost: true,
    geomesh: { demanda: true, oferta: true, heatmap: true }
  },
  {
    id: 'durlock',
    nombre: 'Durlock / Construcción en Seco',
    categoria: 'construccion',
    activo: true,
    keywords: ['durlock','tabique','placa','cielorraso','steel framing','construccion en seco','perfil metalico','yeso','placa verde','placa roja'],
    rolesPermitidos: ['worker', 'commerce'],
    requierePresupuestoInteligente: true,
    admiteEmergencia: false,
    admiteGeolocalizacion: true,
    admiteComercio: true,
    admiteAds: true,
    admiteBoost: true,
    geomesh: { demanda: true, oferta: true, heatmap: true }
  },
  {
    id: 'pintura_interior',
    nombre: 'Pintura Interior',
    categoria: 'construccion',
    activo: true,
    keywords: ['pintar','pintura','latex','enduido','lija','rodillo','interior','habitacion','living','techo','pared'],
    rolesPermitidos: ['worker'],
    requierePresupuestoInteligente: true,
    admiteEmergencia: false,
    admiteGeolocalizacion: true,
    admiteComercio: false,
    admiteAds: true,
    admiteBoost: true,
    geomesh: { demanda: true, oferta: true, heatmap: true }
  },
  {
    id: 'pintura_exterior',
    nombre: 'Pintura Exterior',
    categoria: 'construccion',
    activo: true,
    keywords: ['pintura exterior','fachada','frente','exterior','membrana','impermeabilizante','esmalte exterior'],
    rolesPermitidos: ['worker'],
    requierePresupuestoInteligente: true,
    admiteEmergencia: false,
    admiteGeolocalizacion: true,
    admiteComercio: false,
    admiteAds: true,
    admiteBoost: true,
    geomesh: { demanda: true, oferta: true, heatmap: false }
  },
  {
    id: 'pintura_edificios',
    nombre: 'Pintura de Edificios',
    categoria: 'construccion',
    activo: true,
    keywords: ['edificio','pintura edificio','soga','silletero','rapel','altura','fachada edificio'],
    rolesPermitidos: ['worker'],
    requierePresupuestoInteligente: true,
    admiteEmergencia: false,
    admiteGeolocalizacion: true,
    admiteComercio: false,
    admiteAds: true,
    admiteBoost: false,
    geomesh: { demanda: true, oferta: true, heatmap: false }
  },
  {
    id: 'impermeabilizacion',
    nombre: 'Impermeabilización y Techos',
    categoria: 'construccion',
    activo: true,
    keywords: ['membrana','techo','gotera','impermeabilizacion','azotea','terraza','filtracion','humedad techo'],
    rolesPermitidos: ['worker'],
    requierePresupuestoInteligente: true,
    admiteEmergencia: true,
    admiteGeolocalizacion: true,
    admiteComercio: false,
    admiteAds: true,
    admiteBoost: true,
    geomesh: { demanda: true, oferta: true, heatmap: true }
  },
  {
    id: 'pisos_revestimientos',
    nombre: 'Pisos y Revestimientos',
    categoria: 'construccion',
    activo: true,
    keywords: ['piso','ceramica','porcelanato','revestimiento','zocalo','colocacion piso','pegamento','fragüe'],
    rolesPermitidos: ['worker', 'commerce'],
    requierePresupuestoInteligente: true,
    admiteEmergencia: false,
    admiteGeolocalizacion: true,
    admiteComercio: true,
    admiteAds: true,
    admiteBoost: true,
    geomesh: { demanda: true, oferta: true, heatmap: false }
  },
  {
    id: 'carpinteria',
    nombre: 'Carpintería',
    categoria: 'construccion',
    activo: true,
    keywords: ['carpintero','puerta','ventana','mueble','placard','madera','melamina','bisagra','cerradura madera'],
    rolesPermitidos: ['worker'],
    requierePresupuestoInteligente: true,
    admiteEmergencia: false,
    admiteGeolocalizacion: true,
    admiteComercio: false,
    admiteAds: true,
    admiteBoost: true,
    geomesh: { demanda: true, oferta: true, heatmap: false }
  },
  {
    id: 'herreria',
    nombre: 'Herrería y Soldadura',
    categoria: 'construccion',
    activo: true,
    keywords: ['herrero','soldadura','reja','portón','metalico','hierro','acero','soldador','estructura metalica'],
    rolesPermitidos: ['worker'],
    requierePresupuestoInteligente: true,
    admiteEmergencia: false,
    admiteGeolocalizacion: true,
    admiteComercio: false,
    admiteAds: true,
    admiteBoost: false,
    geomesh: { demanda: true, oferta: true, heatmap: false }
  },
  {
    id: 'silleteros',
    nombre: 'Trabajos en Altura / Silleteros',
    categoria: 'construccion',
    activo: true,
    keywords: ['silletero','altura','rapel','soga','trabajo en altura','fachada altura','andamio rapel'],
    rolesPermitidos: ['worker'],
    requierePresupuestoInteligente: true,
    admiteEmergencia: false,
    admiteGeolocalizacion: true,
    admiteComercio: false,
    admiteAds: false,
    admiteBoost: false,
    geomesh: { demanda: true, oferta: true, heatmap: false }
  },

  // ── INSTALACIONES ──────────────────────────────────────────
  {
    id: 'electricidad',
    nombre: 'Electricidad',
    categoria: 'instalaciones',
    activo: true,
    keywords: ['termica','termomagnética','tablero','disyuntor','cable','cableado','enchufe','toma','llave de luz','interruptor','diferencial','puesta a tierra','cortocircuito','instalacion electrica','medidor','monofasico','trifasico','electricista'],
    rolesPermitidos: ['worker', 'commerce'],
    requierePresupuestoInteligente: true,
    admiteEmergencia: true,
    admiteGeolocalizacion: true,
    admiteComercio: true,
    admiteAds: true,
    admiteBoost: true,
    geomesh: { demanda: true, oferta: true, heatmap: true }
  },
  {
    id: 'plomeria',
    nombre: 'Plomería',
    categoria: 'instalaciones',
    activo: true,
    keywords: ['caño','cañeria','perdida','goteo','sifon','inodoro','canilla','ducha','termotanque','calefon','desagüe','cloaca','agua caliente','presion de agua','plomero','bacha','grifo','bidet','valvula','mochila'],
    rolesPermitidos: ['worker', 'commerce'],
    requierePresupuestoInteligente: true,
    admiteEmergencia: true,
    admiteGeolocalizacion: true,
    admiteComercio: true,
    admiteAds: true,
    admiteBoost: true,
    geomesh: { demanda: true, oferta: true, heatmap: true }
  },
  {
    id: 'gas',
    nombre: 'Gas',
    categoria: 'instalaciones',
    activo: true,
    keywords: ['garrafa','tubo de gas','perdida de gas','caldera','estufa','cocina a gas','habilitacion gas','instalacion gas','enargas','gasista','gas natural'],
    rolesPermitidos: ['worker'],
    requierePresupuestoInteligente: true,
    admiteEmergencia: true,
    admiteGeolocalizacion: true,
    admiteComercio: false,
    admiteAds: true,
    admiteBoost: true,
    geomesh: { demanda: true, oferta: true, heatmap: true }
  },
  {
    id: 'aire_acondicionado',
    nombre: 'Aire Acondicionado',
    categoria: 'instalaciones',
    activo: true,
    keywords: ['split','inverter','compresor','frio calor','btu','instalacion split','service ac','aire acondicionado','ventilacion'],
    rolesPermitidos: ['worker', 'commerce'],
    requierePresupuestoInteligente: true,
    admiteEmergencia: false,
    admiteGeolocalizacion: true,
    admiteComercio: true,
    admiteAds: true,
    admiteBoost: true,
    geomesh: { demanda: true, oferta: true, heatmap: true }
  },
  {
    id: 'calefaccion',
    nombre: 'Calefacción y Termotanques',
    categoria: 'instalaciones',
    activo: true,
    keywords: ['calefaccion','calefactor','radiador','piso radiante','termotanque','caldera','losa radiante','calefaccion central'],
    rolesPermitidos: ['worker'],
    requierePresupuestoInteligente: true,
    admiteEmergencia: true,
    admiteGeolocalizacion: true,
    admiteComercio: false,
    admiteAds: true,
    admiteBoost: true,
    geomesh: { demanda: true, oferta: true, heatmap: false }
  },
  {
    id: 'redes',
    nombre: 'Redes y Cableado Estructurado',
    categoria: 'instalaciones',
    activo: true,
    keywords: ['red','cableado','fibra optica','internet','router','switch','patch panel','datos','wifi','rack'],
    rolesPermitidos: ['worker'],
    requierePresupuestoInteligente: false,
    admiteEmergencia: false,
    admiteGeolocalizacion: true,
    admiteComercio: false,
    admiteAds: true,
    admiteBoost: false,
    geomesh: { demanda: true, oferta: true, heatmap: false }
  },
  {
    id: 'cctv',
    nombre: 'Cámaras de Seguridad (CCTV)',
    categoria: 'instalaciones',
    activo: true,
    keywords: ['camara','cctv','dvr','nvr','seguridad','vigilancia','monitoreo','ip cam','sensor movimiento'],
    rolesPermitidos: ['worker', 'commerce'],
    requierePresupuestoInteligente: false,
    admiteEmergencia: false,
    admiteGeolocalizacion: true,
    admiteComercio: true,
    admiteAds: true,
    admiteBoost: true,
    geomesh: { demanda: true, oferta: true, heatmap: false }
  },
  {
    id: 'alarmas',
    nombre: 'Alarmas',
    categoria: 'instalaciones',
    activo: true,
    keywords: ['alarma','panel alarma','sensor','control de acceso','monitoreo alarma','sirena','teclado alarma'],
    rolesPermitidos: ['worker', 'commerce'],
    requierePresupuestoInteligente: false,
    admiteEmergencia: false,
    admiteGeolocalizacion: true,
    admiteComercio: true,
    admiteAds: true,
    admiteBoost: true,
    geomesh: { demanda: true, oferta: true, heatmap: false }
  },

  // ── HOGAR ──────────────────────────────────────────────────
  {
    id: 'limpieza',
    nombre: 'Limpieza del Hogar',
    categoria: 'hogar',
    activo: true,
    keywords: ['limpieza','limpiar','empleada','doméstica','servicio domestico','ordenar','desinfectar','oficina','comercio limpieza'],
    rolesPermitidos: ['worker'],
    requierePresupuestoInteligente: false,
    admiteEmergencia: false,
    admiteGeolocalizacion: true,
    admiteComercio: false,
    admiteAds: true,
    admiteBoost: true,
    geomesh: { demanda: true, oferta: true, heatmap: true }
  },
  {
    id: 'lavanderia',
    nombre: 'Lavandería y Planchado',
    categoria: 'hogar',
    activo: true,
    keywords: ['planchar','lavar','lavanderia','tintoreria','ropa','tapizado','alfombra','colchon'],
    rolesPermitidos: ['worker', 'commerce'],
    requierePresupuestoInteligente: false,
    admiteEmergencia: false,
    admiteGeolocalizacion: true,
    admiteComercio: true,
    admiteAds: true,
    admiteBoost: true,
    geomesh: { demanda: true, oferta: true, heatmap: false }
  },
  {
    id: 'cerrajeria',
    nombre: 'Cerrajería',
    categoria: 'hogar',
    activo: true,
    keywords: ['cerradura','llave','puerta','cerrojo','candado','bomba de cerradura','duplicado de llave','apertura sin llave','cerrajero'],
    rolesPermitidos: ['worker'],
    requierePresupuestoInteligente: false,
    admiteEmergencia: true,
    admiteGeolocalizacion: true,
    admiteComercio: false,
    admiteAds: true,
    admiteBoost: true,
    geomesh: { demanda: true, oferta: true, heatmap: true }
  },
  {
    id: 'electrodomesticos',
    nombre: 'Reparación de Electrodomésticos',
    categoria: 'hogar',
    activo: true,
    keywords: ['heladera','lavarropas','microondas','lavavajillas','secarropas','electrodomestico','service','reparacion electrodomestico'],
    rolesPermitidos: ['worker'],
    requierePresupuestoInteligente: false,
    admiteEmergencia: false,
    admiteGeolocalizacion: true,
    admiteComercio: false,
    admiteAds: true,
    admiteBoost: false,
    geomesh: { demanda: true, oferta: true, heatmap: false }
  },
  {
    id: 'jardineria',
    nombre: 'Jardinería y Paisajismo',
    categoria: 'hogar',
    activo: true,
    keywords: ['jardin','poda','pasto','planta','desmalezado','arbol','paisajismo','pileta','mantenimiento pileta'],
    rolesPermitidos: ['worker'],
    requierePresupuestoInteligente: false,
    admiteEmergencia: false,
    admiteGeolocalizacion: true,
    admiteComercio: false,
    admiteAds: true,
    admiteBoost: true,
    geomesh: { demanda: true, oferta: true, heatmap: false }
  },
  {
    id: 'fumigacion',
    nombre: 'Fumigación y Control de Plagas',
    categoria: 'hogar',
    activo: true,
    keywords: ['fumigacion','plaga','cucaracha','rata','hormiga','mosquito','desinfeccion','control de plagas'],
    rolesPermitidos: ['worker'],
    requierePresupuestoInteligente: false,
    admiteEmergencia: true,
    admiteGeolocalizacion: true,
    admiteComercio: false,
    admiteAds: true,
    admiteBoost: true,
    geomesh: { demanda: true, oferta: true, heatmap: false }
  },

  // ── AUTOMOTOR ──────────────────────────────────────────────
  {
    id: 'mecanica',
    nombre: 'Mecánica General',
    categoria: 'automotor',
    activo: true,
    keywords: ['mecanico','frenos','aceite','tren delantero','motor','caja','embrague','suspension','auto','taller'],
    rolesPermitidos: ['worker', 'commerce'],
    requierePresupuestoInteligente: false,
    admiteEmergencia: true,
    admiteGeolocalizacion: true,
    admiteComercio: true,
    admiteAds: true,
    admiteBoost: true,
    geomesh: { demanda: true, oferta: true, heatmap: false }
  },
  {
    id: 'electricidad_automotor',
    nombre: 'Electricidad del Automotor',
    categoria: 'automotor',
    activo: true,
    keywords: ['electricidad auto','bateria','alternador','arranque','corto auto','instalacion electrica auto','alarma auto'],
    rolesPermitidos: ['worker'],
    requierePresupuestoInteligente: false,
    admiteEmergencia: true,
    admiteGeolocalizacion: true,
    admiteComercio: false,
    admiteAds: true,
    admiteBoost: false,
    geomesh: { demanda: true, oferta: true, heatmap: false }
  },
  {
    id: 'gomeria',
    nombre: 'Gomería',
    categoria: 'automotor',
    activo: true,
    keywords: ['goma','neumatico','cubierta','gomeria','pinchadura','balanceo','alineacion','llanta'],
    rolesPermitidos: ['worker', 'commerce'],
    requierePresupuestoInteligente: false,
    admiteEmergencia: true,
    admiteGeolocalizacion: true,
    admiteComercio: true,
    admiteAds: true,
    admiteBoost: true,
    geomesh: { demanda: true, oferta: true, heatmap: false }
  },

  // ── LOGÍSTICA ──────────────────────────────────────────────
  {
    id: 'fletes',
    nombre: 'Fletes y Transporte',
    categoria: 'logistica',
    activo: true,
    keywords: ['flete','camion','utilitario','transporte','carga','delivery','distribucion','reparto'],
    rolesPermitidos: ['worker'],
    requierePresupuestoInteligente: false,
    admiteEmergencia: false,
    admiteGeolocalizacion: true,
    admiteComercio: false,
    admiteAds: true,
    admiteBoost: true,
    geomesh: { demanda: true, oferta: true, heatmap: true }
  },
  {
    id: 'mudanzas',
    nombre: 'Mudanzas',
    categoria: 'logistica',
    activo: true,
    keywords: ['mudanza','muebles','mudarse','camion mudanza','guardamuebles','embalaje','traslado'],
    rolesPermitidos: ['worker'],
    requierePresupuestoInteligente: true,
    admiteEmergencia: false,
    admiteGeolocalizacion: true,
    admiteComercio: false,
    admiteAds: true,
    admiteBoost: true,
    geomesh: { demanda: true, oferta: true, heatmap: false }
  },
  {
    id: 'transporte_materiales',
    nombre: 'Transporte de Materiales',
    categoria: 'logistica',
    activo: true,
    keywords: ['materiales','arena','cascote','escombro','volquete','transporte obra','tierra','piedra'],
    rolesPermitidos: ['worker', 'commerce'],
    requierePresupuestoInteligente: false,
    admiteEmergencia: false,
    admiteGeolocalizacion: true,
    admiteComercio: true,
    admiteAds: true,
    admiteBoost: false,
    geomesh: { demanda: true, oferta: true, heatmap: false }
  },

  // ── MAQUINARIA ─────────────────────────────────────────────
  {
    id: 'retroexcavadoras',
    nombre: 'Retroexcavadoras y Movimiento de Suelo',
    categoria: 'maquinaria',
    activo: true,
    keywords: ['retroexcavadora','excavadora','pala mecanica','movimiento de suelo','nivelacion','zanja','excavacion'],
    rolesPermitidos: ['worker', 'commerce'],
    requierePresupuestoInteligente: true,
    admiteEmergencia: false,
    admiteGeolocalizacion: true,
    admiteComercio: true,
    admiteAds: true,
    admiteBoost: false,
    geomesh: { demanda: true, oferta: true, heatmap: false }
  },
  {
    id: 'andamios',
    nombre: 'Andamios y Equipamiento de Altura',
    categoria: 'maquinaria',
    activo: true,
    keywords: ['andamio','hidroelevador','grua','plataforma','alquiler andamio','trabajo en altura maquina'],
    rolesPermitidos: ['worker', 'commerce'],
    requierePresupuestoInteligente: false,
    admiteEmergencia: false,
    admiteGeolocalizacion: true,
    admiteComercio: true,
    admiteAds: true,
    admiteBoost: false,
    geomesh: { demanda: true, oferta: true, heatmap: false }
  },

  // ── SEGURIDAD INDUSTRIAL ───────────────────────────────────
  {
    id: 'seguridad_industrial',
    nombre: 'Seguridad Industrial y EPP',
    categoria: 'seguridad_industrial',
    activo: true,
    keywords: ['epp','casco','bota','chaleco','arnes','guante','seguridad laboral','indumentaria trabajo','ropa trabajo'],
    rolesPermitidos: ['commerce'],
    requierePresupuestoInteligente: false,
    admiteEmergencia: false,
    admiteGeolocalizacion: true,
    admiteComercio: true,
    admiteAds: true,
    admiteBoost: true,
    geomesh: { demanda: true, oferta: true, heatmap: false }
  },

  // ── PROFESIONALES ──────────────────────────────────────────
  {
    id: 'arquitectura',
    nombre: 'Arquitectura',
    categoria: 'profesionales',
    activo: true,
    keywords: ['arquitecto','plano','proyecto','permiso de obra','direccion de obra','reforma arquitectura'],
    rolesPermitidos: ['worker'],
    requierePresupuestoInteligente: true,
    admiteEmergencia: false,
    admiteGeolocalizacion: true,
    admiteComercio: false,
    admiteAds: true,
    admiteBoost: false,
    geomesh: { demanda: true, oferta: true, heatmap: false }
  },
  {
    id: 'ingenieria',
    nombre: 'Ingeniería',
    categoria: 'profesionales',
    activo: true,
    keywords: ['ingeniero','calculo estructural','estructura','proyecto ingenieria','relevamiento','certificado'],
    rolesPermitidos: ['worker'],
    requierePresupuestoInteligente: true,
    admiteEmergencia: false,
    admiteGeolocalizacion: true,
    admiteComercio: false,
    admiteAds: true,
    admiteBoost: false,
    geomesh: { demanda: true, oferta: true, heatmap: false }
  },
  {
    id: 'maestro_mayor_obras',
    nombre: 'Maestro Mayor de Obras',
    categoria: 'profesionales',
    activo: true,
    keywords: ['maestro mayor','mmo','conduccion de obra','jefe de obra','maestro de obras'],
    rolesPermitidos: ['worker'],
    requierePresupuestoInteligente: true,
    admiteEmergencia: false,
    admiteGeolocalizacion: true,
    admiteComercio: false,
    admiteAds: true,
    admiteBoost: false,
    geomesh: { demanda: true, oferta: true, heatmap: false }
  },
  {
    id: 'ascensoristas',
    nombre: 'Ascensores y Montacargas',
    categoria: 'profesionales',
    activo: true,
    keywords: ['ascensor','montacargas','elevador','mantenimiento ascensor','habilitacion ascensor','cabina'],
    rolesPermitidos: ['worker', 'commerce'],
    requierePresupuestoInteligente: true,
    admiteEmergencia: true,
    admiteGeolocalizacion: true,
    admiteComercio: true,
    admiteAds: true,
    admiteBoost: false,
    geomesh: { demanda: true, oferta: true, heatmap: false }
  },

  // ── COMERCIOS (nodos económicos) ───────────────────────────
  {
    id: 'corralon',
    nombre: 'Corralón de Materiales',
    categoria: 'comercios',
    activo: true,
    keywords: ['corralon','materiales de construccion','arena','cemento','hierro','cal','bloques','ladrillos'],
    rolesPermitidos: ['commerce'],
    requierePresupuestoInteligente: false,
    admiteEmergencia: false,
    admiteGeolocalizacion: true,
    admiteComercio: true,
    admiteAds: true,
    admiteBoost: true,
    geomesh: { demanda: true, oferta: true, heatmap: true }
  },
  {
    id: 'ferreteria',
    nombre: 'Ferretería',
    categoria: 'comercios',
    activo: true,
    keywords: ['ferreteria','herramienta','tornillo','fijacion','pegamento','sellador','silicona','ferretero'],
    rolesPermitidos: ['commerce'],
    requierePresupuestoInteligente: false,
    admiteEmergencia: false,
    admiteGeolocalizacion: true,
    admiteComercio: true,
    admiteAds: true,
    admiteBoost: true,
    geomesh: { demanda: true, oferta: true, heatmap: true }
  },
  {
    id: 'pinturia',
    nombre: 'Pinturería',
    categoria: 'comercios',
    activo: true,
    keywords: ['pintureria','latex','esmalte','membrana','enduido','pincel','rodillo','solvente','aguarras'],
    rolesPermitidos: ['commerce'],
    requierePresupuestoInteligente: false,
    admiteEmergencia: false,
    admiteGeolocalizacion: true,
    admiteComercio: true,
    admiteAds: true,
    admiteBoost: true,
    geomesh: { demanda: true, oferta: true, heatmap: true }
  },
  {
    id: 'comercio_electrico',
    nombre: 'Comercio Eléctrico',
    categoria: 'comercios',
    activo: true,
    keywords: ['materiales electricos','cable','termica venta','tablero venta','enchufe venta','led','artefacto'],
    rolesPermitidos: ['commerce'],
    requierePresupuestoInteligente: false,
    admiteEmergencia: false,
    admiteGeolocalizacion: true,
    admiteComercio: true,
    admiteAds: true,
    admiteBoost: true,
    geomesh: { demanda: true, oferta: true, heatmap: false }
  },
  {
    id: 'sanitarios',
    nombre: 'Sanitarios y Plomería Comercial',
    categoria: 'comercios',
    activo: true,
    keywords: ['sanitario','inodoro venta','canilla venta','grifo venta','ducha venta','valvula venta','caño venta'],
    rolesPermitidos: ['commerce'],
    requierePresupuestoInteligente: false,
    admiteEmergencia: false,
    admiteGeolocalizacion: true,
    admiteComercio: true,
    admiteAds: true,
    admiteBoost: true,
    geomesh: { demanda: true, oferta: true, heatmap: false }
  }
];

// ── API del catálogo ───────────────────────────────────────────

/** Todos los rubros activos */
function getActivos() {
  return RUBROS.filter(r => r.activo);
}

/** Buscar rubro por id */
function getById(id) {
  return RUBROS.find(r => r.id === id) || null;
}

/** Buscar rubros por categoría */
function getPorCategoria(categoria) {
  return RUBROS.filter(r => r.categoria === categoria && r.activo);
}

/** Clasificar texto libre → rubro(s) coincidentes por keywords */
function clasificar(texto) {
  const lower = texto.toLowerCase();
  return RUBROS.filter(r =>
    r.activo && r.keywords.some(kw => lower.includes(kw))
  );
}

/** Rubros que admiten comercio */
function getParaComercio() {
  return RUBROS.filter(r => r.activo && r.admiteComercio);
}

/** Rubros que admiten emergencia */
function getEmergencia() {
  return RUBROS.filter(r => r.activo && r.admiteEmergencia);
}

/** Categorías únicas */
function getCategorias() {
  return [...new Set(RUBROS.map(r => r.categoria))];
}

/**
 * resolveRubro(input) → rubroId canónico o UNKNOWN_RUBRO
 * RRL: Rubro Resolution Layer — análogo al ZRL de zonas
 * Determinístico, sin IO, loguea espurios
 */
const UNKNOWN_RUBRO = 'UNKNOWN_RUBRO';
const _rubroAliasIndex = new Map();
// Construir índice: id directo + keywords normalizadas
function _buildRubroIndex() {
  for (const r of RUBROS) {
    _rubroAliasIndex.set(_normalizeRubro(r.id), r.id);
    for (const kw of r.keywords) {
      if (!_rubroAliasIndex.has(_normalizeRubro(kw))) {
        _rubroAliasIndex.set(_normalizeRubro(kw), r.id);
      }
    }
  }
}
function _normalizeRubro(str) {
  return str.toLowerCase()
    .normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .replace(/ñ/g, 'n').replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_').replace(/^_|_$/g, '').trim();
}
const _rubroUnresolvedLog = [];
function resolveRubro(input) {
  if (!input || typeof input !== 'string') return UNKNOWN_RUBRO;
  if (_rubroAliasIndex.size === 0) _buildRubroIndex();
  const norm = _normalizeRubro(input);
  if (_rubroAliasIndex.has(norm)) return _rubroAliasIndex.get(norm);
  // Match parcial
  for (const [alias, id] of _rubroAliasIndex) {
    if (norm.includes(alias) || alias.includes(norm)) return id;
  }
  _rubroUnresolvedLog.push({ original: input, normalized: norm, timestamp: new Date().toISOString() });
  if (_rubroUnresolvedLog.length <= 100)
    console.warn('[Geomesh] ⚠️  Rubro no resuelto: "' + input + '" → UNKNOWN_RUBRO');
  return UNKNOWN_RUBRO;
}
function getRubroUnresolvedLog() { return [..._rubroUnresolvedLog]; }

module.exports = {
  RUBROS,
  getActivos,
  getById,
  getPorCategoria,
  clasificar,
  getParaComercio,
  getEmergencia,
  getCategorias,
  resolveRubro,
  getRubroUnresolvedLog,
  UNKNOWN_RUBRO
};
