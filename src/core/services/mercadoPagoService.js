const { MercadoPagoConfig, Preference, Payment } = require('mercadopago');

const client = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN,
});

const BASE_URL = process.env.BASE_URL || 'https://www.servired.online';

async function crearPreferencia({ pedidoId, servicio, precio, clienteEmail, workerId }) {
  const preference = new Preference(client);
  const comision = Math.round(precio * 0.20);
  const pagoWorker = precio - comision;

  const result = await preference.create({
    body: {
      items: [{
        id: pedidoId,
        title: `SERVired — ${servicio.replace(/_/g,' ')}`,
        quantity: 1,
        unit_price: precio,
        currency_id: 'ARS',
      }],
      payer: { email: clienteEmail },
      external_reference: pedidoId,
      back_urls: {
        success: `${BASE_URL}/cliente.html?pago=ok`,
        failure: `${BASE_URL}/cliente.html?pago=error`,
        pending: `${BASE_URL}/cliente.html?pago=pendiente`,
      },
      auto_return: 'approved',
      notification_url: `${BASE_URL}/api/pagos/webhook`,
      metadata: {
        pedido_id:   pedidoId,
        worker_id:   workerId,
        comision:    comision,
        pago_worker: pagoWorker,
      },
    }
  });

  return {
    preference_id: result.id,
    init_point:    result.init_point,
    comision,
    pago_worker: pagoWorker,
  };
}

async function verificarPago(paymentId) {
  const payment = new Payment(client);
  const data = await payment.get({ id: paymentId });
  return {
    status:     data.status,
    monto:      data.transaction_amount,
    referencia: data.external_reference,
    metadata:   data.metadata,
  };
}

async function getPaymentDetails(paymentId) {
  const payment = new Payment(client);
  return payment.get({ id: paymentId });
}

module.exports = { crearPreferencia, verificarPago, getPaymentDetails };
