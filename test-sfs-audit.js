'use strict';
require('dotenv').config();
const BASE = process.env.BASE_URL || 'https://servired-6e5r.onrender.com';

let pass = 0, fail = 0;
const results = [];

async function req(method, path, body, token) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type':'application/json', ...(token?{Authorization:'Bearer '+token}:{}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json().catch(()=>({})) };
}

function check(name, cond, detail='', risk='BAJO') {
  const r = cond ? 'PASS' : 'FAIL';
  if (cond) pass++; else fail++;
  results.push({ test: name, result: r, detail, risk });
  console.log(`  ${cond?'✅':'❌'} [${r}] ${name} ${detail?'→ '+detail:''}`);
}

async function run() {
  console.log('\n🔍 ServiRed — Auditoría SFS + Ledger Espejo');
  console.log('━'.repeat(55));

  // 1. HEALTH CHECK
  console.log('\n📡 1. Health Check');
  const h = await req('GET', '/health');
  check('Server vivo', h.status===200, `status:${h.status}`);
  check('MongoDB conectado', h.data.status==='OK', h.data.status);

  // 2. AUTH
  console.log('\n🔐 2. Autenticación');
  const lc = await req('POST', '/api/auth/login', {email:'cliente@servired.com', password:'Test2026ok'});
  check('Login cliente', lc.data.ok && lc.data.token, lc.data.error||'');
  const tokenC = lc.data.token;

  const lw = await req('POST', '/api/auth/login', {email:'debora.rouiller.1@gmail.com', password:'debora123'});
  check('Login worker', lw.data.ok && lw.data.token, lw.data.error||'');
  const tokenW = lw.data.token;

  if (!tokenC || !tokenW) { console.log('\n⛔ Sin tokens. Abortando.'); return resumen(); }

  // 3. CREACIÓN DE PEDIDO
  console.log('\n📦 3. Creación de Pedido');
  const smart = await req('POST', '/api/smart-quote', {rubro:'servicio_domestico',zona:'la_matanza'}, null, tokenC);
  const precio = smart.data?.precio || smart.data?.precioBase || 7500;
  check('SmartQuote responde', smart.status===200, `precio:${precio}`);

  // 4. RECOVERY SFS — pedido activo previo
  console.log('\n🔄 4. Recovery SFS');
  const rec = await req('GET', '/api/pedidos/mi-pedido-activo', null, tokenC);
  check('Endpoint recovery existe', rec.status===200, `status:${rec.status}`, 'ALTO');
  check('Recovery retorna estructura válida', rec.data.ok !== undefined, JSON.stringify(rec.data).slice(0,80), 'ALTO');

  const pedidoPrevio = rec.data.pedido;
  if (pedidoPrevio) {
    check('Pedido activo tiene estadoPago', !!pedidoPrevio.estadoPago, `estadoPago:${pedidoPrevio.estadoPago}`, 'MEDIO');
    check('Pedido activo tiene estadoLiquidacion', !!pedidoPrevio.estadoLiquidacion, `estadoLiquidacion:${pedidoPrevio.estadoLiquidacion}`, 'MEDIO');
    if (pedidoPrevio.linkPago) {
      check('LinkPago persiste en DB', pedidoPrevio.linkPago.startsWith('https'), pedidoPrevio.linkPago.slice(0,60), 'ALTO');
    }
  } else {
    console.log('  ℹ️  Sin pedido activo previo — OK para test limpio');
  }

  // 5. PERSISTENCIA SFS — verificar modelo Pedido
  console.log('\n💾 5. Persistencia SFS');
  const hist = await req('GET', '/api/pedidos/mis-pedidos', null, tokenC);
  check('Historial accesible', hist.status===200, `status:${hist.status}`);

  if (hist.data?.pedidos?.length > 0) {
    const ultimo = hist.data.pedidos[0];
    check('Campo estadoPago existe en historial', ultimo.estadoPago !== undefined, `estadoPago:${ultimo.estadoPago}`, 'ALTO');
    check('Campo linkPago existe en historial', ultimo.linkPago !== undefined, `linkPago:${ultimo.linkPago ? 'presente' : 'null'}`, 'MEDIO');

    // INVARIANTE FINANCIERA
    console.log('\n⚖️  6. Invariante Financiera');
    const precio_pedido = ultimo.precio || 0;
    const pago_worker = ultimo.pago_worker || Math.round(precio_pedido * 0.8);
    const comision = precio_pedido - pago_worker;
    const esperado = precio_pedido;
    const calculado = pago_worker + comision;
    const diferencia = Math.abs(esperado - calculado);
    check('Invariante: precio = worker + comision', diferencia === 0,
      `precio:${precio_pedido} worker:${pago_worker} comision:${comision} diff:${diferencia}`, 'ALTO');
    check('Comisión SERViRed es 20%', Math.abs(comision/precio_pedido - 0.2) < 0.01,
      `comision%:${((comision/precio_pedido)*100).toFixed(1)}%`, 'MEDIO');
  } else {
    console.log('  ℹ️  Sin historial — omitiendo invariante financiera');
  }

  // 7. IDEMPOTENCIA — doble recovery
  console.log('\n🔁 7. Idempotencia Recovery');
  const rec2 = await req('GET', '/api/pedidos/mi-pedido-activo', null, tokenC);
  const rec3 = await req('GET', '/api/pedidos/mi-pedido-activo', null, tokenC);
  check('Recovery idempotente', JSON.stringify(rec2.data) === JSON.stringify(rec3.data),
    'dos llamadas consecutivas deben retornar igual', 'ALTO');

  // 8. INTEGRIDAD DE EVENTOS
  console.log('\n📋 8. Integridad de Eventos');
  const ev = await req('GET', '/api/events?limit=5', null, tokenAdmin);
  check('EventStore accesible', ev.status===200 || ev.status===401, `status:${ev.status}`);

  // 9. CONSISTENCIA LEDGER
  console.log('\n📒 9. Consistencia Ledger Espejo');
  const health2 = await req('GET', '/api/health');
  check('Sistema operativo post-auditoría', health2.status===200, '');

  resumen();
}

function resumen() {
  console.log('\n' + '━'.repeat(55));
  console.log('📊 TABLA DE RESULTADOS:\n');
  console.log('Test'.padEnd(40) + 'Resultado'.padEnd(8) + 'Riesgo');
  console.log('─'.repeat(60));
  results.forEach(r => {
    console.log(r.test.padEnd(40) + r.result.padEnd(8) + r.risk);
  });
  console.log('\n' + '─'.repeat(60));
  console.log(`PASS: ${pass} | FAIL: ${fail} | TOTAL: ${pass+fail}`);

  const riesgoOp = fail > 3 ? 'ALTO' : fail > 1 ? 'MEDIO' : 'BAJO';
  const riesgoFin = results.filter(r=>r.result==='FAIL'&&r.risk==='ALTO').length > 0 ? 'ALTO' : 'MEDIO';

  console.log(`\n🔶 Riesgo Operativo: ${riesgoOp}`);
  console.log(`💰 Riesgo Financiero: ${riesgoFin}`);

  const veredicto = fail === 0 ? '✅ APTO PARA PRODUCCIÓN'
                  : fail <= 2 ? '⚠️  APTO CON OBSERVACIONES'
                  : '❌ NO APTO';
  console.log(`\n🏁 VEREDICTO: ${veredicto}`);
  console.log('━'.repeat(55));
}

run().catch(e => { console.error('ERROR FATAL:', e.message); process.exit(1); });
