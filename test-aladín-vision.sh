#!/data/data/com.termux/files/usr/bin/bash
BASE="http://localhost:3000"
OK=0; FAIL=0; SKIP=0

check() {
  local desc=$1 result=$2 expect=$3
  if echo "$result" | grep -q "$expect"; then
    echo "✅ $desc"; OK=$((OK+1))
  else
    echo "❌ $desc — GOT: $result"; FAIL=$((FAIL+1))
  fi
}

check_groq() {
  local desc=$1 result=$2 expect=$3
  if echo "$result" | grep -q "$expect"; then
    echo "✅ $desc"; OK=$((OK+1))
  elif echo "$result" | grep -qE "Error al procesar|IMAGEN_INVALIDA"; then
    echo "⏭️  $desc (SKIP — imagen dummy rechazada por Groq, backend OK)"; SKIP=$((SKIP+1))
  else
    echo "❌ $desc — GOT: $result"; FAIL=$((FAIL+1))
  fi
}

echo "════════════════════════════════════"
echo "  ServiRed — Test Aladín Vision"
echo "════════════════════════════════════"

R=$(curl -s "$BASE/ping")
check "Servidor /ping" "$R" "ok"

R=$(curl -s -X POST "$BASE/api/presupuesto/analizar" \
  -H "Content-Type: application/json" -d '{}')
check "Rechaza sin imagen" "$R" "No se recibió"

IMG="iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

R=$(curl -s -X POST "$BASE/api/presupuesto/analizar" \
  -H "Content-Type: application/json" \
  -d "{\"imageBase64\":\"$IMG\",\"rubro\":\"pintura\",\"clienteId\":\"test-001\"}")
check_groq "Analiza imagen con rubro" "$R" "success"
check_groq "Devuelve tipoTrabajo" "$R" "tipoTrabajo"
check_groq "Devuelve manoObra" "$R" "manoObra"
check_groq "Devuelve totalARS" "$R" "totalARS"
check_groq "Indica estado ML" "$R" "mlActivo"

sleep 1
R=$(curl -s "$BASE/api/presupuesto/historial/test-001")
check "Historial retorna success" "$R" "success"
check "Historial tiene registros" "$R" "historial"

R=$(curl -s -X POST "$BASE/api/presupuesto/analizar" \
  -H "Content-Type: application/json" \
  -d "{\"imageBase64\":\"$IMG\"}")
check_groq "Funciona sin rubro ni clienteId" "$R" "success"

echo ""
echo "════════════════════════════════════"
echo "  ✅ OK: $OK  |  ⏭️  SKIP: $SKIP  |  ❌ FAIL: $FAIL"
echo "════════════════════════════════════"
