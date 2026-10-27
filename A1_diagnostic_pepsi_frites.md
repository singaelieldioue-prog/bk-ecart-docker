# A1-DIAGNOSTIC — Pepsi et frites sont-ils dans les 308 exclus ? (24/10/2026)

Audit **en lecture seule** : aucune modification de code, de whitelist, de prix ni de base. Sources : `backend/data.db` (mode `ro`), `frontend/public/exemple inventaire.xlsx`, KV `bk_sia_ratios_parsed_v1` / `bk_sia_pmix_complement_v1`, table `reports`, code lu (`BaseArticlesTab.jsx`, `excelExporter.js`, `backend/src/articles.js`).

## Verdict

**Hypothèse A1 INFIRMÉE.** Les 5 codes Pepsi et les 6 codes « frites » de la base articles sont **tous dans la whitelist** `orderArticlesByInventoryExample` — donc **aucun des 308 exclus**. Ils sont aussi **tous priced** dans la chaîne de génération, et les 9 codes PMIX Pepsi/frites observés dans le dernier import sont **tous valorisés**. Le « Pepsi absent » d'Aristide ne vient pas d'A1.

## 1. Whitelist : Pepsi et frites y sont (mesuré, pas supposé)

Whitelist = onglet `inventaire` de `frontend/public/exemple inventaire.xlsx`, lignes 7+ avec nom (col. D) **et** code (col. O) : **318 lignes**.

| Code | Désignation | Whitelist | Base articles (après dédup backend) | pu_carton | Ratio Q3 (WA, matière) |
|---|---|---|---|---|---|
| BTL-PEPSIZERO 30CL | BOUTEILLE PEPSI ZERO 30CL | **ligne 30** | OK | 1 288 F (Base locale) | PEPSI ZERO LIGHT SMALL, pièce 107,34 |
| BTL-PEPSI 30CL | BOUTEILLE PEPSI à 30CL | **ligne 31** | OK | 1 520 F (Base locale) | PEPSI SMALL, pièce 127,47 |
| BTL-PEPSI 1.5L | BOUTEILLE PEPSI 1.5L | **ligne 34** | OK | 3 150 F (Base locale) | — (aucune ligne WA PEPSI 1,5 L) |
| BKCI-PEPSI | CAN PEPSI 250 ML | **ligne 35** | OK | 4 576 F (Base locale) | PEPSI SMALL, pièce 127,47 |
| CAN-PEPZER 25 CL | CANETTE PEPSI ZERO 25 CL | **ligne 36** | OK | 1 530 F (Base locale) | PEPSI ZERO LIGHT SMALL, pièce 107,34 |
| BKFR07 | FRITES | **ligne 63** | OK | 17 643 F (Base locale) | LOW COATED FRIES, carton 16 280,77 |
| 998740 | SACHET FRITES GRAND | ligne 222 | OK | 50 000 F | — |
| 73101 | SACHET FRITES MOYEN | ligne 223 | OK | 25 714 F | MEDIUM FRIES BAG, carton 24 078 |
| 64472 | SACHET FRITES PETIT | ligne 224 | OK | 20 670,57 F | — |
| SFP4000 | SACHET FRITES PETIT 4000 | ligne 225 | OK | 20 282 F | SMALL FRIES BAG, carton 20 389,31 |
| 73101SIKO | SACHET FRITES - SIKO | ligne 229 | OK | 24 078 F (source Q3) | MEDIUM FRIES BAG |
| 923482 | DOSETTE FRITE SAUCE PORTION - 10GR | **ligne 114** | OK | 6 250 F | — |
| BKCI-PMC052 | PELLE A FRITES - Plastique | **ABSENT** | OK (catégorie PMC) | 17 219 F | — |

Les numéros de ligne sont les lignes Excel réelles de l'onglet `inventaire` (la 1re ligne retenue est la
ligne 7 ; 318 lignes retenues entre les lignes 7 et 526 de la feuille).

**0 sur 11 dans les 308 exclus.** Contrôle élargi (24/10) : le filtre `PEPSI|FRITES` sur les 621
articles dédupliqués sort **13 identifiants**, dont **12 dans les 318 lignes** — l'unique absent est
`BKCI-PMC052` (pelle à frites, petit matériel). Aucun code Pepsi/frites **matière** n'est exclu.

