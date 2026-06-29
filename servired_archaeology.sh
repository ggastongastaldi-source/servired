#!/bin/bash
PROJECT="${1:-$HOME/servired}"
AUDIT="$PROJECT/audit"
mkdir -p "$AUDIT"
TS=$(date '+%Y-%m-%d %H:%M')

echo "SERVIRED ARCHAEOLOGY v2.0 — $TS"
echo "Proyecto: $PROJECT"
echo ""

# ── 1. TODAS LAS RUTAS ──────────────────────────────────────
{
echo "# API MAP — Todas las rutas"
echo "> $TS"
echo ""
for f in $(find "$PROJECT/routes" -name "*.js" | sort); do
  rel="${f#$PROJECT/}"
  echo "## $rel"
  grep -nE "router\.(get|post|put|patch|delete)\s*\(" "$f" \
  | while IFS=: read ln rest; do
      method=$(echo "$rest" | grep -oP "(get|post|put|patch|delete)" | head -1 | tr a-z A-Z)
      path=$(echo "$rest" | grep -oP "'[^']+'" | head -1 | tr -d "'" )
      [ -z "$path" ] && path=$(echo "$rest" | grep -oP '"[^"]+"' | head -1 | tr -d '"')
      [ -n "$method" ] && [ -n "$path" ] && echo "  $method $path  (línea $ln)"
  done
  echo ""
done
} > "$AUDIT/api_map.md"
echo "✓ api_map.md"

# ── 2. EVENTOS ──────────────────────────────────────────────
{
echo "# EVENTOS — emitidos y consumidos"
echo "> $TS"
echo ""
echo "## Emitidos"
echo "| Evento | Archivo | Línea |"
echo "|--------|---------|-------|"
grep -rn "emitEvent\s*(" "$PROJECT" \
  --include="*.js" --exclude-dir=node_modules --exclude-dir=audit \
| while IFS=: read f ln rest; do
    rel="${f#$PROJECT/}"
    ev=$(echo "$rest" | grep -oP "['\"][A-Za-z][A-Za-z0-9_]+['\"]" | head -1 | tr -d "'\"")
    [ -n "$ev" ] && echo "| \`$ev\` | $rel | $ln |"
done | sort -u

echo ""
echo "## Consumidores (.on / .subscribe)"
echo "| Evento | Archivo |"
echo "|--------|---------|"
grep -rn "\.\(on\|subscribe\)\s*(" "$PROJECT" \
  --include="*.js" --exclude-dir=node_modules --exclude-dir=audit \
| while IFS=: read f ln rest; do
    rel="${f#$PROJECT/}"
    ev=$(echo "$rest" | grep -oP "['\"][A-Za-z][A-Za-z0-9_]+['\"]" | head -1 | tr -d "'\"")
    [ -n "$ev" ] && echo "| \`$ev\` | $rel |"
done | sort -u

echo ""
echo "## Eventos sin consumidor (huérfanos)"
emitidos=$(grep -rh "emitEvent\s*(" "$PROJECT" \
  --include="*.js" --exclude-dir=node_modules --exclude-dir=audit \
  | grep -oP "['\"][A-Za-z][A-Za-z0-9_]+['\"]" | tr -d "'\"" | sort -u)
consumidos=$(grep -rh "\.\(on\|subscribe\)\s*(" "$PROJECT" \
  --include="*.js" --exclude-dir=node_modules --exclude-dir=audit \
  | grep -oP "['\"][A-Za-z][A-Za-z0-9_]+['\"]" | tr -d "'\"" | sort -u)
while IFS= read -r ev; do
  [ -z "$ev" ] && continue
  echo "$consumidos" | grep -qx "$ev" || echo "  ⚠ \`$ev\`"
done <<< "$emitidos"
} > "$AUDIT/events.md"
echo "✓ events.md"

# ── 3. MODELOS MONGO ────────────────────────────────────────
{
echo "# MODELOS MONGODB"
echo "> $TS"
echo ""
find "$PROJECT/models" -name "*.js" 2>/dev/null | sort | while read mf; do
  rel="${mf#$PROJECT/}"
  echo "## $rel"
  mn=$(grep -oP "mongoose\.model\s*\(\s*['\"][^'\"]+['\"]" "$mf" | head -1 | grep -oP "['\"][^'\"]+['\"]" | tr -d "'\"")
  [ -n "$mn" ] && echo "Modelo: \`$mn\`"
  echo ""
  echo "Campos:"
  grep -E "^\s+\w+\s*:" "$mf" | grep -v "//\|Schema\|model\|require\|{\s*$" | head -25 | sed 's/^/  /'
  grep -q "timestamps: true" "$mf" && echo "  + timestamps (createdAt, updatedAt)"
  grep -qi "deleted\|softDelete" "$mf" && echo "  + soft delete detectado"
  echo ""
done
} > "$AUDIT/mongodb.md"
echo "✓ mongodb.md"

