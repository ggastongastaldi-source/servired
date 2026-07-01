#!/bin/bash
OUT=~/servired/audit_admin_anchors.md
echo "# Anchors para insertar tab SOC en admin.html" > $OUT

echo -e "\n## Línea completa del último tab (nexus)" >> $OUT
grep -n "irTab('nexus'" ./public/admin.html >> $OUT

echo -e "\n## Función irTab completa" >> $OUT
sed -n '340,360p' ./public/admin.html >> $OUT

echo -e "\n## Dónde cierra el último tc (buscar el próximo div.tc o tab-content después de tc-live)" >> $OUT
grep -n '<div class="tc"\|<div id="tab-nexus"\|</div>\s*$' ./public/admin.html | grep -A2 "tc-live"

echo -e "\n## Línea donde arranca el <script> principal (para insertar funciones JS antes del cierre)" >> $OUT
grep -n "^<script>\|^</script>" ./public/admin.html >> $OUT

cat $OUT
