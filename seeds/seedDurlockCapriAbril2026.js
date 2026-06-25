/**
 * SEED: Lista de precios Capri Materiales — Abril 2026
 * Fuente: planilla comercial verificada manualmente
 * Big Mac ARS referencia: 8700 (promedio Abril 2026)
 * Rubro ServiRed: construccion_seca / durlock
 */
const mongoose = require('mongoose');
require('dotenv').config();
const CatalogoItem = require('../models/CatalogoItem');

const BIG_MAC_REF = 8700;
const FUENTE = 'Capri Materiales';
const FUENTE_FECHA = 'Abril 2026';

const items = [
  // ── CIELORRASOS JUNTA TOMADA
  { productId: 'capri-cjt-std-12',    categoria: 'cielorraso', subcategoria: 'junta_tomada',   nombre: 'Cielorraso junta tomada placa STD 12.5mm',                    precioMaterial: 17000, precioManoObra: 16000 },

  // ── TABIQUES
  { productId: 'capri-tab-std-12',    categoria: 'tabique',    subcategoria: 'simple',          nombre: 'Tabique placa STD 12.5mm',                                    precioMaterial: 25000, precioManoObra: 23000 },
  { productId: 'capri-tab-vrd-12-1c', categoria: 'tabique',    subcategoria: 'humedad_1cara',   nombre: 'Tabique placa verde 12.5mm 1 cara',                           precioMaterial: 29000, precioManoObra: 23000 },
  { productId: 'capri-tab-roj-12-1c', categoria: 'tabique',    subcategoria: 'fuego_1cara',     nombre: 'Tabique placa roja 12.5mm 1 cara',                            precioMaterial: 28000, precioManoObra: 23000 },
  { productId: 'capri-tab-sb-10-1c',  categoria: 'tabique',    subcategoria: 'exterior_1cara',  nombre: 'Tabique Superboard 10mm 1 cara',                              precioMaterial: 45000, precioManoObra: 42000 },
  { productId: 'capri-tab-vrd-12-2c', categoria: 'tabique',    subcategoria: 'humedad_2caras',  nombre: 'Tabique placa verde 12.5mm ambas caras',                      precioMaterial: 33000, precioManoObra: 28000 },
  { productId: 'capri-tab-roj-12-2c', categoria: 'tabique',    subcategoria: 'fuego_2caras',    nombre: 'Tabique placa roja 12.5mm ambas caras',                       precioMaterial: 31000, precioManoObra: 28000 },
  { productId: 'capri-tab-pgc-sb-2c', categoria: 'tabique',    subcategoria: 'pgc_pgu70',       nombre: 'Tabique PGC/PGU 70 Superboard 10mm ambas caras',              precioMaterial: 85000, precioManoObra: 80000 },
  { productId: 'capri-tab-sf-sb-2c',  categoria: 'tabique',    subcategoria: 'steel_frame',     nombre: 'Tabique Steel Frame Superboard 10mm ambas caras c/PGC PGU 100 lana 50mm OSB', precioMaterial: 140000, precioManoObra: 130000 },

  // ── CIELORRASOS DESMONTABLES
  { productId: 'capri-cdm-06-06-ctx', categoria: 'cielorraso', subcategoria: 'desmontable',     nombre: 'Cielorraso desmontable 0.60×0.60 placa clásica texturada',    precioMaterial: 22000, precioManoObra: 17000 },
  { productId: 'capri-cdm-06-12-ctx', categoria: 'cielorraso', subcategoria: 'desmontable',     nombre: 'Cielorraso desmontable 0.60×1.20 placa clásica texturada',    precioMaterial: 19000, precioManoObra: 17000 },
  { productId: 'capri-cdm-06-12-and', categoria: 'cielorraso', subcategoria: 'desmontable',     nombre: 'Cielorraso desmontable 0.60×0.12 placa Andina rústica',       precioMaterial: 35000, precioManoObra: 17000 },
  { productId: 'capri-cdm-06-06-vyn', categoria: 'cielorraso', subcategoria: 'desmontable',     nombre: 'Cielorraso desmontable 0.60×0.60 Vynil Arena',                precioMaterial: 23000, precioManoObra: 17000 },
  { productId: 'capri-cdm-06-06-lnm', categoria: 'cielorraso', subcategoria: 'desmontable',     nombre: 'Cielorraso desmontable 0.60×0.60 lana mineral Comet',         precioMaterial: 31000, precioManoObra: 17000 },
  { productId: 'capri-cdm-pvc-barb',  categoria: 'cielorraso', subcategoria: 'machimbre_pvc',   nombre: 'Cielorraso machimbre PVC Barbieri x m²',                      precioMaterial: 30000, precioManoObra: 17000 },

  // ── REVESTIMIENTOS
  { productId: 'capri-rev-omg-std',   categoria: 'revestimiento', subcategoria: 'omega',        nombre: 'Revestimiento Omega + placa STD 12.5mm',                      precioMaterial: 15000, precioManoObra: 15000 },
  { productId: 'capri-rev-omg-vrd',   categoria: 'revestimiento', subcategoria: 'omega_humedad',nombre: 'Revestimiento Omega + placa verde 12.5mm',                    precioMaterial: 18000, precioManoObra: 15000 },
  { productId: 'capri-rev-anh-mas',   categoria: 'revestimiento', subcategoria: 'antihumedad',  nombre: 'Revestimiento placa antihumedad masillado total',             precioMaterial: 20000, precioManoObra: 18000 },
  { productId: 'capri-rev-est35-12',  categoria: 'revestimiento', subcategoria: 'estructura',   nombre: 'Revestimiento estructura 35mm + placa 12.5mm',                precioMaterial: 16000, precioManoObra: 15000 },
];

async function seed() {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.DATABASE_URL || process.env.MONGODB_URL;
  if (!mongoUri) { console.error('❌ No se encontró variable de conexión MongoDB en .env'); process.exit(1); }
  await mongoose.connect(mongoUri);
  console.log('🔌 Conectado a MongoDB');

  let insertados = 0, omitidos = 0;

  for (const item of items) {
    const existe = await CatalogoItem.findOne({ productId: item.productId });
    if (existe) { omitidos++; continue; }

    await CatalogoItem.create({
      ...item,
      fuente: 'seed',
      fuenteNombre: FUENTE,
      fuenteFecha: FUENTE_FECHA,
      marca: 'Durlock',
      aplicaciones: ['construccion_seca', 'durlock', 'reforma', 'ampliacion'],
      unidad: 'm2',
      bigMacRef: BIG_MAC_REF,
    });
    insertados++;
  }

  console.log(`✅ Seed Capri Abril 2026: ${insertados} insertados, ${omitidos} omitidos (ya existían)`);
  await mongoose.disconnect();
}

seed().catch(err => { console.error('❌ Seed error:', err); process.exit(1); });
