#!/bin/bash
OUT=~/servired/audit_fase4.md
echo "# SERVIRED — AUDITORÍA FASE IV" > $OUT
echo "Generado: $(date)" >> $OUT

echo -e "\n## 1. READ MODELS (Projections)" >> $OUT
grep -rl "Projection\|ReadModel\|readModel" --include="*.js" . 2>/dev/null | grep -v node_modules >> $OUT

echo -e "\n## 2. ENDPOINTS ADMINISTRATIVOS" >> $OUT
find . -path ./node_modules -prune -o -iname "*admin*" -print 2>/dev/null >> $OUT
echo "--- rutas con /admin en routes/ ---" >> $OUT
grep -rn "'/admin\|\"/admin\|/api/admin" --include="*.js" routes/ 2>/dev/null >> $OUT

echo -e "\n## 3. DASHBOARDS EN public/" >> $OUT
find ./public -maxdepth 1 -iname "*.html" 2>/dev/null >> $OUT
echo "--- posibles dashboards (pulse, dashboard, panel, command, center) ---" >> $OUT
find . -path ./node_modules -prune -o -iregex ".*\(pulse\|dashboard\|panel\|command\|center\|soc\).*" -print 2>/dev/null >> $OUT

echo -e "\n## 4. REACTORS EXISTENTES" >> $OUT
grep -rl "Reactor" --include="*.js" . 2>/dev/null | grep -v node_modules >> $OUT
echo "--- registro de reactors (busco 'Reactor Layer' o 'registerReactor') ---" >> $OUT
grep -rn "Reactor Layer\|registerReactor\|reactor.register" --include="*.js" . 2>/dev/null | grep -v node_modules >> $OUT

echo -e "\n## 5. PROJECTIONS EXISTENTES" >> $OUT
find . -path ./node_modules -prune -o -iname "*projection*" -print 2>/dev/null >> $OUT

echo -e "\n## 6. MÉTRICAS / OBSERVABILIDAD YA CALCULADAS" >> $OUT
grep -rl "observerSnapshot\|ObserverService\|AnalyticsService\|MarketField\|ScoringEngine\|throughput\|latency" --include="*.js" . 2>/dev/null | grep -v node_modules >> $OUT

echo -e "\n## 7. EVENT SCHEMA (tipos de eventos registrados)" >> $OUT
find . -path ./node_modules -prune -o -iname "event.schema.json" -print -exec cat {} \; 2>/dev/null >> $OUT

echo -e "\n## 8. ESTRUCTURA GENERAL (2 niveles)" >> $OUT
find . -maxdepth 2 -path ./node_modules -prune -o -type d -print 2>/dev/null >> $OUT

echo -e "\n## 9. POSIBLES DUPLICADOS (mismo nombre de archivo en distintas carpetas)" >> $OUT
find . -path ./node_modules -prune -o -iname "*.js" -print 2>/dev/null | xargs -n1 basename 2>/dev/null | sort | uniq -d >> $OUT

echo -e "\n## 10. TRUST/RISK/KYC (insumos para Fase 3 Centinela, solo detección)" >> $OUT
grep -rl "trustScore\|TrustScore\|riskScore\|RiskScore\|KYC\|TrustDecay" --include="*.js" . 2>/dev/null | grep -v node_modules >> $OUT

cat $OUT
