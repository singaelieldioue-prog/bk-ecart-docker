# Rapport de tests — chaîne de prix PEPSI

**Date :** 26/10/2026 · **Périmètre :** site BK1 · **Exécution :** `node tests/prix-pepsi-chaine.mjs` et campagne complète (19 suites)
**Base lue :** `backend/data.db`, en lecture seule · **Aucun fichier existant modifié · Aucun commit**

---

## 1. Verdict

| Point | Résultat |
|---|---|
| Prix PEPSI présents dans la base et dans le classeur | **Oui**, les 5 lignes sont cotées, dans toutes les feuilles qui les publient |
| Chaîne Référentiel → Transferts → réimport → calcul | **Cohérente** : le prix du Référentiel est exactement celui appliqué au calcul |
| Quantités et valorisation de l'écart | **Correctes** : cartons × colisage, écart = pièces × prix pièce |
| Campagne complète | **290 PASS / 0 FAIL sur 19 suites** |
| Divergences de prix entre sources | **Mesurées, non tranchées** — 6 points à arbitrer par le CDG (§6) |

Le prix de `BOUTEILLE PEPSI ZERO 1,5L` n'est **pas** absent : il vaut **3 150 F le carton** (525 F la pièce, colisage 6) dans la base, le Référentiel Articles, les Transferts et les Pertes. Seule la feuille Inventaire affiche **3 151 F** (table CDG), soit **1 F d'écart** — c'est le seul écart sur cette ligne.

---

## 2. Méthode

1. Lecture **SQL en lecture seule** de la table `articles` et des caches `kv` (`bk_sia_local_articles_v1`, `bk_sia_base_article_map_v1`, `bk_sia_ratios_parsed_v1`) — pas des fichiers de référence statiques du frontend.
2. Génération réelle du classeur `Suivi de stock` en mémoire via `buildModelesWb(...)` (chaîne de `BaseArticlesTab`), puis **relevé des prix publiés cellule par cellule** dans `Inventaire Initial`, `Référentiel Articles` et `Pertes`.
3. **Saisie** de quantités (10 cartons en inventaire initial, 2 en final ; 5 cartons en transfert), écriture du classeur, **relecture** et réimport par `parseSuivisStock(...)` avec les mêmes ratios / base article / base locale que la production, puis calcul par `calculer(...)`.
4. Assertions uniquement sur des invariants ; **la tolérance (0,01 F) n'a pas été touchée**. Les divergences de prix sont affichées en mesures, sans assertion, pour ne pas figer un arbitrage métier non tranché.

> Les formules du classeur n'ont pas de valeur en cache : SheetJS ne les relit pas. Le test de transfert écrit donc explicitement la désignation (C), la catégorie (D), l'unité (F) et le colisage (G) **comme Excel le ferait après recalcul** — sinon le parseur écarte la ligne (il exige une désignation en C).

---

## 3. Campagne complète — 290 PASS / 0 FAIL

| Suite | PASS | FAIL |
|---|---:|---:|
| `derive-inner-colisage` | 19 | 0 |
| `inventaire-referentiel-cdg` | 24 | 0 |
| `inventaire-roundtrip-reimport` | 17 | 0 |
| `offert-total` | 11 | 0 |
| `pertes-ca-ht` | 11 | 0 |
| `pertes-liste-exacte` | 19 | 0 |
| `pertes-ordre-categorie` | 12 | 0 |
| `pertes-transmis-prix` | 17 | 0 |
| `pertes-unite` | 8 | 0 |
| `prix-code-absent` | 31 | 0 |
| **`prix-pepsi-chaine`** | **21** | **0** |
| `recap-inventaire-categorie` | 17 | 0 |
| `recap-pmix-robustesse` | 5 | 0 |
| `referentiel-base-complete` | 43 | 0 |
| `referentiel-cond-cdg` | 12 | 0 |
| `regressions-cdg` (frontend) | 6 | 0 |
| `lignes-sans-prix` (backend) | 5 | 0 |
| `regressions-cdg` (backend) | 4 | 0 |
| `unites` (backend) | 8 | 0 |
| **Total** | **290** | **0** |

