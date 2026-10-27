# Conditionnement des articles et erreurs de valorisation — diagnostic et corrections

Date : 25/10/2026 · Périmètre : base articles locale (`backend/data.db`) · Faisant foi : `RATIOS BURGER KING ABJ Q3 2026.xlsx` + `BASE ARTICLE SIA.xlsx` + `Base complementaire PMIX.xlsx`

Retour CDG traité : « *Le conditionnement des articles n'est toujours pas correctement pris en compte, entraînant des erreurs de valorisation.* »

---

## 1. Verdict

La base article utilisée jusqu'ici n'avait **pas été produite par le logiciel** : elle avait été chargée à la main depuis `Base articles finale 29092026.xlsx`, un classeur de consolidation dans lequel la colonne Conditionnement (E) est le résultat d'une **concaténation de texte** et non un colisage. Trois lignes citées par le CDG le montrent sans ambiguïté :

| Article | Cellule faisante foi (`BASE ARTICLE SIA.xlsx`) | Ce que le texte est devenu dans la base | Conséquence sur la valorisation |
|---|---|---|---|
| JALAPENOS | `I84` = « 3100 (14.4 kg) » | `Base articles finale 29092026.xlsx!E129` = **310 014,4** | prix pièce divisé par 12 400 |
| SEL FIN 500g | `I123` = « 20\*500 gr » | `!E152` = **20 500** | idem |
| SALADE ICEBERG - Boule | `I51` = « 10 boules ≈ 6,5kg » | **106,5** | idem |

Un colisage de 310 014,4 dans une base où l'on saisi des cartons **ne peut pas venir du calcul** : il vient de la reprise manuelle (`3100` + `14,4` recollés). C'est la cause directe des erreurs de valorisation constatées, et la raison pour laquelle « les mêmes problèmes persistent après chaque mise à jour » : recharger le classeur de consolidation rechargeait l'erreur.

**Ce qui a été fait :** la base a été **re-dérivée par le code du produit lui-même** (mêmes parsers, même pipeline que l'import Ratio de l'interface), puis synchronisée, avec sauvegarde intégrale préalable et journal cellule par cellule.

---

## 2. Les quatre mécanismes en jeu

### M1 — Reprise manuelle du colisage (cause principale, corrigée)
Décrit en §1. Le fichier de consolidation a été construit en collant bout à bout des morceaux du texte source ; `parseConditionnement` (frontend/src/utils/parsers.js:192) n'a jamais été consulté pour ces lignes.

### M2 — Colisages textuels que le parser ne peut pas réduire en un nombre de pièces (corrigé par dérivation)
Sur les 109 valeurs textuelles de `BASE ARTICLE SIA.xlsx!I`, **85 sont exploitables** (« 10 boules ≈ 6,5kg », « 16\*400 gr », « 2 \* 50 ») et **24 ne le sont pas** : elles n'expriment qu'une masse ou un volume (`I174` = « 12.5 kg » pour FRITES, `I107` = « 15 kg » pour SAUCE KETCHUP, `I83` = « 25 L », `I142` = « Bidon de 3,78 L »). Sans autre information, le colisage restait à **1**, donc un prix carton et un prix pièce identiques, donc une conso valorisée au prix du carton pour une pièce.

Le correctif **A7-ter** (frontend/src/utils/parsers.js:428) dérive désormais le colisage du Ratio quand les deux prix existent : `colisage = arrondi(prix carton / prix pièce)`. C'est ce qui rend FRITES : `I174` = « 12,5 kg », prix Ratio 16 280,77 F / 1 302,46 F → **colisage 12,5 retourné**.

Quand le Ratio ne donne qu'un prix au kilogramme (ligne tarifée « par kg »), le colisage reste inconnu mais **le prix carton est dérivé de la masse** (parsers.js:435-442) : SALADE ICEBERG, 6 019,99 F/kg × 6,5 kg = **39 130 F le carton**, 3 913 F la boule.

### M3 — Le Ratio écrase le colisage de la base article (arbitrage en vigueur, inchangé)
parsers.js:424 : `let cond = price.qteCdt || ba.cdt || 1;` — la quantité/carton du Ratio gagne sur le Conditionnement de `BASE ARTICLE SIA.xlsx`. C'est voulu (le fournisseur de prix fait foi pour la valorisation), mais cela produit des incohérences quand un article a **deux fournisseurs** : le colisage du fournisseur A est appliqué au prix du fournisseur B. Voir la question **Q3** en §5.

