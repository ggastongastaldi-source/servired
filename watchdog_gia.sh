#!/data/data/com.termux/files/usr/bin/bash
# ═══════════════════════════════════════════
# WATCHDOG + GIA — ServiRed Auto-Healing
# ═══════════════════════════════════════════

LOG=/data/data/com.termux/files/home/servired/watchdog.log
SERVER_LOG=/data/data/com.termux/files/home/servired/server.log
PUERTO=3000
FALLOS=0
MAX_FALLOS=4

echo "$(date) ▶ Watchdog+GIA iniciado." >> "$LOG"

extraer_culpable() {
  # Busca la primera línea del stack trace que apunte a /servired/
  grep -o '/data/data/com.termux/files/home/servired/[^:]*' "$SERVER_LOG" \
    | grep -v node_modules \
    | tail -5 \
    | head -1
}

extraer_error() {
  # Busca TypeError, SyntaxError, ReferenceError, etc.
  grep -oE '(TypeError|SyntaxError|ReferenceError|RangeError|Error): .{0,120}' "$SERVER_LOG" \
    | tail -1
}

disparar_gia() {
  local archivo="$1"
  local error="$2"

  if [ -z "$archivo" ] || [ ! -f "$archivo" ]; then
    echo "$(date) ⚠️  GIA: archivo culpable no identificado" >> "$LOG"
    return
  fi

  echo "$(date) 🧠 GIA analizando: $archivo" >> "$LOG"
  echo "$(date) 📋 Error: $error" >> "$LOG"

  # Ejecutar GIA y loguear resultado
  node ~/servired/gia.js "$archivo" "$error" >> "$LOG" 2>&1
  echo "$(date) ✅ GIA completado" >> "$LOG"
}

while true; do
  HTTP=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$PUERTO/health" 2>/dev/null)

  if [ "$HTTP" = "200" ]; then
    [ "$FALLOS" -gt 0 ] && echo "$(date) ✅ Node vivo tras $FALLOS fallos." >> "$LOG"
    FALLOS=0
  else
    FALLOS=$((FALLOS + 1))
    echo "$(date) ⚠️  /health=$HTTP Fallo $FALLOS/$MAX_FALLOS" >> "$LOG"

    if [ "$FALLOS" -ge "$MAX_FALLOS" ]; then
      echo "$(date) 🔴 Crash confirmado. Activando GIA..." >> "$LOG"

      # Extraer info del crash ANTES de matar el proceso
      ARCHIVO=$(extraer_culpable)
      ERROR=$(extraer_error)

      # Disparar GIA
      disparar_gia "$ARCHIVO" "$ERROR"

      # Reiniciar Node
      pkill -f "node server.js" 2>/dev/null
      sleep 2
      cd ~/servired && node server.js >> "$SERVER_LOG" 2>&1 &
      echo "$(date) 🟢 Node relanzado PID=$!" >> "$LOG"
      FALLOS=0
      sleep 20
    fi
  fi

  sleep 30
done
