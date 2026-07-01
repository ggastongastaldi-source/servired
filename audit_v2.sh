#!/bin/bash
OUT=~/servired/audit_v2.md
echo "# AUDITORÍA V2 — Médico/Police/Fiscal/Defensor/Juez/Jurisprudencia" > $OUT
echo "Generado: $(date)" >> $OUT

echo -e "\n## /api/health completo (candidato a 'Médico del Sistema')" >> $OUT
cat ./routes/health.js >> $OUT 2>&1

echo -e "\n## ¿Existe algún modelo o servicio de 'Case', 'Incident', 'Diagnostico'?" >> $OUT
find . -path ./node_modules -prune -o -iregex ".*\(case\|incident\|diagnostico\).*\.js" -print 2>/dev/null >> $OUT

echo -e "\n## ¿Existe algún 'runbook', 'autofix', 'autoheal', 'recovery'?" >> $OUT
find . -path ./node_modules -prune -o -iregex ".*\(runbook\|autofix\|autoheal\|recovery\).*\.js" -print 2>/dev/null >> $OUT
grep -rln "runbook\|autoheal\|autofix" --include="*.js" . 2>/dev/null | grep -v node_modules >> $OUT

echo -e "\n## GlobuloRojo watchdog — qué monitorea" >> $OUT
cat ./globuloRojo/watchdog.js >> $OUT 2>&1 | head -60

echo -e "\n## FinanceWatchdog — patrón de auditoría periódica (posible plantilla para Médico)" >> $OUT
head -40 ./src/core/services/financeWatchdog.js >> $OUT 2>&1

echo -e "\n## ¿Hay chequeo de servicios externos (Google OAuth, Mercado Pago) en algún lado?" >> $OUT
grep -rln "GOOGLE_CLIENT_ID\|mercadopago\|MercadoPago" --include="*.js" . 2>/dev/null | grep -v node_modules | grep -v node_modules >> $OUT

echo -e "\n## PolicyFinding — ¿tiene ya noción de agrupación/Case, o es solo finding individual?" >> $OUT
grep -n "Case\|caseId\|agrupa" ./src/sinapsis/dixieTerminal/*.js 2>/dev/null >> $OUT

cat $OUT