### M4 — Unicité par le nom, doublons de code (corrigée)
`articles.ref` est le **nom normalisé** et la clé primaire. Deux lignes désignant le même article avec deux libellés coexistaient (`IFB011` et « AUTOCOLLANTS LIVRAISON ») avec chacune une partie des prix. Le CDG voyait alors un article « non valorisé » alors que la valeur était sur l'autre ligne. **92 groupes de doublons de code** fusionnés avec la fonction du produit (`repairDuplicateArticles`, backend/src/articles.js:298) exposée en script.

---

## 3. Corrections appliquées (base locale, 25/10)

| Action | Script | Résultat |
|---|---|---|
| Ré-import des référentiels par le pipeline produit | `backend/scripts/reimporter_base_referentiels.mjs` | 107 lignes revalorisées — dont **57 colisages**, 87 prix carton, 83 prix pièce ; 142 mises à jour, 26 désactivations |
| Fusion des doublons de même code | `backend/scripts/fusionner_doublons_code.mjs` | 114 fusions, **735 → 621 lignes**, 561 actives, 0 doublon de code |
| Désactivation des lignes sans valeur | `backend/scripts/desactiver_lignes_sans_prix.mjs` | 27 lignes + 1 ligne de test ; règle `isLigneSansValeur` (backend/src/articles.js:45) empêche leur retour à l'import |
| Unité de mesure | `backend/scripts/harmoniser_unites.mjs` | **621/621 lignes renseignées**, 0 vide |
| Noms corrompus | `backend/scripts/reparer_noms_mojibake.mjs` | appliqué |

Tous les scripts sont **en lecture seule par défaut** (`--dry-run`), écrivent seulement avec `--apply`, et journalisent dans `rapports/`. Sauvegarde intégrale avant ré-import : `rapports/base_avant_reimport_20261025162454.json` ; journal des 107 changements avec valeurs avant/après : `rapports/reimport_base_20261025162454.json` ; journal des fusions : `rapports/doublons_codes_20261025162555.json`.

### Lignes citées par le CDG, avant → après

| Article (code) | Colisage | Prix carton | Prix pièce | Source faisante foi |
|---|---|---|---|---|
| SALADE ICEBERG - Boule (`SALADICE`) | 106,5 → **10** | 6 877 → **39 130 F** | 6 877 → **3 913 F** | `I51` « 10 boules ≈ 6,5kg » × 6 019,99 F/kg |
| SEL FIN 500g (`SFL500`) | 20 500 → **20** | 833 → **8 333 F** | 833 → **416,67 F** | `I123` « 20\*500 gr » |
| FRITES (`BKFR07`) | 1 → **12,5** | 17 643 → **16 281 F** | 17 643 → **1 302,46 F** | Ratio « Low coated fries », deux prix |
| CANETTE PEPSI ZERO 25 CL | 24 (inchangé) | 1 530 → **2 576,27 F** | 63,75 → **107,34 F** | prix Ratio Q3 |
| JALAPENOS (`99262`) | 310 014,4 → **25** | 21 186 (inchangé) | 847,46 (inchangé) | dérivation A7-ter ; voir Q1/Q2 |

**Vérification** : 7 suites de tests rejouées après application, toutes vertes — backend `lignes-sans-prix` (5/5), `unites` (8/8), `regressions-cdg` (4/4) ; frontend `derive-inner-colisage`, `pertes-unite`, `recap-pmix-robustesse`, `regressions-cdg`.

---

## 4. Ce qui reste en base après correction

- **227 lignes actives avec prix carton = prix pièce** : dans 226 cas le colisage est à 1 (un carton = une pièce, cohérent). Le seul cas réellement incohérent est `SALADE ICEBERG BOULE HOREB` (colisage 10, 55 000 F les deux) — à trancher, voir Q2.
- **7 lignes où `prix carton ≠ prix pièce × colisage`** hors tolérance : les 3 dossettes ketchup + HUILE ALTIVOLEICO (34 412 F / 23 F, colisage 288-1000) et SACHET SNACK MOYEN — ce sont des prix **au kilogramme ou au mille** importés depuis PMIX, non des prix de pièce ; SAUCE CARAMEL (6 vs 7,2) est un arrondi de colisage fournisseur.
- **48 lignes avec colisage > 1 000** : conditionnements « sachets », « dossettes » et « stickers » — plausibles en soi (un carton de 4 000 sachets frites existe), conservés tels quels.
- **48 lignes actives sans aucun prix** : à renseigner par le CDG, jamais valorisées à 0.
- **237 lignes actives avec prix et colisage 1** : le colisage y est inconnu, la valorisation est donc faite à la pièce ; le gain complet exige la réponse à Q3.

