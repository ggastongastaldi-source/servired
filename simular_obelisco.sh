#!/bin/bash

# Configuración
URL="https://servired.online/api/gps/update"
ID_TRABAJADOR="OBELISCO_TEST"

# Coordenadas exactas del Obelisco
LAT=-34.6037
LNG=-58.3816

echo "🌆 Iniciando simulación en el Obelisco para $ID_TRABAJADOR..."

for i in {1..15}
do
  # Simulamos un movimiento caminando por la Av. 9 de Julio
  LAT=$(echo "$LAT + 0.0002" | bc -l)
  
  echo "📍 Enviando pulso $i: [$LAT, $LNG]"

  curl -s -X POST "$URL" \
       -H "Content-Type: application/json" \
       -d "{
         \"workerId\": \"$ID_TRABAJADOR\",
         \"lat\": $LAT,
         \"lng\": $LNG
       }" | jq .

  sleep 2
done

echo "✅ Simulación en el centro finalizada."
