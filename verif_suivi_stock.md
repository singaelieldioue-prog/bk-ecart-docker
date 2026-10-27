# Vérification du fichier « Suivi Stock » généré — attentes CDG, feuille par feuille

**PROMPT VÉRIF-SUIVI** · rapport en lecture seule à l'origine (2026-10-25) · trois addendum correctifs du 2026-10-26
**La passe d'audit du 25/10 n'a modifié ni le classeur, ni le code, ni les référentiels** (consigne
« Interdit : modifier le fichier / modifier le code »). **En revanche**, trois correctifs demandés sur la
feuille Pertes ont été appliqués au code et régénéré le classeur audité le 26/10 : le point **P5** et la
sous-section **4.1** (prix des lignes transmises), le point **P3** et la sous-section **4.2** (zone
« CA HT du jour »), et le point **P1** avec la sous-section **4.3** (feuille rangée par catégorie +
4 lignes transmises du 4.1 qui retrouvent leur prix, dont `BOUTEILLE PEPSI ZERO 1,5L`, abandon du motif
« doublon de code »). Les mesures des sections 4 à 12 sont celles du classeur régénéré du 26/10 (§4.3),
celles de la section 3 et des feuilles non citées restent celles du 25/10 (les correctifs ne touchent que Pertes).

| | |
|---|---|
| Classeur audité | `tmp_verif/Suivi_BK1_Octobre_2026.xlsx` |
| Restaurant / période | BK1 · Octobre 2026 (période de test) |
| Poids | 26 876 756 octets (classeur du 26/10 après le correctif 4.3) — 26 877 311 octets après 4.2, 26 875 076 avant, 26 856 518 pour celui du 25/10 |
| Empreinte SHA-256 | `6646eae02b09dc95a55d42a7c23274aa04a6906538f988b32a68245354bebe56` (classeur régénéré le 26/10 à 08:29:38 — addendum 4.3). Addendum 4.2 : `25b759c4446d3c86dfd79fcebf88e0b8e91139d1f8ae59c7c634810d17873557`, 26 877 311 octets, 2026-10-26 01:53:36. Addendum 4.1 : `8311990e0187afa9622356d09be5d6ddf63fe170e1b286c6b9110d0c7fc043b7`, 26 875 076 octets, 00:55:51. Classeur audité le 25/10 : `f32497f8a514b0078d2833bda548d7c75fbc1a33f50f6c1b31d67479656f0acc`, 26 856 518 octets, 2026-10-25 14:11:07 |
| Horodatage d'écriture | 2026-10-26 08:29:38 (aucune réécriture depuis) |
| Ratio utilisé | RATIOS BURGER KING ABJ Q3 2026.xlsx (chargé le 23/10/2026) |
| Méthode | Lecture programmatique du XML OOXML réellement écrit (pas une relecture SheetJS) |

---

## 1. Comment ce rapport a été produit (à lire avant de transmettre à Aristide)

1. **Génération.** Le classeur a été produit en reproduisant hors UI la chaîne réelle de génération
   (`frontend/tests/tmp_verif_suivi_gen.mjs`) : base articles 621 actifs → ordre de référence →
   `enrichirAvecBaseLocale` (`frontend/src/utils/parsers.js:476`) → `buildModelesWb`
   (`frontend/src/utils/excelExporter.js:280`) → `XLSX.write` → `injecterLogoXlsx`
   (`frontend/src/utils/xlsxLogo.js:76`). **Limite : ce n'est pas un clic dans l'application** ; la
   chaîne est identique, mais un contrôle visuel par le CDG sur un classeur généré depuis l'UI reste
   nécessaire pour les points 2 à 3 ci-dessous.
   **Addendum 26/10** : la même chaîne, avec l'appel réel à `api.articlesListAll({actif:"1"})` lu en
   base de données (561 actifs au lieu des 621 lignes figées en JSON), a régénéré le classeur mesuré aux
   points P1, P3 et P5 et aux sous-sections 4.1, 4.2 et 4.3 — voir l'écart de méthode en §12.
2. **Ce qui a été mesuré.** Pour chaque point : adresse de cellule, formule écrite, `numFmt` réellement
   appliqué, remplissage, `<pane>`, `<dimension>`, ancres du logo. Sources de preuve :
   `frontend/tests/tmp_verif_suivi_{xml,mesures,couleurs,ordre,detail,risques,styles,releve,edrive_stats,customorder,cellules,final,formats}.mjs`
   → `tmp_verif/xml_inventory.json` ; addendum 26/10 : `pertes-transmis-prix.mjs`,
   `tmp_pertes_resolution.mjs`, `tmp_pertes_fichier_reel.mjs`, `tmp_pertes_retour.mjs`,
   et pour le correctif 4.3 `pertes-ordre-categorie.mjs`, `tmp_pertes_ordre_refus.mjs`,
   `tmp_pertes_code_pepsi.mjs`, `tmp_pertes_xml_ordre.mjs`, `tmp_pertes_xml_valeurs.mjs`.
3. **Retrait d'une mesure erronée (transparence).** Une première passe du décodeur XML déclarait
   13 cellules « ARTICLE » vides et 7 « Code Article » vides dans les inventaires, et 5 noms vides dans
   Pertes. **C'était un artefact de l'outillage** : la regex `<v>…</v>` ne reconnaissait pas
   `<v xml:space="preserve">` (utilisé par xlsx-js-style pour les libellés en fin d'espace). Le décodeur
   corrigé montre que **ces cellules sont bien renseignées** (elles contiennent juste des espaces en
   fin de chaîne, ex. `C54 = "CHICKEN CRUNCHY FILLER "`). Toutes les valeurs ci-dessous sortent de la
   passe corrigée. Aucun point de la checklist ne repose plus sur la mesure erronée.
4. **Sources des attentes.** Les emails d'Aristide (juin → octobre) **ne sont pas dans le dépôt**
   (aucun fichier `.eml`/`.msg`, rien à chercher). Chaque attente est donc reconstituée depuis trois
   sources datées et citées : le **PRD-BK-Ecart-Matieres.md** (lignes 97-108, 198-200, 226), la
   **mémoire projet** (retours CDG des 12, 13, 14, 21, 22, 23, 25 et 26/10) et les **tests de régression
   CDG** (`frontend/tests/regressions-cdg.mjs`, `backend/tests/`). Quand une attente est ambiguë ou
   contradictoire entre ces sources, le statut est ⚠️ et la nuance est écrite — **je ne tranche pas à la
   place d'Aristide**.
5. **Écart sur le critère d'acceptation.** Le critère annonce « 25 points vérifiés » puis énumère
   I1-I6, T1-T6, P1-P6, M1-M4, D1-D2, O1, F1-F6, soit **31 points** (6+6+6+4+2+1+6). **Les 31 points
   sont mesurés** ; le compte de 25 n'a pas été retrouvé — à confirmer (probablement une numérotation
   antérieure).

