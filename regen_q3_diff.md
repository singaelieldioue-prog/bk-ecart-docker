# REGEN-Q3 — Les 2 derniers rapports régénérés avec le Ratio Q3 actif (25/10/2026)

Périmètre demandé : régénérer **uniquement** `60198f93` (Écart matières — octobre 2026 · BK1, créé le 23/10 09:35) et `76b8d757` (Écart matières — octobre 2026 · BK COCODY, créé le 22/10 00:33), les 2 rapports dont `ratiosMeta.label` portait `RATIOS  Q2 2026.xlsx · Chargés le 21/10/2026`.

**Verdict : 2/2 régénérés, tous critères d'acceptation verts, aucune autre écriture en base.**

---

## 1. Méthode — ce qui a été recalculé, et avec quoi

Le recalcul reproduit exactement le chemin de l'application, sans raccourci :

| Étape | Source | Référence |
|---|---|---|
| Référentiel Ratio actif | KV `bk_sia_ratios_parsed_v1` (87 `byPlu`, 104 `byNom`, 122 `pmpByIng`, 125 `waLandedCost`) | `App.jsx:406` (`ratios = clone(ratiosParsedRef.current)`) |
| Base articles | KV `bk_sia_base_article_map_v1` | `App.jsx:417` |
| Complément PMIX | KV `bk_sia_pmix_complement_v1` (231 PLU) | `App.jsx:541` |
| Journal du Ratio | KV `bk_sia_ratios_v1` = `{label:"RATIOS BURGER KING ABJ Q3 2026.xlsx", date:"23/10/2026", nbProduits:104, nbIngredients:122}` | `App.jsx:552-570` |
| Calcul | `calculer(stockData, pmixList, ratios, baseArticle, pmixComplement)` | `frontend/src/utils/calculators.js:40`, appelé depuis `App.jsx:541` |

