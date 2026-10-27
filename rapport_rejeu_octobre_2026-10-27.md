# Rapport — rejeu des contrôles de 2e niveau sur le Suivi Stock (octobre 2026)

**Branche** : `fix/rev27-anomalies` — 7 correctifs committés localement, **rien n'a été poussé**.
**Date** : 27/10/2026.

**Fichier rejoué**
`C:\Users\arnaud.nzue\Downloads\files (12)\bk-ecart-docker28082026\tmp_verif\Suivi_BK1_Octobre_2026.xlsx`

> **Ce fichier n'est PAS le fichier rev27 du client.** C'est le modèle octobre présent dans le workspace, généré par l'application. Les chiffres du bilan (192, 109, 78, 51, 24…) portent sur le classeur du client, que je n'ai pas reçu : ils ne peuvent donc pas être *confirmés*, seulement confrontés à ce que ce fichier-ci contient réellement. Chaque ligne du tableau dit explicitement si le chiffre est confirmé, mesuré autrement, ou non vérifiable.

Le rejeu suit exactement la chaîne de `App.jsx:525-537` : `parseSuivisStock` → `extractPmixFromWorkbook` → `calculer`, avec le Ratio actif **RATIOS BURGER KING ABJ Q3 2026.xlsx (23/10/2026)**, la base article, la base locale et le complément PMIX de `backend/data.db` — ouvert **en lecture seule** (`readonly: true`). Aucune écriture en base, aucun classeur modifié.

---

## 1. Ce que contient réellement le fichier rejoué

| Élément | Valeur |
|---|---|
| Articles en inventaire initial | **318** (325 lignes nommées − 6 séparateurs de catégorie − 1 ligne TOTAL) |
| Articles en inventaire final | **318** (même liste) |
| Quantités de stock saisies | **0** |
| Lignes PMIX (ventes) | **0** |
| Pertes saisies | **0** |
| Lignes de Pertes transmises (pré-remplies) | **186** |
| Transferts | **0** |
| Catégories | Boissons 39 · Surgelé 47 · Frais 20 · Sec 64 · **Packaging 78** · Produits de Nettoyage 70 |
| Ratio actif | Q3 2026 — 104 produits, **0 sans coût**, 90 avec PLU, **3 PLU en doublon (400116 / 400117 / 400118)** → 87 PLU distincts, 122 ingrédients |

**Conséquence directe** : c'est un modèle vierge. Tout ce qui dépend des ventes ou des quantités (C-09, A-04, A-05 et les totaux financiers) **n'est pas rejouable** ; tout ce qui dépend du référentiel et des fichiers (C-10 à C-14, A-01 à A-03, A-06 à A-08) l'est.

---

## 2. Anomalies C-09 à C-14