---

## 5. Questions d'arbitrage pour le CDG

**Q1 — `BASE ARTICLE SIA.xlsx!I84` = « 3100 (14.4 kg) » (JALAPENOS).** Ce texte contient deux nombres et aucune unité de compte. Le logiciel retient **25** (dérivé des deux prix du Ratio, 21 186,44 / 847,46). Le fournisseur entend-il 25 boîtes de 3 100 g, ou un carton de 3 100 pièces ? Si c'est 3 100, la conso est sous-valorisée d'un facteur 124.

**Q2 — `BASE ARTICLE SIA.xlsx!E84` et `E85` = « Frying oil litre » pour JALAPENOS et JALAPENOS - Conway.** La colonne E est la *Correspondance Ratio* : ces deux lignes sont donc rattachées à l'huile de friture, pas aux jalapeños. Le prix qui leur est appliqué vient de cette correspondance. Faut-il (a) corriger la correspondance, (b) supprimer le rattachement, (c) les dédoubler ? Même question pour `SALADE ICEBERG BOULE HOREB` à 55 000 F la pièce.

**Q3 — Arbitrage Ratio vs base article quand un article a deux fournisseurs.** Aujourd'hui le colisage du Ratio gagne (parsers.js:424). Pour les salades, la base article donne le nombre de boules par fournisseur (`I51`→`I59` : 6, 10, 12, 10 boules selon le fournisseur) alors que le Ratio ne connaît qu'« ICEBERG SALAD (kg) ». Faut-il laisser le colisage de `BASE ARTICLE SIA.xlsx` gagner quand il existe et que le Ratio n'apporte qu'un prix au kilogramme ? C'est la correction qui ferait basculer le plus de lignes (237).

**Q4 — Les 48 lignes actives sans prix** et les 13 lignes Pertes « à renseigner » (`verif_suivi_stock.md`) : les complétez-vous dans la base article, ou doivent-elles sortir du calcul d'écart ?

---

## 6. Non fait volontairement

- **Rapports de suivi non régénérés.** Les classeurs produits restent sur leurs prix d'origine : la régénération modifie des livrables déjà transmis au DAF/DG. À faire après Q1-Q3.
- **`qteInner` (colonne E du Suivi) non persistée en base** : elle continue d'être dérivée à l'export (règle E-DERIVE du 25/10, `E = D si 1 < D ≤ 1000`).
- **Aucune push, aucun déploiement, aucune touche à la production.** Les correctifs des 23-25/10 sont uniquement dans l'arborescence locale ; `origin/main` est encore à `fe95f21` (22/10). C'est la raison technique pour laquelle le CDG revoit les mêmes anomalies après chaque « mise à jour » : la prod reconstruite depuis GitHub rejoue le code d'avant le 23/10.

---

## 7. Récapitulatif par catégorie sur les feuilles Inventaire (ajout du 25/10)

Demande CDG : reproduire sur les classeurs générés le bloc de `exemple inventaire.xlsx` (lignes 330-336) — Boissons, Nourriture - Surgelé, Nourriture - Frais, Nourriture - Sec, Packaging, Produits de Nettoyage, puis TOTAL.

**Écriture** (`frontend/src/utils/excelExporter.js`, fonction `invSheet`, lignes 439-479) : le bloc remplace l'ancien récap A/B et est posé **sous** le tableau, 2 lignes après le TOTAL STOCK. Deux retours CDG ont suivi, le second annulant l'emplacement du premier : « le tableau doit être **avant le colisage**, dans A B et C » (25/10), puis, capture du fichier modèle à l'appui, « **je veux le recap identique** » (25/10). Le bloc est donc calé sur la géométrie du modèle — **libellé en C, montant en D, sous-total en E** — et la ligne « AUTRES CATÉGORIES » a été retirée sur ta demande : il fait 7 lignes comme la capture.

Le décalage s'explique colonne par colonne : le fichier du CDG réserve sa colonne A au logo et démarre le tableau en B, chez nous le tableau démarre en A (harmonisation « tout démarrer en A »). Le libellé du modèle est en D = colonne ARTICLE (47,1 caractères) ; notre ARTICLE est en C (40 caractères). Le bloc « identique » occupe donc C/D/E là où le modèle occupe D/E/F — une colonne plus haut, mêmes colonnes métier.

