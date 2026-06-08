#!/usr/bin/env bash
# Vérification post-déploiement des fonctions de paiement (checkout + webhook).
#
# Ne teste PAS la signature Stripe (ça nécessite un event signé : `stripe trigger`).
# Confirme seulement que les fonctions sont déployées et renvoient la bonne erreur,
# ce qui prouve que le code est live et que les chemins d'auth/signature sont atteints.
#
# Usage:
#   ./scripts/verify-payments.sh                       # cible la prod (www.trinitelafee.fr)
#   ./scripts/verify-payments.sh https://mon-preview.vercel.app
#
# NB: vise le domaine CANONIQUE www.trinitelafee.fr — l'apex trinitelafee.fr
# fait un 307 vers www, et curl (sans -L) ne suit pas la redirection.
set -u

BASE="${1:-https://www.trinitelafee.fr}"
ORIGIN="$BASE"          # pour le preflight CORS de /api/checkout
PASS=0; FAIL=0

echo "🔎 Vérification des endpoints de paiement sur : $BASE"
echo

# check <libellé> <attendu> <méthode> <chemin> [args curl supplémentaires...]
check() {
  local label="$1" expected="$2" method="$3" path="$4"; shift 4
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" -X "$method" "$@" "$BASE$path")
  if [ "$code" = "$expected" ]; then
    printf "  ✅ %-42s %s (attendu %s)\n" "$label" "$code" "$expected"
    PASS=$((PASS+1))
  else
    printf "  ❌ %-42s %s (attendu %s)\n" "$label" "$code" "$expected"
    FAIL=$((FAIL+1))
  fi
}

echo "── /api/webhook ──────────────────────────────"
check "GET → 405 (fonction déployée)"        405 GET    /api/webhook
check "POST sans signature → 400"            400 POST   /api/webhook \
  -H "Content-Type: application/json" -d '{}'

echo
echo "── /api/checkout ─────────────────────────────"
check "OPTIONS → 200 (CORS preflight)"       200 OPTIONS /api/checkout \
  -H "Origin: $ORIGIN" \
  -H "Access-Control-Request-Method: POST"
check "POST sans token → 401 (garde Clerk)"  401 POST    /api/checkout \
  -H "Origin: $ORIGIN" -H "Content-Type: application/json" -d '{}'

echo
if [ "$FAIL" -eq 0 ]; then
  echo "✅ $PASS/$((PASS+FAIL)) OK — fonctions déployées et opérationnelles."
  echo "   Pour valider la signature de bout en bout : stripe trigger checkout.session.completed --live"
  exit 0
else
  echo "❌ $FAIL échec(s) sur $((PASS+FAIL)) — vérifie le déploiement Vercel et le dossier api/."
  exit 1
fi
