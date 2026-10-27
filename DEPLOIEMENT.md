# Guide de déploiement — BK Écart Matières

Dernière mise à jour : 27/10/2026 — commit de référence `main` = `6f39f2a`.

Ce guide décrit le déploiement sur le serveur interne, les mises à jour de routine,
le rejeu des prix du 27/10/2026, les contrôles et le retour arrière.
L'agent ne se connecte pas au serveur : toutes les commandes ci-dessous sont à taper
sur le VPS (`vmi2774944:/opt/bk-ecart-docker28082026`).

---

## 1. Architecture déployée

| Élément | Valeur | Où c'est défini |
|---|---|---|
| Base SQLite | `bk-data/data.db` sur l'hôte, `/data/data.db` dans le conteneur | `docker-compose.yml` (`DB_PATH`) |
| API | conteneur `bk-ecart-backend`, port interne 4000, **aucun port publié** | `docker-compose.yml` |
| Interface | conteneur `bk-ecart-frontend`, nginx sur 80 → publié en **4001** | `docker-compose.yml`, `frontend/nginx.conf` |
| Accès utilisateurs | `http://<IP-serveur>:4001` | — |
| Secrets | `.env` à la racine du serveur | `.env.production.example` |
| Contrôle de santé | `GET /api/health` (utilisé par le `HEALTHCHECK` de l'image) | `backend/Dockerfile` |

Le proxy nginx appelle `http://backend:4000` : le nom de service `backend` et le port 4000
sont imposés. Ne pas publier le 4000, ne pas renommer le service.

## 2. Ce qui n'est jamais versionné (et pourquoi c'est important)

| Chemin | Contenu | Conséquence |
|---|---|---|
| `.env` | JWT, mots de passe initiaux, CORS | à créer sur le serveur, jamais commité |
| `backend/data.db` | base de la machine de dev | **la prod a sa propre base** dans `bk-data/` |
| `bk-data/` | base de production et ses sauvegardes | ne jamais supprimer, sauvegarder avant opération |
| `sample_data/` | Ratio, BASE ARTICLE SIA, base locale, PMIX | **absent du serveur** : les scripts qui le lisent ne tournent pas en prod |
| `AUTRE/`, `tmp_verif/` | archives, relevés, classeurs métier | ignorés pour qu'un `git add -A` ne les embarque pas |
| `backend/data.backup*.db`, `backend/reports_backup_*.db` | sauvegardes locales | ignorés |

Un `git pull` ne transporte donc **jamais** de données : ni base, ni ratios, ni classeurs.
Toute évolution de données (base articles, référentiels) est une opération distincte,
décrite au § 6 et § 7.

## 3. Prérequis serveur

- Docker + plugin `docker compose` (v2 ; commande `docker compose`, pas `docker-compose`).
- `git` et accès en lecture au dépôt GitHub.
- Port **4001** libre (un ancien service `web` a déjà squatté le 80 : voir § 10).
- Fichier `.env` à la racine du projet (voir § 4).

## 4. Premier déploiement

```bash
git clone https://github.com/singaelieldioue-prog/bk-ecart-docker.git /opt/bk-ecart-docker28082026
cd /opt/bk-ecart-docker28082026

# 1) secrets : copier le modèle et remplacer chaque valeur
cp .env.production.example .env
#   JWT_SECRET : openssl rand -hex 32
#   SEED_*_PW  : mots de passe initiaux (à changer dans l'app après la 1re connexion)
#   CORS_ORIGIN: URL publique du serveur, ou vide si accès par IP
#   NE JAMAIS committer ce fichier

# 2) base : sans ce dossier, l'app démarre avec une base vide
mkdir -p bk-data
#   pour repartir d'une base de dev existante (migration) :
#   cp backend/data.db bk-data/data.db
#   sinon la base est créée au démarrage et les comptes sont semés depuis SEED_*_PW

# 3) build + démarrage
docker compose up -d --build
docker compose ps
curl -s http://localhost:4001/api/health   # doit répondre OK
```

Vérifier ensuite dans un navigateur : `http://<IP-serveur>:4001`, connexion avec un compte
semé, génération d'un classeur, import.

## 5. Mise à jour de routine

```bash
cd /opt/bk-ecart-docker28082026

# 0) noter l'état courant (utile pour revenir en arrière, § 9)
git rev-parse --short HEAD

# 1) le compose du serveur est une copie manuelle : vérifier qu'il n'a pas d'écart local
git diff docker-compose.yml
#   si seul le port diffère, le dépôt contient déjà 4001:80 :  git checkout -- docker-compose.yml

# 2) récupérer le code
git pull

# 3) reconstruire (le frontend embarque le build Vite, le backend embarque scripts/)
docker compose up -d --build

# 4) contrôles
docker compose ps
curl -s http://localhost:4001/api/health
docker compose logs --tail=50 backend
```

`docker compose up -d --build` reconstruit les deux images ; prévoir quelques minutes.
Les données (`bk-data/`) ne sont pas touchées par une mise à jour de code.

## 6. Rejeu des prix du 27/10/2026 (28 lignes du CDG)

Script : `backend/scripts/appliquer_prix_articles_20261027.mjs`.
Il écrit **deux endroits** dans la même transaction : la table `articles` et la carte KV
`bk_sia_local_articles_v1` — celle que lit réellement la chaîne de prix (`resoudrePrix`).
Écrire seulement la table n'aurait aucun effet sur les calculs.

Options : `--db=`, `--entree=`, `--journal=`. Sans `--entree`, le script lit
`tmp_verif/_lecture_prix.json` s'il existe, sinon le journal committé
`rapports/application_prix_2026-10-27.json` (ses 28 lignes « apres » suffisent).

```bash
cd /opt/bk-ecart-docker28082026

# l'image doit contenir le script => avoir fait le § 5 (git pull + up --build) d'abord
docker compose exec backend ls scripts/appliquer_prix_articles_20261027.mjs

docker compose cp rapports/application_prix_2026-10-27.json backend:/tmp/prix.json
docker compose exec backend node scripts/appliquer_prix_articles_20261027.mjs \
  --db=/data/data.db --entree=/tmp/prix.json --journal=/data/rejeu_prix_20261027.json

docker compose cp backend:/data/rejeu_prix_20261027.json ./rapports/rejeu_prix_prod_20261027.json
```

Comportement à connaître :

- **Sauvegarde automatique** avant écriture : `bk-data/data.db.bak-prix-<AAAAMMJJ>.db`.
  Si le fichier existe déjà, il n'est pas écrasé.
- **Garde-fou d'appariement** : chaque ligne est rapprochée par son code article. Si un code
  est absent ou ambigu, le script s'arrête avec `Appariement incomplet, aucune écriture`
  (code retour 1) et **n'écrit rien** — ni base, ni journal.
- **Idempotent** : relancé sur une base déjà à jour, il réécrit les mêmes valeurs.
- `calculators.js` est absent de l'image backend : la colonne résolution du journal sort alors
  à `n/d`, l'écriture reste correcte.

Résultat attendu : `Lignes écrites : 28` puis
`Articles actifs sans prix carton après opération : <N-28>`.

Si la base prod est encore à ~320 articles (constat du 26/10), des codes manquent :
c'est le § 7 qu'il faut traiter d'abord, puis relancer le rejeu.

## 7. Base articles et référentiels sur le serveur

État connu : la prod est restée à ~320 articles alors que la base de référence en compte
621 (561 actives) — d'où des lignes vides après saisie d'un code pourtant valide.

Le réimport existe : `backend/scripts/reimporter_base_referentiels.mjs` (dry-run par défaut,
`--apply` pour écrire, `--ratio=<fichier>`, `--base=<fichier>`).
`backend/scripts/rederive_prix.mjs` relit les prix (`--apply`, `RATIO_FILE=<ratio>`).

Limite à connaître : ces deux scripts lisent `sample_data/`, `frontend/node_modules/xlsx` et
`frontend/src/utils/parsers.js`. Ils ne fonctionnent donc **pas dans le conteneur backend**
(l'image ne contient que `src/` et `scripts/`) et pas sur un serveur sans `sample_data/`.
Trois options, dans l'ordre de simplicité :

1. **Import par l'application** : « Base article locale » et import du Ratio Q3 depuis l'UI.
   C'est le chemin normal, qui met à jour la table et la KV par le code de la plateforme.
2. **Exécution sur un poste disposant du dépôt complet** (Node ≥ 20, `npm ci` dans
   `frontend/` et `backend/`), en pointant la base du serveur, puis redémarrage.
3. **Copie temporaire de `sample_data/` sur le serveur** pour exécuter les scripts sur l'hôte
   (nécessite Node et les dépendances installées côté serveur), puis suppression de la copie.

Ne jamais lancer `npm run reset-db` : l'option réinitialise les comptes et la base.

## 8. Contrôles après déploiement

```bash
cd /opt/bk-ecart-docker28082026

docker compose ps                                     # backend healthy, frontend up
curl -s http://localhost:4001/api/health              # doit répondre OK
docker compose logs --tail=100 backend                # pas de stack trace au démarrage

# état de la base articles (lecture seule)
docker compose exec backend node -e 'const D=require("better-sqlite3");const db=new D("/data/data.db",{readonly:true});console.log("integrity",JSON.stringify(db.pragma("integrity_check")),"| articles",db.prepare("SELECT COUNT(*) n FROM articles").get().n,"| actifs",db.prepare("SELECT COUNT(*) n FROM articles WHERE actif=1").get().n,"| prix 27/10",db.prepare("SELECT COUNT(*) n FROM articles WHERE source=?").get("Articles sans prix CDG 27/10/2026").n,"| actifs sans prix carton",db.prepare("SELECT COUNT(*) n FROM articles WHERE actif=1 AND (pu_carton IS NULL OR pu_carton<=0)").get().n)'
```

Repères attendus (base de référence) : `integrity ok`, 621 articles, 561 actifs,
28 lignes « prix 27/10 », 29 actifs sans prix carton.
Un nombre d'articles très inférieur (≈320) signale une base prod non réimportée (§ 7).

Contrôle fonctionnel : connexion, génération d'un classeur (les 5 feuilles, logo), import,
rapport avec les 3 volets, export Excel, récap Inventaire par catégorie.

## 9. Retour arrière

```bash
cd /opt/bk-ecart-docker28082026

# a) revenir au code précédent
git checkout <sha noté au § 5>
docker compose up -d --build

# b) restaurer la base d'avant une écriture
docker compose down
cp bk-data/data.db.bak-prix-<AAAAMMJJ>.db bk-data/data.db
docker compose up -d
```

Faire (b) seul si le code est bon mais les données de prix doivent être annulées.
Conserver les fichiers `bk-data/*.bak-*` au moins jusqu'à validation par le CDG.

## 10. Dépannage

| Symptôme | Cause probable | Action |
|---|---|---|
| Écran blanc / erreurs 500 dans l'app | backend arrêté ou en crash | `docker compose ps`, `docker compose logs --tail=100 backend` |
| `port is already allocated` sur 4001 | ancien conteneur ou service occupant le port | `docker compose down --remove-orphans`, `docker ps` pour identifier le rescapé |
| `git pull` refuse : modifications locales | compose du serveur édité à la main | `git diff`, puis `git checkout -- docker-compose.yml` si seul le port diffère |
| Le script de rejeu n'existe pas dans le conteneur | image pas reconstruite | `docker compose up -d --build` (§ 5) |
| `Appariement incomplet, aucune écriture` | codes absents de la base prod | traiter § 7, puis relancer ; rien n'a été écrit |
| Prix toujours à 0 après rejeu | seule la table aurait été écrite, ou base prod non réimportée | vérifier la KV avec le contrôle du § 8 (28 lignes) |
| Référentiel généré incomplet | base prod plus petite que la base de référence | § 7 |
| Le serveur n'a pas `sample_data/` | normal (non versionné) | utiliser `--ratio=`/`--base=` ou passer par l'UI |

## 11. Exploitation et sécurité

- Ne jamais publier le port 4000 du backend : seul nginx doit l'atteindre.
- `JWT_SECRET` et `SEED_*_PW` restent dans `.env` sur le serveur, jamais dans le dépôt,
  jamais dans un message.
- Sauvegarde avant toute opération qui écrit en base (le fichier apparaît directement dans
  `bk-data/` sur l'hôte, puisque `/data` est le volume) :
  ```bash
  docker compose exec backend node -e 'const D=require("better-sqlite3");new D("/data/data.db",{readonly:true}).backup("/data/sauvegarde-avant-20261027.db").then(()=>console.log("sauvegarde ok")).catch((e)=>{console.error(e);process.exit(1)})'
  ```
- Les comptes semés ne servent qu'au premier démarrage : les mots de passe se changent
  ensuite dans l'application.

## 12. Historique des déploiements

| Date | Commit `main` | Contenu | Base |
|---|---|---|---|
| 30/09/2026 | — | premier déploiement, port 4001, volume `bk-data` | copie de `backend/data.db` |
| 26/10/2026 | `259f429` | correctifs 23-26/10, référentiel étendu | réimport serveur encore à faire |
| 27/10/2026 | `6f39f2a` | rev27 : pertes, offert, contrôles 2e niveau, script de rejeu des 28 prix, archives sorties du dépôt | rejeu § 6 après réimport § 7 |