**Synthèse au 25/10 : 31 points mesurés → 19 ✅ · 7 ⚠️ · 5 ❌** (les 5 ❌ : P3 et O1 en priorité P0, I6 et I2 en P1, D2 en P2).
**Synthèse au 26/10, après le correctif Pertes de la sous-section 4.1 : 20 ✅ · 6 ⚠️ · 5 ❌** — le point
P5 passe de ⚠️ à ✅ ; les 5 ❌ sont inchangés (P3 « CA HT du jour », O1 Offert, I6 prix à 0, I2 ordre 311/318, D2 volets).
**Synthèse au 26/10, après le second correctif de la sous-section 4.2 : 20 ✅ · 7 ⚠️ · 4 ❌** — le point
P3 passe de ❌ à ✅ ; en re-mesurant le classeur régénéré, **F4 passe de ✅ à ⚠️** (2 formules portant une
valeur en cache : `E333` des deux inventaires, apparu avec le récap « à l'identique », voir F4).
Les 4 ❌ restants sont **non appliqués** : O1 (feuille Offert sans saisie ni total, P0),
I6 (36 prix carton à 0, P1), I2 (ordre 311/318, P1), D2 (volets figés manquants, P2).
**Synthèse au 26/10, après le troisième correctif de la sous-section 4.3 : inchangée, 20 ✅ · 7 ⚠️ · 4 ❌**
— P1 et P5 étaient déjà ✅ ; ce que le correctif change est **qualitatif** (la feuille est réellement
rangée par catégorie, mesurée : 10 blocs / 0 retour contre 13 blocs / 3 retours) et **12 des 13 lignes
transmises sont désormais valorisées** contre 8. Une **nouvelle question** est ouverte pour Aristide en
§4.3 (a) : le code `BTL-PEPSI 1,5L` occupe deux lignes de la feuille, parce que la liste transmise
elle-même contient deux libellés pour cette référence.

---

## 2. Inventaire initial / final (I1-I6)

| Point | Attente CDG (source) | Statut | Preuve mesurée |
|---|---|---|---|
| I1 | Deux feuilles « Inventaire Initial » et « Inventaire Final », tableau démarrant en A, volet figé, liste complète des articles (PRD l.103, l.200 ; harmonisation « tout démarrer en A ») | ✅ | `dimension A1:O333` sur les deux feuilles ; données lignes **7..324 = 318 lignes** ; en-têtes A6 « Nb articles / carton », E6 « Nb articles / inner », F6 « Carton », G6 « Inner », H6 « Unités », I6 « Nombre », K6 « Prix carton » (libellé C3 du 12/10), L6 « Valeur stock », N6 « Code Article » ; volet figé `<pane xSplit="3" ySplit="6" topLeftCell="D7" state="frozen"/>` (bornes du 12/10) |
| I2 | « articles dans l'ordre de référence » = ordre de `exemple inventaire.xlsx` (PRD AC2 l.226) | ❌ | **311/318 lignes à la bonne position, 7 décalées** en fin de liste : fichier L312 = `2600320ST / SANITIZER TABLETTE` alors que l'exemple met `940902BK / SERPILLERE - Bleu` en 312, et la rotation continue jusqu'à L318. Aucun code perdu, aucun code ajouté (mesure `codes de l'exemple absents : 0`) |
| I3 | Colonnes et libellés complets, catégories reprises de la base (PRD l.103 ; mémoire 12/10 « C3 — étiquettes ») | ✅ | 15 colonnes A..O avec bandeaux fusionnés ligne 5 (`D5:E5`, `F5:H5`, `I5:L5`, `N5:O5`) ; 6 catégories restituées en A (`Boissons`, `Nourriture - Surgelé/Frais/Sec`, `Packaging`, `Produits de Nettoyage`) ; Σ prix carton écrits = **7 076 666 F**, maximum 140 695 F, 37 prix non entiers |
| I4 | Valorisation et quantités calculées automatiquement, total et sous-totaux par catégorie (PRD l.103 ; mémoire 13/10 « L = Nombre × Prix carton ») | ✅ | `I7 = F7+IF(D7>0,G7*E7/D7,0)+IF(D7>0,H7/D7,0)` ; `L7 = I7*K7` ; `O7 = F7*D7+G7*E7+H7` ; `B325 "TOTAL STOCK"`, `L325 = SUM(L7:L324)` ; **récap « à l'identique » du modèle CDG, re-mesuré le 26/10** sur les lignes **327..333** : libellés en C (`Boissons`, `Nourriture - Surgelé/Frais/Sec`, `Packaging`, `Produits de Nettoyage`, `TOTAL`), montants en D `SUMIF($A$7:$A$324,C327,$L$7:$L$324)`, sous-total Nourriture `E328 = SUM(D328:D330)`, total `D333 = SUM(D327:D332)`, écart `E333 = L325-D333` ; format `RECAP_Z` qui affiche « - » un montant nul ; suite durable `recap-inventaire-categorie.mjs` 17/17 (voir F4 pour la valeur en cache de `E333`) |
| I5 | E-DERIVE + garde-fou : E = D quand le colisage est vraisemblable, bloqué au-delà de 1 000 (mémoire 25/10, `excelExporter.js:262-278`) | ✅ | 318 lignes : **177 dérivées** par le correctif (`derive_E`), 5 lignes où l'exemple donnait déjà E = D, **110 lignes E conservées** (jamais écrasées), **4 lignes bloquées E=0** (L111 DOSETTE KETCHUP 10GR D=1500 ; L221 SACHET FRITES PETIT 4000 D=4000 ; L226/L227 SACHET SNACK MOYEN D=2000/4000) → correspond exactement aux 4 `console.warn` du code ; 22 lignes non dérivables (D ≤ 1) ; **aucune colonne E vide** (0 cellule absente) |
| I6 | Liste complète et valorisable : désignation, code, unité, colisage et **prix carton non nuls** (retour CDG 23/10 « Inventaire : prix iceberg » ; mémoire « 82 articles sans prix ») | ❌ | Désignations, codes, unités et colisages : **0 cellule vide sur 318** (mesure corrigée). En revanche **36 lignes à `Prix carton = 0`** (K) → `L = I × K` affichera 0 F : L40 MILO, L62/63 H1 4' Bun Local, L65 H2 5' Bun Local, L69 H3 7' Bun Local, L83/84 MUFFIN CHOCOLAT, L109 DIP FRITE SAUCE 25GR, L133 SAUCE CARAMEL SD, L151 VINAIGRETTE NATURE, L156 SEL Importé, L168/169 TOMATES PFI/BENEVA, L176 SUCRE BUCHETTE, L179..L254 famille BOITE/BOL/COUVERCLE/SAC/SNACK BUCKET/Sundae Cup/TASSE/WRAP |

## 3. Transferts (T1-T6)

| Point | Attente CDG (source) | Statut | Preuve mesurée |
|---|---|---|---|
| T1 | Feuille unique de saisie des entrées/sorties, tableau en A, volet figé depuis D, en-têtes A..K (PRD l.104 ; mémoire 12/10 volets) | ✅ | en-têtes ligne 4 `A Date · B BK · C Désignation · D Catégorie · E Code / Désignation · F Unité · G Cond. · H Quantité · I Prix carton · J Valeur sortie · K CTRL` ; note A3 ; volet figé `<pane xSplit="3" ySplit="4" topLeftCell="D5">` ; bandeau A2 « ✏️ SAISIE » (BBDEFB) et E2 (C8E6C9) |
| T2 | Volume de lignes de saisie (PRD l.104 dit « 500 lignes pré-remplies » ; demande utilisateur 15/10 « Ligne de tranfert va a 20000 ») | ⚠️ | **20 000 lignes vides** (5..20004, `NB_LIGNES_TRANSFERTS=20000`, `excelExporter.js:518`), `SUM(J5:J20004)`. Le PRD n'est plus aligné (500) et parle de « pré-remplies » alors que le modèle est livré vide. Poids mesuré 25,86 Mo, 120 024 cellules de formule sur cette seule feuille |
| T3 | L'article se résout tout seul à partir de la **clé code** (mémoire 13/10 « clé colonne E ») | ✅ | C5/D5/F5/G5/I5 = `IF($E5="","",IFERROR(VLOOKUP(TRIM(E5&""),"Référentiel Articles"!$A$2:$F$634,n,FALSE),""))` sur les 20 000 lignes ; plage `A2:F634` cohérente avec les 633 clés du référentiel ; `TRIM` absorbe les codes à espaces du fichier CDG |
| T4 | La valeur de sortie se calcule sans planter le total | ✅ | `J5 = IF(OR($E5="",$H5=""),"",$H5*$I5)`, format `#,##0` ; pas de multiplication texte × nombre possible |
| T5 | CTRL **non pré-rempli** par l'outil (demande 13/10, task « annuler le remplissage auto de la colonne CTRL ») | ⚠️ | `K5` : **aucune formule** (conforme), cellule vide `t="str"`. Mais le fond reste `#FFE0B2` (orange « = CALCUL AUTOMATIQUE »), identique à J5 : visuellement CTRL passe pour une colonne calculée |
| T6 | Récapitulatif en colonnes N/O (lignes saisies, sans prix, total, par catégorie, par BK destinataire) + cumuls en bas (mémoire 13/10 « correction 02 ») | ✅ | `O2 = SUMPRODUCT(--($E$5:$E$20004<>""))`, `O3 = SUMPRODUCT(--($E$5:$E$20004<>""),--($I$5:$I$20004=""))`, `N4 "TOTAL TRANSFERTS" / O4 = SUM($J$5:$J$20004)` ; catégories `O7..O12` en SUMIF ; `N15 "→ BK1"` = `SUMIF(...,"BK1")+SUMIF(...,"1")+SUMIF(...,"BK 1")` ; bas de feuille L20005 « CUMUL TRANSFERTS PÉRIODE » et L20006 « TOTAL », récap catégorie L20009..20014 et catégorie × BK L20016..20021 |

## 4. Pertes (P1-P6)

| Point | Attente CDG (source) | Statut | Preuve mesurée |
|---|---|---|---|
| P1 | Feuille pilotée par **la liste transmise par les équipes**, pas par l'intersection avec la base (mémoire 14/10, `excelExporter.js:703 PERTES_WHITELIST`) — **et rangée par catégorie** (retour CDG 26/10) | ✅ | **Mesure 26/10 après le correctif 4.3** : `dimension A1:AO191` ; lignes 5..190 = **186 lignes écrites** = 146 matières publiées + 13 lignes transmises (6 résolues sur la base complète par nom exact, 3 par désignation approchante, 3 sur le référentiel PMIX, 1 restante à renseigner) + 27 produits finis du Ratio. **Séquence mesurée dans le XML : 10 blocs pour 10 catégories, 0 retour** — 5→43 Boissons (39), 44→88 Nourriture - Surgelé (45), 89→101 Nourriture - Frais (13), 102→154 Nourriture - Sec (53), 155→159 Nourriture (5), 160→162 Produits finis (3), 163→186 SANDWICHS (24), 187 SALADS (1), 188→189 HOT BEVERAGES (2), 190 ligne sans catégorie (la seule « à renseigner ») ; **0 bandeau**, 0 ligne sans désignation, **0 doublon**, 0 ligne THÉ/LAIT, 0 ligne Produits de Nettoyage/Packaging (exclusions 14/10 et 22/10 respectées) |
| P2 | Pertes jour par jour sur 31 colonnes, quantité = somme des jours, valeur = prix pièce × quantité, total en bas (PRD l.105 ; mémoire 14/10 géométrie) | ✅ | `J4..AN4 = 1..31` ; `G5 = SUM(J5:AN5)` ; `H5 = E5*G5` ; `F191 "TOTAL PERTES"` et `H191 = SUM(H5:H190)` — la borne couvre exactement les 186 lignes de données (au 25/10 la plage allait jusqu'à L192 et balayait les deux bandeaux, qui ajoutaient 0) |
| P3 | Le **CA HT du jour est saisi** et le ratio perte/CA se calcule (PRD l.105 ; note A3 de la feuille elle-même : « le CA HT du jour en ligne 1 (colonne I) ») | ✅ | **Correctif 26/10** (§4.2) : au 25/10, seule `I1` existait et **les 31 cellules `J1..AN1` n'étaient pas publiées** (0 sur 31 dans le XML). Mesure 26/10 sur le classeur livré : **`J1..AN1` = 31/31 publiées**, chacune `v = 0` sans formule, style résolu dans `xl/styles.xml` = **remplissage `FFE8F5E9`** (vert de saisie) + **`numFmtId 3` (« #,##0 »)** ; `I1 "CA HT du jour (saisie)"` (fond `C8E6C9`) ; **`AO1 = SUM(J1:AN1)`**, `AO2 = SUBTOTAL(9,$J$2:$AN$2)`, **`AO3 = IF(AO1=0,"",AO2/AO1)`** ; `J2 = SUMPRODUCT(J$5:J$190,$E$5:$E$190)` et `J3 = IF(J1=0,"",J2/J1)` inchangés ; `AP1` absente (pas de 32ᵉ colonne de jour) ; volet figé conservé (`xSplit="9" ySplit="4" topLeftCell="J5"`) |
| P4 | Prix pièce = prix carton ÷ Cond., **foi au fichier** sur la feuille Pertes ; produits finis valorisés au coût théorique (mémoire 13/10 Pertes ; retour 23/10) | ✅ | **Mesure 26/10 après le correctif 4.3** : `IF(C{R}>0,D{R}/C{R},D{R})` sur **185 lignes** dont les 12 résolues (ex. `E40 = IF(C40>0,D40/C40,D40)` avec `C40=12`, `D40=1288,14`) ; **1 ligne seulement** reste en `E = IF(AND(ISNUMBER(C),C>0),D/C,0)` (garde anti-#VALUE! du 14/10), la L190 « BBQ TENDERCRISP » ; toutes les cellules C non gardées sont numériques → **aucun #VALUE!** ; `D163 WHOPPER = 1 186,6720790730283` |
| P5 | Les articles transmis introuvables doivent retrouver leur prix, ou rester **signalés au CDG pour qu'il renseigne Cond. et Prix** (retour CDG 25/10 : « les prix existent bel et bien » ; **retour 26/10 : « regarde dans la base articles les articles sans infos, on trouve par exemple Pepsi 1,5L »**) | ✅ | **Correctifs 26/10** (§4.1 puis §4.3) : sur les 13 lignes transmises absentes du modèle, **12 sont valorisées et 1 reste à renseigner**. Base par nom exact : L40 MIRINDA ORANGE PET 30CL (12 / 1 288,14 / « Pack de 12 »), L41 BOUTEILLE 7UP 30CL (12 / 1 288,14), **L42 BOUTEILLE PEPSI ZERO 1,5L (6 / 3 150 → 525 F la pièce)**, L156 HUILE AYA 5 L (25 / 21 186,44), L157 BUN 7'' NOUGATINE (75 / 9 375), L158 BUN 5'' Nougatine (54 / 7 560). Base par désignation approchante, candidat unique : **L43 EAU KIRENE 50 CL 16 ← « EAU KIREN 50cl » (16 / 1 288,14)**, **L155 FROMAGE MEDHI NEW ← « FROMAGE MEDHDI NEW » (1 056 / 57 451,42)**, **L159 MOZZARELLA STICKS ← « MOZZARELLA STICKS BIS » (204 / 30 072,59)**. Coût du Ratio : L160 CHICKEN BURGER PETIT PRIX = 472,97 (PLU 500150), L161 SALADE POULET CROUSTILLANT = 1 702,72 (PLU 494), L162 SALADE POULET GRILLE = 2 036,83 (PLU 479). Laissée vide : L190 BBQ TENDERCRISP — ni la base (qui n'a que « TENDERCRISP PATTY », inactif, et « WRAP TENDERCRISP », Packaging) ni le Ratio (PLU 330 « TENDERCRISP ») ne connaissent cette désignation |
| P6 | Les produits finis du Ratio figurent dans la feuille, au coût Q3 (retour CDG 23/10 ; Whopper = 1 187 F et non 5 500 F) | ✅ | **Mesure 26/10 après le correctif 4.3** : 27 lignes de produits finis **L163..L189** (24 SANDWICHS, 1 SALADS, 2 HOT BEVERAGES) ; `D163 WHOPPER = 1 186,6720790730283`, `D164 WHOPPER CHEESE = 1 295,4815893928067`, `D165 DOUBLE WHOPPER = 1 759,0420386722744` — cohérent avec `Ratios!D5/D6/D7` (PV TTC 5 500/6 000/7 000 non écrits, mémoire 24/10). S'y ajoutent les 3 PLU résolus par le correctif du 26/10 (L160..L162, catégorie « Produits finis ») |

### 4.1 Correctif du 26/10 — les lignes transmises de Pertes retrouvent leur prix, les bandeaux disparaissent

> **Lu le 26/10, complété le même jour.** Le retour CDG de la soirée (« regarde dans la base articles les
> articles sans infos, on trouve par exemple Pepsi 1,5L ») a **infirmé un motif de refus** écrit ici (le
> « doublon de code » de `BOUTEILLE PEPSI ZERO 1,5L`) et a conduit le correctif **4.3**, qui porte les
> lignes valorisées de 8 à 12 et range la feuille par catégorie — **les adresses L151..L190 citées
> ci-dessous ont donc bougé**. L'état livré est celui de §4.3 et des
> lignes P1/P4/P5/P6 ci-dessus ; ce §4.1 reste la trace de la première passe.


**Classeur mesuré** : `tmp_verif/Suivi_BK1_Octobre_2026.xlsx` régénéré le 2026-10-26 00:55:51
(26 875 076 octets, SHA-256 `8311990e…`), **puis re-mesuré le 26/10 à 01:53:36 sur le classeur du
correctif 4.2** (26 877 311 octets, SHA-256 `25b759c4…`) : les 186 lignes de données, les adresses
L151..L190, les 181 formules ordinaires / 5 gardées, `H191 = SUM(H5:H190)` et l'absence de bandeau sont
**strictement identiques** — le second correctif n'écrit que les lignes 1 à 3 (sources lues en base de
données, lecture seule : 561 articles actifs, Ratio Q3 104 produits, complément PMIX 231 PLU, base
locale 456 lignes).

**Cause** : la feuille Pertes ne peut publier que les 318 désignations du modèle d'inventaire,
appariées **par nom**. Un article transmis que la base connaît sous un autre libellé (ou que le
modèle ne liste pas) sortait donc en ligne vide à 0,00 F, même quand son colisage et son prix
existent.

**Correctif** (`frontend/src/utils/excelExporter.js`, `buildModelesWb`/`genererModelesSuivi`
en 8e paramètre `baseComplete`, passé par `BaseArticlesTab.jsx:160/180/241`) : avant de laisser une
ligne transmise vide, le prix est résolu sur deux sources seulement —
1. **la base complète, par désignation exacte**, refusée si le **code** de l'article est déjà publié
   sous une autre désignation (deux lignes Pertes sur un même code compteraient deux fois la même
   perte) ;
2. **le référentiel PMIX** (Ratio puis base complémentaire), par désignation exacte ou par
   **troncature d'un seul mot** (`SALADE POULET G` → `SALADE POULET GRILLE`), le **coût du Ratio
   restant prioritaire** quand les deux sources connaissent le même PLU (règle du 13/10) ; un PLU
   déjà valorisé est refusé, et deux candidats ou plus = refus.

Aucun prix n'est inventé : les 5 lignes sans appariement certain gardent Cond./Prix vides et la
formule protégée `ISNUMBER`. Les deux bandeaux (L151 marine, L165 violet) sont supprimés, la colonne
E ne contient donc plus jamais de texte et les plages `SUM` / `SUMPRODUCT` couvrent exactement les
lignes de données.

**Preuves** : test durable `frontend/tests/pertes-transmis-prix.mjs` — 19 points, rouge avant le
correctif (10 en échec), vert après (19/19, 186 lignes de données) ; radiographie du fichier
réel `frontend/tests/tmp_pertes_fichier_reel.mjs` (les 8 lignes valorisées avec leurs adresses
L151..L163 citées en P5, 181 formules ordinaires / 5 gardées, `H191 = SUM(H5:H190)`,
`J2 = SUMPRODUCT(J$5:J$190,$E$5:$E$190)`, bandeaux : aucun, ruptures de séquence : aucune) ;
chaîne de retour CDG rejouée par `frontend/tests/tmp_pertes_retour.mjs` : 3 pertes saisies sur
L151/L153/L161 → le parseur valorise **322,03 F** (MIRINDA) et **945,94 F** (CHICKEN BURGER) « foi au
fichier », et **0 F** seulement sur la ligne refusée ; 7 suites durables exit 0
(`pertes-unite`, `recap-inventaire-categorie` 17/17, `recap-pmix-robustesse`, `regressions-cdg`,
`derive-inner-colisage`, `pertes-transmis-prix`, `pertes-ca-ht`), revérifiées à blanc le 26/10 après le
second correctif ; `npm run build` ✓ 6,64 s.

**Non fait / à trancher** : `HUILE AYA 5 L` (`A5L`) et les 27 produits finis publiés conservent leur
catégorie d'origine ; les 5 lignes résolues par la base écrivent en colonne A la catégorie de la
base, dont le « **Nourriture** » nu (HUILE AYA 5 L, BUN 7''/5'' Nougatine) alors que le modèle
d'inventaire distingue `Nourriture - Sec/Surgelé/Frais` — la base est à corriger, pas la feuille.
Le prix de `HUILE AYA 5 L` (21 186,44 F pour un colisage de 25, identique au `A25L` 25 L) reste
**suspect** et à confirmer par le CDG. Les 5 lignes laissées vides sont la liste réellement attendue
du CDG. Les rapports existants ne sont pas régénérés.

### 4.2 Correctif du 26/10 — la zone « CA HT du jour » existe enfin dans le XML (P3)

**Modèle de référence, radiographié le 26/10** : `recahierdeschargesfonctionnelautomatisationdelava/PERTE JULLET.xlsx`
(une feuille par restaurant, `BK1`..`BK9` + `LISTE`). `I1 "CA HT"` suivi de **31 montants saisis jour par
jour** (`J1..AN1`) — sur BK1 : **31 valeurs, somme 44 856 753 F**, à rapprocher de
`CA JUILLET 2026.xlsx !CA!C4 = 44 856 758,99 F` (écart 5,99 F, arrondis) ; `AN1 = 1 256 717 F` au
31 juillet. Suit `I2 "Valeur perte"` (sur BK1 : `AN2 = SUMPRODUCT(Pertes4[31],Pertes4[Prix pièce])`, la
table structurée `Pertes4` couvrant `B4:AN197`), `I3 "Ratio perte"`
(`J3..AN3 = IF(J1=0,"",J2/J1)` au format `0.00%`) et `AO2 = SUBTOTAL(9,$J$2:$AN$2)`. BK8 ajoute
**`AO1 = +SUM(J1:AN1)` (52 943 979 F)** et le ratio global en **`AP3 = +AO2/AO1`**. Les lignes 2/3 et `AO2`
de notre feuille étaient déjà conformes à ce modèle dès le 25/10 ; seuls la ligne 1 et le total du CA manquaient.

**Cause racine (mesurée, pas supposée).** Les 31 cellules étaient bien bouclées dans le générateur, mais
écrites `{t:"n", z:"#,##0", s:…}` **sans `v` ni `f`** : `xlsx-js-style` ne publie pas une cellule sans
valeur ni formule, donc la ligne 1 du XML livré ne contenait que `B1` et `I1`. Le test rouge l'a chiffré :
`0/31 (J,K,L,…,AN)`.

**Correctif** (`frontend/src/utils/excelExporter.js:889-902`, bloc d'indicateurs de la feuille Pertes) :
1. `J1..AN1` **pré-remplies 0** avec le style de saisie déjà utilisé pour les quantités perdues
   (police `2E7D32` taille 11, fond `E8F5E9`, format `#,##0`, bordure) — la cellule existe, le CDG n'a
   qu'à écraser le 0, comme sur les 31 colonnes de jours ;
2. **`AO1 = SUM(J1:AN1)`** : total du CA du mois, dans le style `ST.totalVp` déjà employé en `AO2` ;
3. **`AO3 = IF(AO1=0,"",AO2/AO1)`** : ratio global perte / CA, **gardé contre `AO1 = 0`** comme les 31
   ratios quotidiens, donc aucune `#DIV/0!` sur un classeur neuf. Chez le CDG ce ratio est en `AP3`
   (colonne libre) ; notre Pertes n'a qu'une colonne de total, l'indice `AO`, il y est donc écrit en `AO3`
   — même formule, même format `0.00%`.

Rien d'autre n'est touché : ratios journaliers, `SUMPRODUCT`, bandeau fusionné `J2:AN2`, volet figé
(`xSplit="9" ySplit="4" topLeftCell="J5"`), `AP1` absente (pas de 32ᵉ colonne de jour) et les 186 lignes de
données sont re-mesurées identiques **en contenu** (§4.1). Leur **ordre** a changé depuis : le correctif 4.3,
appliqué plus tard le 26/10, les range par catégorie. La note `A3` de la feuille (« le CA HT du jour en ligne 1 »)
n'a pas eu à être corrigée : c'est le XML qui ne suivait pas.

**Impact à l'import : nul, mesuré dans les deux sens.** `parseSuivisStock` parcourt Pertes depuis
`rows[3]` (ligne 4 = en-têtes, `parsers.js:677`) et écarte toute ligne sans quantité perdue
(`parsers.js:691 if(qtePieces===0) continue;`) : la ligne 1 n'est jamais lue. Modèle neuf → **0 perte** ;
quantité saisie en `J5` (2 pièces de BIERE BOCK 33cl) → **1 perte de 2 pièces, 1 000 F** au prix pièce du
référentiel. Aucun lecteur de « CA HT » n'existe ailleurs dans `frontend/src` (grep) et `backend/src`
n'est pas touché.

**Preuves** : suite durable `frontend/tests/pertes-ca-ht.mjs` — **11 points, rouge avant le correctif**
(3 en échec dont « 0/31 cellules »), **vert après (11/11)** ; radiographie du classeur livré
`frontend/tests/tmp_ca_ht_fichier_reel.mjs` : `J1..AN1` 31/31 publiées à `v = 0` sans formule, style résolu
dans `xl/styles.xml` = remplissage `FFE8F5E9` + `numFmtId 3`, `AO1`/`AO2`/`AO3`, volet figé conservé,
réimport 0 perte ; 7 suites durables exit 0 (`pertes-ca-ht` 11, `pertes-transmis-prix` 19,
`derive-inner-colisage` 18, `recap-inventaire-categorie` 17, `regressions-cdg` 6,
`recap-pmix-robustesse` 5, `pertes-unite` 3) ; `npm run build` ✓ 6,64 s.

**Non fait / à trancher.** Le CA HT reste une **saisie magasin** : l'application ne le calcule pas et
aucune source de données ne permet de le pré-remplir, donc `AO3` et les 31 ratios afficheront vide tant
que la ligne 1 n'est pas renseignée. Les trois autres traits du fichier juillet relevés le 26/10 sont
**expressément écartés** par l'arbitrage de périmètre : (a) les 5 catégories du CDG (`Boissons`,
`Nourriture - Frais/Sec/Surgelé`, `Produit fini`) à la place des nôtres, (b) un récap par catégorie sur
Pertes, (c) leur sémantique `Cond.` = facteur de conversion de l'unité de perte avec
`Unité de perte ∈ {pièce, g, kg, litre}` — à noter que ce classeur de juillet ne contient **aucun prix**
(0 prix carton et 0 prix pièce renseignés sur 191 lignes) : il ne peut pas servir de référentiel de prix,
seulement de modèle de mise en page. Deux anomalies lues au passage dans leur fichier : `BK7` a une
32ᵉ colonne de jour (`AO4 = 32`), et `BK8` est le seul restaurant à totaliser son CA.

### 4.3 Correctif du 26/10 — la feuille Pertes est rangée par catégorie et 4 lignes transmises de plus retrouvent leur prix

**Demande du CDG (26/10)** : « fichier de perte rangé par catégorie stp, y a catégorie Boissons en haut,
en voici un autre décalé Boissons en bas, ici je ne comprend pas » + « regarde dans la base articles les
articles sans info, on trouve par exemple Pepsi 1,5L » (capture à l'appui : `BOUTEILLE PEPSI ZERO 1,5L` ·
`BTL-PEPSI 1,5L` · Boissons · Pack · Cond. 6 · Prix carton 3 150 · Prix pièce 525 · Actif). Périmètre
choisi par le CDG : **Pepsi Zero + 3 appariements approchants** (`EAU KIRENE 50 CL 16`,
`FROMAGE MEDHI NEW`, `MOZZARELLA STICKS`), `BBQ TENDERCRISP` devant rester vide.

**Deux défauts mesurés avant le correctif** (`frontend/tests/tmp_pertes_ordre_refus.mjs` et
`tmp_pertes_xml_ordre.mjs`, rejouées sur l'état **d'avant** le 26/10 — classeur `25b759c4…` ; depuis le
correctif ces deux sondes affichent l'état livré. Le **rouge** a été **reproduit le 26/10** en désactivant
les deux règles du 4.3 (tri + appariement approchant) : `pertes-ordre-categorie.mjs` rend exactement
**5 FAIL / 13**, puis **13 PASS / 0 FAIL** après restauration octet pour octet du fichier
(SHA-256 `48293e0c…` vérifié avant/après) ; le rouge ne se rejoue donc qu'avec cette désactivation) :
1. **Découpage** : **13 blocs pour 10 catégories, 3 retours** — la séquence publiée était le modèle
   d'inventaire (l.5→150) puis les lignes transmises (l.151→163) puis les produits finis du Ratio
   (l.164→190), d'où `5→39 Boissons`, `151→152 Boissons`, `141→150 Frais` puis `151` Boissons à
   nouveau. Les catégories n'étaient jamais groupées : trois **groupes d'origine** publiés à la suite.
2. **Fausse garde « doublon de code »** sur `BOUTEILLE PEPSI ZERO 1,5L` (motif écrit le 26/10 au §4.1 :
   « code `BTL-PEPSI 1,5L` déjà publié sous « BOUTEILLE PEPSI 1,5L » → double emploi »). **Motif
   abandonné** — l'autopsie `tmp_pertes_code_pepsi.mjs` montre que la désignation du modèle
   `BOUTEILLE PEPSI 1,5L` n'existe **pas** dans la base : `ordonnerSelonExemple` apparie le modèle à la
   base **par code**, donc cette ligne a *hérité* du code et des prix du Zero, et `codesPublies`
   (construit sur les codes du **modèle**) a ensuite bloqué le **vrai** article. Requête en base,
   lecture seule : `SELECT … WHERE code='BTL-PEPSI 1,5L'` → **1 seule ligne**, `BOUTEILLE PEPSI ZERO
   1,5L` (Boissons, Cond. 6, 3 150 F). Aucun autre article ne porte ce code : il n'y avait pas doublon.

**Correctif** (`frontend/src/utils/excelExporter.js`, trois points) :
1. **garde limitée aux vrais doublons** (`:810-817`) — `codesPublies` devient une Map
   code → désignation ; le refus n'opère que si la désignation déjà publiée sous ce code **existe dans
   la base** (`publie && baseParNom.has(publie)`). Une ligne transmise valorisée enregistre son code,
   donc deux articles *réellement* distincts du même code ne comptent pas deux fois ;
2. **troisième source de résolution : la base par désignation approchante** (`:835-847`,
   `candidatsBase`) — candidat admis s'il est **unique**, si sa désignation est à **distance
   d'édition ≤ 3** du nom transmis normalisé (`:818-833`, Levenshtein itératif, sans allocation de
   matrice), et si **chaque nombre du nom transmis** se retrouve dans les nombres du nom du candidat
   **ou dans son conditionnement**. C'est cette dernière condition qui départage
   `EAU KIRENE 50 CL 16` ← `EAU KIREN 50cl` (Cond. **16**) de `EAU KIREN 50cl 12` (Cond. 12) ; à
   partir de deux candidats, refus (aucun prix deviné, `FROMAGE MEDHI NEW` ← `FROMAGE MEDHDI NEW`
   passe à distance 1) ;
3. **tri par catégorie** (`:746-747`, `:876-887`) — les lignes ne sont plus écrites au fil des trois
   groupes mais **tamponnées** (`pending`) puis triées par `rangCategorie`, ordre = ordre de
   **première apparition dans le modèle d'inventaire**, puis les catégories apparues trop tard pour
   le modèle (`Produits finis`, `SANDWICHS`, `SALADS`, `HOT BEVERAGES`, `Nourriture`) dans leur ordre de
   publication, puis les lignes **sans catégorie en dernier**. Le tri est **stable** (`Array.sort`),
   donc l'ordre interne du modèle et l'ordre interne des lignes transmises sont conservés ; les lignes
   restent **contiguës** à partir de la ligne 5, donc `lastP`, `SUM(J{R}:AN{R})`,
   `SUMPRODUCT(J$5:J$190,$E$5:$E$190)`, `H191 = SUM(H5:H190)` et le volet figé restent exacts sans
   aucune modification de leurs bornes.

**Résultat mesuré dans le XML du classeur livré** (SHA-256 `6646eae0…`, 26 876 756 octets,
2026-10-26 08:29) : **10 blocs pour 10 catégories, 0 retour** —
5→43 Boissons (39), 44→88 Nourriture - Surgelé (45), 89→101 Nourriture - Frais (13),
102→154 Nourriture - Sec (53), 155→159 Nourriture (5), 160→162 Produits finis (3),
163→186 SANDWICHS (24), 187 SALADS (1), 188→189 HOT BEVERAGES (2), 190 (1) sans catégorie.
186 lignes de données, `dimension A1:AO191`, volet figé conservé (`xSplit="9" ySplit="4"
topLeftCell="J5"`), 0 bandeau, 0 rupture, 0 doublon de désignation, 1 seule ligne gardée `ISNUMBER`
(L190 « BBQ TENDERCRISP » au lieu de 5). Les 4 résolutions nouvelles, cellule par cellule :
`l42 A="Boissons" C=6 D=3150 F="Pack de 6"`, `l43 A="Boissons" C=16 D=1288,1355932203392
F="Pack de 16"`, `l155 A="Nourriture" C=1056 D=57451,42144884304 F="Carton de 1056"`,
`l159 A="Nourriture" C=204 D=30072,588088733424 F="Carton de 204"`.

**Preuves** : suite durable nouvelle `frontend/tests/pertes-ordre-categorie.mjs` — **13 points, 5 en
échec avant le correctif** (3 retours de Boissons, lignes résolues hors de leur bloc), **13/13 après**,
fixture à catégories entrelacées (7 lignes du modèle dans 4 catégories) + 4 lignes transmises ;
suite durable `pertes-transmis-prix` passée de 19 à **20 points, 20/20** ; les 8 suites durables exit 0
(`pertes-ca-ht` 11, `pertes-transmis-prix` 20, `pertes-ordre-categorie` 13, `derive-inner-colisage` 18,
`recap-inventaire-categorie` 17, `regressions-cdg` 6, `recap-pmix-robustesse` 5, `pertes-unite` 3 =
**93 points**) ; non-régression du correctif 4.2 re-mesurée sur le même classeur (`J1..AN1` 31/31, `AO1`,
`AO3`) ; chaîne de retour CDG rejouée `tmp_pertes_retour.mjs` — 3 pertes saisies aux nouvelles adresses
(l.40 MIRINDA, **l.42 BOUTEILLE PEPSI ZERO**, l.160 CHICKEN BURGER) → le parseur valorise
**322,03 F + 525 F + 945,94 F = 1 792,98 F** « foi au fichier », et le réordonnancement est
**invisible à l'import** (`parseSuivisStock` parcourt Pertes depuis `rows[3]` et ne connaît aucun ordre
de catégories) ; `npm run build` ✓ 9,43 s (13,03 s à la première passe, avant le rouge-vert de re-contrôle).