Mesure de contexte : `articles_bruts=903`, `dedup_actifs=621`, `whitelist_lignes=318`, `whitelist_appariées=312`, `actifs_exclus=308` (audit du 24/10, `rapports/rapport_audit_20261024.json`).

## 2. Ratio Q3 actif : PLU Pepsi et frites présents

PLU du `byPlu` en base (Ratio Q3, chargé 23/10 09:56) :

| PLU | Nom | Coût |
|---|---|---|
| 400101 / 400102 / 400103 | Pepsi small / Medium / large | 124,03 F |
| 400121 / 400122 / 400123 | Pepsi Zero small / medium / large | 124,03 F |
| 706 / 710 / 717 | SMALL / MEDIUM / LARGE FRIES | 229,74 / 283,48 / 411,07 F |
| **705** | (absent) | — supprimé du Q3, reporté sur 706 |

## 3. PMIX importé (dernier rapport BK1, 23/10 09:35, 133 codes)

| PLU PMIX | Nom importé | Qté | Valorisation |
|---|---|---|---|
| 400102 | Pepsi Medium | 4 | **Ratio Q3** |
| 400265 | PEPSI COLA PET 300ML | 117 | complément PMIX 127,47 F |
| 400266 | PEPSI ZERO SUCRE PET 300M | 7 | complément PMIX 123 F |
| 706 | SMALL FRIES | 57 | **Ratio Q3** |
| 710 | MEDIUM FRIES | 2 | **Ratio Q3** |
| 717 | LARGE FRIES | 27 | **Ratio Q3** |
| 705 | PETITE FRITES | 19 | complément PMIX 242 F |
| 713 | MOYEN FRITES MN | 179 | complément PMIX 242,43 F |
| 715 | GRAND FRITES | 9 | complément PMIX 435 F |

**9/9 valorisés, 0 « PLU ABSENT DU RATIO »**, `pluNonMatchés` Pepsi/frites = vide. La feuille cachée « Référentiel PMIX » (104 produits Ratio + 231 compléments + liste de secours) contient bien chaque code ci-dessus avec un coût > 0.

## 4. Ce qui explique réellement le « Pepsi absent » vu par Aristide

Trois mécanismes, aucun n'est A1 :

**(a) Les fichiers et rapports consultés ont été calculés avant le Ratio Q3.** Le dernier rapport enregistré (BK1, `updated_at = 2026-10-23 09:35`) porte `ratiosMeta.label = « RATIOS  Q2 2026.xlsx · Chargés le 21/10/2026 »` ; l'import Q3 a eu lieu le **23/10 à 09:56**, soit 21 minutes plus tard. Un classeur ou rapport téléchargé avant cette heure contient donc le Q2 : avec le Q2, les PLU Pepsi valaient 123,99 F et 706/710/717 242,11 / 299,80 / 433,82 F, au lieu de 124,03 et 229,74 / 283,48 / 411,07 F. **Régénérer avec le Ratio Q3 actif** est la première action à demander.

**(b) Dans la feuille « Pertes », deux Pepsi et un conditionnement de frite n'ont aucune ligne écrite.** La whitelist du volet Pertes (`excelExporter.js:657`, 188 noms) compte 6 Pepsi : `BOUTEILLE PEPSI ZERO 1,5L` n'existe **ni dans la base articles ni dans le PMIX** (37 noms de cette whitelist sont dans ce cas, dont les anciens `BOUTEILLE COCA COLA …`, `BOUTEILLE FANTA …`, `BOUTEILLE SPRITE …` — nommés avant le basculement de fournisseurs du Q3). `CAN PEPSI 250ML` (sans espace) et `BOUTEILLE PEPSI 1.5L` ne sont pas écrits tels quels : ils ne correspondent à la base qu'après normalisation (`CAN PEPSI 250 ML`, `BOUTEILLE PEPSI 1,5L`), ce qui fonctionne — mais le nom `BOUTEILLE PEPSI ZERO 1,5L`, lui, ne peut apparaître nulle part. Si Aristide cherche une ligne nommée précisément ainsi dans un classeur, il la voit « absente ».

