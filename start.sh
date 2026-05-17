#!/data/data/com.termux/files/usr/bin/bash
# ServiRed — Arranque desacoplado
# Node vive independiente del túnel

LOG_CF=~/cf-tunnel.log
LOG_SV=~/servired/server.log
PUERTO=3000

echo "[$(date)] ▶ Arrancando ServiRed (modo desacoplado)..."

# ── Servidor Node: arranca UNA VEZ, no se toca más ──
pkill -f "node server.js" 2>/dev/null
sleep 1
cd ~/servired && node server.js >> "$LOG_SV" 2>&1 &
NODE_PID=$!
echo "[$(date)] ✅ Node PID=$NODE_PID"
sleep 4

# ── Túnel Cloudflare: loop independiente con backoff ──
tunnel_loop() {
  DELAY=60  # Empieza esperando 1 min antes del primer reintento
  MAX_DELAY=900  # Tope: 15 min

  while true; do
    echo "[$(date)] 🌐 Levantando túnel..." >> "$LOG_CF"
    cloudflared tunnel --url "http://localhost:$PUERTO" >> "$LOG_CF" 2>&1 &
    CF_PID=$!

    # Esperar URL activa (hasta 15 seg)
    for i in $(seq 1 15); do
      URL=$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' "$LOG_CF" | tail -1)
      [ -n "$URL" ] && break
      sleep 1
    done

    if [ -n "$URL" ]; then
      echo "[$(date)] ✅ Túnel activo: $URL" | tee -a "$LOG_CF"
      DELAY=60  # Reset backoff al conectar exitosamente
      wait $CF_PID  # Esperar que muera naturalmente
    else
      echo "[$(date)] ⚠️  Túnel no levantó, reintentando en ${DELAY}s..." >> "$LOG_CF"
      kill $CF_PID 2>/dev/null
    fi

    echo "[$(date)] 🔁 Túnel caído. Próximo intento en ${DELAY}s" >> "$LOG_CF"
    sleep $DELAY

    # Backoff exponencial con tope
    DELAY=$(( DELAY * 2 ))
    [ "$DELAY" -gt "$MAX_DELAY" ] && DELAY=$MAX_DELAY
  done
}

# Lanzar loop del túnel en background, Node sigue vivo pase lo que pase
tunnel_loop &
TUNNEL_LOOP_PID=$!
echo "[$(date)] 🔁 Loop de túnel PID=$TUNNEL_LOOP_PID"

echo ""
echo "════════════════════════════════════════"
echo "  ServiRed corriendo en localhost:$PUERTO"
echo "  URL del túnel en: $LOG_CF"
echo "  Para ver URL activa: grep trycloudflare $LOG_CF | tail -1"
echo "════════════════════════════════════════"

# Mantener el script vivo (sin matar nada)
wait $NODE_PID
echo "[$(date)] ⚠️  Node se cerró inesperadamente. Revisar $LOG_SV"
