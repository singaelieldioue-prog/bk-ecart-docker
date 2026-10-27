# Analyse de bout en bout — BK Écart Matières

**Date** : 27/10/2026
**Code testé** : `main` @ `259f429` + 2 fichiers modifiés non commités (`frontend/src/utils/excelExporter.js`, `frontend/src/utils/pertesReferentielCdg.js`)
**Aucun commit, aucune écriture sur `backend/data.db`, aucun accès au VPS.**

---

## 1. Méthode

| Volet | Ce qui a été fait | Preuve |
|---|---|---|
| Compilation | `npm run build` (Vite) dans `frontend/` | sortie de build, exit 0 |
| API | serveur Express lancé sur le port 4555 avec une **copie jetable** de la base (`tmp_api/data.db`, snapshot `VACUUM INTO` de `backend/data.db`) | `tmp_api/api_e2e.mjs` : 24 contrôles |
| Chaîne métier | modèle généré → saisie → réimport → calcul mono/multi → export Excel réel → relecture du fichier produit | `frontend/tests/tmp_bout_en_bout.mjs` : 62 contrôles |
| Non-régression | 16 suites frontend + 3 suites backend | 19 suites, 290 contrôles |
| État réel en base | lecture seule de `backend/data.db` (rapports stockés) | requêtes SQL `json_extract` |

La copie jetable a d'abord été polluée par la campagne précédente (référentiel Ratio vidé par le test d'écrasement KV lui-même) ; elle a été **reconstruite depuis `backend/data.db`** avant la campagne retenue. C'est la campagne sur copie propre qui fait foi ci-dessous.

---

## 2. Cartographie

```
backend/src/
  server.js      API REST : auth, rapports (CRUD, import, workflow), articles, restaurants, KV
  db.js          better-sqlite3 (users, reports, articles, restaurants, kv) + réparations au démarrage
  auth.js        JWT (12 h), requireAuth, requireRole (admin toujours autorisé)
  workflow.js    machine à états : draft → submitted_to_daf → daf_approved → submitted_to_dg → dg_approved
  articles.js    diff / synchro référentiel articles
  (pas de dossier de service frontal : le backend sert uniquement l'API)

frontend/src/
  App.jsx                 orchestration : import Suivi Stock, Ratio, base article, calcul, export
  utils/parsers.js        parseSuivisStock, extractPmixFromWorkbook, diagnosticPreAnalyse
  utils/calculators.js    calculer (mono), calculerMultiRestaurants
  utils/excelExporter.js  buildModelesWb (modèles vierges) + exportExcel (rapport)
  utils/xlsxLogo.js       injection logo BK/Servair, volets figés, fullCalcOnLoad, téléchargement Blob
```

Chaîne couverte par la campagne :

```
Ratio (WA Landed Cost / PMIX / COST) + base article + correspondance + base locale
        + fiches LTO + complément PMIX
                 │
Suivi Stock (Inventaire initial/final, Transferts, Pertes, P.Douane, Offert, PMIX)
                 │  parseSuivisStock + extractPmixFromWorkbook
                 ▼
        calculer / calculerMultiRestaurants
                 │
                 ▼
        exportExcel (+ logo, recalcul à l'ouverture)
```

---

## 3. Résultats

### 3.1 Compilation Vite — OK

```
✓ 69 modules transformed.
✓ built in 10.09s
dist/assets/vendor-xlsx-BUW7exb-.js  332.97 kB │ gzip: 113.86 kB
dist/assets/index-CFztviLZ.js      1 168.49 kB │ gzip: 413.09 kB
(!) chunk > 1 000 kB  → avertissement, non bloquant
```

### 3.2 API — 24 PASS / 0 FAIL (+ 6 constats)

Vérifiés sans échec : santé, 401 sans jeton, refus de mauvais mot de passe, liste paginée *lean* (sans `stockData`) et détail complet, articles paginés et complets (621), restaurants actifs (1) / tous (3), référentiel Ratio en KV (104 produits), création de brouillon, **cycle complet CDG → DAF → DG en 5 étapes**, refus de rôle (403), action inconnue (400), transition depuis un statut final (409), création sans données (400), suppression d'un rapport validé refusée.

Les 6 constats sont détaillés en § 4.2.

### 3.3 Chaîne métier — 62 PASS / 0 FAIL (+ 3 constats)

Saisie réelle sur le modèle généré : 318 lignes d'inventaire, 3 transferts, 3 pertes, 2 prélèvements douane, 1 offert, 5 PLU PMIX.

| Indicateur | Valeur mesurée |
|---|---|
| Stock initial | 76 965 042,95 F |
| Stock final | 15 393 008,59 F |
| Transferts (entrées) | 47 670,00 F |
| Pertes | 6 478,71 F |
| Conso réelle (RG-03) | 61 619 704,36 F |
| Conso théorique | 575 247,05 F |
| Écart (RG-06) | 61 044 457,31 F (10 611,87 %) |
| Couverts | 500 |
| Fiches Ratio matchées | 5 |
| Douane | 35 591,25 F |
| Offerts | 15 |
| CA PMIX relu | 0,00 F *(défaut P1, § 4.1)* |

