#!/bin/bash
OUT=~/servired/audit_fase4b.md
DUPES="AnalyticsService.js dixieGate.js policyEngine.js policyEvaluator.js engine.js emitEvent.js catalogo.js circuitBreaker.js auth.js gia.js aladdinEngine.js"

echo "# AUDITORÍA FASE IV-B — Grafo de dependencias activas" > $OUT
echo "Generado: $(date)" >> $OUT

echo -e "\n## REQUIRES ACTIVOS DESDE server.js" >> $OUT
grep -n "require(" server.js >> $OUT

echo -e "\n## REQUIRES ACTIVOS DESDE runtime/index.js" >> $OUT
grep -n "require(" runtime/index.js >> $OUT

echo -e "\n## src/core/routes/admin.js — ¿está montado en server.js?" >> $OUT
grep -n "admin" server.js >> $OUT

for f in $DUPES; do
  echo -e "\n## $f" >> $OUT
  echo "--- ubicaciones ---" >> $OUT
  find . -path ./node_modules -prune -o -iname "$f" -print 2>/dev/null >> $OUT
  echo "--- referenciado por (quién lo requiere) ---" >> $OUT
  grep -rn "require(.*$f\|require(.*${f%.js}'\|require(.*${f%.js}\"" --include="*.js" . 2>/dev/null | grep -v node_modules >> $OUT
done

echo -e "\n## DIFF de duplicados (si hay exactamente 2 ubicaciones)" >> $OUT
for f in $DUPES; do
  paths=($(find . -path ./node_modules -prune -o -iname "$f" -print 2>/dev/null))
  if [ ${#paths[@]} -eq 2 ]; then
    echo -e "\n--- diff $f ---" >> $OUT
    diff "${paths[0]}" "${paths[1]}" >> $OUT 2>&1
  fi
done

cat $OUT