*Incident de test, pour transparence :* la suite Pepsi affichait 1 FAIL sur l'assertion « total des entrées = somme des transferts ». La cause était l'assertion elle-même — elle lisait `totalEntrees` sur le résultat du **parseur**, propriété qui n'existe que sur le résultat du **calcul** (`calculators.js:49`), donc `NaN`. Assertion réécrite sur la sortie de `calculer(...)`, tolérance inchangée, suite repassée à 21/21.

---

## 4. Prix relevés, cellule par cellule

### 4.1 Base (`articles`, 5 lignes PEPSI)

| `ref` | Nom | Code | Cond. | Prix carton | Prix pièce | Source |
|---|---|---|---:|---:|---:|---|
| BOUTEILLE PEPSI A 30CL | BOUTEILLE PEPSI 30CL | BTL-PEPSI 30CL | 12 | 1 520 | 126,6667 | Base locale |
| BOUTEILLE PEPSI ZERO 1 5L | BOUTEILLE PEPSI ZERO 1,5L | BTL-PEPSI 1,5L | 6 | **3 150** | **525** | RATIOS Q3 2026 |
| BOUTEILLE PEPSI ZERO 30CL | BOUTEILLE PEPSI ZERO 30CL | BTL-PEPSIZERO 30CL | 12 | 1 288 | 107,3333 | RATIOS Q3 2026 |
| CAN PEPSI 250ML | CAN PEPSI 250ML | BKCI-PEPSI | 24 | 3 059,3220 | 127,4718 | RATIOS Q3 2026 |
| CANETTE PEPSI ZERO 25 CL | CANETTE PEPSI ZERO 25 CL | CAN-PEPZER 25 CL | 24 | 2 576,2712 | 107,3446 | RATIOS Q3 2026 |

Contrôles passés : 5 lignes, toutes actives, toutes cotées, `prix pièce × cond. = prix carton` (± 0,01 F), aucun code partagé.

### 4.2 Feuilles du classeur généré

**Inventaire Initial** — prix en colonne K, code en N :

| Cellule | Désignation | Code (N) | Prix carton (K) | Source |
|---|---|---|---:|---|
| L30 | BOUTEILLE PEPSI ZERO 30CL | BTL-PEPSIZERO 30CL | 1 520 | `inventaireReferentielCdg.js:34` |
| L31 | BOUTEILLE PEPSI 30CL | BTL-PEPSI 30CL | 1 805 | `inventaireReferentielCdg.js:35` |
| **L34** | BOUTEILLE PEPSI 1,5L | BTL-PEPSI 1,5L | **3 151** | `inventaireReferentielCdg.js:38` |
| L35 | CAN PEPSI 250 ml | BKCI-PEPSI | 1 530 | `inventaireReferentielCdg.js:39` |
| L36 | CANETTE PEPSI ZERO 25 CL | CAN-PEPZER 25 CL | 1 530 | `inventaireReferentielCdg.js:40` |

**Référentiel Articles** — clé en A, prix carton en F (source du VLOOKUP de Transferts) :

| Cellule | Clé (A) | Désignation (B) | Prix (F) |
|---|---|---|---:|
| L25 | BTL-PEPSIZERO 30CL | BOUTEILLE PEPSI ZERO 30CL | 1 288 |
| L26 | BTL-PEPSI 30CL | BOUTEILLE PEPSI 30CL | 1 520 |
| **L29** | BTL-PEPSI 1,5L | BOUTEILLE PEPSI 1,5L | **3 150** |
| L30 | BKCI-PEPSI | CAN PEPSI 250 ml | 4 576 |
| L31 | CAN-PEPZER 25 CL | CANETTE PEPSI ZERO 25 CL | 1 530 |
| L341, L342, L345, L346, L347 | clés = désignations | 5 doublons conformes aux lignes ci-dessus | 1 288 / 1 520 / 3 150 / 4 576 / 1 530 |
| L1158 | BOUTEILLE PEPSI ZERO 1,5L | BOUTEILLE PEPSI ZERO 1,5L | 3 150 |
| **L1159** | **CAN PEPSI 250ML** | CAN PEPSI 250ML | **3 059,3220** |

**Pertes** — prix carton en D :

