'use strict';

const { generarSlug, parsearSlug } = require('./slugBuilder');
const { generarJSONLD } = require('./jsonldBuilder');

const BASE_URL = process.env.BASE_URL || 'https://servired.online';

const FAQS_POR_OFICIO = {
  plomero: [
    { pregunta: '¿Cuánto cobra un plomero en AMBA?', respuesta: 'El costo varía entre $15.000 y $60.000 ARS según la complejidad. ServiRed muestra el precio antes de confirmar.' },
    { pregunta: '¿Cuánto tarda en llegar un plomero?', respuesta: 'En ServiRed el tiempo estimado de llegada se calcula automáticamente según la distancia real.' },
    { pregunta: '¿Cómo sé si el plomero es confiable?', respuesta: 'Todos los profesionales en ServiRed tienen perfil verificado y reseñas de trabajos anteriores.' },
  ],
  electricista: [
    { pregunta: '¿Cuánto cobra un electricista en AMBA?', respuesta: 'Entre $18.000 y $70.000 ARS según el trabajo. ServiRed calcula el presupuesto en tiempo real.' },
    { pregunta: '¿El electricista tiene matrícula?', respuesta: 'ServiRed verifica la documentación de cada profesional antes de habilitarlo.' },
    { pregunta: '¿Cómo contrato un electricista urgente?', respuesta: 'Ingresá a ServiRed, describí el problema y recibís ofertas en minutos.' },
  ],
  gasista: [
    { pregunta: '¿Cuánto cobra un gasista matriculado en AMBA?', respuesta: 'Entre $20.000 y $80.000 ARS. El precio depende del trabajo. ServiRed lo calcula antes de confirmar.' },
    { pregunta: '¿Qué hace un gasista matriculado?', respuesta: 'Instala, repara y certifica instalaciones de gas. La matrícula es obligatoria por seguridad.' },
    { pregunta: '¿Es seguro contratar un gasista por app?', respuesta: 'En ServiRed todos los gasistas tienen matrícula verificada y seguro de responsabilidad.' },
  ],
  default: [
    { pregunta: '¿Cómo funciona ServiRed?', respuesta: 'Describís el problema, recibís presupuestos de profesionales cercanos y pagás de forma segura desde la app.' },
    { pregunta: '¿Cuánto tarda en llegar el profesional?', respuesta: 'El ETA se calcula en tiempo real según la distancia. Generalmente entre 20 y 60 minutos.' },
    { pregunta: '¿Cómo pago el servicio?', respuesta: 'El pago es 100% digital a través de ServiRed. No necesitás tener efectivo.' },
  ],
};

function obtenerFaqs(oficio) {
  return FAQS_POR_OFICIO[oficio.toLowerCase()] || FAQS_POR_OFICIO.default;
}

function generarMetaSEO({ oficio, localidad, slug }) {
  const titulo = `${capitalizar(oficio)} en ${capitalizar(localidad)} — ServiRed`;
  const descripcion = `Contratá un ${oficio} confiable en ${localidad}. Presupuesto inmediato, pago seguro. Profesionales verificados disponibles ahora en ServiRed.`;
  return {
    title: titulo,
    description: descripcion,
    canonical: `${BASE_URL}/casos/${slug}`,
    og: {
      title: titulo,
      description: descripcion,
      url: `${BASE_URL}/casos/${slug}`,
      type: 'website',
    },
  };
}

function generarCaso({ oficio, localidad }) {
  const slug = generarSlug(oficio, localidad);
  const meta = generarMetaSEO({ oficio, localidad, slug });
  const faqs = obtenerFaqs(oficio);
  const jsonld = generarJSONLD({ oficio, localidad, slug, faqs });
  return { slug, oficio, localidad, meta, faqs, jsonld };
}

function capitalizar(texto) {
  return texto.replace(/(?:^|\s)\S/g, l => l.toUpperCase());
}

module.exports = { generarCaso, generarMetaSEO, obtenerFaqs };
