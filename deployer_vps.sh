#!/usr/bin/env bash
# Déploiement BK Écart Matières depuis le poste de développement jusqu'au serveur.
# Envoie deployer.sh par SSH puis l'exécute à distance : pull + rebuild + contrôle
# de santé (l'API est ensuite joignable sur http://<serveur>:4001).
# Ne pousse rien sans --pousser ; ne modifie jamais bk-data/ ni .env.
#
#   bash deployer_vps.sh                contrôle local, envoie, déploie, vérifie depuis le poste
#   bash deployer_vps.sh --pousser      idem + git push des commits locaux d'abord
#   bash deployer_vps.sh --force        reconstruit même sans nouveau commit
#   bash deployer_vps.sh --simulation   affiche les étapes, ne se connecte pas
#   bash deployer_vps.sh --serveur=root@1.2.3.4 --dossier=/opt/xxx --branche=main
#
# Déploiement manuel (équivalent) : DEPLOIEMENT.md § 5.

if [ -z "${BASH_VERSION:-}" ]; then printf 'Lancer avec bash : bash deployer_vps.sh\n' >&2; exit 1; fi
set -euo pipefail

SERVEUR="${SERVEUR:-root@38.242.201.239}"
DOSSIER="${DOSSIER:-/opt/bk-ecart-docker28082026}"
BRANCHE="main"
PORTE="${PORTE:-4001}"
POUSSER=0
FORCE=0
SIMULATION=0

log()    { printf '%s\n' "$*"; }
etape()  { printf '\n== %s\n' "$*"; }
avertir(){ printf 'ATTENTION : %s\n' "$*" >&2; }
erreur() { printf 'ERREUR : %s\n' "$*" >&2; exit 1; }

usage() { sed -n '2,13p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; }

for arg in "$@"; do
  case "$arg" in
    --serveur=*)  SERVEUR="${arg#*=}" ;;
    --dossier=*)  DOSSIER="${arg#*=}" ;;
    --branche=*)  BRANCHE="${arg#*=}" ;;
    --pousser)    POUSSER=1 ;;
    --force)      FORCE=1 ;;
    --simulation) SIMULATION=1 ;;
    -h|--help)    usage; exit 0 ;;
    *)            erreur "option inconnue : $arg (--help)" ;;
  esac
done

HOTE="${SERVEUR#*@}"
ARGS_DISTANTS="--branche=$BRANCHE"
if [ "$FORCE" -eq 1 ]; then ARGS_DISTANTS="$ARGS_DISTANTS --force"; fi

# ── Contrôles locaux ────────────────────────────────────────────────────────────────
etape "Contrôles locaux"
command -v git  >/dev/null || erreur "git introuvable"
command -v ssh  >/dev/null || erreur "ssh introuvable (OpenSSH du système)"
command -v curl >/dev/null || erreur "curl introuvable"

RACINE="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$RACINE"
log "dépôt local : $RACINE"
log "cible        : $SERVEUR:$DOSSIER"

[ -d .git ]         || erreur "pas un dépôt git : $RACINE"
[ -f deployer.sh ]  || erreur "deployer.sh absent de $RACINE (c'est le script envoyé au serveur)"

case "$DOSSIER" in
  *[!A-Za-z0-9/_.-]*) erreur "dossier distant invalide : $DOSSIER" ;;
esac

COURANTE="$(git symbolic-ref --quiet --short HEAD || true)"
[ "$COURANTE" = "$BRANCHE" ] \
  || erreur "branche locale « ${COURANTE:-detached} » au lieu de « $BRANCHE » (git checkout $BRANCHE)"

SALES="$(git status --porcelain --untracked-files=no)"
if [ -n "$SALES" ]; then
  printf '%s\n' "$SALES"
  erreur "modifications locales non commitées : commiter d'abord (le serveur ne verrait pas ces changements)"
fi

