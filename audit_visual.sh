#!/bin/bash
OUT=~/servired/audit_visual.md
echo "# AUDITORÍA VISUAL — insumos para diseño del Command Center" > $OUT

echo -e "\n## public/pulse.html — primeras 80 líneas (head + estilos inline)" >> $OUT
head -80 ./public/pulse.html >> $OUT 2>&1

echo -e "\n## Variables CSS / paleta de colores usada en pulse.html" >> $OUT
grep -n "#[0-9a-fA-F]\{3,6\}\|--[a-z-]*:" ./public/pulse.html >> $OUT 2>&1

echo -e "\n## public/style.css — si existe, primeras 60 líneas" >> $OUT
head -60 ./public/style.css >> $OUT 2>&1

echo -e "\n## admin.html — head + primeras líneas de estilo" >> $OUT
head -60 ./public/admin.html >> $OUT 2>&1

echo -e "\n## ¿Qué fuentes (Google Fonts / @font-face) se usan en el proyecto?" >> $OUT
grep -rn "fonts.googleapis\|@font-face\|font-family" ./public/*.html 2>/dev/null | head -30 >> $OUT

cat $OUT