# ── 4. ENV VARS ─────────────────────────────────────────────
{
echo "# VARIABLES DE ENTORNO"
echo "> $TS"
echo ""
grep -rh "process\.env\." "$PROJECT" \
  --include="*.js" --exclude-dir=node_modules --exclude-dir=audit \
  | grep -oP "process\.env\.[A-Z_0-9]+" | sort -u \
  | sed 's/process\.env\.//' \
  | while read v; do echo "  - \`$v\`"; done
} > "$AUDIT/env_vars.md"
echo "✓ env_vars.md"

# ── 5. TODO / FIXME ─────────────────────────────────────────
{
echo "# TODO / FIXME / HACK"
echo "> $TS"
echo ""
grep -rn "TODO\|FIXME\|HACK\|XXX" "$PROJECT" \
  --include="*.js" --exclude-dir=node_modules --exclude-dir=audit \
  | sed "s|$PROJECT/||" | head -60 \
  | while IFS=: read f ln rest; do
      echo "- **$f:$ln** $rest"
  done
} > "$AUDIT/tech_debt.md"
echo "✓ tech_debt.md"

# ── 6. FRONTEND CONTRACT ────────────────────────────────────
{
echo "# FRONTEND CONTRACT"
echo "> $TS"
echo "> Qué necesita cada pantalla del backend real"
echo ""

for f in $(find "$PROJECT/routes" -name "*.js" | sort); do
  base=$(basename "$f" .js)
  cnt=$(grep -cE "router\.(get|post|put|patch|delete)\s*\(" "$f" 2>/dev/null || echo 0)
  [ "${cnt:-0}" -eq 0 ] 2>/dev/null && continue

  echo "---"
  echo "## Módulo: \`$base\`"
  echo ""
  echo "### Endpoints"
  grep -nE "router\.(get|post|put|patch|delete)\s*\(" "$f" \
  | while IFS=: read ln rest; do
      method=$(echo "$rest" | grep -oP "(get|post|put|patch|delete)" | head -1 | tr a-z A-Z)
      path=$(echo "$rest" | grep -oP "'[^']+'" | head -1 | tr -d "'")
      [ -z "$path" ] && path=$(echo "$rest" | grep -oP '"[^"]+"' | head -1 | tr -d '"')
      [ -n "$method" ] && [ -n "$path" ] && echo "  \`$method $path\`"
  done

  echo ""
  echo "### Eventos que emite"
  evs=$(grep -oP "emitEvent\s*\(\s*['\"][^'\"]+['\"]" "$f" \
    | grep -oP "['\"][^'\"]+['\"]" | tr -d "'\"" | sort -u)
  [ -n "$evs" ] && echo "$evs" | while read e; do echo "  → \`$e\`"; done \
    || echo "  (ninguno directo)"

  echo ""
  echo "### Auth requerida"
  ac=$(grep -cE "authenticate|requireAuth|verifyToken|isAuth|authMiddleware" "$f" 2>/dev/null || echo 0)
  [ "${ac:-0}" -gt 0 ] 2>/dev/null \
    && echo "  🔒 Sí ($ac referencias)" \
    || echo "  🔓 No detectada"

  echo ""
  echo "### Estados / enums detectados"
  grep -oP "(status|estado|state|fundsStatus)\s*[:=]\s*['\"][^'\"]+['\"]" "$f" 2>/dev/null \
    | grep -oP "['\"][^'\"]+['\"]" | tr -d "'\"" | sort -u \
    | while read s; do echo "  - $s"; done

  echo ""
done
} > "$AUDIT/frontend_contract.md"
echo "✓ frontend_contract.md"

