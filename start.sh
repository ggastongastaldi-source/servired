#!/data/data/com.termux/files/usr/bin/bash
cd ~/servired

while true; do
  echo "[$(date)] Iniciando server.js..."
  node server.js &
  NODE_PID=$!
  sleep 3

  echo "[$(date)] Iniciando cloudflared..."
  cloudflared tunnel --url http://localhost:3000 2>&1 | tee ~/cf-tunnel.log &
  CF_PID=$!
  sleep 5

  URL=$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' ~/cf-tunnel.log | head -1)
  echo ""
  echo "========================================"
  echo "URL ACTIVA: $URL"
  echo "========================================"

  # Esperar a que cloudflared muera
  wait $CF_PID
  echo "[$(date)] cloudflared muerto. Reiniciando en 5 segundos..."
  kill $NODE_PID 2>/dev/null
  sleep 5
done
