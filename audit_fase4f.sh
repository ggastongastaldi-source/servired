#!/bin/bash
OUT=~/servired/audit_fase4f.md
echo "# AUDITORÍA FASE IV-F — Insumos SOC Bloque 3 (Comercial + Aladdín)" > $OUT
echo "Generado: $(date)" >> $OUT

echo -e "\n## Modelo MerchantProjection (schema completo)" >> $OUT
cat ./models/MerchantProjection.js >> $OUT 2>&1

echo -e "\n## services/merchantProjection.js (cómo se consulta)" >> $OUT
cat ./services/merchantProjection.js >> $OUT 2>&1

echo -e "\n## aladdinIntelligenceReactor.js — qué expone / qué estado guarda" >> $OUT
cat ./shared/reactors/aladdinIntelligenceReactor.js >> $OUT 2>&1

echo -e "\n## ¿Existe algún endpoint GET ya armado para merchants/aladdin en admin.js?" >> $OUT
grep -n "merchant\|aladdin\|Aladdin" ./src/core/routes/admin.js >> $OUT

echo -e "\n## routes/merchantRoutes.js — endpoints existentes" >> $OUT
grep -n "router\.\(get\|post\)" ./routes/merchantRoutes.js >> $OUT 2>&1

cat $OUT