# ── 7. STATISTICS ───────────────────────────────────────────
{
echo "# ESTADÍSTICAS"
echo "> $TS"
echo ""
total_get=$(grep -rch "router\.get\s*(" "$PROJECT/routes" 2>/dev/null | awk '{s+=$1}END{print s+0}')
total_post=$(grep -rch "router\.post\s*(" "$PROJECT/routes" 2>/dev/null | awk '{s+=$1}END{print s+0}')
total_patch=$(grep -rch "router\.patch\s*(" "$PROJECT/routes" 2>/dev/null | awk '{s+=$1}END{print s+0}')
total_delete=$(grep -rch "router\.delete\s*(" "$PROJECT/routes" 2>/dev/null | awk '{s+=$1}END{print s+0}')
total_put=$(grep -rch "router\.put\s*(" "$PROJECT/routes" 2>/dev/null | awk '{s+=$1}END{print s+0}')
total_ev=$(grep -rh "emitEvent\s*(" "$PROJECT" --include="*.js" --exclude-dir=node_modules --exclude-dir=audit \
  | grep -oP "['\"][A-Za-z][A-Za-z0-9_]+['\"]" | tr -d "'\"" | sort -u | wc -l)
total_models=$(find "$PROJECT/models" -name "*.js" 2>/dev/null | wc -l)
total_routes_files=$(find "$PROJECT/routes" -name "*.js" 2>/dev/null | wc -l)
total_js=$(find "$PROJECT" -name "*.js" \
  -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/audit/*" | wc -l)
total_lines=$(find "$PROJECT" -name "*.js" \
  -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/audit/*" \
  | xargs wc -l 2>/dev/null | tail -1 | awk '{print $1}')
total_todo=$(grep -rn "TODO\|FIXME" "$PROJECT" --include="*.js" \
  --exclude-dir=node_modules --exclude-dir=audit | wc -l)

echo "| Métrica | Valor |"
echo "|---------|-------|"
echo "| Archivos de rutas | $total_routes_files |"
echo "| GET | $total_get |"
echo "| POST | $total_post |"
echo "| PUT | $total_put |"
echo "| PATCH | $total_patch |"
echo "| DELETE | $total_delete |"
echo "| Tipos de eventos únicos | $total_ev |"
echo "| Modelos MongoDB | $total_models |"
echo "| Archivos JS totales | $total_js |"
echo "| Líneas de código | $total_lines |"
echo "| TODO/FIXME | $total_todo |"

echo ""
echo "## Archivos de rutas"
find "$PROJECT/routes" -name "*.js" | sort | while read f; do
  lines=$(wc -l < "$f")
  routes=$(grep -cE "router\.(get|post|put|patch|delete)" "$f" 2>/dev/null || echo 0)
  echo "  - $(basename $f): $routes rutas, $lines líneas"
done

echo ""
echo "## Archivos más grandes"
find "$PROJECT" -name "*.js" \
  -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/audit/*" \
  | xargs wc -l 2>/dev/null | sort -rn | head -12 | grep -v total \
  | sed "s|$PROJECT/||" | awk '{print "  "$2" ("$1" líneas)"}'
} > "$AUDIT/statistics.md"
echo "✓ statistics.md"

# ── 8. SUMMARY MAESTRO ──────────────────────────────────────
{
echo "# SERVIRED — SUMMARY PARA DISEÑO DE FRONTEND"
echo "> $TS"
echo ""
echo "## Archivos de rutas encontrados"
find "$PROJECT/routes" -name "*.js" | sort | sed "s|$PROJECT/routes/||" | while read f; do
  echo "  - $f"
done
echo ""
echo "## Total de endpoints"
grep -rh "router\.\(get\|post\|put\|patch\|delete\)\s*(" "$PROJECT/routes" \
  --include="*.js" 2>/dev/null | wc -l | xargs echo "  "
echo ""
echo "## Todos los eventos emitidos en el sistema"
grep -rh "emitEvent\s*(" "$PROJECT" \
  --include="*.js" --exclude-dir=node_modules --exclude-dir=audit \
  | grep -oP "['\"][A-Za-z][A-Za-z0-9_]+['\"]" | tr -d "'\"" | sort -u \
  | while read e; do echo "  - \`$e\`"; done
echo ""
echo "## Modelos de datos"
find "$PROJECT/models" -name "*.js" 2>/dev/null | sort | sed "s|$PROJECT/models/||" | while read f; do
  echo "  - $f"
done
echo ""
echo "## Variables de entorno en uso"
grep -rh "process\.env\." "$PROJECT" \
  --include="*.js" --exclude-dir=node_modules --exclude-dir=audit \
  | grep -oP "process\.env\.[A-Z_0-9]+" | sort -u | sed 's/process\.env\.//' \
  | while read v; do echo "  - \`$v\`"; done
echo ""
echo "## Deuda técnica (TODO/FIXME)"
grep -rn "TODO\|FIXME" "$PROJECT" \
  --include="*.js" --exclude-dir=node_modules --exclude-dir=audit \
  | sed "s|$PROJECT/||" | head -30 | while IFS=: read f ln rest; do
    echo "  - $f:$ln →$rest"
done
} > "$AUDIT/summary.md"
echo "✓ summary.md"

# ── CONSOLA FINAL ───────────────────────────────────────────
echo ""
echo "════════════════════════════════"
echo " ARQUEOLOGÍA COMPLETA"
echo "════════════════════════════════"
echo ""
echo "Rutas encontradas:"
grep -rh "router\.\(get\|post\|put\|patch\|delete\)\s*(" "$PROJECT/routes" \
  --include="*.js" 2>/dev/null | wc -l | xargs echo " "
echo ""
echo "Eventos únicos:"
grep -rh "emitEvent\s*(" "$PROJECT" \
  --include="*.js" --exclude-dir=node_modules --exclude-dir=audit \
  | grep -oP "['\"][A-Za-z][A-Za-z0-9_]+['\"]" | tr -d "'\"" | sort -u | wc -l | xargs echo " "
echo ""
echo "Archivos generados en: $AUDIT/"
ls "$AUDIT/"
echo ""
echo "Siguiente paso:"
echo "  cat $AUDIT/summary.md | head -80"
echo "  cat $AUDIT/events.md"
echo "  cat $AUDIT/frontend_contract.md"
