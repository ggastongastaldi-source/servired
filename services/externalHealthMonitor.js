// externalHealthMonitor.js — Capa 1: Sensores (extensión del Médico)
// Chequea disponibilidad de integraciones externas (Google OAuth, Mercado Pago)
// SIN duplicar configuración: reutiliza los mismos env vars que ya usan
// auth.js (GOOGLE_CLIENT_ID) y mercadoPagoService.js (MP_ACCESS_TOKEN).
//
// Corre en intervalo propio (no en cada request a /api/health) y cachea
// el resultado en memoria — mismo patrón anti-solapamiento que FinanceWatchdog.
// Nunca crea preferencias ni intenta login real: solo mide disponibilidad.

const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutos
const TIMEOUT_MS = 3000;

let _running = false;
let _snapshot = {
  googleOAuth: { status: 'UNKNOWN', latencyMs: null, lastChecked: null, error: null },
  mercadoPago: { status: 'UNKNOWN', latencyMs: null, lastChecked: null, error: null },
};

function _fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
}

async function checkGoogleOAuth() {
  const start = Date.now();
  if (!process.env.GOOGLE_CLIENT_ID) {
    return { status: 'DOWN', latencyMs: 0, lastChecked: new Date().toISOString(), error: 'CONFIG_MISSING: GOOGLE_CLIENT_ID no definido' };
  }
  try {
    const res = await _fetchWithTimeout('https://accounts.google.com/.well-known/openid-configuration');
    const latencyMs = Date.now() - start;
    if (!res.ok) {
      return { status: 'DOWN', latencyMs, lastChecked: new Date().toISOString(), error: `HTTP ${res.status}` };
    }
    return { status: 'UP', latencyMs, lastChecked: new Date().toISOString(), error: null };
  } catch (e) {
    return { status: 'DOWN', latencyMs: Date.now() - start, lastChecked: new Date().toISOString(), error: e.name === 'AbortError' ? 'TIMEOUT' : e.message };
  }
}

async function checkMercadoPago() {
  const start = Date.now();
  if (!process.env.MP_ACCESS_TOKEN) {
    return { status: 'DOWN', latencyMs: 0, lastChecked: new Date().toISOString(), error: 'CONFIG_MISSING: MP_ACCESS_TOKEN no definido' };
  }
  try {
    // Endpoint público de solo lectura — no crea ni modifica nada, mide conectividad real.
    const res = await _fetchWithTimeout('https://api.mercadopago.com/v1/payment_methods', {
      headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` }
    });
    const latencyMs = Date.now() - start;
    if (!res.ok) {
      return { status: res.status === 401 ? 'DOWN' : 'DEGRADED', latencyMs, lastChecked: new Date().toISOString(), error: `HTTP ${res.status}` };
    }
    return { status: 'UP', latencyMs, lastChecked: new Date().toISOString(), error: null };
  } catch (e) {
    return { status: 'DOWN', latencyMs: Date.now() - start, lastChecked: new Date().toISOString(), error: e.name === 'AbortError' ? 'TIMEOUT' : e.message };
  }
}

async function runChecks() {
  if (_running) {
    console.log('[ExternalHealthMonitor] Ejecución solapada — saltando ciclo');
    return;
  }
  _running = true;
  try {
    const [google, mp] = await Promise.all([checkGoogleOAuth(), checkMercadoPago()]);
    _snapshot = { googleOAuth: google, mercadoPago: mp };
  } catch (e) {
    console.error('[ExternalHealthMonitor] Error en ciclo:', e.message);
  } finally {
    _running = false;
  }
}

function getSnapshot() {
  return _snapshot;
}

function start() {
  console.log('[ExternalHealthMonitor] Iniciado — chequeo cada 5 min (Google OAuth + Mercado Pago)');
  runChecks(); // primera corrida inmediata
  const timer = setInterval(runChecks, CHECK_INTERVAL_MS);
  if (timer.unref) timer.unref();
}

module.exports = { start, runChecks, getSnapshot, checkGoogleOAuth, checkMercadoPago };