| Élément | Colonne | Modèle du CDG | Chez nous (BK1 octobre 2026, classeur réel relu) |
|---|---|---|---|
| 6 libellés fixes, dans l'ordre du CDG | libellé | D330:D335, centré, gras 12 pt | **C327:C332** |
| Montant par catégorie | montant | E330:E335 (valeurs tapées à la main) | **D327:D332** `SUMIF($A$7:$A$324,C327,$L$7:$L$324)` |
| Sous-total « Nourriture », fusionné sur 3 lignes | sous-total | `F331:F333` = `SUM(E331:E333)` | **`E328:E330`** = `SUM(D328:D330)` |
| TOTAL (fond jaune, police rouge) | libellé + montant | D336 / `E336` = `SUM(E330:E335)` | **C333 / D333** = `SUM(D327:D332)` |
| Cellule de contrôle | sous-total | `F336` = `H336-E336`, sans fond ni bordure | **`E333`** = `L325-D333`, sans fond ni bordure |

**Reproduit à l'identique, et une seule différence.** Teintes relues dans le XML du modèle : Boissons `F7CAAC`, les trois « Nourriture » `BED7EE`, Packaging `FFD1D1`, Produits de Nettoyage `E2EFD9`, TOTAL `FFFF00` en `FF0000` ; contour **medium** sur tout le tour du bloc et autour de la fusion, séparations internes **thin** (bordures 8/11/25/30/40-42/43/44 du modèle) ; 12 pt gras, libellé centré sur une ligne, hauteurs de bloc 16,5 pt. Seule entorse assumée : chez le CDG la cellule de contrôle est en police **blanche**, donc muette même quand ça dérive ; ici elle est sans fond ni bordure (rien ne s'affiche à 0, masque `_(* #,##0_);_(* (#,##0);_(* ""_);_(@_)`) mais **en noir dès qu'une catégorie sort des 6 libellés** — c'est ce qui remplace la ligne « AUTRES » retirée.

**Bordures de la fusion.** Excel ne dessine un trait que là où une cellule existe *et* porte le style : le sérialiseur saute une cellule sans valeur, donc les deux lignes basses de la fusion ne sont pas écrites si on ne leur donne pas de contenu, et le cadre reste ouvert en bas et à droite. Elles portent maintenant un `0` masqué (invisible dans la fusion, et rien du tout si on la dissout, grâce au masque à zéro vide). Contrôle sur le XML du classeur produit par l'application (`frontend/tests/tmp_xml_reel.mjs`), identique sur les deux feuilles : `E328 b26[lmed rmed tmed bnon] | E329 b27[lmed rmed] | E330 b28[lmed rmed bmed]`, fusion `<mergeCell ref="E328:E330">`, et pour le bloc `C327 b22[lmed … tmed]` … `C333 b33[… bmed]`, `D333 b34[rmed … bmed]`.

**Aucun article fantôme — et c'était le vrai risque.** Le libellé tombe maintenant **dans la colonne de désignation** : `parseInventaire` lit le nom en C (`nom = g(r,3)` avec l'offset du nouveau format, `frontend/src/utils/parsers.js:572`) et relisait donc « Boissons », « Nourriture - Sec », « Packaging » comme trois articles de plus. Garde posée à la source (`parsers.js:578`) : la ligne de total **clôt** le tableau (`continue` → `break`), tout ce qui est écrit sous elle est du récap. Démonstration rouge/verte sur cette seule garde : remise en `continue` → `FAIL Réimport : aucune ligne du récap avalée comme un article — fantômes importés : Boissons, Nourriture - Surgelé, Nourriture - Frais, Nourriture - Sec, Packaging, Produits de Nettoyage`, 17/17 après restauration. Aucun des 621 articles de la base ne commence par « total » et aucun n'est nommé comme un des 6 libellés, la règle ne peut donc rogner aucune ligne d'article.

**Correction d'une affirmation de la conception.** Le brief initial annonçait « 26 lignes du tableau hors des 6 libellés, à lister ici ». Chiffrage repris cellule par cellule sur les données du jour : **0 ligne**.