| Cellule | Désignation (B) | Prix (D) | Source |
|---|---|---|---:|
| L21 | BOUTEILLE PEPSI ZERO 30CL | 1 476 | `pertesReferentielCdg.js:27` |
| L24 | BOUTEILLE PEPSI ZERO 1,5L | 3 150 | base (pas de prix dans `pertesReferentielCdg.js:30`) |
| L25 | CAN PEPSI 250ML | 1 530 | `pertesReferentielCdg.js:31` |
| L26 | CANETTE PEPSI ZERO 25 CL | 1 530 | `pertesReferentielCdg.js:32` |
| L27 | BOUTEILLE PEPSI 1.5L | 3 150 | `pertesReferentielCdg.js:33` |
| L28 | BOUTEILLE PEPSI  30CL | 1 476 | `pertesReferentielCdg.js:34` |

Base locale (`kv.bk_sia_local_articles_v1`) pour les 5 articles : 1 288 / 1 520 / **3 150 (525)** / 4 576 / 1 530. Le code y est écrit `BTL-PEPSI 1.5L` (point) alors que la table `articles` porte `BTL-PEPSI 1,5L` (virgule) : la normalisation les fait coïncider, aucun impact.

---

## 5. Réimport et calcul (production rejouée)

Saisie : 10 cartons en inventaire initial, 2 en inventaire final, aucun transfert, aucune perte.

| Article | Cond. | Prix pièce retenu | Source de résolution | Initial (pièces) | Final | Écart pièces | Écart valorisé |
|---|---:|---:|---|---:|---:|---:|---:|
| BOUTEILLE PEPSI ZERO 30CL | 12 | 107,3333 | Base locale | 120 | 24 | 96 | 10 304 F |
| BOUTEILLE PEPSI 30CL | 12 | 126,6667 | Base locale | 120 | 24 | 96 | 12 160 F |
| BOUTEILLE PEPSI 1,5L | 6 | 525 | Base locale | 60 | 12 | 48 | 25 200 F |
| CAN PEPSI 250 ml | 24 | 190,6667 | Base locale | 240 | 48 | 192 | 36 608 F |
| CANETTE PEPSI ZERO 25 CL | 24 | 63,75 | Base locale | 240 | 48 | 192 | 12 240 F |

Total écart valorisé : **96 512 F**. Assertions vertes : quantités = cartons × colisage, écart = initial − final, valorisation = pièces × prix pièce, conso réelle = variation de stock.

**Constat structurel :** les 5 lignes se résolvent toutes par la **base locale**, jamais par le Ratio Q3. Vérifié dans les caches : la feuille WA Landed Cost du Ratio ne contient que les noms produits (`PEPSI SMALL`, `PEPSI MEDIUM`, `PEPSI LARGE`, `PEPSI ZERO LIGHT SMALL/MEDIUM/LARGE`) et les 4 entrées Pepsi de `baseArticle` renvoient `corresponRatio: "PACK"`, clé absente de cette feuille. Le prix appliqué au calcul dépend donc du chargement manuel de la base locale.

### Transferts (5 cartons par code)

| Code | Désignation | Qté | Cond. | Prix carton retenu | Valeur | Source |
|---|---|---:|---:|---:|---:|---|
| BTL-PEPSI 30CL | BOUTEILLE PEPSI 30CL | 5 | 12 | 1 520 | 7 600 | Base locale (code) |
| BTL-PEPSI 1,5L | BOUTEILLE PEPSI 1,5L | 5 | 6 | 3 150 | 15 750 | Base locale (code) |
| BTL-PEPSIZERO 30CL | BOUTEILLE PEPSI ZERO 30CL | 5 | 12 | 1 288 | 6 440 | Base locale (code) |
| BKCI-PEPSI | CAN PEPSI 250 ml | 5 | 24 | 4 576 | 22 880 | Base locale (code) |
| CAN-PEPZER 25 CL | CANETTE PEPSI ZERO 25 CL | 5 | 24 | 1 530 | 7 650 | Base locale (code) |

**Total des entrées = 60 320 F**, égal à `totalEntrees` du calcul et à la somme des valeurs de transferts. Chaque prix de transfert est **égal au prix publié dans le Référentiel Articles** (VLOOKUP cohérent), et chaque transfert est repris en entrées pièces (5 × colisage).

---

## 6. Divergences mesurées — 6 points à trancher

Prix carton, pour le même article, selon la source :