**Reste à trancher avec le CDG.** (a) Le code `BTL-PEPSI 1,5L` vit désormais sur **deux lignes** de la
feuille — l.28 sous la désignation du modèle `BOUTEILLE PEPSI 1,5L` (que la base ne connaît pas sous ce
nom) et l.42 sous la désignation transmise `BOUTEILLE PEPSI ZERO 1,5L`, toutes deux Cond. 6 / 3 150 F :
c'est la liste transmise qui contient deux libellés pour une même référence, et le magasin doit savoir
laquelle saisir. La correction propre est côté **base / exemple inventaire.xlsx** (renommer ou fusionner),
pas côté feuille. (b) Les **libellés de catégories** restent hétérogènes : « Nourriture » nu pour
HUILE AYA 5 L et les BUN (5 lignes, bloc 155→159) alors que le modèle distingue
`Nourriture - Sec/Surgelé/Frais`, et le Ratio écrit `SANDWICHS` / `SALADS` / `HOT BEVERAGES` (27 lignes)
au lieu de « Produit fini » comme dans `PERTE JULLET.xlsx`. Le tri **respecte** ces libellés tels quels ;
les harmoniser est une décision référentiel, hors du périmètre demandé. (c) `BBQ TENDERCRISP` : ni la
base (seulement `TENDERCRISP PATTY` **inactif** et `WRAP TENDERCRISP`, catégorie Packaging) ni le Ratio
(PLU 330 « TENDERCRISP ») ne le connaissent → à renseigner dans la **base articles** plutôt que dans la
feuille, si le CDG le souhaite. (d) Les rapports existants ne sont pas régénérés.

