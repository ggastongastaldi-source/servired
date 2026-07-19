'use strict';

const express = require('express');
const router = express.Router();
const {
  generarSitemapIndex,
  generarSitemapStatic,
  generarSitemapServicios,
  generarSitemapCasos,
  generarSitemapEdificios,
  generarSitemapComercios,
  generarSitemapFabricantes,
} = require('../seo/sitemaps/sitemapBuilder');

function xmlResponse(res, xml) {
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  return res.send(xml);
}

router.get('/sitemap.xml',              (_, res) => xmlResponse(res, generarSitemapIndex()));
router.get('/sitemap-static.xml',       (_, res) => xmlResponse(res, generarSitemapStatic()));
router.get('/sitemap-servicios.xml',    (_, res) => xmlResponse(res, generarSitemapServicios()));
router.get('/sitemap-casos.xml',        (_, res) => xmlResponse(res, generarSitemapCasos()));
router.get('/sitemap-edificios.xml',    (_, res) => xmlResponse(res, generarSitemapEdificios()));
router.get('/sitemap-comercios.xml',    (_, res) => xmlResponse(res, generarSitemapComercios()));
router.get('/sitemap-fabricantes.xml',  (_, res) => xmlResponse(res, generarSitemapFabricantes()));

module.exports = router;
