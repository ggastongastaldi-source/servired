// ── BLOQUE GR3 REFACTORIZADO: COPIAR ADENTRO DEL SCRIPT DE TRABAJADOR.HTML ──

let gr3_heartbeatInterval = null;
let gr3_reconnectAttempts = 0;
const GR3_BASE_BACKOFF_MS = 1500;
const GR3_MAX_BACKOFF_MS  = 12000;

async function gr3_fetchReconnectToken() {
  try {
    // Tomamos las credenciales base globales de tu HTML
    const workerId = localStorage.getItem('gr3_workerId') || (typeof WORKER_ID !== 'undefined' ? WORKER_ID : null);
    if (!workerId) return null;

    console.log('🩸 [GR3] Solicitando pasaporte fresco a la API...');
    const res = await fetch('/api/workers/session', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json'
        // Si usas JWT dinámico inyectalo acá: 'Authorization': 'Bearer ' + TOKEN 
      },
      body: JSON.stringify({ workerId })
    });
    
    const data = await res.json();
    if (data.ok && data.reconnectToken) {
      localStorage.setItem('gr3_reconnectToken', data.reconnectToken);
      localStorage.setItem('gr3_reconnectTokenVersion', data.reconnectTokenVersion);
      localStorage.setItem('gr3_workerId', data.workerId);
      console.log('🩸 [GR3] Pasaporte guardado. Token versión: ' + data.reconnectTokenVersion);
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
    if (!data) {
      // Fallback fallback: reintentar con el algoritmo de backoff si la API de sesión se cae
      gr3_scheduleRetry(socketInstance);
      return;
    }
    return gr3_restoreSession(socketInstance);
  }

  // Medición de latencia básica antes de mandar el payload
  const startTime = Date.now();

  socketInstance.emit('worker:restore-session', {
    workerId,
    reconnectToken,
    reconnectTokenVersion: parseInt(reconnectTokenVersion, 10),
    runtimeData: {
      platform:     navigator.userAgent,
      networkType:  navigator.connection?.effectiveType || 'unknown',
      appVersion:   '3.0.0',
      batteryLevel: typeof currentBatteryLevel !== 'undefined' ? currentBatteryLevel : null,
      gpsAccuracy:  typeof currentGpsAccuracy  !== 'undefined' ? currentGpsAccuracy  : null,
      latencyMs:    (Date.now() - startTime)
    }
  }, (ack) => {
    if (!ack) {
      gr3_scheduleRetry(socketInstance);
      return;
    }

    if (ack.ok) {
      console.log('🩸 [GR3] Sesión Restaurada con éxito total. FSM State: ' + ack.fsmState + ' v=' + ack.sessionVersion);
      gr3_reconnectAttempts = 0; // Limpiamos intentos en éxito
      
      if (ack.reliabilityFlags?.length) {
        console.warn('🩸 [GR3] Advertencias de confiabilidad en este dispositivo:', ack.reliabilityFlags);
      }
      
      gr3_startHeartbeat(socketInstance);

    } else if (ack.reason === 'TOKEN_VERSION_MISMATCH' || ack.reason === 'INVALID_TOKEN_OR_EXPIRED') {
      console.warn('🩸 [GR3] Pasaporte obsoleto o comprometido (' + ack.reason + '). Forzando renovación atómica...');
      localStorage.removeItem('gr3_reconnectToken');
      localStorage.removeItem('gr3_reconnectTokenVersion');
      
      gr3_fetchReconnectToken().then((freshData) => {
        if (freshData) gr3_restoreSession(socketInstance);
        else gr3_scheduleRetry(socketInstance);
      });

    } else {
      console.error('🩸 [GR3] Rechazo del Servidor por causa:', ack.reason);
      gr3_scheduleRetry(socketInstance);
    }
  });
}

function gr3_scheduleRetry(socketInstance) {
  // Algoritmo de Backoff Exponencial con Jitter para mitigar Thundering Herd
  const baseDelay = Math.min(GR3_BASE_BACKOFF_MS * Math.pow(2, gr3_reconnectAttempts), GR3_MAX_BACKOFF_MS);
  const jitter    = Math.random() * 1000; // Ventana de dispersión de 1 segundo
  const finalDelay = baseDelay + jitter;

  gr3_reconnectAttempts++;
  console.log('🩸 [GR3] Reintento de conexión programado en ' + Math.round(finalDelay) + 'ms (Intento #' + gr3_reconnectAttempts + ')');
  
  setTimeout(() => {
    if (!socketInstance.connected) {
      socketInstance.connect();
    }
  }, finalDelay);
}

function gr3_startHeartbeat(socketInstance) {
  if (gr3_heartbeatInterval) clearInterval(gr3_heartbeatInterval);
  
  const workerId = localStorage.getItem('gr3_workerId');
  if (!workerId) return;

  gr3_heartbeatInterval = setInterval(() => {
    // Guard de seguridad del timer: si el transporte cayó, suspender latidos
    if (!socketInstance.connected) {
      console.log('🩸 [GR3] Heartbeat omitido: Socket desconectado.');
      return;
    }
    socketInstance.emit('worker:heartbeat', { workerId });
  }, 20000);
}

function gr3_cleanTimers() {
  if (gr3_heartbeatInterval) {
    clearInterval(gr3_heartbeatInterval);
    gr3_heartbeatInterval = null;
    console.log('🩸 [GR3] Timers y heartbeats purgados del runtime de la vista.');
  }
}

// ── CONFIGURACIÓN DEL MANAGER DE SOCKET.IO ──
// Unificá tus listeners en una sola instancia compacta:
const socket = io({
  autoConnect: false, // Controlamos el inicio nosotros vía GR3
  reconnection: false // Desactivamos el reintento nativo tonto para usar nuestro Backoff con Jitter
});

socket.on('connect', () => {
  console.log('🩸 [GR3] Canal de transporte TCP abierto. Iniciando protocolo de restauración...');
  gr3_restoreSession(socket);
});

socket.on('disconnect', (reason) => {
  console.warn('🩸 [GR3] Canal de transporte cerrado. Razón:', reason);
  gr3_cleanTimers();
  if (reason === 'io server disconnect' || reason === 'transport close') {
    gr3_scheduleRetry(socket);
  }
});

// Evento heredado encapsulado para mantener UI vieja funcionando
socket.on('worker:heartbeat_ack', (data) => {
  // console.log('Latido confirmado', data.timestamp);
});

// Arrancamos el ciclo de vida GR3
if (localStorage.getItem('gr3_workerId')) {
  socket.connect();
}
