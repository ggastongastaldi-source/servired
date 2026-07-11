#!/data/data/com.termux/files/usr/bin/bash

echo "🚀 ServiRed SAFE MODE"

while true; do
  fuser -k 3000/tcp 2>/dev/null || true
  sleep 1
  node server.js
  echo "⚠️ crash detectado → restart en 3s"
  sleep 3
done
