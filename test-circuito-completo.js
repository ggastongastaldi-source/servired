require('dotenv').config();
const { io } = require('socket.io-client');

const EMAIL_CLIENTE = 'TU_EMAIL_DE_CLIENTE_DE_PRUEBA';
const PASSWORD_CLIENTE = 'TU_PASSWORD';
const BASE_URL = 'https://servired-6e5r.onrender.com';

async function main() {
  // 1. Login como CLIENTE (no como worker)
  const loginRes = await fetch(BASE_URL + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL_CLIENTE, password: PASSWORD_CLIENTE })
  });
  const loginData = await loginRes.json();
  if (!loginData.ok) { console.error('[TEST] Login cliente fallo:', loginData); process.exit(1); }
  console.log('[TEST] Login cliente OK:', loginData.usuario.nombre);

  // 2. Crear pedido real
  const pedidoRes = await fetch(BASE_URL + '/api/pedidos', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + loginData.token
    },
    body: JSON.stringify({
      tipoServicio: 'limpieza_hogar',
      zona: 'CABA',
      descripcion: 'Test E2E circuito completo',
      direccion: 'Av. Test 123',
      complejidad: 'baja'
    })
  });
  const pedidoData = await pedidoRes.json();
  console.log('[TEST] Pedido creado:', JSON.stringify(pedidoData, null, 2));

  if (!pedidoData.ok) { console.error('[TEST] Creacion de pedido fallo'); process.exit(1); }

  console.log('[TEST] Pedido ID:', pedidoData.pedido._id);
  console.log('[TEST] Esperando 5s para que el Auction Engine procese...');
  await new Promise(r => setTimeout(r, 5000));
  console.log('[TEST] Revisar logs de Render ahora para ver [AuctionEngine] y si Debora aparece como candidata.');
}

main().catch(e => { console.error('[TEST] Error fatal:', e); process.exit(1); });