- Tableau généré, colonne A (`frontend/tests/tmp_recap_reel.mjs`, régénération des données BK1 du jour puis relecture du fichier écrit sur disque, Inventaire Initial lignes 7 à 324) : Packaging 78, Produits de Nettoyage 70, Nourriture - Sec 64, Nourriture - Surgelé 47, Boissons 39, Nourriture - Frais 20 = **318 lignes, toutes dans les 6 libellés**.
- Source de ces catégories : `exemple inventaire.xlsx`, feuille `inventaire`, colonne B, lignes 7-324, filtre « désignation D et code O non vides » → 318 lignes, **0 hors libellés**. Le logiciel relit ce fichier à chaque export (`frontend/src/pages/BaseArticlesTab.jsx:33` et `:53` : `categorie: row[1]`) ; `enrichirAvecBaseLocale` (`parsers.js:476-501`) ne touche jamais la catégorie.
- Les catégories hors libellés existent **dans la base article**, pas dans le classeur : **274 articles actifs sur 561** (`backend/data.db`, table `articles`, `actif=1`, GROUP BY `categorie`) — Nourriture 143, PMC 110, IFB 20, PACKAGING 1. Elles ne rejoignent jamais la feuille tant que l'article n'est pas dans la liste de référence du CDG.

La cellule de contrôle `E333` est donc **à 0 aujourd'hui, et n'affiche rien**. Elle fait le travail de la ligne « AUTRES » retirée : si le CDG modifie la colonne B de son fichier exemple ou y ajoute un article hors des 6 libellés, le TOTAL du récap manque de ce montant et `E333` l'affiche en noir, au lieu que l'écart passe inaperçu.

**Preuves** (campagne reprise ce jour, classeur réel `tmp_verif/Suivi_BK1_Octobre_2026.xlsx`, 26 878 074 octets, régénéré par la chaîne de l'application avec le logo injecté). Sonde `frontend/tests/recap-inventaire-categorie.mjs` : **17/17**, géométrie relue après écriture sur disque avec le sérialiseur de l'application (`xlsx-js-style`) : formules, masque, fusion, teintes, contour et bloc identique sur Inventaire Final. Trois contrôles sont portés jusqu'au XML du classeur, la bordure ne pouvant pas être vérifiée en mémoire (le lecteur ne restaure jamais `.s`, seul le XML fait foi) :
- `Écrit sur disque : la fusion « Nourriture » est cerclée en medium dans le XML (E25 l=medium r=medium t=medium | E26 l=medium r=medium | E27 l=medium r=medium b=medium)`
- `Écrit sur disque : contour medium et teintes du CDG dans le XML (F7CAAC BED7EE BED7EE BED7EE FFD1D1 E2EFD9 FFFF00)`
- `Écrit sur disque : libellé sur une ligne, hauteur de bloc 16,5 pt (C24→C30 ht=16.5, <row r="7">)`

Relecture du même XML sur le classeur produit (`frontend/tests/tmp_xml_reel.mjs`), **identique ligne à ligne sur les deux feuilles Inventaire** : `C327 b22[lmed rthi tmed bthi] F7CAAC «Boissons»` … `C333 b33[lmed rthi tthi bmed] FFFF00 «TOTAL»`, `E328 b26[lmed rmed tmed bnon] | E329 b27[lmed rmed] | E330 b28[lmed rmed bmed]`, `<mergeCell ref="E328:E330">`, `ht="16.5" customHeight="1"` sur les 7 lignes du bloc, `E333 b0[l-r-t-b-]` (la cellule de contrôle hors cadre, comme dans le modèle), et rien écrit en F. `<row r="7">` reste sans attribut : les lignes du tableau gardent leur hauteur par défaut.

Démonstration rouge/verte portée sur la garde du parser seule (`parsers.js:578`, `continue` au lieu de `break`) : `FAIL Réimport : aucune ligne du récap avalée comme un article — fantômes importés : Boissons, Nourriture - Surgelé, Nourriture - Frais, Nourriture - Sec, Packaging, Produits de Nettoyage`, puis 17/17 après restauration. Les 8 suites durables restent vertes, code de sortie 0 et 0 FAIL (`frontend/tests/` : `derive-inner-colisage`, `pertes-unite`, `recap-inventaire-categorie`, `recap-pmix-robustesse`, `regressions-cdg` ; `backend/tests/` : `lignes-sans-prix`, `regressions-cdg`, `unites`). `npm run build` : `✓ built in 5.49s`, seul l'avertissement de taille de chunk préexistant.

**Non fait** : le récap des feuilles Transferts (déjà en place, liste de catégories dynamique) n'a pas été touché ; le fichier `exemple inventaire.xlsx` du CDG n'a pas été modifié ; les teintes des **lignes du tableau** (`categoryFill`, `excelExporter.js:324` — F8CBAD / DDEBF7 / FCE4D6 / E2F0D9) sont volontairement laissées telles quelles, la demande portait sur le bloc de récap et non sur le tableau ; les rapports de suivi en base ne sont pas régénérés.