L'écart de 10 611,87 % **n'est pas un résultat métier** : la saisie de test remplit les 318 lignes (10 cartons en initial, 2 en final) alors que la consommation théorique ne porte que sur 5 PLU. Il valide l'arithmétique, pas le niveau d'écart réel.

Multi-restaurants (2 copies) : stock initial, entrées, conso théorique, conso réelle, écart et couverts valent exactement 2 × le mono ; `isMulti = true` ; 2 restaurants agrégés.

Export réel (émulation Node du téléchargement, Blob capturé puis relu) :

| Contrôle | Résultat |
|---|---|
| Taille | 242 333 octets |
| Feuilles | Synthèse, Écart par article, Pertes, Conso théo ingrédients, PMIX valorisé, Anomalies, Douane, Historique (8) |
| Totaux de la Synthèse | 12/12 égaux au calcul |
| Écart par article | 317 lignes |
| Pertes | TOTAL 6 478,71 F, 3 lignes publiées |
| Douane | TOTAL 35 591,25 F |
| PMIX valorisé | 5 lignes |
| Logo BK/Servair | présent dans le média du classeur |
| `fullCalcOnLoad="1"` | présent (recalcul à l'ouverture) |

### 3.4 Non-régression — 19 suites, 290 PASS / 0 FAIL

| Suite | PASS | Suite | PASS |
|---|---|---|---|
| frontend/derive-inner-colisage | 19 | frontend/recap-inventaire-categorie | 17 |
| frontend/inventaire-referentiel-cdg | 24 | frontend/recap-pmix-robustesse | 5 |
| frontend/inventaire-roundtrip-reimport | 17 | frontend/referentiel-base-complete | 43 |
| frontend/offert-total | 11 | frontend/referentiel-cond-cdg | 12 |
| frontend/pertes-ca-ht | 11 | frontend/regressions-cdg | 6 |
| frontend/pertes-liste-exacte | 19 | backend/lignes-sans-prix | 5 |
| frontend/pertes-ordre-categorie | 12 | backend/regressions-cdg | 4 |
| frontend/pertes-transmis-prix | 17 | backend/unites | 8 |
| frontend/pertes-unite | 8 | | |
| frontend/prix-code-absent | 31 | **Total** | **290 PASS / 0 FAIL** |
| frontend/prix-pepsi-chaine | 21 | | |

Toutes les suites sortent avec le code 0.

---

## 4. Anomalies

### 4.1 P1 — Le montant PMIX est perdu à la relecture d'un fichier généré par l'application

**Mesure** : 5 lignes PMIX saisies à **575 247,05 F** de montant sont relues à **0 F**. Les quantités et les prix, eux, sont corrects.

**Mécanisme** (prouvé) : le récapitulatif PMIX écrit par l'application place le libellé `INDICATEUR` en `H1`. À l'import, la détection d'en-tête cherche la colonne « montant » avec :

- `frontend/src/utils/parsers.js:1039` — `if(/amount|montant|ca/i.test(cs)) a = idx;`
- `frontend/src/utils/parsers.js:1048` — `colAmount = a;`
- `frontend/src/utils/parsers.js:1066` — `const amountRaw = colAmount >= 0 ? r[colAmount] : null;`

`INDICATEUR` contient « ca » → `colAmount = 7` (colonne H du récap) au lieu de `4` (colonne E, le vrai montant). La valeur lue est donc le libellé d'indicateur ou une case vide → `amount = 0` pour chaque ligne (`parsers.js:1068`).

**Chemin de production** : `frontend/src/App.jsx:466` et `frontend/src/App.jsx:537` appellent `extractPmixFromWorkbook` sur le fichier Suivi Stock importé.

**Confirmation sur l'état réel en base** (`backend/data.db`, lecture seule) :

| Rapport | `calc.ca` | `calc.consoTheoTotal` | `calc.couverts` |
|---|---|---|---|
| Octobre 2026 | **0** | 3 267 247,37 | 3 147 |
| Août 2026 BK1 | 8 220 183,44 | 0 | — |

Le rapport d'octobre présente exactement la signature du défaut : consommation théorique calculée, CA à zéro. Le rapport d'août montre le cas inverse (CA renseigné, conso théorique nulle) : à vérifier séparément, il peut s'agir d'un import antérieur au branchement du PMIX.

**Impact** : `calc.ca` faux ; colonne « CA FCFA » de la feuille « PMIX valorisé » et total correspondant de la Synthèse. La consommation théorique (`coutTheo × quantité`) n'est **pas** affectée.

**Correctif suggéré** (non appliqué — campagne de mesure uniquement) :
1. Exclure explicitement les en-têtes de récapitulatif (`INDICATEUR`, `TOTAL`, `COÛT MOYEN`) de la détection des colonnes ;
2. ancrer les motifs (`/^amount/`, `/^montant/`, `/^ca\b/`) au lieu d'une recherche libre ;
3. ajouter un test rouge qui rejoue `extractPmixFromWorkbook` sur un classeur généré et exige `amount > 0`.

### 4.2 Autres constats

| # | Sévérité | Constat | Preuve |
|---|---|---|---|
| 1 | P2 | `?page=abc` renvoie **500 HTML** au lieu de 400 : `parseInt` → `NaN` → `LIMIT ? OFFSET ?` | `backend/src/server.js:90-93` ; mesure API |
| 2 | P2 | Route inconnue : **404 HTML**, pas de 404 JSON (middleware absent) | mesure API |
| 3 | P2 | Import : un CDG peut insérer un rapport **directement au statut `dg_approved`** (`r.status` recopié sans `checkTransition`) | `backend/src/server.js:135`, `:155` ; test : relu `dg_approved` |
| 4 | P2 | KV : **aucun contrôle de rôle** sur `PUT /api/kv/:key` — un DG peut écraser n'importe quel référentiel | `backend/src/server.js:299-305` |
| 5 | P2 | Conséquence du #4 : le référentiel Ratio `bk_sia_ratios_parsed_v1` a été **vidé** par le test lui-même sur la copie | mesure API |
| 6 | P3 | CORS : sans `CORS_ORIGIN`, `origin: false` **bloque** toute origine croisée, alors que `.env.example:11-13` laisse croire à une configuration optionnelle | `backend/src/server.js:12` ; `.env.example:11` |
| 7 | P2 | Désignations dupliquées dans le modèle d'inventaire : **318 lignes → 317 clés** (« SANITIZER TABLETTE » fusionnée en silence) | chaîne métier |
| 8 | P3 | 3 articles sans aucun prix (classeur + tous référentiels) : TOMATES BENEVA, BOITE ENFANT, BOL A SALADE — non valorisés, donc sans impact sur les totaux, mais à renseigner | chaîne métier + suite `prix-code-absent` |
| 9 | P3 | Bundle principal > 1 Mo (1 168,49 kB) — avertissement Vite, non bloquant | build |

### 4.3 Points vérifiés comme solides

- Workflow : les transitions sont contrôlées (403/409) sur le chemin normal ; `admin` est le seul rôle à contourner `requireRole`, par conception.
- Lecture *lean* : `stockData` exclu des listes, présent dans le détail — pas de régression.
- Parsers : 318 lignes d'inventaire relues sans perte, transferts/pertes/douane/offert relus au centime, douane 35 591,25 F, offert 15.
- Calculs : RG-03 et RG-06 vérifiés à l'unité près sur 317 articles ; multi = 2 × mono sur tous les agrégats.
- Export : 12/12 totaux de synthèse, lignes et totaux des feuilles, logo et `fullCalcOnLoad`.
- Suites durables : les acquis du CDG (colisage, unités, Pertes à l'identique, récap Inventaire, chaîne de prix Pepsi) tiennent tous.

---

## 5. Limites de la campagne

- La saisie de test est **synthétique** : les niveaux d'écart ne sont pas interprétables métier.
- L'export a été exécuté en Node avec émulation du téléchargement (`document.createElement`, `URL.createObjectURL`) : le contenu du classeur est vérifié, pas le geste navigateur réel.
- L'API a été testée sur copie jetable ; aucun test n'a été fait contre le serveur de production.
- Le rapport d'août (`conso théorique = 0`) n'a pas été expliqué — observation, pas conclusion.
- Aucune correction de code n'a été appliquée : cette campagne est une mesure.

---

## 6. Recommandations, par priorité

1. **P1** — corriger la détection de la colonne « montant » du PMIX (§ 4.1) et rejouer la chaîne de bout en bout ; vérifier ensuite le `calc.ca` du rapport d'octobre après réimport.
2. **P2** — valider la pagination (`page`/`limit` entiers positifs, 400 sinon), ajouter un 404 JSON, restreindre `PUT /api/kv` au rôle CDG (ou à une liste de clés), interdire l'injection de statut à l'import (`draft` forcé ou `checkTransition`).
3. **P2** — arbitrer les désignations dupliquées du modèle d'inventaire (fusionner ou désambiguïser explicitement, ne pas laisser la fusion silencieuse).
4. **P3** — renseigner les 3 articles sans prix ; découper le bundle (import dynamique de `xlsx`).

---

## 7. Reproduire

```bash
# compilation
cd frontend && npm run build

# API sur copie jetable (port 4555)
DB_PATH=.../tmp_api/data.db PORT=4555 node backend/src/server.js &
node tmp_api/api_e2e.mjs

# chaîne métier
cd frontend && node tests/tmp_bout_en_bout.mjs

# non-régression
cd frontend && for f in derive-inner-colisage inventaire-referentiel-cdg inventaire-roundtrip-reimport \
  offert-total pertes-ca-ht pertes-liste-exacte pertes-ordre-categorie pertes-transmis-prix pertes-unite \
  prix-code-absent prix-pepsi-chaine recap-inventaire-categorie recap-pmix-robustesse \
  referentiel-base-complete referentiel-cond-cdg regressions-cdg; do node tests/$f.mjs; done
cd ../backend && for f in lignes-sans-prix regressions-cdg unites; do node tests/$f.mjs; done
```

Les fichiers `tmp_api/` et `frontend/tests/tmp_bout_en_bout.mjs` sont des outils de campagne, non commités.