### 4.4 Correctif du 26/10 — les feuilles Inventaire publient la table « Inventaire initial » du CDG, et le réimport le prouve

**Demande du CDG (26/10)** : « va dans `…\exact`, ya un fichier suivi de stock ; je produis tout pareil
pour notre fichier suivi de stock, conditionnement pareil et tout regarde ». Référence autoritaire :
`exact/suivis stock BK 1.xlsx` (52 917 576 octets), **feuille `Inventaire initial`**.

**Pourquoi cette feuille et pas `Articles`** : dans le classeur du CDG, les deux feuilles se contredisent
(106 colisages et 72 prix divergents). C'est `Inventaire initial` que le magasin remplit : elle fait foi.
Avant le correctif, notre modèle divergeait d'elle sur **41 colisages, 189 prix et 1 unité** (312 articles
communs avec la base locale de 621 articles) ; après, **0 / 0 / 0**.

**Table extraite** (`frontend/src/utils/inventaireReferentielCdg.js`) : **316 lignes, 315 noms distincts**
(« SANITIZER TABLETTE » figure deux fois chez le CDG, L309 et L316 — la première occurrence fait foi, comme
dans la feuille générée). Colonnes reprises : COLISAGE (E du CDG), « Nb articles / inner » (F), unité
affichée (K), prix de valorisation (L), dans l'ordre strict du CDG. **291 lignes ont un colisage, 24 restent
vides** (produits pesés : oignons, tomates…, aucune valeur inventée) ; **6 prix sont à 0 chez le CDG**
(`BOUTEILLE COCA COLA 1.5L`, `BOUTEILLE FANTA 1.5L`, `BOUTEILLE SPRITE 1.5L`, `TOMATE BENEVA`, `BOITE ENFANT`,
`BOL A SALADE`) et sont publiés à 0.

