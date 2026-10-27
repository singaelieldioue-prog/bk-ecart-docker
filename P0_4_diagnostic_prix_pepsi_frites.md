# P0-4 — Diagnostic de la résolution de prix des lignes Pepsi / frites

**Périmètre : lecture seule.** Aucun fichier de production, aucune whitelist, aucun Ratio, aucun prix, aucune base n'a été modifié. Le diagnostic est reproductible avec les données déjà en base (rapports sauvegardés + KV) et les classeurs de `sample_data/` / `frontend/public/`.

Demande d'origine :
> Vérifier la résolution de prix pour les codes Pepsi/frites dans la whitelist. Cause probable : mapping PMIX → article, ou prix manquant, ou quantité nulle.
> Interdit : modifier la whitelist avant le diagnostic. Changer le Ratio.

**Réponse en une ligne : les trois causes sont réelles, mais elles ne pèsent pas pareil. La cause dominante est le mapping PMIX → article (rattachement de la consommation théorique), pas le prix. Le prix est résolu dans 100 % des lignes générées ; la quantité, elle, est annulée par une colonne de colisage vide.**

| Cause soupçonnée | Verdict | Poids mesuré |
|---|---|---|
| Mapping PMIX → article | **PROUVÉE — cause principale** | 361 068,12 F de consommation théorique **sans ligne d'écart** sur 559 270,36 F, soit **64,6 %** ; **0 F** rattaché aux 6 ingrédients Pepsi/frites (30 403,69 F) |
| Prix manquant | **PARTIELLEMENT VRAIE** | Génération : 11/11 lignes avec prix écrit. Réimport : 8/11 résolues, **3/11 en « inconnu »**, + 2 noms sans aucun prix (`puPieceSource = aucun`) |
| Quantité nulle | **PROUVÉE — 2 mécanismes distincts** | Colonne E vide sur **203/318 lignes (63,8 %)** → les « Inner » saisis ne pèsent plus rien ; 4 des 11 lignes whitelist **disparaissent** de la table d'écart (stock nul aux 2 dates, aucun mouvement) |

Rapports audités (sauvegardes en base, table `reports`, lecture en mode `mode=ro`) :

| Rapport | id | Écart matière | Consommation réelle | Consommation théorique PMIX |
|---|---|---|---|---|
| BK1 — 23/10/2026 | `60198f93-f763-4bb9-b84c-05e63d01d639` | 9 321 972,09 F | 9 881 242,45 F | 559 270,36 F |
| BK COCODY — 22/10/2026 | `76b8d757-ebe4-4d46-a9e1-0aa3a79de44c` | 222 636 893,37 F | 223 196 163,72 F | 559 270,36 F |

Les deux rapports partagent le même fichier PMIX et le même Ratio Q3 (`bk_sia_ratios_v1.label = « RATIOS BURGER KING ABJ Q3 2026.xlsx »`, chargé le 23/10/2026, 104 produits / 122 ingrédients) : la consommation théorique est donc identique, et c'est bien un problème de chaîne, pas de saisie d'un restaurant.

---

## 1. Cause principale : le mapping PMIX → article n'existe pas

### 1.1 Ce que fait la chaîne (code lu, non modifié)

