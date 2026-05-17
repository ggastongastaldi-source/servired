#!/data/data/com.termux/files/usr/bin/bash
# Watchdog ServiRed — solo cuida a Node, no al túnel
# Uso: ./watchdog.sh &

LOG=~/servired/watchdog.log
PUERTO=3000
FALLOS=0
MAX_FALLOS=4

echo "$(date) ▶ Watchdog iniciado." >> "$LOG"

while true; do
  HTTP=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$PUERTO/health" 2>/dev/null)

  if [ "$HTTP" = "200" ]; then
    [ "$FALLOS" -gt 0 ] && echo "$(date) ✅ Node vivo tras $FALLOS fallos." >> "$LOG"
    FALLOS=0
  else
    FALLOS=$((FALLOS + 1))
    echo "$(date) ⚠️  /health = $HTTP. Fallo $FALLOS/$MAX_FALLOS" >> "$LOG"

    if [ "$FALLOS" -ge "$MAX_FALLOS" ]; then
      echo "$(date) 🔴 Reiniciando Node..." >> "$LOG"
      pkill -f "node server.js" 2>/dev/null
      sleep 2
      cd ~/servired && node server.js >> ~/servired/server.log 2>&1 &
      echo "$(date) 🟢 Node relanzado PID=$!" >> "$LOG"
      FALLOS=0
      sleep 20
    fi
  fi

  sleep 30
done
