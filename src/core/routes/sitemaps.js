'use strict';

const express = require('express');
const router = express.Router();
const {
  generarSitemapIndex,
  generarSitemapStatic,
  generarSitemapServicios,
  generarSitemapCasos,
} = require('../seo/sitemaps/sitemapBuilder');

function xmlResponse(res, xml) {
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  return res.send(xml);
}

router.get('/sitemap.xml',           (_, res) => xmlResponse(res, generarSitemapIndex()));
router.get('/sitemap-static.xml',    (_, res) => xmlResponse(res, generarSitemapStatic()));
router.get('/sitemap-servicios.xml', (_, res) => xmlResponse(res, generarSitemapServicios()));
router.get('/sitemap-casos.xml',     (_, res) => xmlResponse(res, generarSitemapCasos()));

module.exports = router;