1. `frontend/src/utils/calculators.js:40-213` (`calculer`) résout chaque ligne PMIX sur une fiche produit : `ratios.byPlu[plu]` puis `ratios.byNom[norm(nom)]`, sinon `pmixComplement[String(plu)]`. Le coût unitaire retenu multiplié par la quantité donne `pmixTheo[].coutTheo` (total de ligne).
2. La consommation théorique est ensuite **redistribué par ingrédient** dans `consoParIng` (nom de l'ingrédient du Ratio, ex. `FRIES (kg)`, `SMALL FRIES BAG`, `PEPSI MEDIUM`).
3. Le **seuil de rattachement** aux lignes d'écart est double :
   - `norm(ingrédient)` exactement égal au nom d'une ligne `articlesEcart` ;
   - ou `ratios.waByCode`/`ratioToStock`, construit depuis `baseArticle[stockKey].corresponRatio`.
4. Il n'existe **aucun** lien PLU → article de stock. Le seul chemin par code est `indexerParCode` (`frontend/src/utils/parsers.js:541-554`), réservé à la feuille **Transferts**.

### 1.2 Mesure fraîche sur les deux rapports

| Indicateur | BK1 23/10 | COCODY 22/10 |
|---|---|---|
| Ingrédients dans `consoParIng` | 75 | 75 |
| Rattachés par nom exact à une ligne d'écart | **7** (45 385,25 F) | **7** (45 385,25 F) |
| Rattachés via `corresponRatio` | **0** | **0** |
| **Non rattachés** | **68 = 361 068,12 F** | **68 = 361 068,12 F** |
| Part non rattachée / consommation théorique | **64,6 %** | **64,6 %** |
| Lignes `articlesEcart` recevant des ventes théoriques (`ventesPieces ≠ 0`) | **7 sur 206** | **7 sur 261** |

Les 7 ingrédients qui trouvent une ligne ne sont **pas** Pepsi/frites : `LONG CHICKEN PATTY`, `CHILI CHEESE BITES`, `TENDERCRISP PATTY`, `CRISPY CHICKEN PATTY`, `ONION RINGS`, `FISH PATTY`, `SUNDAE CUP`.

### 1.3 Pourquoi le rattachement Pepsi/frites est impossible, même en théorie

Le champ `corresponRatio` du fichier BASE ARTICLE ne contient **pas un nom d'ingrédient du Ratio** mais une **unité de conditionnement**. 24 valeurs brutes distinctes (15 après normalisation), toutes de ce type : `Carton`, `Pack`, `Inner`, `Kg`, `Piece`, `Boite`, `Bidon`, `Bobine`, `Seau`, `Unité`, « 1 inner de 4 », « Pack de 12*1L ». Les 4 entrées Pepsi portent toutes `PACK` :

| `ref` BASE ARTICLE | `designation` | `corresponRatio` | `codeBollore` |
|---|---|---|---|
| `BTL PEPSIZERO 30CL` | BTL-PEPSIZERO 30CL | **PACK** | *(vide)* |
| `BTL PEPSI 30CL` | BTL-PEPSI 30CL | **PACK** | *(vide)* |
| `BTL PEPSI 1 5L` | BTL-PEPSI 1.5L | **PACK** | *(vide)* |
| `BKCI PEPSI` | BKCI-PEPSI | **PACK** | *(vide)* |

Un `PACK` ne peut jamais égaler `PEPSI MEDIUM` ou `SMALL FRIES BAG` : la jointure est structurellement morte pour **tous** les articles, pas seulement les nôtres.

### 1.4 Conséquence directe sur la consommation théorique Pepsi/frites

`consoParIng` côté Pepsi/frites — **30 403,69 F de sorties théoriques, 0 F rattaché à une ligne** :

| Ingrédient du Ratio | Qté conso théo | Valeur | PMP utilisé | Ligne d'écart atteinte ? |
|---|---|---|---|---|
| `FRIES (kg)` | 18,381 kg | **25 944,18 F** | 1 411,47 F/kg | **Non** — la clé normalisée est `FRIES KG ` (avec l'espace final que `norm` ne tronque pas, `formatters.js:24-34`), alors que la ligne s'appelle `FRITES` |
| `FRITE SAUCE SACHET` | 86 | 2 150,00 F | 25,00 F | Non |
| `LARGE FRIES BAG` | 27 | 1 350,00 F | 50,00 F | Non |
| `SMALL FRIES BAG` | 99 | 501,99 F | 5,0706 F | Non |
| `CAN SOFT MEDIUM` | 4 | 445,48 F | 111,37 F | Non |
| `MEDIUM FRIES BAG` | 2 | 12,04 F | 6,0195 F | Non |
| **Total** | | **30 403,69 F** | | **0 F rattaché** |

Et 152 816,99 F de plus sortent des **34 PLU du complément PMIX** (`bk_sia_pmix_complement_v1`, `source = "complement"`) qui n'ont **par construction aucune recette** : ils ne produisent donc aucune ligne dans `consoParIng` et ne peuvent atteindre aucun stock. Répartition complète de la consommation théorique :

| Source PMIX | PLU | Valeur | Arrive dans `consoParIng` ? | Atteint une ligne d'écart ? |
|---|---|---|---|---|
| Fiche Ratio (`source = "ratio"`, 48 PLU matchés) | 48 | 406 453,37 F | Oui (75 ingrédients) | **45 385,25 F seulement** |
| Complément PMIX (`source = "complement"`, 34 PLU) | 34 | 152 816,99 F | **Non** | **0 F** |
| **Total** | 82 | **559 270,36 F** | | **45 385,25 F = 8,1 %** |

**Lecture métier :** sur 559 270,36 F de sorties théoriques, **91,9 % ne sont déduits d'aucune ligne de stock**. Les lignes Pepsi/frites affichent donc `ventesPieces = 0` et un écart ≈ (stock initial + transferts − stock final), gonflé d'autant.

---

## 2. Deuxième cause : le prix — résolu à la génération, pas toujours au réimport

### 2.1 À la génération des classeurs : aucune ligne sans prix

Chaîne jouée à l'identique (`api.articlesListAll({actif:"1"})` → `dedupeArticles` → `orderArticlesByInventoryExample` sur `frontend/public/exemple inventaire.xlsx` → `enrichirAvecBaseLocale` → `buildModelesWb`) : 621 articles dédupliqués, 318 lignes de l'exemple, **318 lignes écrites** (filtre `CUSTOM_ARTICLES_ORDER`, 321 entrées). Les 11 lignes Pepsi/frites ont **toutes** une colonne K « Prix carton » > 0 :

| Ligne | Code | Colisage D | Écrit K (prix carton) | `puPiece` | Source |
|---|---|---|---|---|---|
| BOUTEILLE PEPSI ZERO 30CL | BTL-PEPSIZERO 30CL | 12 | 1 288,00 | 107,33 | Base locale |
| BOUTEILLE PEPSI 30CL | BTL-PEPSI 30CL | 12 | 1 520,00 | 126,67 | Base locale |
| BOUTEILLE PEPSI 1,5L | BTL-PEPSI 1.5L | 6 | 3 150,00 | 525,00 | Base locale |
| CAN PEPSI 250 ml | BKCI-PEPSI | 24 | 4 576,00 | 190,67 | Base locale |
| CANETTE PEPSI ZERO 25 CL | CAN-PEPZER 25 CL | 24 | 1 530,00 | 63,75 | Base locale |
| FRITES | BKFR07 | 5 | 17 643,00 | 17 643,00 | Base locale |
| SACHET FRITES GRAND | 998740 | 6 000 | 50 000,00 | 50,00 | **inconnu** (K écrit quand même) |
| SACHET FRITES MOYEN | 73101 | 4 000 | 25 714,00 | 6,4285 | Base locale |
| SACHET FRITES PETIT | 64472 | 5 000 | 20 670,57 | 4,1341 | **inconnu** |
| SACHET FRITES PETIT 4000 | SFP4000 | 4 000 | 20 282,00 | 5,0705 | Base locale |
| SACHET FRITES - SIKO | 73101SIKO | 1 | 24 078,00 | 6,0195 | **inconnu** |

### 2.2 Au réimport : 8 lignes sur 11 retrouvent un prix, 3 non

`resoudrePrix` rejoué pas à pas (`calculators.js:6-33`, 6 étapes) sur les noms **tels que lus dans les classeurs** : 8/11 touchent l'étape 3 « Base locale » ; **3/11 ressortent « inconnu »** et ne survivent que grâce au K écrit au point 2.1 :

| Ligne | Étape atteinte | `puCarton` appliqué | Prix réellement retenu |
|---|---|---|---|
| SACHET FRITES GRAND | aucune (1 ✗, 2 ✗, 3 ✗, 5 ✗, 6 ✗) | repli sur K | 50 000,00000000001 F |
| SACHET FRITES PETIT | aucune | repli sur K | 20 670,56688932533 F |
| SACHET FRITES - SIKO | aucune | repli sur K | 24 077,99650003751 F |

Ces trois lignes sont affichées par l'interface comme **prix non résolu** (`frontend/src/pages/RapportView.jsx:379`) alors que le calcul, lui, utilise bien le K du classeur. D'où l'écart de perception CDG / outil.

Sans prix du tout (`puPieceSource = "aucun"`, `puPiece = 0`) : `DIP FRITE SAUCE - 25GR` et `DOSETTE FRITE SAUCE AMERIGO - 10GR` (écarts de −1 pièce valorisés **0 F**), et `BOUTEILLE PEPSI ZERO 1,5L` (feuille Pertes, `puPiece` nul, valeur 0 F).

### 2.3 L'injection « Correspondance » est un no-op — vérifié

`BASE DE CORRESPONDANCE 2.xlsx` contient bien **20 entrées Pepsi/frites** avec des prix, dont :

| Clé (désignation Ratio) | Code | Statut | Qté/cdt | PMP carton | PU pièce |
|---|---|---|---|---|---|
| LOW COATED FRIES | BKFR07 | ACTIF | 12,5 | 17 643,34248594438 F | 1 411,4673988755503 F |
| LARGE FRIES BAG | CAF | ACTIF | 1 000 | 50 000,00000000001 F | 50,000000000000004 F |
| SMALL FRIES BAG | SFP4000 | ACTIF | 4 000 | 20 282,28758069595 F | 5,0705718951739875 F |
| MEDIUM FRIES BAG | 73101 | **INACTIF** | 4 000 | 24 077,99650003751 F | 6,019499125009377 F |
| PEPSI SMALL / MEDIUM / LARGE | BTL-PEPSI 30CL/BKCI-PEPSI | ACTIF | *(nul)* | *(nul)* | 127,47175141242938 F |
| PEPSI DIET/ZERO/LIGHT (3 tailles) | BTL-PEPSIZERO 30CL/CAN-PEPZER 25 CL | ACTIF | *(nul)* | *(nul)* | 107,34463276836159 F |

Mesure sur le port de `App.jsx:419-435` : **0 injection effective** (`nb_injection_correspondance_effective = 0`), `waLandedCost` reste à **125** entrées. Deux raisons, toutes deux structurelles :
- la clé KV `bk_sia_correspondance_map_v1` est stockée sous la forme `{map: 126, byCode: 118}` **sans champ `v`**, alors que le code n'injecte que si `v === 2` ;
- même activée, l'injection est indexée sur la **désignation Ratio** (`LOW COATED FRIES`, `SMALL FRIES BAG`), pas sur le nom de stock (`FRITES`, `SACHET FRITES PETIT 4000`) que cherche `resoudrePrix`. Vérifié aussi : les codes Pepsi de la Correspondance sont composites — `BTL-PEPSI 30CL/BKCI-PEPSI` et `BTL-PEPSIZERO 30CL/CAN-PEPZER 25 CL` — et **n'existent tels quels dans aucune base locale**, alors que chacun de leurs deux éléments existe séparément (`BTL-PEPSI 30CL` ✓, `BKCI-PEPSI` ✓, `BTL-PEPSIZERO 30CL` ✓, `CAN-PEPZER 25 CL` ✓) : il faudra que le CDG dise à quel code de stock chaque taille (Small/Medium/Large) doit être rattachée.

---

## 3. Troisième cause : la quantité — deux mécanismes qui s'additionnent

### 3.1 Mécanisme C1 : la colonne E (« Nb articles / inner ») est vide, donc la colonne G est arithmétiquement morte

Colonne I des Inventaires générés (`frontend/src/utils/excelExporter.js:397`) :

```
I = F + IF(D>0 ; G×E/D ; 0) + IF(D>0 ; H/D ; 0)
```

Si **E = 0**, quel que soit le « Inner » saisi en G, sa contribution est **0 pièce**. Mesure sur `frontend/public/exemple inventaire.xlsx` (318 lignes de référence) : **E ≤ 0 sur 203 lignes, soit 63,8 %** — dont **les 6 lignes Pepsi/frites concernées** :

| Ligne | D (colisage) | E (par inner) | Verdict |
|---|---|---|---|
| BOUTEILLE PEPSI ZERO 30CL (ligne 30) | 12 | *(vide)* | G mort |
| BOUTEILLE PEPSI 30CL (31) | 12 | *(vide)* | G mort |
| BOUTEILLE PEPSI 1,5L (34) | 6 | *(vide)* | G mort |
| CAN PEPSI 250 ml (35) | 24 | *(vide)* | G mort |
| CANETTE PEPSI ZERO 25 CL (36) | 24 | *(vide)* | G mort |
| FRITES (63) | 5 | *(vide)* | G mort |
| SACHET FRITES PETIT 4000 (225) | 4 000 | *(vide)* | G mort |
| SACHET FRITES GRAND / MOYEN / PETIT / SIKO (222-224, 229) | 6 000 / 4 000 / 5 000 / 1 | 100 / 100 / 200 / 100 | E renseigné, G utile |

Inners **effectivement saisis puis annulés** dans les deux classeurs réimportés (7 occurrences, 43,164 iners) :

| Rapport | Date | Ligne | F cartons | **G inner saisi** | H unités | I nombre retenu | Pièces | Valeur |
|---|---|---|---|---|---|---|---|---|
| BK1 | Ini | BOUTEILLE PEPSI 30CL | 6 | **8,082** | 0 | 72 | 72 | 9 120,00 F |
| BK1 | Ini | BOUTEILLE PEPSI 1,5L | 0 | **2** | 0 | 0 | 0 | 0 F |
| BK1 | Ini | CANETTE PEPSI ZERO 25 CL | 2,1667 | **6** | 28 | 52 | 52 | 3 315,00 F |
| COCODY | Ini | BOUTEILLE PEPSI 30CL | 6 | **8,082** | 0 | 72 | 72 | 9 120,00 F |
| COCODY | Ini | BOUTEILLE PEPSI 1,5L | 0 | **2** | 0 | 0 | 0 | 0 F |
| COCODY | Ini | CANETTE PEPSI ZERO 25 CL | 2,1667 | **6** | 28 | 52 | 52 | 3 315,00 F |
| COCODY | Fin | FRITES | 2 | **11** | 2 | 2 | 2 | 35 286,00 F |
| | | **Total BK1** | | **15,082 iners** | | | **0 pièce, 0 F** | |
| | | **Total COCODY** | | **27,082 iners** | | | **0 pièce, 0 F** | |

L'effet le plus lourd est sur `FRITES` à COCODY : 11 iners de stock final effacés, sur une ligne valorisée 17 643 F/pièce.

À noter aussi, côté modèle : la ligne `SIKO` a `D = 1` avec `E = 100` (incohérence de colisage dans la base locale — un « inner » de 100 articles dans un carton de 1) et `COFFRET A FRITE` a `D = 1 000` mais `E` vide.

### 3.2 Mécanisme C2 : stock nul aux deux dates, aucun mouvement → la ligne disparaît du calcul

`calculators.js:209-211` ne conserve qu'une ligne si au moins une quantité est non nulle. 4 des 11 lignes whitelist sont donc **absentes de la table d'écart** dans les deux rapports :

| Ligne absente | Ini (cartons/inner/unités) | Fin | Transferts | Pertes | Motif |
|---|---|---|---|---|---|
| SACHET FRITES GRAND | 0 / 0 / 0 | 0 / 0 / 0 | 0 | 0 | aucun mouvement |
| SACHET FRITES MOYEN | 0 / 0 / 0 | 0 / 0 / 0 | 0 | 0 | aucun mouvement |
| SACHET FRITES PETIT | 0 / 0 / 0 | 0 / 0 / 0 | 0 | 0 | aucun mouvement |
| SACHET FRITES - SIKO | 0 / 0 / 0 | 0 / 0 / 0 | 0 | 0 | aucun mouvement |
| (`BOUTEILLE PEPSI ZERO 1,5L`, hors whitelist) | *absent des Inventaires* | — | 0 | 1 ligne | présent en Pertes uniquement, sans prix |

Une ligne « à 0 » n'est pas une ligne « juste » : si le magasin a consommé des sachets sans les inventorier, la sortie n'apparaît nulle part — et la consommation théorique de `SMALL/LARGE/MEDIUM FRIES BAG` (1 864,03 F au total, §1.4) ne vient pas la révéler, faute de rattachement.

### 3.3 Ce qui entre, au contraire : les transferts, valorisés par code

Contrairement aux Inventaires, la feuille Transferts résout les prix **par code Bolloré** (`parsers.js:541-554`, `indexerParCode`). Les lignes Pepsi/frites ne doivent donc leur existence qu'aux livraisons :

| Rapport | Ligne | Lignes de transfert | Pièces entrantes | Valeur entrée | Origines (`bk`) |
|---|---|---|---|---|---|
| BK1 | CAN PEPSI 250 ml | 8 | 3 384 | 645 216,00 F | BK 1 - VGE, DC - PERTES |
| BK1 | FRITES | 10 | 87 | 1 534 941,00 F | BK 1 - VGE |
| BK1 | SACHET FRITES PETIT 4000 | 2 | 8 000 | 40 564,00 F | BK 1 - VGE |
| BK1 | BOUTEILLE PEPSI ZERO 30CL | 1 | 12 | 1 288,00 F | DC - PERTES |
| COCODY | CAN PEPSI 250 ml | **69** | 53 928 | 10 282 272,00 F | BK 1→9 + DC - PERTES |
| COCODY | FRITES | **67** | 1 140 | 20 113 020,00 F | BK 1→9 + DC - PERTES |
| COCODY | CANETTE PEPSI ZERO 25 CL | 38 | 3 744 | 238 680,00 F | BK 2→9 |
| COCODY | SACHET FRITES PETIT 4000 | 30 | 120 000 | 608 460,00 F | BK 1→9 |

Exemple chiffré de la bascule : `CAN PEPSI 250 ml` à BK1, une livraison de `qte = 30` conditionnements × `qteCdt = 24` = **720 pièces** valorisées 30 × 4 576 = **137 280 F** (PU pièce 190,666… F). Entrée résolue par code, sortie théorique perdue → l'écart ≈ l'intégralité des livraisons.

---

## 4. Impact chiffré sur les écarts publiés

Somme des `ecartVal` des lignes Pepsi/frites réellement présentes dans la table d'écart :

| Rapport | Total Pepsi | Total frites/sachets | **Sous-total lignes** | Écart matière rapport | **Part de l'écart** |
|---|---|---|---|---|---|
| BK1 — 23/10/2026 | 637 186,08 F | 1 557 830,75 F | **2 195 016,83 F** | 9 321 972,09 F | **23,55 %** |
| BK COCODY — 22/10/2026 | 10 512 922,08 F | 20 668 519,75 F | **31 181 441,83 F** | 222 636 893,37 F | **14,01 %** |

Détail BK1 (mêmes lignes à COCODY, quantités différentes) :

| Ligne | Ini | Entrées | Pertes | Fin | **Ventes théo.** | Écart pièces | PU pièce (source) | **Écart valeur** |
|---|---|---|---|---|---|---|---|---|
| FRITES | 0 | 87 | 1 | 0 | **0** | +86 | 17 643 (stock) | **+1 517 298,00 F** |
| CAN PEPSI 250 ml | 0 | 3 384 | 1 | 0 | **0** | +3 383 | 190,67 (stock) | **+645 025,33 F** |
| SACHET FRITES PETIT 4000 | 0 | 8 000 | 0 | 0 | **0** | +8 000 | 5,0705 (stock) | **+40 564,00 F** |
| CANETTE PEPSI ZERO 25 CL | 52 | 0 | 1 | 18 | **0** | +33 | 63,75 (stock) | +2 103,75 F |
| BOUTEILLE PEPSI 30CL | 72 | 0 | 1 | 114 | **0** | −43 | 126,67 (stock) | −5 446,67 F |
| BOUTEILLE PEPSI ZERO 30CL | 26 | 12 | 1 | 74 | **0** | −37 | 107,33 (stock) | −3 971,33 F |
| BOUTEILLE PEPSI 1,5L | 0 | 0 | 1 | 0 | **0** | −1 | 525,00 (stock) | −525,00 F |
| DOSETTE FRITE SAUCE PORTION - 10GR | 0 | 0 | 1 | 0 | **0** | −1 | 31,25 (stock) | −31,25 F |
| DIP FRITE SAUCE - 25GR | 0 | 0 | 1 | 0 | **0** | −1 | **0 (aucun)** | 0 F |
| DOSETTE FRITE SAUCE AMERIGO - 10GR | 0 | 0 | 1 | 0 | **0** | −1 | **0 (aucun)** | 0 F |

COCODY, mêmes lignes : `FRITES` +1 137 pièces = **+20 060 091,00 F** ; `CAN PEPSI 250 ml` +53 927 pièces = **+10 282 081,33 F** ; `SACHET FRITES PETIT 4000` +120 000 pièces = +608 460,00 F ; `CANETTE PEPSI ZERO 25 CL` +3 777 pièces = +240 783,75 F.

**`ventesPieces = 0` sur les 10 lignes** : aucune sortie théorique Pepsi/frites n'est jamais venue les diminuer (§1.2-§1.4), alors que le PMIX du même mois déclare 335 pièces Pepsi/frites vendues à BK1 (68 179,42 F de coût théorique) et 417 à COCODY (93 796,31 F).

---

## 5. Ce qu'il faut trancher (aucune action prise)

Le diagnostic appelle trois décisions, qui relèvent du CDG et non de ce dossier :

1. **Rattachement PMIX → stock** : seule une table explicite `PLU / ingrédient Ratio → code Bolloré de stock` peut remplacer la jointure actuelle sur `corresponRatio` (qui porte des unités de conditionnement). Sans elle, ~92 % de la consommation théorique reste hors calcul et les écarts Pepsi/frites resteront égaux aux livraisons. Le fichier `BASE DE CORRESPONDANCE 2.xlsx` contient déjà les 20 entrées nécessaires côté frites et Pepsi, avec les codes à double valeur (`BTL-PEPSI 30CL/BKCI-PEPSI`) à départager par le CDG.
2. **Injection Correspondance** : décider si on la réactive (elle est neutralisée par l'absence de champ `v` en KV) **et** sur quelle clé — désignation Ratio ou nom de stock. Dans les deux cas, un changement de clé est nécessaire pour qu'elle serve aux lignes Pepsi/frites.
3. **Colisage / colonne E** : 63,8 % des lignes du modèle ont E vide. Soit on dérive E du colisage pour les articles à inner (le correctif d'import A7-ter du 24/10 ne couvre que la dérivation D), soit on interdit la saisie en G pour ces articles. Les 43,164 iners saisis puis annulés sur les deux rapports (§3.1) montrent que les magasins utilisent déjà la colonne.

Sous-périmètre volontaire, non traité ici : la valeur de l'écart BK1 (−41 %) mentionnée le 23/10, l'A1-bis (ombres Ratio Q3) et le déploiement prod — à ne pas mélanger avec ce diagnostic de prix.

---

## 6. Méthode et traçabilité

- Chaîne de génération rejouée en Python à l'identique de `BaseArticlesTab.jsx` (`genGenerate`) + `excelExporter.js` : déduplication 621, appariement exemple **par code puis par nom** (`normalize_inventory_value`), `enrichirAvecBaseLocale` (garde `FACTEUR_MAX = 20`), filtre `CUSTOM_ARTICLES_ORDER` (321 entrées, clé `normalizeString` d'`excelExporter.js:348-353`).
- Réimport rejoué avec les offsets réels des fichiers générés (`offsetInventaire → o = 1`, donc `nom = D`, `D = E`, `E = F`, `F = G`, `G = H`, `H = I`, `I = J`, `K = L`, `L = M`) et les 6 étapes de `resoudrePrix` tracées ligne par ligne.
- Rapports lus dans la table `reports` (`data.calc`, `data.stockData`) et KV en mode `mode=ro` (`bk_sia_ratios_parsed_v1` : byPlu 87, byNom 104, pmpByIng 122, waLandedCost 125, waByCode 122 ; `bk_sia_base_article_map_v1` : 435 entrées, 432 avec `corresponRatio` ; `bk_sia_local_articles_v1` : 456 ; `bk_sia_pmix_complement_v1` : 231 PLU ; `bk_sia_correspondance_map_v1` : `{map: 126, byCode: 118}`).
- Normalisation utilisée pour les jointures : `norm` de `frontend/src/utils/formatters.js:24-34`, y compris son **espace final non tronqué** — c'est ce qui rend `FRIES (kg)` → `FRIES KG ` incompatible avec `FRITES`.
- Scripts et JSON de mesure conservés à la racine (`tmp_p04_gen.py`, `tmp_p04_reimport.py`, `tmp_p04_mapping.py`, `tmp_p04_chiffres.py`, `tmp_p04_final.py`, `tmp_p04_transferts.py` + `.json`), supprimables sans impact : ils n'écrivent que dans le répertoire de travail et jamais dans `backend/data.db`.
