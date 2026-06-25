const express = require('express');
const router = express.Router();
const CatalogoItem = require('../models/CatalogoItem');
const { presupuestar, presupuestarEspacio } = require('../services/aladinPresupuesto');
const sinapsis = require('../../shared/events/persistenceAdapters/sinapsisBusAdapter');
const { v4: uuidv4 } = require('uuid');

// POST /api/catalogo — carga individual por comercio
router.post('/', async (req, res) => {
  try {
    const {
      productId, commerceId, nombre, categoria, subcategoria,
      marca, aplicaciones, unidad, precioMaterial, precioManoObra,
      fuente, fuenteNombre, fuenteFecha, bigMacRef
    } = req.body;

    if (!productId || !nombre || !categoria || !precioMaterial) {
      return res.status(400).json({ error: 'productId, nombre, categoria y precioMaterial son obligatorios' });
    }

    const item = await CatalogoItem.create({
      productId, commerceId, nombre, categoria, subcategoria,
      marca, aplicaciones, unidad: unidad || 'm2',
      precioMaterial, precioManoObra,
      fuente: fuente || 'manual',
      fuenteNombre, fuenteFecha,
      bigMacRef: bigMacRef || parseFloat(process.env.BIG_MAC_ARS || '8700'),
    });

    // Evento SINAPSIS
    sinapsis.publish({
      event_type: 'CATALOGO_ITEM_CREATED',
      source: 'catalogo_route',
      correlation_id: uuidv4(),
      payload: {
        productId: item.productId,
        commerceId: item.commerceId?.toString(),
        nombre: item.nombre,
        categoria: item.categoria,
        precioTotal: item.precioTotal,
      }
    }).catch(err => console.error('[SINAPSIS] CATALOGO_ITEM_CREATED error:', err));

    res.status(201).json({ ok: true, item });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'productId ya existe' });
    console.error('[POST /api/catalogo]', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// GET /api/catalogo/:commerceId — feed de productos de un comercio
router.get('/:commerceId', async (req, res) => {
  try {
    const items = await CatalogoItem.find({
      commerceId: req.params.commerceId,
      activo: true
    }).sort({ categoria: 1, precioTotal: 1 }).lean();
    res.json({ ok: true, total: items.length, items });
  } catch (err) {
    res.status(500).json({ error: 'Error interno' });
  }
});

// GET /api/catalogo — todos los ítems activos (admin / Aladín)
router.get('/', async (req, res) => {
  try {
    const { categoria, subcategoria } = req.query;
    const query = { activo: true };
    if (categoria) query.categoria = categoria;
    if (subcategoria) query.subcategoria = subcategoria;
    const items = await CatalogoItem.find(query).sort({ categoria: 1, precioTotal: 1 }).lean();
    res.json({ ok: true, total: items.length, items });
  } catch (err) {
    res.status(500).json({ error: 'Error interno' });
  }
});

// POST /api/catalogo/presupuesto — motor Aladín
router.post('/presupuesto', async (req, res) => {
  try {
    const { categoria, subcategoria, metros, incluirManoObra, bigMacActual } = req.body;
    if (!categoria || !metros) {
      return res.status(400).json({ error: 'categoria y metros son obligatorios' });
    }
    const resultado = await presupuestar({ categoria, subcategoria, metros, incluirManoObra, bigMacActual });
    res.json({ ok: true, ...resultado });
  } catch (err) {
    console.error('[POST /api/catalogo/presupuesto]', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// POST /api/catalogo/presupuesto/espacio — múltiples trabajos
router.post('/presupuesto/espacio', async (req, res) => {
  try {
    const { trabajos, bigMacActual } = req.body;
    if (!trabajos || !Array.isArray(trabajos) || !trabajos.length) {
      return res.status(400).json({ error: 'trabajos debe ser un array no vacío' });
    }
    const resultado = await presupuestarEspacio(trabajos, bigMacActual);
    res.json({ ok: true, ...resultado });
  } catch (err) {
    console.error('[POST /api/catalogo/presupuesto/espacio]', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

module.exports = router;
