#!/usr/bin/env bash
set -euo pipefail

# cargar .env
set -a; source .env; set +a

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'

echo -e "\n🛡️  SINAPSIS Pre-Deploy Gate\n"

# ── 1) branch check ──────────────────────────────────────────────────────────
BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$BRANCH" != "main" ]; then
  echo -e "${RED}❌ Branch '$BRANCH' — solo se deploya desde main${NC}"
  exit 1
fi
echo -e "${GREEN}✅ Branch: main${NC}"

# ── 2) working tree limpio ───────────────────────────────────────────────────
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo -e "${RED}❌ Working tree sucio — commitear antes de deployar${NC}"
  exit 1
fi
echo -e "${GREEN}✅ Working tree: limpio${NC}"

# ── 3) Suite 1 — chaos runner local ─────────────────────────────────────────
echo -e "\n${YELLOW}▶ Suite 1/3 — Chaos Runner (local)${NC}"
if ! npm run test:chaos --silent; then
  echo -e "${RED}❌ Suite 1 FAILED — deploy bloqueado${NC}"
  exit 1
fi
echo -e "${GREEN}✅ Suite 1 PASS${NC}"

# ── 4) Suite 2 — outbox failure tests ───────────────────────────────────────
echo -e "\n${YELLOW}▶ Suite 2/3 — Outbox Failure Tests (Mongo real)${NC}"
if ! node scripts/chaos-outbox.js; then
  echo -e "${RED}❌ Suite 2 FAILED — deploy bloqueado${NC}"
  exit 1
fi
echo -e "${GREEN}✅ Suite 2 PASS${NC}"

# ── 5) Suite 3 — staging run contra Render ───────────────────────────────────
echo -e "\n${YELLOW}▶ Suite 3/3 — Staging Run (Render real)${NC}"
if ! STAGING_ENDPOINT=https://servired-6e5r.onrender.com node scripts/chaos-staging.js; then
  echo -e "${RED}❌ Suite 3 FAILED — deploy bloqueado${NC}"
  exit 1
fi
echo -e "${GREEN}✅ Suite 3 PASS${NC}"

# ── 6) confirmación manual ───────────────────────────────────────────────────
echo -e "\n${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  ✅ TODAS LAS SUITES PASARON${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "\n¿Confirmar git push a producción? [s/N] \c"
read -r CONFIRM
if [[ "$CONFIRM" != "s" && "$CONFIRM" != "S" ]]; then
  echo -e "${YELLOW}⚠️  Push cancelado por el operador${NC}"
  exit 0
fi

git push
echo -e "\n${GREEN}🚀 Deploy enviado a Render${NC}\n"
