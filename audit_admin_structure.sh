#!/bin/bash
OUT=~/servired/audit_admin_structure.md
echo "# Estructura de tabs y auth en admin.html" > $OUT

echo -e "\n## Definición de tabs (HTML)" >> $OUT
grep -n "class=\"tab\"\|class=\"tc\"\|id=\"tab-\|id=\"tc-" ./public/admin.html >> $OUT

echo -e "\n## Función JS de cambio de tab" >> $OUT
grep -n "function.*[Tt]ab\|switchTab\|showTab" ./public/admin.html >> $OUT

echo -e "\n## Cómo se guarda/lee el token (localStorage key)" >> $OUT
grep -n "localStorage.getItem\|localStorage.setItem" ./public/admin.html | head -10 >> $OUT

echo -e "\n## Patrón de fetch existente (para replicar headers/auth)" >> $OUT
grep -n "fetch(" ./public/admin.html | head -10 >> $OUT

echo -e "\n## Últimas 40 líneas del archivo (cierre de tags, dónde insertar)" >> $OUT
tail -40 ./public/admin.html >> $OUT

cat $OUT
