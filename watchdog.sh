#!/data/data/com.termux/files/usr/bin/bash
# ═══════════════════════════════════════════
# WATCHDOG EXTERNO — ServiRed Termux
# Uso: ./watchdog.sh &
# Log: ~/servired/watchdog.log
# ═══════════════════════════════════════════

LOG=~/servired/watchdog.log
PUERTO=3000
REINTENTOS=0
MAX_REINTENTOS=5

echo "$(date) ▶ Watchdog iniciado." >> "$LOG"

while true; do
    # Chequeo de salud
    HTTP=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$PUERTO/health" 2>/dev/null)

    if [ "$HTTP" != "200" ]; then
        REINTENTOS=$((REINTENTOS + 1))
        echo "$(date) ⚠️  ServiRed NO responde (HTTP $HTTP). Intento $REINTENTOS/$MAX_REINTENTOS" >> "$LOG"

        if [ "$REINTENTOS" -ge "$MAX_REINTENTOS" ]; then
            echo "$(date) 🔴 MAX reintentos alcanzado. Matando proceso..." >> "$LOG"
            pkill -f "node server.js"
            sleep 3
            cd ~/servired && node server.js >> ~/servired/server.log 2>&1 &
            echo "$(date) 🟢 ServiRed relanzado. PID: $!" >> "$LOG"
            REINTENTOS=0
            sleep 25  # Tiempo para que levante del todo
        fi
    else
        if [ "$REINTENTOS" -gt 0 ]; then
            echo "$(date) ✅ ServiRed vivo de nuevo tras $REINTENTOS fallas." >> "$LOG"
        fi
        REINTENTOS=0
    fi

    sleep 60
done