# ── État local / distant ────────────────────────────────────────────────────────────
etape "Comparaison avec origin/$BRANCHE"
git fetch --prune --quiet origin "$BRANCHE" || erreur "git fetch impossible (réseau ou accès GitHub)"
LOCAL="$(git rev-parse --short HEAD)"
DISTANT="$(git rev-parse --short "origin/$BRANCHE")"
EN_AVANCE="$(git rev-list --count "origin/$BRANCHE..HEAD")"
EN_RETARD="$(git rev-list --count "HEAD..origin/$BRANCHE")"
log "local $LOCAL · origin/$BRANCHE $DISTANT · $EN_AVANCE à pousser · $EN_RETARD à récupérer"

[ "$EN_RETARD" -eq 0 ] \
  || erreur "le dépôt local est en retard de $EN_RETARD commit(s) : git pull --ff-only puis relancer"

if [ "$EN_AVANCE" -gt 0 ] && [ "$POUSSER" -eq 0 ]; then
  git log --oneline "origin/$BRANCHE..HEAD" | sed 's/^/  /'
  erreur "$EN_AVANCE commit(s) local(aux) ne sont pas sur GitHub : le serveur ne les verrait pas (--pousser pour les envoyer)"
fi

if [ "$SIMULATION" -eq 1 ]; then
  etape "Simulation (aucune connexion, aucune modification)"
  if [ "$EN_AVANCE" -gt 0 ]; then log "git push origin $BRANCHE"; fi
  log "ssh $SERVEUR  (vérifie $DOSSIER, reçoit deployer.sh, lance : PORTE=$PORTE bash deployer.sh $ARGS_DISTANTS)"
  log "curl http://$HOTE:$PORTE/api/health depuis le poste"
  exit 0
fi

if [ "$EN_AVANCE" -gt 0 ]; then
  etape "Envoi des commits vers GitHub"
  git push origin "$BRANCHE" || erreur "git push refusé : authentifier GitHub puis relancer"
  log "origin/$BRANCHE = $(git rev-parse --short "origin/$BRANCHE")"
else
  log "rien à pousser, le serveur partira de $LOCAL"
fi

# ── Envoi et exécution sur le serveur ───────────────────────────────────────────────
etape "Connexion à $SERVEUR"
avertir "un mot de passe peut être demandé (SSH root)."
log "envoi de deployer.sh puis exécution à distance…"

MESSAGE="cd '$DOSSIER' 2>/dev/null || { echo \"ERREUR : dossier $DOSSIER introuvable sur le serveur\" >&2; exit 2; }; cat > deployer.sh && PORTE=$PORTE bash deployer.sh $ARGS_DISTANTS"

CODE=0
ssh -o ConnectTimeout=10 "$SERVEUR" "$MESSAGE" < deployer.sh || CODE=$?

if [ "$CODE" -eq 2 ]; then
  erreur "dossier $DOSSIER absent : cloner le dépôt sur le serveur (DEPLOIEMENT.md § 4)"
fi
if [ "$CODE" -eq 255 ]; then
  erreur "connexion SSH impossible vers $SERVEUR (IP, réseau, port 22 ou empreinte non acceptée)"
fi
[ "$CODE" -eq 0 ] || erreur "le déploiement distant a échoué (code $CODE) — voir la sortie ci-dessus"

# ── Contrôle depuis le poste ────────────────────────────────────────────────────────
etape "Contrôle depuis le poste de développement"
if REPONSE="$(curl -fsS --max-time 5 "http://$HOTE:$PORTE/api/health" 2>/dev/null)"; then
  log "API joignable : $REPONSE"
else
  avertir "http://$HOTE:$PORTE/api/health ne répond pas depuis ce poste."
  avertir "l'API est validée en local sur le serveur par deployer.sh ; vérifier le pare-feu (port $PORTE)."
fi

etape "Résumé"
log "serveur : $SERVEUR:$DOSSIER"
log "commit : $LOCAL ($BRANCHE)"
log "accès  : http://$HOTE:$PORTE"
log "prix/référentiels à rejouer ? DEPLOIEMENT.md § 6 et § 7"
