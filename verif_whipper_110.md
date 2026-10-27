# VERIF-WHOPPER-110 — Le « 5 500 F » du Whopper est-il un prix de vente ?

**Rapport de vérification en lecture seule** — généré le 24/10/2026.
Aucune modification : le Ratio, les prix, la base et le code n'ont pas été touchés (`git status` inchangé sur les fichiers de production).

Fichier audité : `sample_data/RATIOS BURGER KING ABJ Q3 2026.xlsx` (onglet actif : `Data sheet`, `COST`, `Ratios`, `PMP marchandises`, `WA Landed Cost`, `Products list`, `Correspondance nom`).
Contexte de la charge : Ratio Q3 2026 chargé le 23/10/2026 (`nbProduits: 104`, `nbIngredients: 122`), label stocké : « RATIOS BURGER KING ABJ Q3 2026.xlsx ».

---

## 1. Verdict

**OUI — 5 500 F est bien un prix de vente TTC.** Ce n'est pas une valorisation matière.

| | Valeur | Cellule source | Intitulé exact de la colonne |
|---|---|---|---|
| Prix de vente TTC (sandwich seul) | **5 500 F** | `Ratios!C5` | `PV TTC` (en-tête `Ratios!C4`), bloc `SANDWICH ONLY` (fusion `Ratios!C3`) |
| Prix de revient / coût théorique | **1 186,67 F** (arrondi à 1 187 F) | `Ratios!D5` et `COST!C5` | `COÛT` (en-tête `Ratios!D4`) / `COST` (en-tête `COST!C4`) |

**Les deux chiffres d'Aristide sont donc vrais, mais ils ne mesurent pas la même chose.** L'un est le prix affiché en caisse, l'autre le coût matière de la fiche. L'« écart » apparent de 4 313,33 F (5 500 − 1 186,67) est en réalité la **marge brute matière**, pas une erreur.

---

## 2. Où se trouve le PLU 110 — et où il ne se trouve pas

Le PLU n'existe **que dans une seule feuille**. Les prix, eux, ne sont **pas dans la feuille que la demande citait** (`COST`) mais dans la feuille `Ratios`, absente de la liste initiale.

| Feuille du Ratio | PLU 110 présent ? | Prix de vente présent ? | Prix de revient présent ? | Rôle réel |
|---|---|---|---|---|
| `Data sheet` | **OUI** : `Data sheet!C5` = 110, `B5` = `WHOPPER`, `A5` = `SANDWICHS` | **NON** — aucune colonne de prix ; la ligne ne porte que des quantités d'ingrédients (voir §4) | NON | Base PLU + recette (ratios d'ingrédients) |
| `Ratios` | NON (pas de colonne PLU ; produits identifiés par le nom en colonne B) | **OUI** : `C5` = 5 500 (`PV TTC`) | **OUI** : `D5` = 1 186,6720790730283 (`COÛT`) | **Seule feuille de prix de l'appli** (6 blocs tarifaires) |
| `COST` (fiches techniques) | NON (pas de colonne PLU ; nom en `B5`) | **NON — absence documentée** | **OUI** : `C5` = 1 186,6720790730283, + coût par ingrédient | Décomposition du coût matière |
| `PMP marchandises` | NON | NON | NON (au produit) — uniquement le PMP **par ingrédient** (`PMP marchandises!C5` = « Average Weighted cost », 13 lignes au total) | Coûts moyens d'achat matière |
| `WA Landed Cost` | NON | NON | NON (au produit) — 166 lignes **ingrédient/contenant**, ex. `C33` = `BEEF PATTY WHOPPER HALAL`, `D33` = `BKFR16`, `H33` = 64 105,49 F/carton | PMP atterrissage par référence d'achat |

Compléments vérifiés : `Products list` (166 lignes, pas de PLU) et `Correspondance nom` (feuille masquée, 118 lignes) **ne contiennent aucune entrée « WHOPPER » au niveau produit** — seulement des correspondances d'ingrédients (ex. `B19` = `WHOPPER PATTY - Americana` ↔ `C19` = `BEEF PATTY WHOPPER HALAL`). Le prix de vente du PLU 110 ne peut donc être rattaché qu'**indirectement**, par le nom de ligne `WHOPPER`.

---

## 3. Tableau de TOUTES les colonnes du PLU 110 (WHOPPER) — feuille `Ratios`