**(c) Les Pepsi/frites « PET » et les formats locaux ne sont pas dans le Ratio : ils sont valorisés par la base complémentaire PMIX, pas par le Ratio.** 400265, 400266, 705, 713, 715 (au total 117 + 7 + 19 + 179 + 9 = 331 pièces vendues sur le dernier import) sortent du `Ratio` et viennent du complément ; ces mêmes PLU figurent aussi dans la liste de secours `missingPmix.js` avec `coutTheo: 0`. **Si le complément n'est pas chargé** (autre poste, navigateur vierge, KV vidé), ces lignes basculent en coût 0 : c'est exactement « frites non valorisées » + « Pepsi absent », sans intervention d'A1. Le complément est pourtant bien en base serveur (`bk_sia_pmix_complement_v1`, 231 PLU) — le point à vérifier côté poste d'Aristide est donc la présence de ce KV, pas la whitelist.

## 5. Ce que le diagnostic écarte explicitement

- **A1 (exclusion par la whitelist)** : écarté, §1.
- **Ratio Q3 sans Pepsi/frites** : écarté, §2.
- **PLU PMIX non reconnus** : écarté sur le dernier rapport, §3.
- **Périmètre** : la whitelist des 318 lignes n'a pas été touchée ; aucun prix modifié ; aucun code modifié.

## 6. Risque latent repéré (non déclenché, à ne pas corriger ici)

Les 903 lignes brutes de la table `articles` contiennent **282 lignes « ombre »** = 903 bruts − 621
dédupliqués, toutes `source = RATIOS BURGER KING ABJ Q3 2026.xlsx`, `pu_carton` et `pu_piece` à `NULL`
(ex. ref `BTL PEPSI 30CL` / code `BTL-PEPSI 30CL`), dont **4 portent PEPSI ou FRITES** dans le nom ou le
code. Aujourd'hui la route backend `/articles` **déduplique** (`backend/src/articles.js:337`,
`dedupeArticles` garde la ligne priced grâce à `score_article` + `orderBy rowid`), donc la génération
écrit les 318 lignes avec prix et il ne reste que **31 lignes whitelist sans prix** (= la mesure connue
« appariées sans prix » de l'audit). Simulation : en résolvant chaque ligne de la whitelist **sans
déduplique et **en prenant la dernière occurrence** de la table (ordre `rowid`), **169 des 318 lignes**
dont les 5 Pepsi et BKFR07 partiraient en `PU carton = 0` — le symptôme exact décrit par Aristide
(avec la première occurrence : 31 lignes, soit la mesure courante). Conséquence : toute consommation de
la table `articles` **sans passer par `dedupeArticles`** (import direct, futur endpoint, script)
reproduira « Pepsi absent » et « frites non valorisées ». À traiter comme un dossier distinct (A1-bis), **pas** en modifiant la whitelist.

## 7. Prochaines étapes proposées (aucune action prise)

1. Faire régénérer les classeurs et relancer le rapport BK1/BK COCODY **avec le Ratio Q3 actif**, puis redemander à Aristide de préciser **quelle vue** montre « Pepsi absent » (feuille Pertes, PMIX, Référentiel Articles, ou rapport de synthèse) et **avec quel fichier**.
2. Vérifier sur son poste que `bk_sia_pmix_complement_v1` est bien chargé (231 PLU) — sans lui, 705/713/715/400265/400266 tombent à 0 F.
3. Ouvrir A1-bis sur les 282 ombres Q3 (prix NULL + collision de code) : c'est le seul mécanisme identifié capable de produire le symptôme décrit dans la chaîne de génération.

## 8. Suite donnée (24/10)

- `A1_codes_a_ajouter.csv` — 40 lignes classées par type (`ARTICLE_BASE` 13, `PLU_VENTE` 23,
  `NOM_PERTES_SANS_APPARIEMENT` 4) avec pour chacune la présence dans la whitelist des 318, le Ratio Q3
  et le complément PMIX, la quantité et le coût relevés dans les 2 derniers rapports. **Un seul code est
  réellement à ajouter : `BKCI-PMC052`.**
- `A1_dossier_arbitrage.md` — les 3 options chiffrées (A strict 318, B union 319, C complet 621 ou
  C-triée 282) et la question fermée posée au CDG : « Quelle option pour les modèles ? A / B / C ».
