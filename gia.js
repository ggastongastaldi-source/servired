#!/usr/bin/env node
// ═══════════════════════════════════════════
// GIA — Groq Intelligent Autofix
// Uso: node gia.js <archivo> [descripcion_del_error]
// ═══════════════════════════════════════════
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const MODELO = 'llama-3.1-8b-instant';
const API_KEY = process.env.GROQ_API_KEY;

async function groq(prompt) {
  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODELO,
      temperature: 0.1,
      messages: [{ role: 'user', content: prompt }]
    })
  });
  const d = await r.json();
  if (!d.choices) throw new Error(JSON.stringify(d.error));
  return d.choices[0].message.content.trim();
}

async function main() {
  if (!API_KEY) { console.error('❌ GROQ_API_KEY no encontrada'); process.exit(1); }

  const archivo = process.argv[2];
  const errorDesc = process.argv[3] || 'Analiza el archivo y detecta bugs potenciales';

  if (!archivo) {
    console.log('Uso: node gia.js <archivo> [descripcion_error]');
    console.log('Ejemplo: node gia.js src/old_structure/services/socketHandlers.js "syntax error line 237"');
    process.exit(0);
  }

  const rutaCompleta = path.resolve(archivo);
  if (!fs.existsSync(rutaCompleta)) { console.error(`❌ Archivo no encontrado: ${rutaCompleta}`); process.exit(1); }

  const codigo = fs.readFileSync(rutaCompleta, 'utf8');
  const lineas = codigo.split('\n').length;

  console.log(`\n🧠 GIA analizando: ${archivo} (${lineas} líneas)`);
  console.log(`📋 Error reportado: ${errorDesc}\n`);

  // ── FASE 1: Diagnóstico ──
  const diagnostico = await groq(`Eres un experto en Node.js/JavaScript backend.
Archivo: ${archivo}
Error reportado: ${errorDesc}

Código:
\`\`\`javascript
${codigo.slice(0, 6000)}
\`\`\`

Respondé SOLO con JSON en este formato exacto, sin texto adicional:
{
  "tiene_bug": true,
  "linea_aproximada": 42,
  "descripcion": "descripcion breve del bug",
  "confianza": "alta|media|baja"
}`);

  let diag;
  try {
    const clean = diagnostico.replace(/```json|```/g, '').trim();
    diag = JSON.parse(clean);
  } catch(e) {
    console.log('📊 Diagnóstico raw:', diagnostico);
    process.exit(1);
  }

  console.log(`📊 DIAGNÓSTICO:`);
  console.log(`   Bug detectado: ${diag.tiene_bug ? '✅ SÍ' : '❌ NO'}`);
  console.log(`   Línea aprox: ${diag.linea_aproximada}`);
  console.log(`   Descripción: ${diag.descripcion}`);
  console.log(`   Confianza: ${diag.confianza}\n`);

  if (!diag.tiene_bug || diag.confianza === 'baja') {
    console.log('✅ GIA: No hay fix necesario o confianza insuficiente. Revisión manual recomendada.');
    process.exit(0);
  }

  // ── FASE 2: Parche ──
  console.log('🔧 Generando parche...');
  const parche = await groq(`Eres un experto en Node.js. Tenés este bug en ${archivo}:
Bug: ${diag.descripcion} (línea ~${diag.linea_aproximada})

Código actual:
\`\`\`javascript
${codigo.slice(0, 6000)}
\`\`\`

Respondé SOLO con JSON en este formato exacto:
{
  "texto_a_reemplazar": "texto exacto del código actual con el bug (copiado literalmente)",
  "texto_nuevo": "texto corregido",
  "explicacion": "qué cambiaste y por qué"
}`);

  let fix;
  try {
    const clean = parche.replace(/```json|```/g, '').trim();
    fix = JSON.parse(clean);
  } catch(e) {
    console.log('🔧 Parche raw:', parche);
    process.exit(1);
  }

  console.log(`\n📝 PARCHE PROPUESTO:`);
  console.log(`   Explicación: ${fix.explicacion}`);
  console.log(`\n   ANTES: ${fix.texto_a_reemplazar?.slice(0,100)}...`);
  console.log(`   DESPUÉS: ${fix.texto_nuevo?.slice(0,100)}...`);

  // ── FASE 3: Aplicar con backup ──
  if (fix.texto_a_reemplazar && codigo.includes(fix.texto_a_reemplazar)) {
    const backup = rutaCompleta + '.gia-bak';
    fs.writeFileSync(backup, codigo);
    console.log(`\n💾 Backup guardado: ${backup}`);

    const nuevo = codigo.replace(fix.texto_a_reemplazar, fix.texto_nuevo);
    fs.writeFileSync(rutaCompleta, nuevo);
    console.log(`✅ Parche aplicado en: ${archivo}`);
    console.log(`\n⚠️  Revisá el cambio antes de hacer git push:`);
    console.log(`   diff ${backup} ${rutaCompleta}`);
  } else {
    console.log('\n⚠️  GIA no pudo aplicar el parche automáticamente.');
    console.log('   El texto a reemplazar no se encontró exacto en el archivo.');
    console.log('   Aplicá el fix manualmente con la info de arriba.');
  }
}

main().catch(e => { console.error('❌ GIA Error:', e.message); process.exit(1); });
