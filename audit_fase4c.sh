#!/bin/bash
OUT=~/servired/audit_fase4c.md
echo "# AUDITORÍA FASE IV-C — Verificación final" > $OUT
echo "Generado: $(date)" >> $OUT

echo -e "\n## ¿policyEvaluator (Aladdín Kernel v2) referenciado dinámicamente en algún lado?" >> $OUT
grep -rn "policyEvaluator\|PolicyEvaluator" --include="*.js" . 2>/dev/null | grep -v node_modules | grep -v "^./services/policyEvaluator.js" | grep -v "^./src/core/services/policyEvaluator.js"

echo -e "\n## Contenido completo de src/core/services/policyEvaluator.js (primeras 15 líneas, para confirmar identidad)" >> $OUT
head -15 ./src/core/services/policyEvaluator.js >> $OUT 2>&1

echo -e "\n## ¿Quién usa priceCents / breakdown / applyActions estilo Aladdin Kernel v2?" >> $OUT
grep -rln "priceCents\|applyActions" --include="*.js" . 2>/dev/null | grep -v node_modules >> $OUT

echo -e "\n## admin.js — rutas completas expuestas (candidatas a reuso SOC)" >> $OUT
grep -n "router\.\(get\|post\|put\|delete\)" ./src/core/routes/admin.js >> $OUT 2>&1

echo -e "\n## nexus/dixie/gate.js — primeras 30 líneas (DixieGate real)" >> $OUT
find . -path ./node_modules -prune -o -path "*/nexus/dixie/gate.js" -print 2>/dev/null >> $OUT
head -30 ./nexus/dixie/gate.js >> $OUT 2>&1

echo -e "\n## src/sinapsis/dixieTerminal/circuitBreaker.js — ¿quién lo llama en runtime real (fuera de tests)?" >> $OUT
grep -rn "evaluateCircuitBreaker" --include="*.js" . 2>/dev/null | grep -v node_modules | grep -v __tests__ >> $OUT

echo -e "\n## routes/gia.js — ¿está montado en server.js?" >> $OUT
grep -n "routes/gia'\|routes/gia\"" server.js >> $OUT 2>&1

echo -e "\n## Huérfanos confirmados: ¿algo requiere estos 3 archivos?" >> $OUT
for f in "nexus/eventstore/emitEvent.js" "nexus/shared/dixieGate.js" "src/core/services/analyticsService.js" "src/sinapsis/dixieGate.js"; do
  echo "--- $f ---" >> $OUT
  base=$(basename "$f" .js)
  grep -rn "require(.*$base" --include="*.js" . 2>/dev/null | grep -v node_modules | grep -v "$f:" >> $OUT
done

cat $OUT