| Article | Base `articles` | Base locale | Inventaire (CDG) | Référentiel (clé code) | Pertes (CDG) |
|---|---:|---:|---:|---:|---:|
| BOUTEILLE PEPSI 30CL | 1 520 | 1 520 | **1 805** | 1 520 | **1 476** |
| BOUTEILLE PEPSI ZERO 30CL | 1 288 | 1 288 | **1 520** | 1 288 | **1 476** |
| BOUTEILLE PEPSI ZERO 1,5L | 3 150 | 3 150 | **3 151** | 3 150 | 3 150 |
| CAN PEPSI 250ML | 3 059,32 | **4 576** | 1 530 | 4 576 | 1 530 |
| CANETTE PEPSI ZERO 25 CL | **2 576,27** | 1 530 | 1 530 | 1 530 | 1 530 |

1. **1,5 L : 3 150 ou 3 151 ?** La base, le Référentiel, les Transferts et les Pertes sont à 3 150 (valeur de la capture du CDG) ; seule la table Inventaire publie 3 151 (`inventaireReferentielCdg.js:38`) → 0,1667 F de plus par pièce. Impact : 1 F par carton.
2. **CAN PEPSI 250ML : trois prix.** 4 576 (base locale, appliqué aux transferts) / 3 059,32 (Ratio Q3, encore publié comme clé `CAN PEPSI 250ML` en `L1159`) / 1 530 (tables Inventaire et Pertes du CDG). Écart maximal : **3 046 F par pack** (~3×).
3. **CANETTE PEPSI ZERO 25 CL : la ligne `articles` est périmée.** Elle porte 2 576,27 (Ratio Q3) alors que la base locale et toutes les feuilles sont à 1 530. Les feuilles sont justes ; toute vue qui lit `articles.pu_carton` directement affiche 2 576,27.
4. **Deux prix CDG pour le même produit.** Inventaire 1 805/1 520 contre Pertes 1 476 pour les 30 CL : le CDG valorise le stock et la perte à deux prix différents (écarts 329 F pour PEPSI 30CL et 44 F pour ZERO 30CL). À confirmer ou corriger côté CDG.
5. **Doubles clés dans le Référentiel Articles.** `BKCI-PEPSI` (L30) = 4 576 et `CAN PEPSI 250ML` (L1159) = 3 059,32 coexistent dans la même plage de VLOOKUP : **la valeur du transfert dépend de ce que l'utilisateur tape en colonne E** (code ou désignation). Même mécanisme, sans conséquence, pour les 5 doublons conformes (L341..L347).
6. **Doublon et libellé dans Pertes.** `BOUTEILLE PEPSI ZERO 1,5L` (L24) et `BOUTEILLE PEPSI 1.5L` (L27) désignent le même code : si les deux lignes sont remplies, la perte est comptée deux fois. Et l'Inventaire affiche « BOUTEILLE PEPSI 1,5L » sans « ZERO » pour l'article ZERO (L34).

Aucun de ces points n'a été corrigé ici : ce sont des arbitrages de prix, hors du périmètre « faire des tests ». Le point 4 était déjà connu (deux tables CDG distinctes) ; les points 1, 2, 3, 5 et 6 sont mesurés par cette campagne.

---

## 7. Ce que ces tests ne prouvent pas

- **Le recalcul par Excel/LibreOffice** : le classeur est relu par SheetJS, qui ignore les cellules sans valeur en cache. Les formules sont vérifiées via leur construction et le XML, pas par une ouverture réelle du fichier.
- **L'interface** : aucun test navigateur dans cette campagne (cache, import, écrans).
- **La production** : tout est calculé sur la copie locale `backend/data.db`, pas sur le VPS.
- **Les autres restaurants** : seul BK1 est rejoué.
- **Le reste du référentiel** : les 5 lignes Pepsi sont couvertes de bout en bout ; les autres articles ne le sont que par les suites ciblées (tables CDG, colisage, Pertes, Offert), pas par une chaîne de prix article par article.

---

## 8. Reproduire

```bash
cd "C:\Users\arnaud.nzue\Downloads\files (12)\bk-ecart-docker28082026\frontend"
node tests/prix-pepsi-chaine.mjs          # 21 PASS / 0 FAIL — chaîne Pepsi
```

Campagne complète : exécuter les fichiers `*.mjs` de `frontend/tests/` (hors `tmp_*`) et de `backend/tests/`.