**Ce que la feuille générée publie** (`excelExporter.js`, `invSheet`) : D = colonne E du CDG, E = colonne F
(cellule **non écrite** quand le CDG ne la renseigne pas), J = colonne K, K = colonne L. Le modèle
d'inventaire transmis ne sert plus qu'aux articles absents de la table ; **E-DERIVE (25/10) ne couvre plus
que ce reliquat** (18 lignes hors table sur la base locale ; aucune trace `derive_E` sur une ligne cotée).

**Conséquence assumée, identique au modèle du CDG** : sa formule `I = F + IF(D>0;G*E/D;0) + IF(D>0;H/D;0)`
annule un inner saisi quand E est vide. **182 lignes du CDG ont un colisage > 1 sans inner** : chez elles,
on saisit le carton (F) ou les unités (H), comme dans son fichier. Là où le CDG donne l'inner, la conversion
est juste : `SANITIZER TABLETTE` (D = 1380, E = 230) et `CHILI CHEESE BITES` (300 / 50) → **1 inner =
1/6 carton** au réimport (et non 1 carton comme sous E-DERIVE).

**Filtre de la liste d'ordre corrigé** : `CUSTOM_ARTICLES_ORDER` écrit `BOUTEILLE PEPSI 1,5L`,
`HAMBURGER PATTY - Toledo`, `WHOPPER PATTY  - Toledo`, `BUN 4’’ NOUGATINE`, `CAN PEPSI 250 ml` ; le base
article écrit `1.5L`, `Hamburger Patty Toledo`, `4''`, `250ML`. Le filtre comparait la ponctuation à
l'identique : **5 articles du CDG disparaissaient silencieusement** des inventaires générés. Le repli de
normalisation supprime désormais la ponctuation des deux côtés (0 collision sur les 321 libellés).

**Round-trip réimport** (nouvelle suite durable `frontend/tests/inventaire-roundtrip-reimport.mjs`,
génération → `XLSX.write` → `XLSX.read` → `parseSuivisStock`) : table du CDG seule, **315/315 articles
relus**, COLISAGE et prix relus **au centime**, 24 colisages vides préservés, récap (Boissons… TOTAL) **non
avalé**, modèle vierge ⇒ **stock importé nul** ; données réelles (`sample_data` : 523 articles de base,
Ratio Q3), **263 articles publiés = 263 couverts par le CDG**, 0 perdu, 0 colisage divergent, prix relu =
référentiel sinon prix du CDG, les 5 libellés à ponctuation variable désormais présents.