Ligne `WHOPPER` = ligne 5 dans toutes les feuilles (alignement par le nom, `Ratios!B5` = `COST!B5` = `Data sheet!B5` = `WHOPPER`).

### Bloc `SANDWICH ONLY` — le sandwich seul, ce qui concerne le « 5 500 »

| Colonne | En-tête (`Ratios!ligne 4`) | Valeur exacte lue | Valeur lisible | Nature |
|---|---|---|---|---|
| `C5` | `PV TTC` | 5500 | **5 500 F** | **Prix de vente TTC** |
| `D5` | `COÛT` | 1186.6720790730283 | **1 186,67 F** | Prix de revient matière |
| `E5` | `Coût (€)` | 1.809069922377577 | 1,81 € | Coût converti (`D5 ÷ 655,957`) |
| `F5` | `PV HT` | 4547.33360892931 | 4 547,33 F | Prix de vente **hors taxes** |
| `G5` | `GP` | 3360.6615298562815 | 3 360,66 F | **Marge brute** (Gross Profit) = `F5 − D5` |
| `H5` | `GP (€)` | 5.123295474941622 | 5,12 € | Marge en euros |
| `I5` | `Ratio` | 0.26095997811615046 | **26,10 %** | **Food cost** = `D5 ÷ F5` |

### Autres blocs de la même ligne (les prix de vente ne se résument pas à 5 500 F)

| Bloc (`Ratios!ligne 3`) | PV TTC | COÛT | PV HT | GP | Ratio |
|---|---|---|---|---|---|
| `SANDWICH ONLY` (C–I) | 5 500 F (`C5`) | 1 186,67 F (`D5`) | 4 547,33 F (`F5`) | 3 360,66 F (`G5`) | 26,10 % (`I5`) |
| `MENU LARGE` (J–P) | 8 000 F (`J5`) | 1 721,78 F (`K5`) | 6 614,30 F (`M5`) | 4 892,53 F (`N5`) | 26,03 % (`P5`) |
| `MENU MEDIUM` (Q–W) | 7 000 F (`Q5`) | 1 540,44 F (`R5`) | 5 787,52 F (`T5`) | 4 247,07 F (`U5`) | 26,62 % (`W5`) |
| `MENU Yêrê` (X–AD) | *vide* | *vide* | *vide* | *vide* | *vide* |
| `MENU Yêrê + boisson` (AE–AK) | *vide* | *vide* | *vide* | *vide* | *vide* |
| `MENU KID` (AL–AR) | *vide* | *vide* | *vide* | *vide* | *vide* |

Paramètres de la feuille : `Ratios!B2` = « CURRANCY RATE: », `C2` = 655,957 ; `G2` = « VAT rate: », `H2` = 1,2095, `I2` = 0,1977 (soit TVA 19,77 %).

### Preuve de cohérence interne (recalculs, aucun arrondi ne cache un autre sens)

| Contrôle | Formule | Résultat recalculé | Valeur écrite | Écart |
|---|---|---|---|---|
| PV HT | `5 500 ÷ 1,2095` | 4 547,33360892931 | `F5` = 4 547,33360892931 | **0,0** |
| Marge | `F5 − D5` | 3 360,6615298562815 | `G5` = 3 360,6615298562815 | **0,0** |
| Coût en € | `D5 ÷ 655,957` | 1,809069922377577 | `E5` = 1,809069922377577 | **0,0** |
| Food cost | `D5 ÷ F5` | 0,26095997811615046 | `I5` = 0,26095997811615046 | **0,0** |
| Coût matière | somme des 11 ingrédients `COST!ligne 5` | 1 186,672079 | `COST!C5` = 1 186,672079 | **0,0** |

`D5` (1 186,67 F) est **exactement** `COST!C5` : c'est bien le prix de revient, pas un prix de vente. `C5` (5 500) ne s'obtient d'aucune somme de coûts : c'est une donnée de vente.

---

## 4. Détail de la ligne PLU 110 dans `COST` et `Data sheet`

Décomposition du coût (`COST!ligne 5`, colonne C = total, le reste en FCFA par ingrédient) :

