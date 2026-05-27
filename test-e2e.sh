#!/bin/bash
BASE="https://servired-6e5r.onrender.com"
PASS=0; FAIL=0; LOG=""
ok()  { echo "✅ $1"; PASS=$((PASS+1)); }
fail(){ echo "❌ $1"; FAIL=$((FAIL+1)); LOG="$LOG\n❌ $1"; }

echo ""; echo "══════════════════════════════════════"
echo "   SERVIRED — TEST E2E v3"
echo "══════════════════════════════════════"; echo ""

echo "── [1] HEALTH ──"
for path in "/" "/cliente.html" "/trabajador.html" "/admin.html"; do
  R=$(curl -s -o /dev/null -w "%{http_code}" $BASE$path)
  [ "$R" = "200" ] && ok "$path → 200" || fail "$path → $R"
done

echo ""; echo "── [2] AUTH ──"
RCLIENTE=$(curl -s -X POST $BASE/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"cliente@servired.com","password":"cliente123"}')
TOKEN_CLIENTE=$(echo $RCLIENTE | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))" 2>/dev/null)
[ -n "$TOKEN_CLIENTE" ] && ok "Login cliente OK" || fail "Login cliente falló: $RCLIENTE"

RDEBORA=$(curl -s -X POST $BASE/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"debora.rouiller.1@gmail.com","password":"debora123"}')
TOKEN_DEBORA=$(echo $RDEBORA | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))" 2>/dev/null)
[ -n "$TOKEN_DEBORA" ] && ok "Login Débora OK" || fail "Login Débora falló"

RADMIN=$(curl -s -X POST $BASE/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"gaston@servired.com","password":"admin123"}')
TOKEN_ADMIN=$(echo $RADMIN | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))" 2>/dev/null)
[ -n "$TOKEN_ADMIN" ] && ok "Login admin OK" || fail "Login admin falló"

if [ -n "$TOKEN_DEBORA" ]; then
  PAYLOAD=$(echo $TOKEN_DEBORA | cut -d. -f2 | python3 -c "
import sys,base64,json
p=sys.stdin.read().strip()
p+='='*(4-len(p)%4)
print(json.dumps(json.loads(base64.b64decode(p))))
")
  UID=$(echo $PAYLOAD | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id') or d.get('userId',''))" 2>/dev/null)
  ROL=$(echo $PAYLOAD | python3 -c "import sys,json; print(json.load(sys.stdin).get('rol',''))" 2>/dev/null)
  [ -n "$UID" ] && ok "JWT Débora userId: ${UID:0:12}..." || fail "JWT Débora sin userId"
  [ "$ROL" = "TRABAJADOR" ] && ok "JWT Débora rol: TRABAJADOR" || fail "JWT rol incorrecto: $ROL"
fi

echo ""; echo "── [3] SMART QUOTE ──"
SQ=$(curl -s -X POST $BASE/api/smart-quote \
  -H "Content-Type: application/json" \
  -d '{"rubro":"servicio_domestico","zona":"la_matanza","horas":1}')
OK_SQ=$(echo $SQ | python3 -c "import sys,json; print(json.load(sys.stdin).get('ok',False))" 2>/dev/null)
PRECIO=$(echo $SQ | python3 -c "import sys,json; print(json.load(sys.stdin).get('precioCliente',0))" 2>/dev/null)
[ "$OK_SQ" = "True" ] && ok "SmartQuote OK" || fail "SmartQuote falló"
python3 -c "exit(0 if 5000<=int('${PRECIO:-0}')<=80000 else 1)" 2>/dev/null \
  && ok "Precio doméstico en rango: \$$PRECIO ARS" \
  || fail "Precio fuera de rango: \$$PRECIO ARS"

echo ""; echo "── [4] PEDIDO ──"
if [ -n "$TOKEN_CLIENTE" ]; then
  PEDIDO=$(curl -s -X POST $BASE/api/pedidos \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN_CLIENTE" \
    -d '{"tipoServicio":"servicio_domestico","descripcion":"[TEST E2E - ignorar]","direccion":"Av. Test 1234, La Matanza","zona":"la_matanza","lat":-34.6691,"lng":-58.5272,"horas":1}')
  OK_PED=$(echo $PEDIDO | python3 -c "import sys,json; print(json.load(sys.stdin).get('ok',False))" 2>/dev/null)
  PID=$(echo $PEDIDO | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('pedido',{}).get('_id','') or d.get('_id',''))" 2>/dev/null)
  [ "$OK_PED" = "True" ] && ok "Crear pedido OK (${PID:0:12}...)" || fail "Crear pedido falló: $PEDIDO"
else
  fail "Sin token cliente — saltando pedido"
fi

echo ""; echo "── [5] ADMIN ──"
if [ -n "$TOKEN_ADMIN" ]; then
  for ep in "/api/admin/pedidos" "/api/admin/trabajadores" "/api/admin/stats"; do
    R=$(curl -s -o /dev/null -w "%{http_code}" $BASE$ep -H "Authorization: Bearer $TOKEN_ADMIN")
    [ "$R" = "200" ] && ok "Admin $ep → 200" || fail "Admin $ep → $R"
  done
else
  fail "Sin token admin"
fi

echo ""; echo "── [6] PROTECCIÓN ──"
R=$(curl -s -o /dev/null -w "%{http_code}" $BASE/api/admin/pedidos)
[ "$R" = "401" ] && ok "Sin token → 401" || fail "Sin token → $R"
R=$(curl -s -o /dev/null -w "%{http_code}" $BASE/api/admin/pedidos -H "Authorization: Bearer fake")
[ "$R" = "401" ] && ok "Token falso → 401" || fail "Token falso → $R"

echo ""; echo "── [7] ASSETS ──"
for asset in "/js/rubros.js" "/manifest.json"; do
  R=$(curl -s -o /dev/null -w "%{http_code}" $BASE$asset)
  [ "$R" = "200" ] && ok "$asset → 200" || fail "$asset → $R"
done

echo ""; echo "══════════════════════════════════════"
echo "   RESULTADO: ✅ $PASS OK  |  ❌ $FAIL FALLOS"
echo "══════════════════════════════════════"
[ $FAIL -gt 0 ] && echo -e "\nFALLOS:\n$LOG"
echo ""