**Pertes — même asservissement** : la feuille reproduit la table `Perte_Q1 2026` du CDG (**191 lignes, 5
blocs** : Boissons 43, Nourriture - Frais 14, Nourriture - Sec 55, Nourriture - Surgelé 48, Produit fini 31),
ordre, libellés, Cond. et Unité de perte compris — ceci **remplace** la composition de 186 lignes décrite au
§4.3. Les **5 lignes où le CDG est à 0** (`l24` BOUTEILLE PEPSI ZERO 1,5L, `l137` H2 5' Bun, `l140` H3 7'
Bun, `l143` H4 Corn dusted 4,5' Bun, `l182` CHEESEBURGER JUNIOR) gardent notre résolution de prix : aucun
prix inventé, aucune ligne perdue.

**Divergence de périmètre, volontaire** : THE et LAIT en brique figurent dans la table Pertes (le CDG les
suit en pertes) mais **restent absents des Inventaires** — supprimés de la base articles le 14/10 sur
instruction explicite.

**Preuves** : `inventaire-referentiel-cdg` **22/22** (COLISAGE, inner, unité, prix, 24 vides, 6 zéros,
Inventaire Final, formules I/L/O, TOTAL `SUM(L7:L321)` en L322, récap SUMIF, XML : D163 vide) ;
`inventaire-roundtrip-reimport` **17/17** (nouvelle) ; `derive-inner-colisage` retargetée **19/19** ; campagne
**11 suites, 146 points verts** (`pertes-ca-ht` 11, `pertes-liste-exacte` 18, `pertes-ordre-categorie` 12,
`pertes-transmis-prix` 17, `pertes-unite` 8, `recap-inventaire-categorie` 17, `recap-pmix-robustesse` 5,
`derive-inner-colisage` 19, `inventaire-referentiel-cdg` 22, `inventaire-roundtrip-reimport` 17,
`regressions-cdg` 6) ; `npm run build` ✓ 8,53 s.

### 4.5 Correctif du 26/10 — le conditionnement du référentiel caché est celui du CDG, donc Transferts et P.Douane aussi

**Demande du CDG (26/10)** : « je produit tout pareil pour notre fichier suivi de stock **conditionnement
pareil** et tout regarde » (classeur `exact/suivis stock BK 1.xlsx`, 52 917 576 o).

**Ce que lit la référence** — mesure cellule par cellule, feuilles `Sorties` (journal réel) et `Articles`
(base de données) : `Sorties` = `A1:AH4891`, mais **1 649 lignes de données** (les 3 242 suivantes sont des
lignes formatées vides), **150 désignations, 137 codes Bolloré, 113 conditionnements**, 3 libellés de CTRL
(`Transfert inter BK`, `Transfert AGL vers Bk`, `transfert directe`), 18 libellés de BK (BK1..BK9 + ADM +
`DC - Pertes`), colonnes B Date · C BK · D Désignation · E Catégorie · F Code · G Unité · H Conditionnement
· I Quantité signée · J Prix unitaire · K Valeur · M CTRL, L vide, matrice `S..AB` de SUMIFS par BK et
`AC = SUM(S:AB)`. `Articles` = `B1:G591`, **583 articles** (Catégorie, Nom Article, Code article Bolloré,
Unité, Conditionnement, Prix unitaire Q3-2025).

**Pourquoi le référentiel caché était le maillon faible** : Transferts (`G`) et P.Douane (`E`) remplissent
leur conditionnement par `VLOOKUP(...,'Référentiel Articles'!$A$2:$F$n,5,FALSE)` — donc depuis **notre base**,
alors que les feuilles Inventaire et Pertes publient déjà la table du CDG (§4.4). Même article, deux
colisages dans le même classeur. Écarts mesurés sur `sample_data` (BASE ARTICLE SIA + Ratio Q3, 523
articles, 263 noms communs avec le CDG) : **39 conditionnements divergents** (ex. FRITES base 12,5 vs CDG 5 ;
CORNICHONS base 2004 vs CDG 6 ; KIT KAT MIX 6,4 vs 16), **119 catégories** (« Nourriture » vs « Nourriture -
Surgelé ») et **59 unités** (« PACK » vs « Pack de 12 »).

**Quelle source fait foi** : la table de l'« Inventaire initial » (`inventaireReferentielCdg.js`), sauf sur
**3 lignes où le classeur du CDG se contredit**. Son Inventaire initial y est resté en arrière (E=10, 120,
240) alors que sa base `Articles` et son journal `Sorties` portent la même autre valeur — vérifié
cellule par cellule : `GANTS SACHET PACK DE 100` Inventaire `l.276 E=10` (inner F=100) vs `Articles l.378
F=100` et `Sorties l.208 H=100` ; `Chicken crunchy filler` Inventaire `E=120` vs `Articles l.586 F=10` et
`Sorties l.587 H=10` ; `KAY-5 SANITIZER` Inventaire `E=240` vs `Articles l.393 F=4` et `Sorties H=4`. C'est
la base `Articles` qui fait foi : c'est elle qui vit dans les transferts. Les Inventaires générés restent,
eux, la copie fidèle de l'Inventaire initial (10 / 120 / 240) — la contradiction est celle du fichier du
CDG, pas une régression.

**Correctif** (`frontend/src/utils/excelExporter.js`, un seul point) : `condRef(a)` remplace
`a.conditionnement` dans la construction de la feuille cachée `Référentiel Articles` — table du CDG par clé
de ponctuation repliée (`[^A-Z0-9]` supprimés), puis les 3 valeurs de la base `Articles`, puis la base
locale pour les articles hors table. Aucune cellule de Transferts ni de P.Douane n'est modifiée : les deux
feuilles héritent de la correction par leur `VLOOKUP` colonne 5.

**Résultat mesuré dans le XML réellement écrit** (génération `injecterLogoXlsx`, `fullCalcOnLoad="1"`) :
référentiel = 1 045 lignes (523 clés article — code, à défaut désignation — + 521 clés-désignation
doublées + en-tête), `FROMAGE MEDHDI NEW l.44
cond=288`, `FROMAGE TRANCHE CONWAY l.45 cond=1104`, `CORNICHONS l.66 cond=6`, `JALAPENOS l.84 cond=4`,
`SAUCE KETCHUP l.107 cond=1`, `TASSE CAFE 30CL l.278 cond=800`, `BACTIGEL l.302 cond=12`, `BROSSE A ONGLES
l.312 cond=20`, `GANTS SACHET PACK DE 100 l.332 cond=100`, `KAY-5 SANITIZER l.345 cond=4` ; `Transferts G5
= IF($E5="","",IFERROR(VLOOKUP(TRIM(E5&""),'Référentiel Articles'!$A$2:$F$1046,5,FALSE),""))`. Les
**242 articles du CDG cotés** présents dans la base réelle sont vérifiés (les 21 autres lignes du CDG sont
les 24 pesées sans colisage, qui gardent la valeur de base) ; **291/291** avec une base volontairement
fausse (cond. 999) ; les articles hors CDG gardent leur conditionnement de base. Les clés suivies par le
journal du CDG sont couvertes : **147 des 151 codes** de `Sorties` existent dans notre base — les 4 autres
(`BTL-PEPSI 30CL`, `BTL-PEPSIZERO 30CL`, `BKCI-EAU`, `4006724011915` SEL - Local) sont des articles du CDG
absents de `BASE ARTICLE SIA`, donc à créer en base, pas dans la feuille.

**Preuves** : nouvelle suite durable `frontend/tests/referentiel-cond-cdg.mjs` — **12 points, 6 en échec
avant le correctif** (39 écarts de conditionnement, 291 à 999, 3 valeurs de la base Articles), **12/12
après** ; campagne **12 suites, 164 points verts** (`derive-inner-colisage` 19, `inventaire-referentiel-cdg`
22, `inventaire-roundtrip-reimport` 17, `pertes-ca-ht` 11, `pertes-liste-exacte` 18,
`pertes-ordre-categorie` 12, `pertes-transmis-prix` 17, `pertes-unite` 8, `recap-inventaire-categorie` 17,
`recap-pmix-robustesse` 5, `regressions-cdg` 6, `referentiel-cond-cdg` 12) ; `npm run build` ✓ 16,88 s.

**Ce qui n'est pas aligné, et pourquoi** (mesuré, non modifié — hors de la demande) : (a) **catégories** et
**unités** du référentiel restent celles de la base (119 et 59 écarts) ; la référence utilise elle-même deux
sémantiques d'unité (base `Articles` E = `PACK`/`Pièce`, Inventaire K = `Pack de 12`/`Carton de 24`) et
`Sorties` G suit la base, pas l'Inventaire — l'aligner toucherait le classement des récaps. (b) `Sorties`
publie une **matrice SUMIFS par ligne** `S..AB` + `AC` ; le modèle généré a 20 000 lignes de saisie, soit
220 000 SUMIFS sur 20 000 lignes — remplacée par les récaps par catégorie et catégorie × BK sous le TOTAL.
(c) `Sorties` J est un **prix historique** (31 écarts avec l'Inventaire L, ex. WHOPPER PATTY - Americana
J=61 214,16 vs L=62 011,40) ; le modèle publie le prix courant du référentiel. (d) `Offert` de la référence
= BK1..BK9 + TOTAL (`B1:I13`) ; le nôtre n'a qu'une ligne de site. (e) `P.Douane` de la référence =
3 lignes saisies + gabarit (`B1:H12`, `TOTAL =SUM(H4:H7)`) ; le nôtre a 200 lignes, mêmes formules
(`Px pièce = Px carton ÷ Cond.`, `Valeur = Qté × Px pièce`), avec deux colonnes de plus (Catégorie, clé).

### 4.6 Correctif du 26/10 — la feuille Offert devient une table de saisie avec Total et ligne TOTAL

**Référence du CDG** (`exact/suivis stock BK 1.xlsx`) : `Offert` = `B1:I13` — en-têtes ligne 2
(`BK · STAFF M · MNGR M · GT · OFFER · HO · DISCOUNT CARTE JEUNE · TOTAL`), **BK1..BK9 lignes 3..11**,
puis une ligne de totaux en 12 : `B12 =SUM(C3:C11)`, `D12 = 4 048 500`, `E12 = 185 700`,
`F12 = 77 550`, `G12 = 0`, `H12 = 38 850`, `I12 = 14 162 600`. Deux constats sur cette référence : la
ligne de totaux est **elle-même décalée** (pas de libellé « TOTAL », le total « Staff Meal » atterrit dans
la colonne BK, `C12` n'existe pas) et la colonne TOTAL est **statique** (`I3 = 1 090 050` = somme des six
colonnes, sans formule).

**État avant correctif** : `A1:H3`, titre `B1 = « Offerts / Repas »` (ni site ni période), en-têtes
ligne 2 conformes, ligne 3 réduite à `A3 = "BK1"` — `B3..H3` absentes du XML, **0 formule**. Conséquence
mesurée : le parseur positionnel (`parsers.js:524 offsetOffert`, `:753-765`) relit bien `offerts.BK1`,
mais avec six montants à 0 et un total à 0, donc `totalOfferts` (`calculators.js:53`) et la ligne publiée
`excelExporter.js:135` valent 0 quel que soit le travail du restaurant.

**Correctif** (`excelExporter.js`, bloc Offert) : titre au format des autres feuilles
(`Offerts / Repas — BK1 · Octobre 2026`) ; `B3..G3` publiées à 0 en `#,##0`, fond vert de saisie et
bordures vertes ; `H3 = SUM(B3:G3)` en style calcul ; **ligne 4 `TOTAL`** avec une somme par colonne
(`B4..H4 = SUM(colonne 3)`). Colonnes, fusion `B1:H1` et zone logo inchangées ; aucun libellé modifié
(le parseur lit en position, pas en texte).

**XML réellement écrit** (`injecterLogoXlsx`, `fullCalcOnLoad="1"`) : `dimension A1:H4`, `mergeCell
B1:H1`, `B1` titre, `A3 t="str"` (`BK1`), `B3`/`G3` sans `t` avec `<v>0</v>`, `H3`
`<f>SUM(B3:G3)</f>` **sans `<v>`**, `A4` `TOTAL`, `B4` `<f>SUM(B3:B3)</f>`, `H4`
`<f>SUM(H3:H3)</f>`. Aller-retour prouvé : valeurs de saisie + total calculé injectés dans le classeur
relu → `offerts.BK1 = {staffM 100, discountCJ 3, total 170}`, la ligne `TOTAL` n'est pas lue comme un BK.
Un fichier réimporté **avant** que le CDG ne l'ouvre n'a pas de cache de formule : le total vaut 0 jusqu'à
la première ouverture/sauvegarde, comme toutes les formules du classeur.

**Ce qui reste ouvert** : la référence liste **tous** les BK (1..9) dans le classeur d'un seul site ;
le nôtre publie **une ligne = le site du classeur**. C'est volontaire : la consolidation multi-fichiers
fusionne les Offert par `Object.assign` (`App.jsx:505`), donc répéter les neuf lignes dans chaque fichier
écraserait les valeurs des autres sites. Passer à la table groupe demande un arbitrage CDG (une table
groupe saisie à l'identique dans chaque fichier, ou une fusion par site). Le format date hérité du style
texte (`numFmt 165 dd/mm/yyyy`, point F6) reste appliqué à `A3`, sans effet sur l'affichage d'un libellé.

**Preuves** : nouvelle suite durable `frontend/tests/offert-total.mjs` — **7 points en échec avant**,
**11/11 après** ; campagne **13 suites, 175 points verts** ; `npm run build` ✓ 10,63 s.

## 5. PMIX (M1-M4)

| Point | Attente CDG (source) | Statut | Preuve mesurée |
|---|---|---|---|
| M1 | Feuille PMIX de saisie des ventes, 1 000 lignes, en-têtes Item PLU / Item Name / Qty Sold / Price / Amount / Status + récap indicateurs (PRD l.107 ; code `excelExporter.js:995-1063`) | ✅ | `dimension A1:I1003` ; B1 « PMIX (Ventes) — BK1 · Octobre 2026 » ; en-têtes ligne 2 conformes (`Price` conservé volontairement ; « Coût unitaire (FCFA) » est le libellé de la feuille masquée, `:1059`) ; **1 000 lignes de saisie 3..1002** ; `H2 "INDICATEUR" / I2 "VALEUR"` |
| M2 | Le référentiel PMIX doit écrire le **coût de revient**, pas le prix de vente TTC (retour CDG 23/10 n°2, `regressions-cdg.mjs:87`) | ✅ | Référentiel PMIX `A1:C377`, 376 PLU ; **0 coût > 5 000 F** sur 376 → aucun PV TTC résiduel ; PLU 110 WHOPPER = `1186,6720790730283` (L2), 706 SMALL FRIES = `229,7356` (L44), 717 LARGE FRIES = `411,0699` (L46), 400102 Pepsi Medium = `124,0350` (L71) |
| M3 | `Amount` ne doit plus propager de `#VALUE!` au récap (retour CDG 23/10 n°1, `regressions-cdg.mjs:81`) | ✅ | `E3 = IF(OR(A3="",C3=""),"",IF(ISNUMBER(D3),C3*D3,""))` ; `F3` statut `IF(COUNTIF('Référentiel PMIX'!$A$2:$A$377,TRIM(A3&""))=0,"PLU ABSENT DU RATIO","OK")` ; `B3/D3` en VLOOKUP `TRIM(A3&"")` |
| M4 | TOTAL COUVERTS / TOTAL COÛT MATIÈRE / coût moyen exploitables (arbitrage CDG ouvert sur « TOTAL COUVERTS = somme des quantités ? ») | ⚠️ | `I5 = SUM($C$3:$C$1002)`, `I6 = SUM($E$3:$E$1002)`, `I7 = IF($I$5=0,"",$I$6/$I$5)`, `B1003 "TOTAL"` avec `C1003/E1003` ; **mais 125 coûts sur 376 sont à 0 (33,2 %)** (8017 ENFT JOUET, 900331, 900332, 400190 FANTA POMME 30CL, 900408 Menu YERE Nugge, 905268, 5195 PLAIN, …) → tout PLU sans coût est valorisé 0 F silencieusement |

## 6. Douane (D1-D2)

| Point | Attente CDG (source) | Statut | Preuve mesurée |
|---|---|---|---|
| D1 | Feuille « P.Douane » de prélèvements hors flux normal, auto-valorisée, avec total (PRD l.106 ; fix #2 Douane) | ✅ | `dimension A1:I205` ; en-têtes ligne 4 `A Date · B Article · C Catégorie · D Code / Désignation · E Cond. · F Quantité · G Prix carton · H Prix pièce · I Valeur (FCFA)` ; 200 lignes 5..204 (`NB_LIGNES_DOUANE=200`, `:789`) ; `H5 = IF($G5="","",IF($E5>0,$G5/$E5,$G5))`, `I5 = IF(OR($F5="",$H5=""),"",$F5*$H5)` ; `A205 "TOTAL"`, `I205 = SUM($I$5:$I$204)` en violet `#F5F3FF`/`#7C3AED` ; note A3 de saisie |
| D2 | Tableaux figés (PRD l.200) — borne demandée par le CDG pour les feuilles larges (mémoire 12/10 : Pertes, Inventaires, Transferts) | ❌ | `P.Douane : pane = aucun`. La feuille fait 9 colonnes × 200 lignes ; le défilement horizontal fait disparaître « Article ». Même constat sur Offert, PMIX et les deux référentiels |

## 7. Offerts (O1)

| Point | Attente CDG (source) | Statut | Preuve mesurée |
|---|---|---|---|
| O1 | Feuille « Offert » : un tableau par BK avec Staff Meal / Manager Meal / GT / Offer / HO / Discount CJ **et un Total**, nom du restaurant et période en tête (PRD l.106 et l.108 ; mémoire 13/10 lecture `parsers.js:524,753-765`) | ✅ | Corrigé le 26/10 (**§4.6**) : `dimension A1:H4`, titre `B1 = « Offerts / Repas — BK1 · Octobre 2026 »`, `B3..G3` en saisie verte `#,##0`, `H3 = SUM(B3:G3)`, ligne 4 `TOTAL` avec `SUM` par colonne ; aller-retour réimport vert (`offerts.BK1` relu, `TOTAL` ignoré). **Reste ouvert** : une ligne = le site du classeur, la table groupe BK1..BK9 de la référence demande un arbitrage CDG (fusion `Object.assign`, `App.jsx:505`) |

## 8. Formats et présentation (F1-F6)

| Point | Attente CDG (source) | Statut | Preuve mesurée |
|---|---|---|---|
| F1 | Logo BK/Servair en haut à gauche de **chaque feuille visible** (PRD l.108, l.200 ; AC2 l.226) | ✅ | 7/7 feuilles visibles avec ancre `<xdr:oneCellAnchor>` depuis `col=0,row=0`, `colOff=rowOff=19050 EMU` (2 px), `cx=981075 cy=971550` → **103 × 102 px**, `r:embed="rId1"` → `xl/media/logo_bk_servair.png` (12 844 octets, média unique). Les 2 référentiels masqués n'ont pas de dessin (conforme) |
| F2 | Titre à **1 cm du logo** (contrôle visuel de l'utilisateur, « écart logo↔titre = 1 cm ») | ✅ | Colonne A = `w19.71484375` → **143 px** sur les 7 feuilles visibles ; bord droit du logo à 103 px + 2 px de marge → **38 px libres ≈ 1,005 cm** (37,8 px/cm) ; ligne 1 `ht="80pt"` ; titre en `B1` (ex. « Inventaire Initial — BK1 · Octobre 2026 », « Transferts — BK1 · Octobre 2026 », « PMIX (Ventes) — BK1 · Octobre 2026 ») |
| F3 | Tableaux figés / volets (PRD l.200 ; mémoire 12/10) | ⚠️ | 4 feuilles conformes : Inventaire Initial et Final `xSplit=3 ySplit=6 D7`, Transferts `3/4 D5`, Pertes `9/4 J5`. **P.Douane, Offert, PMIX : `pane = aucun`** (voir D2). Injecté dans `xlsxLogo.js:43-48 (PANNEAUX_FIGES)` faute de support xlsx-js-style |
| F4 | « Formules calculées à l'ouverture, **valeurs jamais figées** » (PRD l.199) | ⚠️ | `<calcPr calcId="191029" calcMode="auto" fullCalcOnLoad="1" forceFullCalc="1"/>` ; décompte 26/10 sur le classeur régénéré : **2 cellules de formule sur 127 785 portent un `<v>` en cache** — `E333` dans « Inventaire Initial » et dans « Inventaire Final » (dernière ligne du récap « écart »), formule `L325-D333` écrite avec `v: 0` (`excelExporter.js:473`). Répartition mesurée : Inventaires **1/964** chacun, Pertes 0/624, Transferts 0/120 024, P.Douane 0/1 201, PMIX 0/4 008, référentiels et Offert 0. **Non corrigé** : hors du périmètre validé le 26/10 (ligne 1 de Pertes) ; `fullCalcOnLoad` recalcule à l'ouverture, donc l'affichage n'est pas faux, mais la règle « jamais figé » est prise en défaut sur ces deux cellules — le correctif tient au retrait de `v: 0` |
| F5 | Feuilles attendues présentes, référentiels masquées (PRD l.107 ; AC2 l.226 « 10 feuilles ») | ⚠️ | **9 feuilles** : Inventaire Initial, Inventaire Final, Transferts, Référentiel Articles (masquée), Pertes, P.Douane, Offert, Référentiel PMIX (masquée), PMIX. L'AC2 du PRD en annonce 10, le §3.4 du même PRD n'en énumère que 9 → le compte de référence est à trancher par le CDG. Les 2 masquées sont bien `state="hidden"` |
| F6 | Colonnage stable et formats cohérents, tableaux démarrant en A (PRD l.200 ; task « harmoniser : tableaux en A ») | ⚠️ | Colonne A identique (19,71 wch = 143 px) sur les 7 feuilles visibles ✓, tous les tableaux démarrent en A ✓. Mais : **colonnes Date au format `General`** (Transferts `A5`, P.Douane `A5`), **`dd/mm/yyyy` appliqué à du texte** (PMIX `B3`/`F3` = libellé et statut, Offert `A3` = « BK1 », Inventaire `F3`/`J3` = date inventaire/vide), et PMIX `A3`/`C3` (PLU et quantité à saisir) **sans aucun fond** (pas de zone verte « ✏️ » contrairement aux Inventaires et aux Transferts) |

---

## 9. Les points ❌ classés par priorité (P3 est passé en ✅ le 26/10 — §4.2)

### P0 — bloquants : Aristide les verra à l'ouverture

**P3 · Pertes : la zone « CA HT du jour » — ✅ corrigé le 26/10 (sous-section 4.2).**
- Constat du 25/10 : seule `I1` portait le libellé ; `J1..AN1` n'étaient pas écrites (0 sur 31), alors que
  la note `A3` de la feuille y renvoie le CDG et que les 31 ratios `J3..AN3 = IF(J1=0,"",J2/J1)` les lisent.
- Cause **confirmée par la mesure** (et non plus « probable ») : le générateur bouclait bien les 31
  cellules, mais sans `v` ni `f` — `xlsx-js-style` ne publie pas une telle cellule dans le XML.
- Correctif appliqué le 26/10 : `J1..AN1` pré-remplies 0 au style de saisie vert `#,##0`, `AO1 = SUM(J1:AN1)`,
  `AO3 = IF(AO1=0,"",AO2/AO1)` ; garde-fou du ratio conservé, import insensible (ligne 1 jamais lue).
  Détails, preuves et périmètre écarté en **§4.2**.

**O1 · Offert : feuille vide de toute saisie et de tout total — ✅ corrigé le 26/10 (sous-section 4.6).**
- Constat du 25/10 : `A1:H3`, ligne 3 réduite à `A3 = "BK1"`, aucune cellule `B3..H3`, **0 formule** ;
  titre `B1` sans restaurant ni période.
- Cause **confirmée par la mesure** : le bloc Offert ne publiait que l'en-tête et le code du site ; ni les
  six montants ni le `Total` (colonne H) n'étaient écrits, et le titre n'avait pas suivi l'harmonisation
  des autres feuilles.
- Correctif appliqué le 26/10 : titre « Offerts / Repas — <site> · <période> », `B3..G3` en saisie verte
  `#,##0`, `H3 = SUM(B3:G3)`, ligne 4 `TOTAL` avec `SUM` par colonne. Aller-retour réimport rejoué
  (le parseur lit en position, la ligne `TOTAL` est ignorée). **Reste ouvert** : la table groupe
  BK1..BK9 de la référence, qui demande un arbitrage CDG sur la fusion multi-fichiers. Détails et
  preuves en **§4.6**.

### P1 — importants, non bloquants

**I6 · 36 lignes d'inventaire à `Prix carton = 0`.**
- Constat : `K = 0` sur 36 des 318 lignes → `L = I × K` affichera 0 F et le « TOTAL STOCK » (`L325`)
  sera sous-évalué d'autant.
- Cause probable : résidu connu et assumé du dossier prix (mémoire 12/10 « 82 articles sans prix en
  base » ; `Référentiel Articles` colonne F : **72 clés à 0** sur 633). Ces articles ne sont couverts ni
  par le Ratio Q3, ni par la base locale, ni par la base complémentaire PMIX ; le générateur écrit 0
  plutôt que de laisser la cellule vide (une cellule vide casserait le style de la ligne).
- Correctif à faire (**non appliqué, et hors périmètre d'un correctif de code**) : ce sont les
  **référentiels** qui doivent être complétés (import d'un prix pour ces 36 codes), pas le classeur.
  Avant toute décision, le CDG doit arbitrer la liste des lignes à garder/enlever, déjà ouverte le
  23/10. Signalétique possible côté feuille : afficher « prix à renseigner » au lieu d'un 0 muet —
  à valider avec Aristide, pas implémenté d'office.

**I2 · Ordre : 7 lignes finales décalées par rapport à l'exemple de référence.**
- Constat : L312..L318 du fichier = rotation d'une position par rapport à `exemple inventaire.xlsx`
  (le fichier met `2600320ST / SANITIZER TABLETTE` en 312 ; l'exemple y met `940902BK / SERPILLERE - Bleu`).
- Cause probable, mesurée : l'ordre du classeur n'est pas celui du fichier de l'utilisateur mais celui
  de la **liste codée en dur** `CUSTOM_ARTICLES_ORDER` (`frontend/src/utils/customArticleOrder.js`,
  321 entrées, tri appliqué dans `excelExporter.js:374-391` par `normalizeString(nom)`). Cette liste
  contient **4 noms que l'exemple n'a plus** (`THE`, `LAIT en Brique`, `LAIT en brique - PROSUMA`,
  `LAIT en brique - PROSUMA_06` — résidus de la suppression lait/thé du 14/10) et l'exemple contient
  **1 nom en double** (`SANITIZER TABLETTE`, 2 occurrences avec des colisages différents : lignes 311
  D=1380 et 312 D=6). Le tri par clé de nom ne peut donc pas reproduire strictement l'ordre positionnel
  de l'exemple dans la zone où les deux listes diffèrent.
- Correctif à faire (**non appliqué**) : soit retirer les 4 noms lait/thé de `CUSTOM_ARTICLES_ORDER`,
  soit piloter l'ordre sur l'index de ligne de `exemple inventaire.xlsx` plutôt que sur un nom normalisé
  (les doublons de noms sont alors sans effet). Le second choix change le comportement pour tous les
  restaurants → **à faire arbitrer par Aristide**.

### P2 — cosmétique

**D2 · P.Douane sans volet figé.**
- Constat : `pane = aucun` sur P.Douane (et Offert, PMIX, référentiels), alors que le PRD l.200 demande
  « tableaux figés » sans limitation de feuilles.
- Cause probable : `PANNEAUX_FIGES` (`xlsxLogo.js:43-48`) ne couvre que les 4 feuilles demandées le
  12/10 ; l'injection post-écriture est la seule voie possible (xlsx-js-style n'écrit pas de `<pane>`).
- Correctif à faire (**non appliqué**) : ajouter une entrée P.Douane (`xSplit=3 ySplit=4`, topLeftCell
  `D5`) et, si le CDG le souhaite, PMIX (`xSplit=0 ySplit=2`) et Offert. Vérification : contrôler le
  `<pane>` réellement écrit dans `sheet6.xml`, pas la relecture SheetJS.

---

## 10. Les ⚠️ — nuances à confirmer avec le CDG (aucune décision prise ici)

| Point | Nuance mesurée | Question pour Aristide |
|---|---|---|
| T2 | 20 000 lignes **vides** (demande du 15/10) alors que le PRD l.104 annonce « 500 lignes pré-remplies ». Coût mesuré : 120 024 formules sur la feuille, classeur 25,86 Mo, recalcul complet à l'ouverture | Le PRD doit-il être mis à jour (20 000 vides) ? Le temps d'ouverture sur le poste de gestion est-il acceptable, sinon revenir à 2 000 ou 500 ? |
| T5 | CTRL n'a aucune formule (conforme à la demande), mais porte le même fond orange que les colonnes automatiques | Faut-il re-styliser CTRL en zone de saisie (vert) ou la laisser neutre ? |
| P3 | Depuis le correctif 4.2, le CA HT est **pré-rempli `0`** (une cellule sans valeur ni formule n'est pas publiée par `xlsx-js-style`, cf. §4.2) : le ratio du jour et `AO3` restent donc vides tant que le 0 n'est pas écrasé. Aucun pré-remplissage par l'application n'est possible — le CA ne vit dans aucune base de données de l'outil | Le 0 de départ est-il acceptable comme état de saisie, ou faut-il une mention explicite (ex. « ✏️ à saisir ») ? Le total du CA en `AO1` et le ratio global en `AO3` conviennent-ils, alors que le fichier juillet place le ratio global en `AP3` (colonne libre) et ne totalise le CA que sur BK8 ? |
| P5 | Après les correctifs 4.1 puis **4.3**, **12 lignes transmises sur 13 sont valorisées** et **une seule** reste sans Cond./Prix : `L190 BBQ TENDERCRISP` (ni la base, qui n'a que `TENDERCRISP PATTY` **inactif** et `WRAP TENDERCRISP` en Packaging, ni le Ratio, PLU 330 « TENDERCRISP », ne connaissent cette désignation). Le motif « doublon de code » de `BOUTEILLE PEPSI ZERO 1,5L` était **faux** et a été abandonné (§4.3). Cette dernière cellule garde le fond bleu clair `#E3F2FD`, hors de la charte verte « à saisir ». **Point neuf ouvert par le 4.3** : `BTL-PEPSI 1,5L` est publié sur deux lignes (l.28 « BOUTEILLE PEPSI 1,5L », désignation du modèle inconnue de la base sous ce nom, et l.42 « BOUTEILLE PEPSI ZERO 1,5L ») | `BBQ TENDERCRISP` doit-il être créé dans la **base articles** (désignation + code + colisage + prix) plutôt que laissé vide dans la feuille, et le couple « BOUTEILLE PEPSI 1,5L » / « BOUTEILLE PEPSI ZERO 1,5L » doit-il être fusionné dans la liste transmise ? Le bleu de la dernière cellule doit-il passer au vert « saisie » ? |
| M4 | 125 coûts sur 376 à 0 F, silencieusement valorisés 0 dans `TOTAL COÛT MATIÈRE` (`I6`) ; PLU 705 reste sans coût (arbitrage 23/10 non clos) | Ces 125 PLU doivent-ils être (a) exclus du récap, (b) marqués « coût à renseigner », (c) complétés depuis la base complémentaire ? |
| F3 | 4 feuilles sur 7 avec volet figé ; P.Douane/Offert/PMIX sans | Les bornes du 12/10 (Pertes J, Inventaires et Transferts D) sont-elles la liste exhaustive, ou toute feuille large doit-elle être figée ? |
| F4 | `E333` des deux inventaires (l'écart `L325-D333` du récap) est la **seule formule du classeur écrite avec une valeur en cache** (`v: 0`, `excelExporter.js:473`) ; or une formule sans `v` est publiée quand même — les 624 formules de Pertes n'ont aucun cache, donc le `v: 0` est superflu | Retire-t-on ce `v: 0` pour respecter le PRD l.199 « valeurs jamais figées » ? Correctif d'un mot, **hors du périmètre validé le 26/10**, donc non appliqué |
| F5 | 9 feuilles produites ; le PRD AC2 l.226 en annonce 10, son §3.4 en énumère 9 | Quelle est la liste de référence des feuilles ? (10ᵉ feuille = un classeur « Synthèse » attendu ?) |
| F6 | Dates en `General` (Transferts A, P.Douane A) ; `dd/mm/yyyy` appliqué à des cellules de texte (PMIX B3/F3, Offert A3, Inventaire F3/J3) ; PMIX A3/C3 sans fond de saisie | Le format date des colonnes Date doit-il être imposé (`dd/mm/yyyy`) et les formats texte corrigés ? Une zone verte est-elle attendue sur PMIX comme sur les autres feuilles ? |

Deux points ouverts déjà signalés, mesurés ici mais non imputables à la checklist :
- **Lignes bloquées par le garde-fou E-DERIVE** : les 4 lignes `D > 1000` gardent `E = 0`, donc le
  « Inner » saisi en G y est arithmétiquement annulé (`I = F + G×E/D + H/D`). Comportement voulu le
  23/10 ; la correction doit venir du fichier CDG (colisages `SACHET FRITES PETIT 4000`, etc.).
- **Libellé « Price » conservé** dans la feuille PMIX (`excelExporter.js:998`) alors que la valeur
  écrite est un coût : c'est l'arbitrage « libellé CA vs coût » laissé au CDG le 23/10, non tranché.

---

## 11. Ce qui n'a pas été fait (consignes respectées)

**Périmètre de cette section : la passe d'audit du 25/10.** Les trois correctifs du 26/10 (sous-sections
4.1, 4.2 et 4.3), eux, ont bien modifié `frontend/src` et régénéré le classeur — c'est ce que le CDG a demandé.

- Le classeur du 25/10 n'avait pas été réouvert en écriture pendant l'audit. Il a été **remplacé** trois
  fois le 26/10 par une régénération complète (SHA-256 `8311990e…` puis `25b759c4…` puis `6646eae0…`,
  empreintes conservées en tête du rapport).
- Les trois correctifs du 26/10 n'ont touché, dans `frontend/src`, que `utils/excelExporter.js`
  (Pertes : résolutions de prix, ligne 1 « CA HT », puis tri par catégorie + résolution approchante —
  dernière écriture mesurée à 08:22, les empreintes des classeurs regenerated 00:55:51 / 01:53:36 /
  08:29:38 en témoignent) et `pages/BaseArticlesTab.jsx` (passage de la base complète en 8ᵉ paramètre,
  00:54), et aucun fichier de `backend/src`. `utils/parsers.js` n'a **pas** été modifié pour le 4.3 : le
  réordonnancement est validé insensible à l'import par `tmp_pertes_retour.mjs`.
- **Attention à l'état du dépôt** : le working tree porte aussi des travaux antérieurs non commités —
  `frontend/src/utils/parsers.js` (25/10 23:57), `backend/src/articles.js` (25/10 15:55),
  `frontend/src/App.jsx` (24/10 01:03) — indépendants des correctifs Pertes du 26/10. Les autres ❌
  (feuille Offert, ordre 311/318, 36 prix carton à 0, volets figés manquants) sont décrits, **pas corrigés**.
- Aucun référentiel (Ratio, whitelist, prix, base articles) n'a été touché ; **aucune ligne de prix n'a
  été inventée** pour combler les 36 `K = 0`, les 125 coûts à 0, ni la ligne transmise restée vide. Le
  correctif 4.3 **lit** la base (`BOUTEILLE PEPSI ZERO 1,5L`, `EAU KIREN 50cl`, `FROMAGE MEDHDI NEW`,
  `MOZZARELLA STICKS BIS`) et n'y **écrit** rien — la base est restée en lecture seule dans toutes les
  sondes (`{readonly:true}`).
- Aucun arbitrage n'est pris à la place d'Aristide : les ⚠️ sont posés comme questions. Le périmètre du
  correctif 4.2 a été **limité à la ligne 1** sur choix du CDG (26/10) ; les trois autres traits du
  fichier juillet sont listés en §4.2 comme « écartés ». Celui du 4.3 a été **borné par le choix du CDG**
  « Pepsi Zero + 3 appariements approchants » : `BBQ TENDERCRISP` reste vide, et les libellés de
  catégories hétérogènes (« Nourriture » nu, `SANDWICHS`/`SALADS`/`HOT BEVERAGES`) sont **conservés tels
  quels** par le tri.
- Aucun commit, aucun push, aucun redéploiement (les corrections 25/10 et 26/10 sont en local uniquement).

## 12. Annexes — reproductibilité des mesures

```bash
cd frontend
node tests/tmp_verif_suivi_gen.mjs        # régénère tmp_verif/Suivi_BK1_Octobre_2026.xlsx (26 876 756 octets au 26/10 08:29, après 4.3)
node tests/tmp_verif_suivi_xml.mjs        # radiographie OOXML → tmp_verif/xml_inventory.json
node tests/tmp_verif_suivi_mesures.mjs    # largeurs, panaux, Cond. non numériques, inventaires incomplets, référentiels, titres
node tests/tmp_verif_suivi_final.mjs      # Pertes (blocs/ligne 1), Offert (cellules), Transferts (en-têtes, ligne 20005)
node tests/tmp_verif_suivi_customorder.mjs# ordre fichier vs exemple vs CUSTOM_ARTICLES_ORDER
node tests/tmp_verif_suivi_edrive_stats.mjs  # classification E (dérivée / conservée / bloquée)
node tests/tmp_verif_suivi_cellules.mjs   # radio brute des cellules suspectes (retrait des « vides »)
node tests/tmp_verif_suivi_formats.mjs    # numFmt réels sur les cellules sondées
node tests/tmp_verif_suivi_ordre.mjs      # ordre positionnel + cache de calcul (0 valeur figée)
node tests/tmp_verif_suivi_styles.mjs · tmp_verif_suivi_couleurs.mjs · tmp_verif_suivi_detail.mjs · tmp_verif_suivi_risques.mjs · tmp_verif_suivi_releve.mjs

# Addendum 26/10 — correctif Pertes 4.1 (prix des lignes transmises)
node tests/pertes-transmis-prix.mjs       # suite durable : 19 points à la passe 4.1 (20 depuis la passe 4.3), rouge avant / vert après le correctif
node tests/tmp_pertes_resolution.mjs      # algorithme de résolution rejoué sur backend/data.db (lecture seule) : 8/13 résolues
node tests/tmp_pertes_fichier_reel.mjs    # XML écrit de la feuille Pertes (sheet5.xml via JSZip) : adresses, formules, bandeaux
node tests/tmp_pertes_retour.mjs          # classeur → saisie de 3 pertes → réimport parseSuivisStock → montants valorisés

# Addendum 26/10 — correctif Pertes 4.2 (ligne « CA HT du jour »)
node tests/pertes-ca-ht.mjs               # suite durable : 11 points, rouge avant (0/31 cellules) / vert après
node tests/tmp_ca_ht_fichier_reel.mjs     # classeur livré : J1..AN1 + styles résolus dans xl/styles.xml + AO1/AO3 + réimport
node tests/tmp_perte_juillet.mjs          # modèle CDG : structure des feuilles BK1..BK9 et PERTE JULLET.xlsx (tables, colonnes)
node tests/tmp_perte_juillet_structure.mjs# xl/tables/tableN.xml : pertes4..pertes410, ref B4:AN197, formules calculées
node tests/tmp_perte_juillet_comparaison.mjs  # I1/J1..AN1, AO1/AP3, rapprochement avec CA JUILLET 2026.xlsx, catégories
node tests/tmp_perte_juillet_vs_genere.mjs    # feuille générée vs BK1 du CDG : noms, Cond., catégories

# Addendum 26/10 (soir) — correctif Pertes 4.3 (tri par catégorie + résolution depuis la base)
node tests/pertes-ordre-categorie.mjs    # suite durable NEW : 13 points, 5 en échec avant / 13-13 après (blocs, ordre du modèle, lignes résolues dans leur bloc, bornes SUM/SUMPRODUCT)
#   reproduction du rouge : commenter `pending.sort(...)` (:886) et remplacer `candidatsBase(nom)` par `[]` (:862)
#   → 5 FAIL ; restaurer ensuite et vérifier le SHA-256 du fichier (48293e0c…) → 13 PASS
node tests/pertes-transmis-prix.mjs      # même suite portée de 19 à 20 points (les 4 résolutions nouvelles assertées, BBQ TENDERCRISP reste vide)
node tests/tmp_pertes_ordre_refus.mjs    # ordre des blocs + lignes vides + existence en base (lecture seule). A rendu « 13 blocs / 3 retours » AVANT le correctif, « 10 blocs / 0 retour » depuis — le rouge reproductible est la suite ci-dessus
node tests/tmp_pertes_code_pepsi.mjs     # autopsie du faux doublon : qui porte BTL-PEPSI 1,5L dans la base, le modèle, les lignes publiées
node tests/tmp_pertes_bloc.mjs           # dump d'une plage de lignes (env DE=.. FI=..) : A/C/D/E/F/G/H
node tests/tmp_pertes_xml_ordre.mjs      # XML écrit : blocs et retours, gardes ISNUMBER, les 4 lignes résolues, J1..AN1/AO1/AO3, H191
node tests/tmp_pertes_xml_valeurs.mjs    # <v> et <f> exacts des cellules citées ( WHOPPER, D164/D165, C42/D42…)
node tests/tmp_ca_ht_fichier_reel.mjs    # re-jeu de la sonde 4.2 sur le classeur 4.3 (non-régression J1..AN1, styles, volet figé)
```

**Écart de méthode à connaître** : depuis le 26/10, `tmp_verif_suivi_gen.mjs` ne lit plus les dumps
JSON de `tmp_verif/` mais **la base vivante** `backend/data.db` en lecture seule (561 articles actifs,
Ratio Q3 104 produits, complément PMIX 231 PLU, base locale 456 lignes, restaurants actifs). Les
mesures du 25/10 portaient donc sur 621 lignes figées le 25/10 à 14:11, celles du 26/10 sur l'état réel
de la base.

Note de contexte (hors périmètre, signalée) : `articles.updated_at = 2026-10-25 13:57:52` — un autre
processus a réécrit des lignes d'articles pendant la campagne de vérification ; la base lue par le
générateur du 25/10 (`tmp_verif/articles.json`, 621 actifs) avait été figée avant cette écriture.
