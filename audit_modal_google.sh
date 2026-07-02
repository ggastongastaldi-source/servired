#!/bin/bash
OUT=~/servired/audit_modal_google.md
echo "# AUDITORÍA — Modal viejo + Login Google" > $OUT

echo -e "\n## Bloque HTML del modal 'Hola, {nombre}' — contexto completo" >> $OUT
grep -n "Hola,\|Bienvenido a ServiRed\|Qué querés hacer\|Buscar un trabajador o servicio\|Ofrecer mis servicios\|Registrar mi comercio" public/index.html >> $OUT

echo -e "\n## ¿Cuándo se introdujo este modal? (git blame de esas líneas)" >> $OUT
grep -n "Bienvenido a ServiRed" public/index.html | head -1

echo -e "\n## Botón/flujo de Google Sign-In en index.html" >> $OUT
grep -n "google\|Google\|GoogleSignIn\|id_token\|credential" public/index.html | head -30 >> $OUT

echo -e "\n## ¿Existe GOOGLE_CLIENT_ID configurado? (solo confirma que la env var existe, no su valor)" >> $OUT
grep -n "GOOGLE_CLIENT_ID" server.js src/core/routes/auth.js >> $OUT

cat $OUT
