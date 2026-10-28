#!/usr/bin/env bash
# Déploiement BK Écart Matières — récupère le code puis reconstruit les conteneurs.
# À exécuter sur le serveur, depuis n'importe quel répertoire : le script se place
# lui-même à la racine du dépôt. Procédure détaillée : DEPLOIEMENT.md
#
#   bash deployer.sh                pull de main + rebuild + contrôle de santé
#   bash deployer.sh --force        rebuild même sans nouveau commit
#   bash deployer.sh --simulation   montre ce qui serait fait, sans toucher aux conteneurs
#   bash deployer.sh --branche=main autre branche (par défaut : main)
#
# Le script ne touche jamais à bk-data/ (base de production) ni au .env.
# Il refuse de démarrer s'il y a des modifications locales : rien n'est écrasé.

if [ -z "${BASH_VERSION:-}" ]; then printf 'Lancer avec bash : bash deployer.sh\n' >&2; exit 1; fi
set -euo pipefail

BRANCHE="main"
FORCE=0
SIMULATION=0
PORTE="${PORTE:-4001}"

log()   { printf '%s\n' "$*"; }
etape() { printf '\n== %s\n' "$*"; }
erreur() { printf 'ERREUR : %s\n' "$*" >&2; exit 1; }

usage() {
  sed -n '2,12p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
}

for arg in "$@"; do
  case "$arg" in
    --branche=*)  BRANCHE="${arg#*=}" ;;
    --force)      FORCE=1 ;;
    --simulation) SIMULATION=1 ;;
    -h|--help)    usage; exit 0 ;;
    *)            erreur "option inconnue : $arg (--help)" ;;
  esac
done

# ── Contrôles préalables ─────────────────────────────────────────────────────────────
etape "Contrôles préalables"
command -v git    >/dev/null || erreur "git introuvable"
command -v docker >/dev/null || erreur "docker introuvable"
command -v curl   >/dev/null || erreur "curl introuvable (nécessaire au contrôle de santé)"
docker compose version >/dev/null 2>&1 || erreur "docker compose (v2) indisponible"

RACINE="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$RACINE"
log "dépôt : $RACINE"

[ -d .git ]              || erreur "pas un dépôt git : $RACINE"
[ -f docker-compose.yml ] || erreur "docker-compose.yml absent de $RACINE"
[ -f .env ]              || erreur ".env absent — copier .env.production.example puis adapter (DEPLOIEMENT.md § 4)"
[ -f bk-data/data.db ]   || erreur "bk-data/data.db absent — le serveur démarrerait sur une base vide (DEPLOIEMENT.md § 4)"
log ".env et bk-data/data.db présents"

COURANTE="$(git symbolic-ref --quiet --short HEAD || true)"
[ "$COURANTE" = "$BRANCHE" ] \
  || erreur "branche courante « ${COURANTE:-detached} » au lieu de « $BRANCHE » (git checkout $BRANCHE)"

SALES="$(git status --porcelain --untracked-files=no)"
if [ -n "$SALES" ]; then
  printf '%s\n' "$SALES"
  erreur "modifications locales : le script ne les écrase pas (git diff, puis git checkout -- <fichier>)"
fi
log "arbre de travail propre, branche $BRANCHE"

# ── Récupération du code ─────────────────────────────────────────────────────────────
etape "Récupération de origin/$BRANCHE"
git fetch --prune --quiet origin "$BRANCHE" || erreur "git fetch impossible (réseau ou accès au dépôt)"

AVANT="$(git rev-parse --short HEAD)"
NB="$(git rev-list --count "HEAD..origin/$BRANCHE")"
log "local $AVANT · distant $(git rev-parse --short "origin/$BRANCHE") · $NB nouveau(x) commit(s)"
if [ "$NB" -gt 0 ]; then
  git log --oneline "HEAD..origin/$BRANCHE" | sed 's/^/  /'
fi

git merge-base --is-ancestor HEAD "origin/$BRANCHE" \
  || erreur "avance rapide impossible : HEAD n'est pas un ancêtre de origin/$BRANCHE"

if [ "$NB" -eq 0 ] && [ "$FORCE" -eq 0 ]; then
  log "déjà à jour, rien à reconstruire (--force pour reconstruire quand même)."
  exit 0
fi

if [ "$SIMULATION" -eq 1 ]; then
  etape "Simulation (aucune modification)"
  log "git merge --ff-only origin/$BRANCHE"
  log "docker compose up -d --build"
  log "contrôle de santé sur http://localhost:$PORTE/api/health"
  exit 0
fi

# ── Déploiement ──────────────────────────────────────────────────────────────────────
etape "Mise à jour du code"
git merge --ff-only --quiet "origin/$BRANCHE"
APRES="$(git rev-parse --short HEAD)"
log "commit déployé : $APRES"

etape "Reconstruction et redémarrage"
docker compose up -d --build || erreur "échec de docker compose up -d --build (docker compose logs backend)"

# ── Contrôle de santé ────────────────────────────────────────────────────────────────
etape "Contrôle de santé"
sante() { curl -fsS --max-time 3 "http://localhost:$PORTE/api/health" >/dev/null 2>&1; }
EN_LIGNE=0
for _ in $(seq 1 30); do
  if sante; then EN_LIGNE=1; break; fi
  sleep 2
done

if [ "$EN_LIGNE" -ne 1 ]; then
  docker compose logs --tail=80 backend || true
  printf '\nRetour arrière :\n  git checkout %s && docker compose up -d --build\n  puis git checkout %s\n' "$AVANT" "$BRANCHE"
  erreur "l'API ne répond pas sur le port $PORTE après 60 s"
fi
log "API en ligne sur http://localhost:$PORTE"

etape "Résumé"
log "commit : $AVANT → $APRES"
log "si des prix ou référentiels ont changé : DEPLOIEMENT.md § 6 et § 7"
