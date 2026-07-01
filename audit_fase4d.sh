#!/bin/bash
OUT=~/servired/audit_fase4d.md
echo "# AUDITORÍA FASE IV-D — Insumos para SOC Bloque 2 (Dixie Terminal)" > $OUT
echo "Generado: $(date)" >> $OUT

echo -e "\n## Implementación completa: GET /circuit-breaker en admin.js" >> $OUT
sed -n '114,123p' ./src/core/routes/admin.js >> $OUT

echo -e "\n## Implementación completa: GET /chaos/faults" >> $OUT
sed -n '183,198p' ./src/core/routes/admin.js >> $OUT

echo -e "\n## Modelo PolicyFinding" >> $OUT
find . -path ./node_modules -prune -o -iname "PolicyFinding.js" -print -exec cat {} \; 2>/dev/null >> $OUT

echo -e "\n## Modelo SystemState" >> $OUT
find . -path ./node_modules -prune -o -iname "SystemState.js" -print -exec cat {} \; 2>/dev/null >> $OUT

echo -e "\n## dixieScanner.js completo (cómo arma openFindings/getState)" >> $OUT
cat ./src/sinapsis/dixieTerminal/dixieScanner.js >> $OUT 2>&1

echo -e "\n## ¿Quién llama a dixieScanner? (¿corre en cron, endpoint, o solo se invoca manual?)" >> $OUT
grep -rn "dixieScanner\|require.*dixieScanner" --include="*.js" . 2>/dev/null | grep -v node_modules | grep -v "^./src/sinapsis/dixieTerminal/dixieScanner.js"

cat $OUT
