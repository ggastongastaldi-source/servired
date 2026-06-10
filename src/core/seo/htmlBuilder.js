'use strict';

function renderHtml({ meta, faqs, jsonld, oficio, localidad }) {
  const jsonldTags = jsonld
    .map(schema => `<script type="application/ld+json">\n${JSON.stringify(schema, null, 2)}\n</script>`)
    .join('\n');

  const faqsHtml = faqs.map(({ pregunta, respuesta }) => `
      <div class="faq-item">
        <h3>${escHtml(pregunta)}</h3>
        <p>${escHtml(respuesta)}</p>
      </div>`).join('');

  const titulo = `${capitalizar(oficio)} en ${capitalizar(localidad)}`;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escHtml(meta.title)}</title>
  <meta name="description" content="${escHtml(meta.description)}">
  <link rel="canonical" href="${escHtml(meta.canonical)}">
  <meta property="og:title" content="${escHtml(meta.og.title)}">
  <meta property="og:description" content="${escHtml(meta.og.description)}">
  <meta property="og:url" content="${escHtml(meta.og.url)}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="ServiRed">
  ${jsonldTags}
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1a1a1a;background:#fff}
    header{background:#e63946;color:#fff;padding:16px 24px}
    header a{color:#fff;text-decoration:none;font-weight:700;font-size:1.2rem}
    .hero{padding:40px 24px;max-width:720px;margin:0 auto}
    .hero h1{font-size:1.8rem;margin-bottom:12px;color:#e63946}
    .hero p{font-size:1rem;color:#444;line-height:1.6}
    .cta{display:inline-block;margin-top:20px;padding:14px 28px;background:#e63946;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;font-size:1rem}
    .faqs{background:#f9f9f9;padding:40px 24px}
    .faqs h2{max-width:720px;margin:0 auto 24px;font-size:1.3rem;color:#1a1a1a}
    .faq-item{max-width:720px;margin:0 auto 20px;background:#fff;padding:16px 20px;border-radius:8px;border-left:4px solid #e63946}
    .faq-item h3{font-size:1rem;margin-bottom:8px;color:#1a1a1a}
    .faq-item p{font-size:0.95rem;color:#555;line-height:1.5}
    footer{text-align:center;padding:24px;font-size:0.85rem;color:#888}
  </style>
</head>
<body>
  <header>
    <a href="/">ServiRed</a>
  </header>

  <section class="hero">
    <h1>${escHtml(titulo)} — ServiRed</h1>
    <p>Encontrá profesionales verificados disponibles ahora en tu zona. Presupuesto inmediato, pago 100% seguro.</p>
    <a href="/" class="cta">Solicitar presupuesto gratis</a>
  </section>

  <section class="faqs">
    <h2>Preguntas frecuentes</h2>
    ${faqsHtml}
  </section>

  <footer>
    &copy; ${new Date().getFullYear()} ServiRed — Servicios del hogar en AMBA
  </footer>
</body>
</html>`;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function capitalizar(texto) {
  return texto.replace(/(?:^|\s)\S/g, l => l.toUpperCase());
}

module.exports = { renderHtml };