| Anomalie | Statut | Preuve | Résultat chiffré sur ce fichier | Votre chiffre |
|---|---|---|---|---|
| **C-09** — PLU à coût zéro vendus | **détecté et signalé** | `frontend/src/utils/calculators.js:37-41` (statut `COÛT NUL`) et `:139-142` (`pluCoutNul`, `qtyCoutNul`, `coutMoyenSans`) ; suite `frontend/tests/plu-cout-nul.mjs` **20 PASS** | **Non rejouable** : 0 vente, 0 couvert → 0 PLU vendu, 0 % des ventes. Le référentiel du classeur contient bien **125 PLU à coût nul** (C-13), donc « 51 PLU vendus » est cohérent, mais non mesurable ici | 51 PLU / 2 399 articles / 10 % → **non vérifié** |
| **C-10** — prix d'inventaire ≠ référentiel | **détecté et signalé** (jamais arbitré) | `frontend/src/utils/parsers.js:528` (`ecartPrixSaisi`), `:669`, `frontend/src/utils/calculators.js:77` (`ecartsPrix`) ; suite `prix-source-unique.mjs` **21 PASS** | **11 / 318** écarts, dont **6 > 1 F** et 5 arrondis ≤ 1 F — cumul net **−2 041 F**. Détail : CORNICHONS MEHDI −4 256,24 · SAUCE SALADE CESAR 100 +1 514,53 · CRISPY ONIONS +818,29 · MOZZARELLA STICKS BIS −736,41 · CHICKEN STRIPS +418,60 · FUSION CUP CONWAY +199,58 | 192 / 318 → **non vérifié** (ce fichier est un modèle généré : ses prix *sont* ceux du référentiel, il ne peut donc pas en diverger massivement) |
| **C-11** — articles sans prix | **détecté et signalé** | `parsers.js:651` (anomalie « Prix absent ») ; suite `prix-code-absent.mjs` **31 PASS** | **44 / 318** sans prix carton dans le fichier, dont **40 sans aucune source de prix** (fichier + référentiel). Sources résolues pour les autres : Base locale 217, inconnu 93, PMP ingrédients 4, WA Landed Cost 4 | 78 → **non vérifié** |
| **C-12** — prix de Pertes ≠ référentiel / désignations absentes | **détecté et signalé** | `parsers.js:780` (`ecartPrixSaisi` sur les Pertes) ; suites `pertes-transmis-prix.mjs` **17 PASS**, `pertes-liste-exacte.mjs` **19 PASS** | **40 désignations absentes de l'Inventaire / 186 = votre chiffre confirmé à l'unité** (ex. MIRINDA ORANGE PET 30CL, ligne 40). Prix divergents : **10 / 186**, dont 4 > 1 F (mêmes articles que C-10) et 6 arrondis — cumul net **−1 504 F**. Aussi : 18 lignes sans prix carton, 83 sans prix au référentiel | 40 → **confirmé** · 109 prix → **non vérifié** (mesuré 10) |
| **C-13** — PLU à coût nul dans le référentiel PMIX | **détecté et signalé** | `calculators.js:158-159` (`ratioCoutNulCount`, `ratioCoutNulVendus`) ; feuille « Référentiel PMIX » (ligne 253 = PLU 8017, ligne 254 = PLU 900331) | **125 / 362 = 34,5 % — votre chiffre confirmé exactement**. Nuance : le Ratio **actif** Q3 n'a lui aucun PLU à coût nul (87/87 valorisés) ; les 125 sont dans la feuille PMIX du classeur (362 PLU, menus et jouets compris) | 125 → **confirmé** |
| **C-14** — articles sans colisage | **détecté et signalé** + corrigé côté dérivation | `parsers.js:643` (« Colisage vide ») ; `derive-inner-colisage.mjs` **19 PASS** | **0 colisage vide** sur les 318 articles. Détail : **34 colisages = 1**, **4 colisages > 1 sans inner** (dérivés à l'import), **42 colisages > 1 000** — 38 Packaging (couvercles 2 000 / 3 750, dosettes 1 500), 2 Frais et 1 Sec (fromage 1 056 / 1 104), 1 Produits de Nettoyage ; la garde E-DERIVE ne dérive pas leur inner | 24 → **non vérifié** (définition non concordante : dites-moi si vos 24 sont les colisages = 1 ou une autre liste) |

---

## 3. Anomalies A-01 à A-08

| Anomalie | Statut | Preuve | Résultat chiffré |
|---|---|---|---|
| **A-01** — conditionnement | **corrigé par le code** | E-DERIVE (`frontend/src/utils/parsers.js`, dérivation de l'inner depuis le colisage si `1 < D ≤ 1 000`, sinon blocage + WARN) ; conditionnement du référentiel CDG prioritaire ; suites `derive-inner-colisage.mjs` **19 PASS**, `referentiel-cond-cdg.mjs` **12 PASS** | 34 articles à colisage 1 (inner = 1 carton) · 4 articles > 1 sans inner, dérivés · 42 articles > 1 000 (38 Packaging, 2 Frais, 1 Sec, 1 Nettoyage) dont l'inner n'est pas dérivé par la garde |
| **A-02** — hors stock PMC / IFB / PACKAGING | **corrigé par le code (paramétrable)** | `frontend/src/constants.js:19-24` (`CATEGORIES_HORS_ECART`, `estCategorieHorsEcart`), appliqué en `calculators.js:202 / 216 / 228 / 255`, restitution `excelExporter.js:222` ; suite `articles-hors-ecart.mjs` **17 PASS** | **78 articles Packaging (24,5 % des 318) sortis du tableau d'écart**. PMC et IFB : 0 article dans ce fichier. Par conception, les totaux de stock et la conso réelle ne bougent pas — seuls les articles sortent du calcul d'écart |
| **A-03** — unité | **détecté et signalé** | `parsers.js:645-648` (« Unité incohérente » : libellé « pack de N » vs Cond.) ; suites `unites.mjs` (back) **8 PASS**, `pertes-unite.mjs` **8 PASS**, `iceberg-unite.mjs` **11 PASS** | **1 cas** : GANTS SACHET PACK DE 500, Inventaire Initial ligne 279 — libellé « PACK DE 500 » vs Cond. 20 |
| **A-04** — coût du Whopper | **détecté et signalé** (le coût vient du Ratio, l'app ne l'arbitre pas) | Conso théorique par PLU (`calculators.js`, `pmixTheo`) ; Ratio Q3 | **PLU 110 WHOPPER : coût 1 187 F**. Le Ratio ne porte **aucun prix de vente** (PV = 0 sur les 87 PLU) : la marge se calcule uniquement avec le PMIX rempli, absent ici → **non vérifié**. Sur le rapport d'août rejoué, le food cost global ressort à **102,7 %**, ce qui rend cet arbitrage bloquant |
| **A-05** — coût moyen | **détecté et signalé** | Double calcul `coutMoyenAvec` / `coutMoyenSans` (`calculators.js:141-142`) : le second exclut les PLU non valorisés, pour ne pas minorer le coût moyen | 0 couvert dans ce fichier → **non calculable**. La mécanique est couverte par `recap-pmix-robustesse.mjs` (5 PASS) et `plu-cout-nul.mjs` (20 PASS) |
| **A-06** — PLU valorisés | **donnée à valider** | Ratio actif Q3 (base locale) | **104 produits, 0 sans coût, 90 avec PLU, 3 PLU en doublon (400116 / 400117 / 400118) → 87 PLU distincts exploitables**, 122 ingrédients. Les 14 produits sans PLU et les 3 doublons sont des données de référentiel, pas du code |
| **A-07** — iceberg | **corrigé par le code** | Commit `30d865b` ; `parsers.js:640-642` (inventaires) et `:773` (pertes) : un prix au kg sans masse de carton validée ne dérive **aucun** prix — le nombre de boules ne convertit pas un prix au kg ; suite `iceberg-unite.mjs` **11 PASS** | **0 cas** dans ce fichier (`anomaliesIntegrite` = 1 seule ligne, l'unité GANTS) |
| **A-08** — prix des pertes | **détecté et signalé** + lignes transmises résolues | Résolution des lignes transmises (3 sources) ; `pertes-transmis-prix.mjs` **17 PASS** ; `ecartPrixSaisi` `parsers.js:780` | 186 lignes · **18 sans prix carton** dans le fichier · **83 sans prix au référentiel** · **40 absentes de l'Inventaire**, dont BBQ TENDERCRISP (ligne 190) transmise sans catégorie, sans cond. et sans prix |

Rappel de lecture : « corrigé par le code » = l'application ne produit plus le défaut ; « détecté et signalé » = l'application le remonte sans l'arbitrer (l'arbitrage est métier) ; « donnée à valider » = seul le client peut trancher.

---

## 4. Avant / après

### 4.1 Sur le fichier d'octobre (modèle vierge)

| Indicateur | Avant correctifs | Après correctifs | Delta |
|---|---|---|---|
| CA | 0,00 | 0,00 | 0 |
| Conso théorique | 0,00 | 0,00 | 0 |
| Conso réelle | 0,00 | 0,00 | 0 |
| Écart matières | 0,00 | 0,00 | 0 |
| Coût matière % | indéfini (CA = 0) | indéfini (CA = 0) | — |
| Valeur du stock initial / final | 0,00 | 0,00 | 0 |

Ces zéros sont **l'état normal d'un modèle qui n'est pas encore rempli** : aucune quantité, aucune vente, aucune perte saisie. Ce n'est ni une anomalie ni un défaut du fichier. Les correctifs 2 à 7 sont des contrôles de signalement (ils ne modifient aucun total) ; seul le correctif 1 (montant PMIX) change un total, et il n'a aucun effet ici faute de ligne PMIX. **Un avant/après financier sur ce fichier suppose le classeur rempli** — il sera produit dès réception des saisies.

### 4.2 Le seul jeu avec ventes disponible : rapport d'août rejoué

C'est le seul avant/après chiffré que la base permet, et il porte sur un autre mois (rejeu : `frontend/tests/tmp_aout_replay.mjs`) :

| Indicateur | Avant (rapport figé) | Après (même données, chaîne actuelle) |
|---|---|---|
| CA | 8 220 183 | 8 220 183 |
| Conso théorique | **0** | 8 441 317 |
| Conso réelle | 5 191 768 | 5 191 768 |
| Écart matières | +5 191 768 | **−3 249 549** |
| Écart % | non calculable | **−38,5 %** |
| Coût matière % CA | 0,0 % | **102,7 %** |
| Fiches matchées | **0** | 46 |
| PLU non matchés | 46 | 0 |
| Couverts | 11 116 | 11 116 |

Lecture : le rapport d'août avait été produit avec une **analyse Ratio vide** (0 fiche, 0 conso théorique) — c'est la cause du « coût matière 0 % ». La chaîne actuelle rattache bien les 46 PLU, mais le résultat (102,7 % de food cost) est **invraisemblable** : il traduit un problème de données (valorisation du stock final / coûts), pas un progrès. **Ce rapport ne doit pas être régénéré avant validation des données** — c'est le point 8, laissé en enquête volontairement.

### 4.3 Ce que les correctifs changent réellement sur ce fichier (compteurs)

| Contrôle | Avant | Après |
|---|---|---|
| Écarts prix saisi / référentiel | non signalés | **21 signalés** (11 inventaire + 10 pertes) |
| Doublons de lignes d'inventaire | fusionnés silencieusement | **2 signalés** : SANITIZER TABLETTE (lignes 311-312) et code SSM30700 partagé par SACHET SNACK MOYEN 2000 et 4000 (lignes 226-227) |
| Défauts d'intégrité | invisibles | **1 signalé** (unité GANTS, ligne 279) |
| PLU vendus sans coût | invisibles | compteur + part des ventes + coût moyen hors PLU non valorisés (0 ici) |
| Articles hors écart PMC/IFB/PACKAGING | mêlés au calcul d'écart | **78 sortis** (Packaging) |
| Iceberg sans masse de carton | conversion erronée possible | **0 cas**, règle bloquante |

---

## 5. Campagne de tests (exécutée à l'instant)

**26 suites durables, 398 PASS / 0 FAIL**, plus `vite build` OK (7,19 s).

- Frontend (22 suites, **364 PASS**) : articles-hors-ecart 17 · derive-inner-colisage 19 · doublons-integrite 15 · iceberg-unite 11 · inventaire-referentiel-cdg 24 · inventaire-roundtrip-reimport 17 · offert-total 11 · pertes-ca-ht 11 · pertes-liste-exacte 19 · pertes-ordre-categorie 12 · pertes-transmis-prix 17 · pertes-unite 8 · plu-cout-nul 20 · pmix-montant 7 · prix-code-absent 31 · prix-pepsi-chaine 21 · prix-source-unique 21 · recap-inventaire-categorie 17 · recap-pmix-robustesse 5 · referentiel-base-complete 43 · referentiel-cond-cdg 12 · regressions-cdg 6.
- Backend (4 suites, **34 PASS**) : gouvernance-api 17 · lignes-sans-prix 5 · regressions-cdg 4 · unites 8.

---

## 6. Décisions client — **toutes validées le 27/10/2026**

Les 10 points ouverts sont enregistrés comme **validés**. Aucune de ces validations n'exige de modification de code : l'application applique déjà la règle « signaler, ne jamais arbitrer ». Les points qui portent sur une **donnée absente** (prix, masse, quantité) ne sont donc pas « résolus » par une valeur inventée : le paramétrage actuel est conservé et le signalement reste actif dans le rapport.

| # | Point | Décision enregistrée le 27/10/2026 | Application / état opposable |
|---|---|---|---|
| 1 | **C-09 / C-13** — 125 PLU à coût nul du référentiel PMIX | coût nul **signalé**, jamais inventé | compteur + part des ventes + coût moyen hors PLU non valorisés ; suite `plu-cout-nul` |
| 2 | **C-10** — 6 écarts de prix > 1 F : CORNICHONS MEHDI −4 256,24 · SAUCE SALADE CESAR 100 +1 514,53 · CRISPY ONIONS +818,29 · MOZZARELLA STICKS BIS −736,41 · CHICKEN STRIPS +418,60 · FUSION CUP CONWAY +199,58 | **pas d'arbitrage automatique** : prix du fichier et prix du référentiel restent affichés côte à côte | valorisation inventaire = référentiel, prix saisi en secours ([parsers.js:621](file:///C:/Users/arnaud.nzue/Downloads/files%20(12)/bk-ecart-docker28082026/frontend/src/utils/parsers.js#L621)) ; 21 écarts signalés (11 inventaire + 10 pertes) |
| 3 | **C-11** — 40 articles sans aucune source, 44 sans prix carton | **aucun prix inventé** : ligne bloquée et listée | `valorisationBloquee` → exclue du calcul et listée dans le rapport ([calculators.js:81](file:///C:/Users/arnaud.nzue/Downloads/files%20(12)/bk-ecart-docker28082026/frontend/src/utils/calculators.js#L81), [calculators.js:88](file:///C:/Users/arnaud.nzue/Downloads/files%20(12)/bk-ecart-docker28082026/frontend/src/utils/calculators.js#L88)) |
| 4 | **C-12 / A-08** — 40 désignations de Pertes absentes de l'Inventaire (dont BBQ TENDERCRISP) ; origine du prix des Pertes | prix des Pertes = **prix du fichier** ; désignations absentes signalées, aucun libellé harmonisé | [parsers.js:765](file:///C:/Users/arnaud.nzue/Downloads/files%20(12)/bk-ecart-docker28082026/frontend/src/utils/parsers.js#L765) : référentiel utilisé seulement si la cellule est vide ; 10 écarts de prix signalés |
| 5 | **C-14 / A-01** — 34 colisages = 1 et 42 colisages > 1 000 (dont 38 Packaging) | référentiel **conservé tel quel**, aucune correction silencieuse | garde E-DERIVE bloquante au-delà de 1 000 pièces de carton (suite `derive-inner-colisage`) |
| 6 | **A-02** — hors écart PMC / IFB / PACKAGING ; ajout des Produits de Nettoyage ? | paramètre **inchangé** : PMC / IFB / PACKAGING hors écart, Produits de Nettoyage **non ajoutés** (aucune demande de modification) | [constants.js:19](file:///C:/Users/arnaud.nzue/Downloads/files%20(12)/bk-ecart-docker28082026/frontend/src/constants.js#L19) ; 78 articles Packaging sortis du calcul ([calculators.js:186](file:///C:/Users/arnaud.nzue/Downloads/files%20(12)/bk-ecart-docker28082026/frontend/src/utils/calculators.js#L186), [calculators.js:307](file:///C:/Users/arnaud.nzue/Downloads/files%20(12)/bk-ecart-docker28082026/frontend/src/utils/calculators.js#L307)) |
| 7 | **A-04** — coût du Whopper (1 187 F au Ratio Q3) | coût du Ratio **accepté**, aucun prix de vente inventé | coût théorique = quantité × coût Ratio ; le Ratio ne porte aucun PV |
| 8 | **A-06** — 3 PLU en doublon (400116 / 400117 / 400118) et 14 produits sans PLU | **acceptés**, hors périmètre rev27 | aucun correctif appliqué au Ratio ; risque de rapprochement PMIX documenté (§7) |
| 9 | **Point 8** — régénération du rapport d'août (rejeu 102,7 %) | **pas de régénération** | rapport d'août inchangé, aucune réécriture |
| 10 | Classeur rempli (ventes + quantités de stock + pertes) | tests conduits sur **données fictives** en attendant le fichier réel | jeu fictif reproductible (graine 20261027), résultats §9.2 |

Conséquence pratique : aucun de ces 10 points ne bloque la livraison du classeur corrigé. Les points 1 à 3 réapparaîtront à l'identique dans chaque rapport tant que les données sous-jacentes ne seront pas fournies — c'est le comportement attendu, pas un défaut.

---

## 7. Limites et risques

- Aucun chiffre côté ventes n'est mesurable sur ce fichier : C-09, A-04, A-05 et les totaux restent **non vérifiés**, pas « conformes ».
- Les écarts avec vos chiffres (192 → 11, 109 → 10, 78 → 44, 24 → 0 colisage vide) ne prouvent pas une erreur de votre côté : ils prouvent que **nous n'avons pas le même fichier**. Tant que la rev27 n'est pas fournie, ces quatre points restent ouverts.
- C-13 (125) et C-12 (40) se reproduisent **à l'unité** : ce sont les deux points où le fichier du workspace et votre bilan se rejoignent, donc les deux plus solides.
- Le Ratio Q3 contient 3 PLU en doublon et 14 produits sans PLU : impact possible sur le rapprochement PMIX, non traité (hors périmètre de la rev27).
- Deux fichiers portent des modifications **antérieures** non committées (`frontend/src/utils/excelExporter.js`, `frontend/src/utils/pertesReferentielCdg.js`) : elles ne font pas partie des 7 correctifs et n'ont pas été incluses dans les commits.

## 8. État du dépôt

Branche `fix/rev27-anomalies`, 7 commits locaux :

| Commit | Correctif |
|---|---|
| `97d2e61` | 1 — montant PMIX conservé à la relecture du classeur |
| `10d1273` | 2 — PLU vendu sans coût bloqué et impact chiffré (C-09/C-13) |
| `bcacd92` | 3 — écart prix saisi / référentiel signalé sans arbitrage (C-10/C-12) |
| `f386d92` | 4 — doublons non fusionnés + défauts d'intégrité signalés |
| `2b4ad66` | 5 — catégories non-matière hors calcul d'écart par configuration (A-02) |
| `30d865b` | 6 — iceberg : plus de conversion au kg sans masse de carton (A-07) |
| `961975c` | 7 — gouvernance API (import en brouillon, KV protégé, pagination 400, 404 JSON) |

Correctif 8 (rapport d'août) : **enquête seule, aucun code modifié**, en attente de votre arbitrage.

**Rien n'a été poussé. J'attends votre validation.**

## 9. Correction appliquée au classeur (27/10, après validation)

Fichier livré : `C:\Users\arnaud.nzue\Downloads\files (12)\bk-ecart-docker28082026\tmp_verif\Suivi_BK1_Octobre_2026_corrige.xlsx`
Le fichier d'origine `Suivi_BK1_Octobre_2026.xlsx` n'a pas été modifié.

Deux corrections, appliquées à l'identique sur `Inventaire Initial` et `Inventaire Final` (18 cellules au total) :

| Ligne | Correction | Justification dans le fichier lui-même |
|---|---|---|
| 227 | code article `SSM30700` → **`SSM4000`** | `SSM30700` est le code du format **2 000** (feuille Référentiel Articles, L221 = SACHET SNACK MOYEN 2000). Le format 4 000 porte `SSM4000` dans la base article et la base locale. |
| 312 | contenu article vidé (catégorie, fournisseur, désignation, cond. 6, inner 6, unité, prix, code) | Doublon de SANITIZER TABLETTE dont le conditionnement 6/6 contredit le référentiel (L305 : Cond. **1 380** = « 6*230 »), qui valide la ligne 311 (1 380 / 230). La ligne physique et ses bordures sont conservées. |

Aucune autre cellule, aucune autre feuille n'a changé (comparaison cellule par cellule des 9 feuilles) ; 964 formules, 333 lignes par feuille, dimension `A1:O333` et logo inchangés.

Rejeu de la chaîne sur le fichier corrigé : **317 articles** (au lieu de 318), **0 doublon** (au lieu de 2), totaux inchangés (aucune quantité saisie à ce stade — état normal d'un modèle à remplir). Reste signalé : 1 défaut d'intégrité (GANTS SACHET PACK DE 500).

Points laissés ouverts, non touchés : prix du format 2 000 (16 712,256 F) sans source référentielle ; feuille Référentiel Articles sans code pour le format 4 000.

### 9.1 Tests de validation passés sur la copie corrigée (27/10)

| Campagne | Périmètre | Résultat |
|---|---|---|
| Contrôles ciblés sur la copie (`tests/tmp_validation_corrige.mjs`) | structure, 2 corrections × 2 feuilles, rejeu de la chaîne, saisie d'un carton, réécriture puis réimport | **32 PASS / 0 FAIL** |
| Suites durables frontend (22) | même campagne que §5 | **364 PASS / 0 FAIL** |
| Suites durables backend (4) | même campagne que §5 | **34 PASS / 0 FAIL** |
| Contrôle indépendant openpyxl (`tests/tmp_validation_openpyxl.py`) | 9 feuilles : grille, fusions, largeurs, hauteurs, images, formules ; contenu corrigé | **58 PASS / 0 FAIL** |

Points saillants : 964 formules conservées et aucune en erreur par feuille d'inventaire ; géométrie des 9 feuilles identique à l'original (fusions, largeurs, hauteurs, images) ; 317 articles relus (contre 318), 0 doublon (contre 2) ; 1 défaut d'intégrité restant (GANTS). Comportement vérifié avec saisie : 1 carton de SANITIZER = 1 380 pièces / 62 935 F, 1 carton de SACHET SNACK MOYEN 4 000 = 4 000 pièces / 42 266 F, 1 carton du format 2 000 = 2 000 pièces / 16 712,256 F, et une seule ligne SANITIZER dans le calcul.

### 9.2 Test de bout en bout sur données fictives (27/10)

Le classeur corrigé ne contient aucune quantité (état normal d'un modèle à remplir). Pour éprouver la chaîne complète quand même, un jeu de **données fictives reproductibles** a été injecté dans une copie du classeur corrigé : ventes pour les 87 PLU du Ratio Q3, stocks initial et final sur les 317 articles, 3 transferts, 10 lignes de pertes. Graine `20261027`, script `frontend/tests/tmp_test_fictif.mjs`.

Fichier de test : `C:\Users\arnaud.nzue\Downloads\files (12)\bk-ecart-docker28082026\tmp_verif\Suivi_BK1_Octobre_2026_TEST_fictif.xlsx`

Résultat : **22 PASS / 0 FAIL**. La chaîne réelle (`parseSuivisStock` → `extractPmixFromWorkbook` → `calculer`) est exécutée sur le fichier écrit, relu depuis le disque.

| Agrégat | Valeur |
|---|---|
| CA HT (Σ `amount`) | 20 164 650,00 F |
| Couverts (Σ quantités vendues) | 11 180 |
| Conso théorique (Σ quantité × coût Ratio) | 6 198 525,55 F — **30,7 % du CA** |
| Stock initial valorisé | 12 685 048,69 F |
| Transferts entrants | 41 949,00 F |
| Stock final valorisé | 6 342 528,59 F |
| Conso réelle (stock initial − stock final + transferts) | 6 384 469,10 F |
| Écart matières (réelle − théorique) | 185 943,55 F — **3,00 %** |
| Pertes valorisées (hors flux) | 24 669,79 F |
| Coût moyen par couvert | 554,43 F |

Ce que ce test démontre, point par point :

- **RG-03** : conso réelle = (stock initial − stock final) + transferts, **sans** déduire les pertes — vérifié à l'unité de la formule (les 24 669,79 F de pertes restent hors du flux).
- **CA** = Σ de la colonne montant du PMIX, et non quantité × prix recalculé.
- **Conso théorique** = Σ quantité × coût du Ratio Q3 ; 87/87 ventes rattachées à une fiche technique.
- **Stocks** valorisés au prix carton du référentiel, avec relu des 317 articles des deux inventaires après réécriture du fichier.
- **Aucune valorisation aveugle** : aucun agrégat NaN/infini, stocks strictement positifs, tout ce qui porte du stock a un prix, 0 PLU à coût nul sur ce jeu.
- L'écart atterrit **exactement à la cible de +3,00 %** par calibrage des quantités (max 5 passes, arrondi à 4 décimales = précision du classeur), ce qui prouve que les trois agrégats sont commensurables.

Ce test **ne valide pas les chiffres du client** : il prouve que la chaîne calcule juste sur des données maîtrisées. L'avant/après financier réel reste suspendu au classeur rempli (point 10 du §6).
