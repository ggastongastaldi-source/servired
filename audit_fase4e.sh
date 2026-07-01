#!/bin/bash
OUT=~/servired/audit_fase4e.md
echo "# AUDITORÍA FASE IV-E — Mecanismo de ejecución de dixieScanner" > $OUT
echo "Generado: $(date)" >> $OUT

echo -e "\n## Contexto de la línea 194 en server.js (10 líneas antes y después)" >> $OUT
sed -n '184,210p' server.js >> $OUT

echo -e "\n## ¿Hay setInterval / node-cron / setTimeout cerca de dixieScan en server.js?" >> $OUT
grep -n "setInterval\|cron\.schedule\|setTimeout" server.js >> $OUT

echo -e "\n## routes/dixieTerminal.js completo" >> $OUT
cat ./src/core/routes/dixieTerminal.js >> $OUT 2>&1

echo -e "\n## ¿Algún cron externo o Render cronjob referenciado en el repo?" >> $OUT
grep -rln "cron\|schedule" --include="*.json" --include="*.yaml" --include="*.yml" . 2>/dev/null | grep -v node_modules >> $OUT
find . -path ./node_modules -prune -o -iname "render.yaml" -print -exec cat {} \; 2>/dev/null >> $OUT

echo -e "\n## Última vez que corrió: query directa no posible sin DB, pero buscamos timestamps hardcodeados o docs" >> $OUT
grep -rn "dixieScan\|scan()" server.js >> $OUT

cat $OUT