| Ingrédient (en-tête `COST!ligne 4`) | Cellule | Valeur |
|---|---|---|
| BUN 5' (`P`) | `P5` | 189,47 F |
| MAYO kg (`R`) | `R5` | 54,09 F |
| KETCHUP kg (`T`) | `T5` | 20,73 F |
| TOMATO slice (`AB`) | `AB5` | 145,83 F |
| ONION kg (`AC`) | `AC5` | 11,20 F |
| LAITUCE ICEBERG kg (`AD`) | `AD5` | 126,42 F |
| PICKLE SLICE pc (`AK`) | `AK5` | 35,42 F |
| **WHOPPER PATTY** (`AM`) | `AM5` | **572,37 F** (48,2 % du coût) |
| WHOPPER WRAP (`BC`) | `BC5` | 15,35 F |
| NAPKIN (`DR`) | `DR5` | 2,79 F |
| PLATE LEAVE (`DS`) | `DS5` | 13,00 F |
| **Total** | `C5` | **1 186,67 F** |

Quantités théoriques correspondantes (`Data sheet!ligne 5`, colonnes sans prix) : `P5`=1 bun 5', `R5`=0,021 kg mayo, `T5`=0,014 kg ketchup, `AB5`=2 tomates, `AC5`=0,014 kg oignon, `AD5`=0,021 kg laitue, `AK5`=4 pickles, `AM5`=1 patty Whopper, `BD5`=1 wrap, plus les marqueurs de service `DS5`/`DT5`.

---

## 5. Tableau comparatif 110 / 115 / 120