Les entrées `stockData` et `pmixList` sont **celles, stockées, des rapports** (aucune réinterprétation d'un classeur source : le rapport ne conserve pas le nom du fichier suivi stock importé). Seuls `data.calc`, `data.ficheMatchees` et `data.ratiosMeta` sont réécrits ; `data.stockData`, `data.pmixList`, `data.dateLabel`, `data.site`, `data.isMulti`, `data.ltoFiches` sont **reconduits à l'octet près** (contrôle §8), ainsi que les colonnes `titre`, `status`, `site`, `created_at`, `created_by`, `history`.

`ratiosMeta.label` reprend le format de l'application (`<label> · Chargés le <date>`), d'où la valeur écrite : `RATIOS BURGER KING ABJ Q3 2026.xlsx · Chargés le 23/10/2026`.

## 2. Sauvegarde

`backend/reports_backup_20261025_135457.db` — 12 840 960 octets, produite **avant** toute écriture par l'API de sauvegarde en ligne SQLite (`Connection.backup`, donc instantané cohérent incluant le WAL de 4,6 Mo). Contrôle après création : les 12 rapports, la table `kv` et la table `articles` de la sauvegarde sont **identiques** à la base active (empreintes SHA-256 des `data` égales ligne à ligne, `kv` `953dbfd5169b40be`, `articles` `0f7aeea500e8b767`). Les deux rapports cibles y conservent leur label Q2 d'origine.

> **Point d'attention** : `.gitignore` couvre `backend/data.db`, `backend/data.backup*.db` et `backend/data.pre-restore*.db`, mais **pas** le nom imposé `reports_backup_*.db`. Cette sauvegarde — qui contient la table `users` et ses `password_hash` — apparaît donc en fichier non suivi (`git status`). Rien n'est committé ; avant tout `git add`, soit ajouter une règle `backend/reports_backup_*.db`, soit renommer la sauvegarde au format déjà ignoré. À arbitrer par le CDG.

## 3. Avant / après, rapport par rapport

### 3.1 `60198f93` — Écart matières — octobre 2026 · BK1 (brouillon, créé le 23/10/2026 09:35:47)

| Indicateur | AVANT (Q2 21/10) | APRÈS (Q3 23/10) | Δ |
|---|---|---|---|
| `ratiosMeta.label` | RATIOS  Q2 2026.xlsx · Chargés le 21/10/2026 | **RATIOS BURGER KING ABJ Q3 2026.xlsx · Chargés le 23/10/2026** | — |
| `ratiosMeta.nbProduits` (nb PLU) | 104 | 104 | = |
| `ratiosMeta.nbIngredients` | 121 | 122 | +1 |
| Couverts PMIX / lignes `pmixTheo` | 2 045 / 133 | 2 045 / 133 | = |
| Lignes au Ratio / au complément / anomalies | 48 / 34 / 48 | 48 / 34 / 48 | = |
| Conso théorique | 559 270,36 F | **549 437,05 F** | −9 833,30 F (−1,76 %) |
| Conso réelle (variation de stock + transferts) | 9 881 242,45 F | 9 881 242,45 F | 0 |
| **Écart matières** | 9 321 972,09 F | **9 331 805,39 F** | **+9 833,30 F (+0,11 %)** |
| Écart en % de la conso théorique | 1 666,81 % | 1 698,43 % | +31,62 pts |
| Coût matière vendue | 559 259,36 F | 549 426,05 F | −9 833,30 F |
| Pertes non contrôlées | 8 327 101,20 F | 8 336 934,50 F | +9 833,30 F |
| Destruction contrôlée / pertes | 994 870,89 F | 994 870,89 F | 0 |

### 3.2 `76b8d757` — Écart matières — octobre 2026 · BK COCODY (brouillon, créé le 22/10/2026 00:33:41)

| Indicateur | AVANT (Q2 21/10) | APRÈS (Q3 23/10) | Δ |
|---|---|---|---|
| `ratiosMeta.label` | RATIOS  Q2 2026.xlsx · Chargés le 21/10/2026 | **RATIOS BURGER KING ABJ Q3 2026.xlsx · Chargés le 23/10/2026** | — |
| `ratiosMeta.nbProduits` / `nbIngredients` | 104 / 121 | 104 / 122 | +1 ingrédient |
| Couverts PMIX / lignes `pmixTheo` | 2 045 / 133 | 2 045 / 133 | = |
| Lignes au Ratio / au complément / anomalies | 48 / 34 / 48 | 48 / 34 / 48 | = |
| Conso théorique | 559 270,36 F | **549 437,05 F** | −9 833,30 F |
| Conso réelle | 223 196 163,72 F | 223 196 163,72 F | 0 |
| **Écart matières** | 222 636 893,37 F | **222 646 726,67 F** | **+9 833,30 F (+0,004 %)** |
| Écart en % de la conso théorique | 39 808,46 % | 40 522,70 % | +714,24 pts |
| CA PMIX | 430 071,21 F | 430 071,21 F | 0 |

Les deux rapports partagent le même fichier de ventes PMIX (133 lignes identiques) : les coûts unitaires théoriques, et donc les 46 deltas du §4, sont **les mêmes dans les deux rapports**. Seule la partie stock diffère.

## 4. Les 46 PLU dont le coût unitaire change (valeurs identiques dans les 2 rapports)

Coûts en F CFA, par unité vendue ; « impact » = Δ coût × quantité PMIX.

| PLU | Produit | Qté | Coût AVANT | Coût APRÈS | Δ unitaire | Impact |
|---|---|---|---|---|---|---|
| 815 | CHEESEBURGER JUNIOR | 30 | 1 588.29 | 1 455.41 | -132.88 | -3 986.41 |
| 835 | 4 NUGGETS JUNIOR | 7 | 1 462.35 | 1 337.59 | -124.77 | -873.37 |
| 810 | HAMBURGER JUNIOR | 5 | 1 521.74 | 1 401.00 | -120.73 | -603.67 |
| 1106 | 12 NUGGETS | 14 | 1 151.69 | 1 036.60 | -115.10 | -1 611.36 |
| 120 | DOUBLE WHOPPER | 13 | 1 673.16 | 1 759.04 | +85.89 | +1 116.52 |
| 369 | 4 NUGGETS | 21 | 426.38 | 347.59 | -78.79 | -1 654.68 |
| 361 | 6 NUGGETS | 12 | 582.37 | 524.25 | -58.12 | -697.45 |
| **110** | **WHOPPER** | 18 | 1 131.38 | **1 186.67** | **+55.29** | **+995.26** |
| 494 | CRISPY CHICKEN SALAD | 1 | 1 744.10 | 1 702.72 | -41.38 | -41.38 |
| 350 | TENDERGRILL | 2 | 1 312.90 | 1 353.48 | +40.57 | +81.15 |
| 200106 | 9 NUGGETS | 6 | 813.69 | 777.91 | -35.78 | -214.70 |
| 1101 | 9 NUGGETS | 3 | 813.69 | 777.91 | -35.78 | -107.35 |
| 115 | WHOPPER CHEESE | 3 | 1 264.48 | 1 295.48 | +31.00 | +92.99 |
| 756 | 9 CHILI CHEESE BITES | 11 | 737.43 | 708.34 | -29.09 | -319.96 |
| 261 | EXTRA LONG CHILI CHEESE | 14 | 1 137.67 | 1 164.78 | +27.11 | +379.55 |
| 479 | GRILLED CHICLEN SALAD | 1 | 2 061.32 | 2 036.83 | -24.49 | -24.49 |
| **717** | **LARGE FRIES** | 27 | 433.82 | **411.07** | -22.75 | -614.32 |
| 500150 | VALUE CHICKEN | 23 | 494.96 | 472.97 | -21.99 | -505.80 |
| 755 | 6 CHILI CHEESE BITES | 7 | 497.84 | 477.87 | -19.97 | -139.82 |
| 263 | LONG CHILI CHEESE CHICKEN | 11 | 1 027.99 | 1 008.33 | -19.66 | -216.23 |
| 262 | CHILI CHEESE BURGER | 2 | 696.75 | 714.21 | +17.46 | +34.92 |
| 383 | KING FISH | 1 | 905.89 | 888.70 | -17.19 | -17.19 |
| 1102 | BIG KING XXL | 16 | 1 814.37 | 1 830.77 | +16.40 | +262.47 |
| 710 | MEDIUM FRIES | 2 | 299.80 | 283.48 | -16.32 | -32.64 |
| 200112 | BIG KING | 15 | 915.03 | 899.05 | -15.98 | -239.64 |
| 754 | 4 CHILI CHEESE BITES | 6 | 336.35 | 322.85 | -13.50 | -80.98 |
| **706** | **SMALL FRIES** | 57 | 242.11 | **229.74** | -12.37 | -705.12 |
| 150111 | DELUXE | 12 | 1 317.69 | 1 329.87 | +12.19 | +146.24 |
| 2531 | FUSION Kit Kat | 5 | 380.98 | 368.88 | -12.10 | -60.51 |
| 740 | 6 ONION RINGS | 4 | 223.42 | 212.78 | -10.63 | -42.52 |
| 500148 | 6 CHICKEN STRIPS | 10 | 1 465.76 | 1 455.16 | -10.60 | -105.99 |
| 310 | LONG CHICKEN | 31 | 812.32 | 821.74 | +9.42 | +292.12 |
| 220 | CHEESEBURGER | 21 | 510.53 | 501.37 | -9.16 | -192.31 |
| 330 | TENDERCRISP | 10 | 1 087.09 | 1 080.64 | -6.45 | -64.47 |
| 225 | DOUBLE CHEESE BURGER | 18 | 809.40 | 803.03 | -6.37 | -114.74 |
| 500147 | 3 CHICKEN STRIPS | 5 | 742.52 | 736.95 | -5.57 | -27.85 |
| 200132 | CRISPY CHICKEN | 17 | 708.22 | 711.84 | +3.62 | +61.54 |
| 210 | HAMBURGER | 12 | 443.98 | 446.97 | +2.99 | +35.88 |
| 130 | WHOPPER Junior | 3 | 609.27 | 612.22 | +2.96 | +8.87 |
| 2530 | FUSION Oreo | 3 | 289.25 | 286.73 | -2.52 | -7.56 |
| 2507 | CONE | 28 | 71.89 | 70.86 | -1.03 | -28.80 |
| 2509 | SUNDAE Caramel | 5 | 232.44 | 231.48 | -0.96 | -4.79 |
| 2510 | SUNDAE Chocolate | 3 | 206.44 | 205.48 | -0.96 | -2.87 |
| 2508 | SUNDAE Vanilla | 2 | 97.93 | 96.97 | -0.96 | -1.92 |
| 400131 | Small MILKSHAKE Vanilla | 1 | 111.65 | 111.51 | -0.14 | -0.14 |
| **400102** | **Pepsi Medium** | 4 | 123.99 | **124.03** | +0.04 | +0.17 |

**Réconciliation** : Σ des impacts = **−9 833,30 F**, soit exactement la variation de conso théorique du §3 (aucune ligne non expliquée). Les 36 autres lignes `pmixTheo` (dont les 34 du complément PMIX) gardent un coût identique ; **aucun PLU n'est apparu ni disparu**, et **aucune source de coût n'a changé** (48 lignes restent `ratio`, 34 restent `complement`).

Côté ingrédients, `consoParIng` passe de 75 à 76 lignes : **`CROWN` fait son apparition (1 771,20 F)**, marqueur du passage Coca/Fanta/Sprite → Pepsi/Mirinda/7UP du Q3. 48 ingrédients voient leur valeur théorique bouger, les plus marqués : `TOY` −6 269,87 F, `SNACK DIP` −4 698,94 F (quantité 70 → 128), `CHEESE (Slice)` −3 170,41 F, `WHOPPER PATTY` +2 784,05 F, `HAMBURGER PATTY` +2 732,24 F, `LAITUCE ICEBERG` −2 248,81 F, `FRIES (kg)` −2 003,63 F. Les quantités restent identiques sauf pour `SNACK DIP` : **le Q3 change des prix, pas les recettes**.

## 5. Impact sur l'écart matières

| | BK1 | BK COCODY |
|---|---|---|
| Écart avant | 9 321 972,09 F | 222 636 893,37 F |
| Écart après | 9 331 805,39 F | 222 646 726,67 F |
| **Δ FCFA** | **+9 833,30 F** | **+9 833,30 F** |
| **Δ relatif sur l'écart** | **+0,105 %** | **+0,004 %** |
| Écart / conso théorique | 1 666,81 % → 1 698,43 % | 39 808,46 % → 40 522,70 % |

L'écart matière **augmente** parce que la conso théorique **baisse** (−9 833,30 F) à conso réelle inchangée. C'est le sens de lecture de `RG-06` : `écart = conso réelle − conso théorique`.

**L'effet réel du Ratio Q3 est donc faible (≈ 10 000 F) rapporté aux écarts affichés (9,3 M F et 222,6 M F).** Le « Pepsi absent » et le « Whopper 5 500 » étaient bien des artefacts d'affichage liés au référentiel Q2, maintenant corrigés au niveau des coûts produits ; mais les montants d'écart restent dominés par les deux problèmes déjà documentés et non traités ici :

1. **Valorisation du stock figée à l'import** : `stockData.invIni/invFin/sorties/pertes` conservent leurs `.valeur` et `.puCarton` calculés au moment de l'import (référentiel Q2 du 21/10). `consoReelle`, `totalValIni` (1 740 270,16 F), `totalValFin` (9 292 355,25 F), `totalEntrees` (17 433 327,54 F) et `totalPertes` (994 870,89 F) sont **inchangés** — volontairement : le prompt interdit de modifier les prix et la base articles, et le nom du classeur « suivi stock » d'origine n'est pas stocké dans le rapport, ce qui rendrait une reparse fidèle impossible sans guess. Pour chiffrer aussi le côté stock, il faut relancer l'analyse sur le classeur source avec le Q3 chargé (UI), pas régénérer le rapport.
2. **Rattachement théorique → stock (dossier P0-4)** : seules 270 pièces de vente théorique sont rattachées à un article de stock, quel que soit le Ratio (valeur identique avant/après). Le Ratio n'est pas la cause dominante de ce volet.
3. **9 autres rapports portent encore un label Q2** en base (périodes août, septembre, versions de travail d'octobre). Ils sont hors du périmètre demandé (« Interdit : régénérer d'autres rapports que les 2 concernés ») et n'ont pas été touchés ; à régénérer séparément si le CDG veut un historique homogène au Q3.

## 6. Critères d'acceptation

| Critère | Mesure en base après écriture | État |
|---|---|---|
| 2 rapports régénérés avec `ratiosMeta.label` Q3 | `RATIOS BURGER KING ABJ Q3 2026.xlsx · Chargés le 23/10/2026` sur `60198f93` et `76b8d757` | ✅ |
| Whopper PLU 110 = 1 186,67 F ± 1 | 1 186,6721 F (BK1 et COCODY) | ✅ |
| PLU 706 = 229,74 F ± 1 | 229,7356 F | ✅ |
| PLU 717 = 411,07 F ± 1 | 411,0699 F | ✅ |
| Pepsi PLU 400101-400123 = 124,03 F ± 1 | PLU **400102 = 124,0350 F** présent dans les 2 rapports (×4). Les autres PLU de la plage (400101, 400103, 400121, 400122, 400123) valent bien 124,035 F dans le Ratio Q3 mais **n'ont aucune ligne de vente** dans ces rapports : non régénérables, non forcés | ✅ (sur la ligne existante) |
| Backup pris pour chaque rapport | `backend/reports_backup_20261025_135457.db`, contenu vérifié identique à l'état antérieur | ✅ |
| `regen_q3_diff.md` produit avec chiffres avant/après | ce fichier | ✅ |
| Aucune écriture en base hors les 2 rapports | 12 rapports comparés par empreinte : seules `60198f93` et `76b8d757` diffèrent ; `kv` et `articles` (903 lignes) inchangés | ✅ |
| Interdit : modifier le Ratio / la whitelist / les prix / la base articles | Aucun fichier `sample_data/*`, aucune clé KV, aucune ligne `articles` touchée | ✅ |
| Interdit : régénérer d'autres rapports | 10 rapports intacts, **dont 9 portent encore un label Q2** (non demandés : ils mélangent d'autres périodes et d'autres imports) | ✅ |

**Écarts avec la prémisse du prompt, signalés plutôt que corrigés en douce :**
- le « hash 6c7cb1e5 » du Ratio Q3 est la **signature des clés/valeurs `byPlu`** stockées en KV (`ratio_q3_comparaison.md:10`), pas l'empreinte du fichier. L'empreinte du fichier `sample_data/RATIOS BURGER KING ABJ Q3 2026.xlsx` est sha256 `ea241d6cd40e…` (md5 `0d420384a5d5…`), 465 976 octets. Les deux désignent bien le même référentiel actif ;
- le PLU **705** (frites) n'existe pas dans le Ratio Q3 : il reste servi par le complément PMIX à 242 F × 19 unités, comme avant ;
- le ratio de l'écart s'exprime en fraction dans `calc.ecartMatiereP` (16,98 = 1 698 %) — les pourcentages du §3 sont rendus lisibles, la valeur brute en base n'est pas retouchée.

## 7. Anomalies résiduelles (inchangées par la régénération)

| Anomalie | BK1 | BK COCODY |
|---|---|---|
| PLU sans fiche (48 lignes, préfixe `900xxx`, 265 pièces) — menus « MN » absents de la correspondance | 48 | 48 |
| Lignes servies par le complément PMIX, hors Ratio (34 lignes, 152 816,99 F de conso théorique, soit 27,8 % du total) | 34 | 34 |
| Dont PLU 713 « MOYEN FRITES » ×179 à 242,43 F et 715/705 à 242 F — non couverts par le Q3 | oui | oui |
| Lignes hors matière exclues du calcul | 3 (`8017` ENFT JOUET ×53, `5505` NO Sauce ×20, `50000` GLOVO ×72) | 3 (identiques) |
| Articles de stock sans prix résolu (`puPieceSource = "aucun"`) | 16 (−3 847,6 pièces d'écart non chiffrées) | 14 (−1 608,98 pièces) |
| Conso théorique issue du Ratio | 396 620,07 F (72,2 %) | 396 620,07 F |
| CA PMIX | 0 F (colonnes prix vides dans le suivi) | 430 071,21 F |

Aucune de ces anomalies n'a été créée ni résorbée par le passage au Q3 : les compteurs de correspondance sont identiques avant/après. Elles relèvent des dossiers A1 (menus `900xxx`), P0-4 (rattachement) et base articles locale (prix manquants), hors du périmètre de cette régénération.

## 8. Intégrité — ce qui n'a pas bougé

- Colonnes `titre`, `status` (`draft`), `site`, `created_at`, `created_by`, `history` des 2 rapports : identité vérifiée après écriture. Seuls `data` et `updated_at` (`2026-10-25 13:56:13`, format `datetime('now')` du backend) sont posés.
- `data.stockData`, `data.pmixList`, `data.dateLabel`, `data.site`, `data.isMulti`, `data.ltoFiches` : comparés `True` à la sauvegarde, clé par clé.
- Structure de `data.calc` : jeux de clés identiques avant/après (`pmixTheo`, `articlesEcart`, `consoParIng`, indicateurs) — aucun champ perdu par la version de code actuelle.
- 10 autres rapports, table `kv` (7 clés), table `articles` (903 lignes) : empreintes identiques avant/après.
- `sample_data/`, fichiers du CDG, code source : non touchés par cette tâche. **Aucun commit.** Rien de déployé sur le VPS de production (`/opt/bk-ecart-docker28082026`) — la régénération ne concerne que la base locale.

## 9. Rejouer la vérification

```bash
# 1. extract lecture seule des référentiels + des 2 rapports
python <dump KV/reports → tmp_regen/*.json>
# 2. jet d'essai chiffré, sans écriture
cd frontend && node tests/tmp_regen_q3_dryrun.mjs
# 3. préparation des nouveaux data
cd frontend && node tests/tmp_regen_q3_emit.mjs
# 4. backup + écriture des 2 lignes uniquement (empreintes de contrôle à la fin)
```

Les scripts temporaires de cette tâche sont `frontend/tests/tmp_regen_q3_dryrun.mjs` et `frontend/tests/tmp_regen_q3_emit.mjs` ; les artefacts intermédiaires sont dans `tmp_regen/`.
