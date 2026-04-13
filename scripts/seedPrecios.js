// Carga inicial de precios reales abril 2026
// Ejecutar: node scripts/seedPrecios.js
require('dotenv').config();
const mongoose = require('mongoose');
const PrecioMercado = require('../models/PrecioMercado');

const PRECIOS_BASE = [
  { rubro:'limpieza_hogar',          baja:8000,    alta:18000,   fuente:'manual' },
  { rubro:'servicio_domestico',      baja:8000,    alta:16000,   fuente:'manual' },
  { rubro:'cerrajeria',              baja:40000,   alta:120000,  fuente:'manual' },
  { rubro:'jardineria',              baja:12000,   alta:35000,   fuente:'manual' },
  { rubro:'mecanica_auxilio',        baja:60000,   alta:200000,  fuente:'manual' },
  { rubro:'peluqueria_canina',       baja:18000,   alta:60000,   fuente:'manual' },
  { rubro:'plomeria',                baja:200000,  alta:600000,  fuente:'manual' },
  { rubro:'electricidad',            baja:180000,  alta:550000,  fuente:'manual' },
  { rubro:'albanileria',             baja:600000,  alta:1800000, fuente:'manual' },
  { rubro:'pintura',                 baja:400000,  alta:1200000, fuente:'manual' },
  { rubro:'gasista',                 baja:200000,  alta:700000,  fuente:'manual' },
  { rubro:'durlock',                 baja:350000,  alta:1000000, fuente:'manual' },
  { rubro:'impermeabilizacion',      baja:350000,  alta:1000000, fuente:'manual' },
  { rubro:'pisos_revestimientos',    baja:500000,  alta:1500000, fuente:'manual' },
  { rubro:'carpinteria',             baja:600000,  alta:2000000, fuente:'manual' },
  { rubro:'herreria',                baja:500000,  alta:1800000, fuente:'manual' },
  { rubro:'techistas',               baja:500000,  alta:1800000, fuente:'manual' },
  { rubro:'antihumedad',             baja:350000,  alta:1200000, fuente:'manual' },
  { rubro:'revestimientos_pvc',      baja:300000,  alta:900000,  fuente:'manual' },
  { rubro:'climatizacion',           baja:400000,  alta:1200000, fuente:'manual' },
  { rubro:'fletes_mudanzas',         baja:250000,  alta:900000,  fuente:'manual' },
  { rubro:'mantenimiento_consorcios',baja:250000,  alta:800000,  fuente:'manual' },
  { rubro:'fumigacion',              baja:180000,  alta:600000,  fuente:'manual' },
  // Instalaciones — escala domiciliaria (no industrial)
  { rubro:'camaras_seguridad',       baja:400000,  alta:900000,  fuente:'manual' }, // 4 cam domiciliarias
  { rubro:'alarmas',                 baja:350000,  alta:800000,  fuente:'manual' },
  { rubro:'domotica_automatizacion', baja:800000,  alta:3000000, fuente:'manual' },
  { rubro:'paneles_solares',         baja:4000000, alta:18000000,fuente:'manual' },
];

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI, { family: 4 });
  console.log('MongoDB conectado');
  let ok=0, skip=0;
  for (const p of PRECIOS_BASE) {
    await PrecioMercado.findOneAndUpdate(
      { rubro: p.rubro },
      { ...p, actualizadoEn: new Date() },
      { upsert: true, new: true }
    );
    ok++;
  }
  console.log(`✅ ${ok} precios cargados en MongoDB`);
  await mongoose.disconnect();
}

seed().catch(e => { console.error(e); process.exit(1); });
