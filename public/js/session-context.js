// SessionContext — capa mínima de estado de sesión del navegador.
//
// Centraliza TODAS las claves de sessionStorage usadas por el frontend
// de ServiRed (correlation_id del bus de eventos, último evento emitido,
// origin_ref del QR territorial) para evitar que se desparramen claves
// sueltas por distintos archivos (qr-landing.js, shell, etc.).
//
// Uso en el navegador:
//   <script src="/js/session-context.js"></script>
//   SessionContext.getCorrelationId()
//   SessionContext.recordEvent(evt)  // evt = resultado de emitX() en backend
//
// Uso en Node (tests):
//   const SessionContext = require('../../public/js/session-context');
//   (requiere mockear global.sessionStorage antes del require)
//
// Puro JS. Sin React, sin Redux, sin dependencias.

(function (global) {
  const KEYS = Object.freeze({
    CORRELATION_ID: 'correlation_id',
    LAST_EVENT: 'last_event',
    ORIGIN_REF: 'origin_ref'
  });

  function storage() {
    return global.sessionStorage;
  }

  function getItem(key) {
    try {
      const s = storage();
      return s ? s.getItem(key) : null;
    } catch (e) {
      return null;
    }
  }

  function setItem(key, value) {
    try {
      const s = storage();
      if (!s) return;
      if (value === null || value === undefined) {
        s.removeItem(key);
      } else {
        s.setItem(key, value);
      }
    } catch (e) {
      // sessionStorage puede no estar disponible (SSR, modo privado, etc.)
    }
  }

  const SessionContext = {
    KEYS,

    getCorrelationId() {
      return getItem(KEYS.CORRELATION_ID);
    },

    setCorrelationId(correlationId) {
      setItem(KEYS.CORRELATION_ID, correlationId);
    },

    getLastEvent() {
      const raw = getItem(KEYS.LAST_EVENT);
      if (!raw) return null;
      try {
        return JSON.parse(raw);
      } catch (e) {
        return null;
      }
    },

    setLastEvent(evt) {
      if (!evt) {
        setItem(KEYS.LAST_EVENT, null);
        return;
      }
      setItem(KEYS.LAST_EVENT, JSON.stringify({
        event_id: evt.event_id,
        event_type: evt.event_type
      }));
    },

    getOriginRef() {
      return getItem(KEYS.ORIGIN_REF);
    },

    setOriginRef(ref) {
      setItem(KEYS.ORIGIN_REF, ref);
    },

    /**
     * Persiste correlation_id + referencia del evento (event_id/event_type)
     * a partir de un evento recién emitido por el bus.
     * Uso típico después de llamar a emitShellOpened()/emitWalletOpened()/etc.
     */
    recordEvent(evt) {
      if (!evt) return;
      this.setCorrelationId(evt.correlation_id);
      this.setLastEvent(evt);
    },

    /**
     * Devuelve { correlationId, causation } listos para pasar como
     * `correlationId` y `causation` a cualquier emitX() del bus,
     * preservando la cadena causal de la sesión activa.
     */
    getCausalContext() {
      return {
        correlationId: this.getCorrelationId() || undefined,
        causation: this.getLastEvent() || undefined
      };
    }
  };

  global.SessionContext = SessionContext;


  // ─── AppMode Layer ───────────────────────────────────────────────────────
  // Persiste el modo activo del usuario (cliente/tecnico/comercio) en
  // localStorage para que el home y el FAB se adapten entre sesiones.
  // No reemplaza correlation_id ni los eventos del bus. Son capas distintas.

  const AppMode = {
    KEY: 'servired_app_mode',
    MODES: Object.freeze({ CLIENTE: 'cliente', TECNICO: 'tecnico', COMERCIO: 'comercio' }),

    get() {
      try { return localStorage.getItem(this.KEY) || null; } catch(e) { return null; }
    },

    set(mode) {
      try {
        if (Object.values(this.MODES).includes(mode)) {
          localStorage.setItem(this.KEY, mode);
          document.dispatchEvent(new CustomEvent('appModeChanged', { detail: { mode } }));
        }
      } catch(e) {}
    },

    clear() {
      try { localStorage.removeItem(this.KEY); } catch(e) {}
    }
  };

  global.AppMode = AppMode;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = SessionContext;
  }
})(typeof window !== 'undefined' ? window : globalThis);
