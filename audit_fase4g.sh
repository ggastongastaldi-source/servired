#!/bin/bash
OUT=~/servired/audit_fase4g.md
echo "# AUDITORÍA FASE IV-G — Modelo AladdinInsight + agregación plataforma" > $OUT
echo "Generado: $(date)" >> $OUT

echo -e "\n## Modelo AladdinInsight completo" >> $OUT
find . -path ./node_modules -prune -o -iname "AladdinInsight.js" -print -exec cat {} \; 2>/dev/null >> $OUT

echo -e "\n## ¿Existe ya alguna agregación cross-merchant (todos los comercios, no uno solo)?" >> $OUT
grep -rln "MerchantProjection.aggregate\|MerchantProjection.find({})\|MerchantProjection.countDocuments" --include="*.js" . 2>/dev/null | grep -v node_modules >> $OUT

echo -e "\n## ¿Existe ya alguna agregación cross-insight de AladdinInsight?" >> $OUT
grep -rln "AladdinInsight.aggregate\|AladdinInsight.find\|AladdinInsight.countDocuments" --include="*.js" . 2>/dev/null | grep -v node_modules >> $OUT

echo -e "\n## AuctionOutcome — schema (para saber qué campos agregar en Aladdín)" >> $OUT
find . -path ./node_modules -prune -o -iname "AuctionOutcome.js" -print -exec cat {} \; 2>/dev/null >> $OUT

cat $OUT
