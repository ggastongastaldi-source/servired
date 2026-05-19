// ── BLOQUE GR3 REFACTORIZADO V3.1: WATCHDOG DE TELEMETRÍA MÓVIL ──
let gr3_heartbeatInterval = null;
let gr3_reconnectAttempts = 0;
const GR3_BASE_BACKOFF_MS = 1500;
const GR3_MAX_BACKOFF_MS  = 12000;

// Variables de estado del Watchdog local
let localTelemetry = {
  batteryLevel: null,
  networkType: 'unknown',
  gpsAccuracy: null,
  lastReadAt: 0
};

// Inicializar capturadores nativos del celular
if (navigator.getBattery) {
  navigator.getBattery().then(battery => {
    const updateBattery = () => {
      localTelemetry.batteryLevel = Math.round(battery.level * 100);
      localTelemetry.lastReadAt = Date.now();
    };
    updateBattery();
    battery.onlevelchange = updateBattery;
    battery.onchargingchange = updateBattery;
  });
}

function updateNetworkInfo() {
  localTelemetry.networkType = navigator.connection?.effectiveType || 'unknown';
  localTelemetry.lastReadAt = Date.now();
}
if (navigator.connection) {
  navigator.connection.onchange = updateNetworkInfo;
  updateNetworkInfo();
}

// Watchdog de verificación de frescura (Máximo 15 segundos de antigüedad)
function gr3_isTelemetryFresh() {
  const age = Date.now() - localTelemetry.lastReadAt;
  return (localTelemetry.batteryLevel !== null && age < 15000);
}

async function gr3_fetchReconnectToken() {
  try {
    const workerId = localStorage.getItem('gr3_workerId') || (typeof WORKER_ID !== 'undefined' ? WORKER_ID : null);
    if (!workerId) return null;
    
    const res = await fetch('/api/workers/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workerId })
    });
    const data = await res.json();
    if (data.ok && data.reconnectToken) {
      localStorage.setItem('gr3_reconnectToken', data.reconnectToken);
      localStorage.setItem('gr3_reconnectTokenVersion', data.reconnectTokenVersion);
      localStorage.setItem('gr3_workerId', data.workerId);
      return data;
    }
  } catch (e) {
    console.warn('🩸 [GR3] Error en fetchReconnectToken:', e.message);
  }
  return null;
}

async function gr3_restoreSession(socketInstance) {
  const reconnectToken        = localStorage.getItem('gr3_reconnectToken');
  const reconnectTokenVersion = localStorage.getItem('gr3_reconnectTokenVersion');
  const workerId              = localStorage.getItem('gr3_workerId') || (typeof WORKER_ID !== 'undefined' ? WORKER_ID : null);

  if (!reconnectToken || reconnectTokenVersion == null || !workerId) {
    const data = await gr3_fetchReconnectToken();
    if (!data) return gr3_scheduleRetry(socketInstance);
    return gr3_restoreSession(socketInstance);
  }

  // Si el Watchdog detecta telemetría sucia o ausente, marcamos el flag localmente antes de enviar
  const telemetryFresh = gr3_isTelemetryFresh();
  const flagsEnviados = [];
  if (!telemetryFresh) flagsEnviados.push('TELEMETRY_STALE');

  const startTime = Date.now();
  
  socketInstance.emit('worker:restore-session', {
    workerId,
    reconnectToken,
    reconnectTokenVersion: parseInt(reconnectTokenVersion, 10),
    runtimeData: {
      platform: navigator.userAgent,
      networkType: localTelemetry.networkType,
      appVersion: '3.1.0',
      batteryLevel: localTelemetry.batteryLevel,
      gpsAccuracy: typeof currentGpsAccuracy !== 'undefined' ? currentGpsAccuracy : null,
      latencyMs: (Date.now() - startTime),
      forcedFlags: flagsEnviados
    }
  }, (ack) => {
    if (!ack) return gr3_scheduleRetry(socketInstance);
    
    if (ack.ok) {
      console.log('🩸 [GR3] Conexión autorizada por el Servidor. FSM:', ack.fsmState);
      gr3_reconnectAttempts = 0;
      gr3_startHeartbeat(socketInstance);
    } else if (ack.reason === 'TOKEN_VERSION_MISMATCH' || ack.reason === 'INVALID_TOKEN_OR_EXPIRED') {
      localStorage.removeItem('gr3_reconnectToken');
      localStorage.removeItem('gr3_reconnectTokenVersion');
      gr3_fetchReconnectToken().then(fresh => fresh ? gr3_restoreSession(socketInstance) : gr3_scheduleRetry(socketInstance));
    } else {
      gr3_scheduleRetry(socketInstance);
    }
  });
}

function gr3_scheduleRetry(socketInstance) {
  const baseDelay = Math.min(GR3_BASE_BACKOFF_MS * Math.pow(2, gr3_reconnectAttempts), GR3_MAX_BACKOFF_MS);
  const jitter = Math.random() * 1000;
  const finalDelay = baseDelay + jitter;
  gr3_reconnectAttempts++;
  setTimeout(() => { if (!socketInstance.connected) socketInstance.connect(); }, finalDelay);
}

function gr3_startHeartbeat(socketInstance) {
  if (gr3_heartbeatInterval) clearInterval(gr3_heartbeatInterval);
  const workerId = localStorage.getItem('gr3_workerId');
  if (!workerId) return;

  gr3_heartbeatInterval = setInterval(() => {
    if (!socketInstance.connected) return;
    
    // El heartbeat inyecta telemetría viva en cada latido
    socketInstance.emit('worker:heartbeat', { 
      workerId,
      telemetry: {
        batteryLevel: localTelemetry.batteryLevel,
        networkType: localTelemetry.networkType,
        gpsAccuracy: typeof currentGpsAccuracy !== 'undefined' ? currentGpsAccuracy : null,
        isFresh: gr3_isTelemetryFresh()
      }
    });
  }, 12000); // 12 segundos entre latidos
}

function gr3_cleanTimers() {
  if (gr3_heartbeatInterval) { clearInterval(gr3_heartbeatInterval); gr3_heartbeatInterval = null; }
}

const socket = io({ autoConnect: false, reconnection: false });
socket.on('connect', () => { gr3_restoreSession(socket); });
socket.on('disconnect', (reason) => { gr3_cleanTimers(); if (reason !== 'io client disconnect') gr3_scheduleRetry(socket); });

if (localStorage.getItem('gr3_workerId')) { socket.connect(); }