| | **110 WHOPPER** | **115 WHOPPER CHEESE** | **120 DOUBLE WHOPPER** |
|---|---|---|---|
| Cellule PLU (`Data sheet!C`) | `C5` = 110 | `C6` = 115 | `C7` = 120 |
| Nom produit (3 feuilles alignées, col. B) | `WHOPPER` | `WHOPPER CHEESE` | `DOUBLE WHOPPER` |
| Catégorie | `SANDWICHS` (`Data sheet!A5`) | idem (ligne sans libellé A) | idem |
| **PV TTC sandwich seul** | **5 500 F** (`Ratios!C5`) | **6 000 F** (`Ratios!C6`) | **7 000 F** (`Ratios!C7`) |
| **COÛT (prix de revient)** | **1 186,67 F** (`Ratios!D5` = `COST!C5`) | **1 295,48 F** (`Ratios!D6` = `COST!C6`) | **1 759,04 F** (`Ratios!D7` = `COST!C7`) |
| Coût (€) | 1,81 € (`E5`) | 1,97 € (`E6`) | 2,68 € (`E7`) |
| PV HT | 4 547,33 F (`F5`) | 4 960,73 F (`F6`) | 5 787,52 F (`F7`) |
| Marge brute (GP) | 3 360,66 F (`G5`) | 3 665,25 F (`G6`) | 4 028,47 F (`G7`) |
| GP (€) | 5,12 € (`H5`) | 5,59 € (`H6`) | 6,14 € (`H7`) |
| **Ratio (food cost)** | **26,10 %** (`I5`) | **26,11 %** (`I6`) | **30,39 %** (`I7`) |
| PV TTC MENU LARGE / COÛT | 8 000 F / 1 721,78 F (`J5`/`K5`) | 8 500 F / 1 830,59 F (`J6`/`K6`) | 9 500 F / 2 294,15 F (`J7`/`K7`) |
| PV TTC MENU MEDIUM / COÛT | 7 000 F / 1 540,44 F (`Q5`/`R5`) | 7 500 F / 1 649,25 F (`Q6`/`R6`) | 8 500 F / 2 112,81 F (`Q7`/`R7`) |
| Différence PV TTC − COÛT (ce qu'Aristide lit comme « écart ») | **4 313,33 F** | **4 704,52 F** | **5 240,96 F** |
| ingrédient qui explique la progression du coût | patty 572,37 F (`AM5`) | + fromage 108,81 F (`AL6`) | patty ×2 = 1 144,74 F (`AM7`) |

Le PLU 120 existe bien et correspond à **DOUBLE WHOPPER** (et non à un autre sandwich) ; sa progression de coût s'explique intégralement par la double patty (`COST!AM7` = 2 × `AM5` = 1 144,74 F), ce qui confirme que `COST!C` est une somme de matières et non un prix.

---

## 6. D'où vient très probablement la confusion

L'application lit les **deux** colonnes, mais n'expose aux magasins que le **coût** :

- `frontend/src/utils/parsers.js:120-143` lit la feuille `Ratios`, retient le **premier** en-tête `PV TTC` (bloc `SANDWICH ONLY`) et le range dans `prod.pvTtc` ; `parsers.js:175` l'attache au produit, avec `coutTheo` issu de la recette valorisée par `COST`.
- Ce que l'appli a en mémoire pour le PLU 110 (base locale, lecture seule, KV `bk_sia_ratios_parsed_v1`) : `nom = WHOPPER`, `coutTheo = 1186,6720790730283`, **`pvTtc = 5500`** — identique aux cellules ci-dessus. PLU 115 : `coutTheo 1295,48` / `pvTtc 6000`. PLU 120 : `coutTheo 1759,04` / `pvTtc 7000`.
- Dans les classeurs générés, la colonne tarifaire du PMIX s'appelle **« Coût unitaire (FCFA) »** et écrit `coutTheo`, le `pvTtc` ne servant que de **repli** pour les rares PLU sans coût connu (`frontend/src/utils/excelExporter.js:896-900`). Un Whopper y apparaît donc à **1 187 F** sous une colonne de prix.

**Conclusion opérationnelle :** « 1 187 F » est bien la valeur matière utilisée dans tous nos calculs d'écart ; « 5 500 F » est le prix de vente affiché (sandwich seul), jamais utilisé pour valoriser la matière. Comparer les deux revient à comparer un prix de vente TTC à un coût de revient — l'écart de 4 313,33 F est la marge (food cost 26,10 %), pas une incohérence de fichier.

---

## 7. Réponse prête à envoyer

> **Objet : Whopper PLU 110 — 5 500 F = prix de vente, 1 187 F = coût de revient**
>
> Bonjour Aristide,
>
> Vérification faite dans le Ratio Q3 2026, cellule par cellule :
>
> - **5 500 F = prix de vente TTC** du Whopper (sandwich seul). Feuille `Ratios`, cellule **C5**, colonne intitulée **« PV TTC »**.
> - **1 187 F = prix de revient matière** (valeur exacte 1 186,672 F). Feuille `Ratios` cellule **D5** (« COÛT »), identique à la feuille `COST` cellule **C5**, qui est la somme des 11 ingrédients de la fiche (patty Whopper 572,37 F à elle seule).
> - La différence de 4 313,33 F est la **marge brute matière** (cellule **G5** = 3 360,66 F sur le prix HT de 4 547,33 F, soit un **food cost de 26,10 %**, cellule **I5**). Ce n'est pas un écart de fichier.
> - Comparaison sur les PLU voisins : 115 WHOPPER CHEESE 6 000 F / 1 295,48 F (26,11 %) ; 120 DOUBLE WHOPPER 7 000 F / 1 759,04 F (30,39 %). Le ratio plus élevé du Double Whopper vient de la double patty (1 144,74 F).
> - Rappel utile : dans les classeurs de saisie, la colonne du PMIX est libellée **« Coût unitaire (FCFA) »** et porte le coût (1 187 F), non le prix de vente ; le prix de vente 5 500 F n'entre dans aucun calcul d'écart matières.
>
> Chiffres reproductibles : PV HT = 5 500 ÷ 1,2095 (TVA, cellule `H2`) = 4 547,33 F ; coût en € = 1 186,67 ÷ 655,957 (taux, cellule `C2`) = 1,81 €.
>
> Rien a été modifié dans le Ratio ni dans les prix (contrôle en lecture seule).

---

## 8. Périmètre et méthode

- Outil : `scripts/audit_referentiel.py::read_sheet_rows` (lecture des **valeurs calculées mises en cache** dans l'OOXML du classeur), invoqué en mode lecture seule ; aucune écriture.
- Base consultée en lecture seule uniquement (`file:backend/data.db?mode=ro`, clé de KV `bk_sia_ratios_parsed_v1`) pour vérifier ce que l'application a retenue du même fichier.
- Non vérifié / hors demande : le prix de vente du Whopper **en caisse** (5 500 F est le prix de la fiche Ratio Q3 ; s'il existe une grille tarifaire 2026 hors Ratio, elle n'est pas dans ce fichier). Les blocs `MENU Yêrê`, `MENU Yêrê + boisson` et `MENU KID` sont vides pour les lignes 110/115/120.
- Intégrité du fichier audité : `sample_data/RATIOS BURGER KING ABJ Q3 2026.xlsx` conserve sa date de dernière modification du 23/10/2026 09:54 — il n'a pas été réécrit par ce contrôle.
