# Dossier A1 — Arbitrage sur la liste des articles des modèles

**Destinataire :** Aristide (CDG) · **Émetteur :** BK Écart Matières · **Date :** 24/10/2026
**Objet :** combien de lignes doivent contenir les classeurs « Suivi Stock » générés ?
**Pièce jointe :** `A1_codes_a_ajouter.csv` (40 lignes, dont **1 seul code à ajouter**)
**Documents liés :** `A1_diagnostic_pepsi_frites.md`, `ratio_q3_comparaison.md`, `PRD-BK-Ecart-Matieres.md` (§8 risque R1, §7 V1.1)

> ## ❓ Question fermée
> **Quelle option pour les modèles ? A / B / C**
> (réponse attendue : une seule lettre, case à cocher en §6)

---

## 0. A lire avant de choisir : l'hypothèse de départ est infirmée

L'hypothèse A1 était : « Pepsi et frites sont dans les 308 articles actifs exclus de la liste des
modèles, donc ils n'apparaissent pas / ne sont pas valorisés. »

**Mesure (24/10, lecture seule) : sur les 13 articles « Pepsi » ou « frites » de la base dédupliquée,
12 figurent déjà dans les 318 lignes des modèles. Seul absent : `BKCI-PMC052` — « PELLE A FRITES -
Plastique » (catégorie PMC, petit matériel, 17 219 F le carton). Aucun code Pepsi/frites matière n'est
exclu.** (Le diagnostic du 24/10 exprimait la même chose en « 0 sur 11 » : il ne retenait que les 5
codes Pepsi + 6 codes frites matières et packaging, tous dans les 318.) Détail ligne à ligne :
`A1_diagnostic_pepsi_frites.md` §1, et les 13 lignes `ARTICLE_BASE` du CSV joint.

Deux conséquences pour cet arbitrage :

1. **L'option « A strict » telle qu'elle avait été formulée (« 318 lignes, Pepsi/frites absents ») est
   fausse sur le fond** : dans l'option A, Pepsi et frites sont *présents et valorisés*. Le texte
   corrigé est en §2.
2. **L'option « C complet » telle que formulée (« 621 lignes, tous valorisés ») est également fausse** :
   sur les 621 articles dédupliqués, **91 n'ont aucun prix carton** (mesure §4). Ils entreraient dans
   les classeurs *sans valorisation*.

Le « Pepsi absent / frites non valorisées » constaté dans le mail du 23/10 vient d'ailleurs (3 causes,
§5). **Aucune des trois options ne corrige ces trois causes** — elles se règlent séparément.

---

## 1. Chiffres de vérité (tous mesurés, reproductibles en §7)

| Grandeur | Valeur | Provenance |
|---|---|---|
| Articles en base (bruts, tous actifs) | **903** | `backend/data.db`, table `articles` |
| Articles après dédoublonnage backend | **621** | `dedupeArticles()` — `backend/src/articles.js:337` |
| Lignes des modèles générés aujourd'hui | **318** | `frontend/public/exemple inventaire.xlsx`, feuille `inventaire`, à partir de la ligne 7 ; nom col. D (`row[3]`), code col. O (`row[14]`) |
| Articles actifs exclus des modèles | **308** (621 − 312 appariés) | filtre `orderArticlesByInventoryExample`, `frontend/src/pages/BaseArticlesTab.jsx:20-59` |
| … dont avec prix carton (> 0) | **248** | table `articles.pu_carton` |
| … dont sans prix carton | **60** | idem |
| Lignes des modèles appariées **avec** prix | **281** | 312 appariées − 31 sans prix |
| Lignes des modèles appariées **sans** prix | **31** | audit `apparies_sans_prix` |
| Lignes des modèles non appariées (nom + code inconnus) | **6** | audit `lignes_non_appariees` |
| Articles Pepsi/frites de la base / présents dans les 318 | **13 / 12** | CSV joint, type `ARTICLE_BASE` |
| PLU de vente Pepsi/frites (Ratio Q3 et/ou complément PMIX) absents des 318 | **23** (dont 9 vendus sur les 2 derniers rapports) | KV `bk_sia_ratios_parsed_v1` (`byPlu`), KV `bk_sia_pmix_complement_v1` |
| Noms de la feuille Pertes sans appariement (total / Pepsi-frites) | **37 / 4** | `frontend/src/utils/excelExporter.js`, `const PERTES_WHITELIST` (188 noms) |
| Lignes « ombre » Ratio Q3 sans prix, masquées par le dédoublonnage | **282** | 903 − 621 ; source `RATIOS BURGER KING ABJ Q3 2026.xlsx` pour les 282 |

Ratio officiellement actif en base : `RATIOS BURGER KING ABJ Q3 2026.xlsx`, chargé le 23/10/2026,
104 produits, 122 ingrédients (KV `bk_sia_ratios_v1`).

---

## 2. Option A — « strict » (statu quo)

**Définition :** la liste des modèles reste exactement l'exemple de référence.

| | |
|---|---|
| Lignes par classeur Inventaires | **318** |
| Composition | 281 avec prix · 31 sans prix · 6 non appariées |
| Pepsi/frites matières | **12 des 13 lignes présentes et valorisées au prix carton** (ex. `BKFR07` FRITES 17 643 F, `BTL-PEPSI 30CL` 1 520 F, `BKCI-PEPSI` 4 576 F) |
| Seul absent | `BKCI-PMC052` PELLE A FRITES - Plastique (PMC, non matière) |
| Valorisation PMIX Pepsi/frites mesurée | **161 975,72 F pour 752 pièces** sur les 2 derniers rapports (9 PLU) |
| Effet sur les écarts | aucun (aucun changement) |
| Travail de mise en œuvre | **nul** |
| Travail de recette CDG | **nul** |
| Risque principal | la couverture reste ~51 % du référentiel : 308 articles actifs ne sont jamais comptés, donc **jamais déclarés en écart** |

**À ne pas écrire au CDG :** « en option A, Pepsi et frites sont absents ». Mesure : ils sont présents,
sauf la pelle à frites.

---

## 3. Option B — « union » (318 + N)

**Définition mesurée :** `N = 1` → **319 lignes**. Le code à ajouter est unique :
`BKCI-PMC052` — PELLE A FRITES - Plastique — catégorie PMC — colisage 1 — 17 219 F le carton.

Les 23 identifiants Pepsi/frites restants du CSV joint sont des **PLU de vente PMIX**, pas des lignes
de stock : ils ne peuvent pas être ajoutés à la feuille Inventaires sans créer de fausses lignes
d'inventaire. Ils sont **déjà suivis** — et déjà valorisés — par la feuille PMIX des classeurs.

Les 4 lignes `NOM_PERTES_SANS_APPARIEMENT` du CSV ne sont pas des ajouts de code non plus : ce sont des
**corrections de noms** à faire dans la liste Pertes transmise (ou à renseigner par le CDG) :

- `BOUTEILLE PEPSI ZERO 1,5L` — introuvable partout (base, Ratio Q3, complément PMIX) ;
- `BOUTEILLE PEPSI[NBSP]30CL` — la base a `BOUTEILLE PEPSI A 30CL` : un espace insécable casse l'appariement ;
- `DOSETTE FRITE SAUCE AMERIGO - 10GR` — présent **2 fois** dans la liste Pertes, absent de toute base de prix ;
- `DIP FRITE SAUCE - 25GR` — absent de toute base de prix.

| | |
|---|---|
| Lignes par classeur | **319** |
| Mise en œuvre | ajouter la ligne dans `exemple inventaire.xlsx` (col. D nom, col. O code) — **aucune ligne de code à écrire** |
| Recette | une re-génération + contrôle visuel d'une feuille |
| Effet sur les écarts matière | **nul** (la pelle à frites est du petit matériel, pas de la matière) |
| Effet réel | le classeur ne peut plus être contesté sur « il manque une ligne frites » |
| Risque | faible ; la liste reste figée sur l'exemple de référence |

**Variante B+ (à ne pas choisir sans le dire) :** B **plus** les 2 corrections d'appariement des noms
Pertes ci-dessus, qui sortent 2 lignes du statut « à renseigner ». Coût : modification de la liste
`PERTES_WHITELIST` dans `excelExporter.js` → 1 ligne de code + campagne de tests des classeurs.

---

## 4. Option C — « complet » (621 lignes)

**Définition :** la liste des modèles = référentiel articles actif dédupliqué entier, soit
**621 lignes** (318 + 308 nouvelles).

| | |
|---|---|
| Lignes par classeur | **621** (+ 95 %) |
| Valorisation | **530 avec prix carton, 91 sans prix** → « tous valorisés » est **faux** |
| Dont sans prix dans les 308 nouvelles | **60** (à renseigner par le CDG avant usage) |
| Dont non appariées aujourd'hui | 6 (elles restent, prix vide) |
| Nature des 308 nouvelles lignes | PMC **113** · Produits de Nettoyage **56** · Nourriture **26** · Packaging **23** · Boissons **22** · IFB **18** · Surgelé **18** · Frais **16** · Sec **13** · « Catégorie » **1** · « Test » **1** · PACKAGING **1** |
| Mise en œuvre | soit 308 lignes ajoutées à `exemple inventaire.xlsx`, soit bascule du générateur sur le référentiel complet (modification de `orderArticlesByInventoryExample`) |
| Recette estimée | **≈ 1 semaine dev + recette CDG** (estimation déjà inscrite au PRD §7 V1.1, ligne 245) |
| Effet sur les écarts | **non chiffrable sans régénération** : des lignes non comptées en magasin ressortiront à 0 et peuvent créer des écarts artificiels |
| Risque 1 | charge de comptage × 2 pour chaque restaurant ; risque de feuilles bâclées → écarts moins fiables, pas plus |
| Risque 2 | les 60 nouvelles lignes sans prix + les 31 actuelles = **91 lignes à 0 F**, donc des costs théories sous-estimés tant que le CDG ne les a pas renseignées |
| Risque 3 | **A1-bis** : le dédoublonnage masque 282 lignes « ombre » issues de l'import Q3, toutes à prix 0. Tout consommateur qui court-circuite `dedupeArticles()` (export direct, script, API paginée différemment) peut les réintroduire |

**Variante C-triée** (ce que le PRD appelle « référentiel complet trié »), mesure exacte :
**282 lignes matières**, dont **234 avec prix carton** et 48 sans prix.
*(Ce « 282 »-là n'a aucun rapport avec les 282 lignes ombre du §1 : coïncidence des deux mesures.)*

- périmètre retenu : catégories Nourriture - Sec (64), Nourriture - Surgelé (60), Boissons (60),
  Nourriture (50), Nourriture - Frais (28), IFB (19), NOURRITURE_SEC (1) = 282 ;
- exclues : Produits de Nettoyage (125), PMC (113), Packaging (98 + 1 « PACKAGING »),
  « Catégorie » (1), « Test » (1) = 339 ; les 2 parasites de la table `articles`
  (« Code article Bolloré », « Article Test ») sont dans ces 339-là ;
- **attention : C-triée n'est pas qu'un élargissement, c'est aussi une réduction.** Les 318 lignes
  actuelles contiennent déjà **145 lignes non matières** (Packaging 75 + Produits de Nettoyage 70).
  Retenir C-triée supprimerait donc 145 lignes aujourd'hui comptées (emballages et produits
  d'entretien), alors qu'elle en ajouterait 115 lignes matières (282 − 167 matières actuellement
  présentes). Les 6 lignes non appariées et les 31 sans prix restent à trancher de toute façon.

Répartition mesurée des 318 lignes actuelles : Packaging 75 · Produits de Nettoyage 70 ·
Nourriture - Sec 51 · Nourriture - Surgelé 41 · Boissons 38 · Nourriture 24 · Nourriture - Frais 12 ·
NOURRITURE_SEC 1 · non appariées 6.

---

## 5. Ce que ni A, ni B, ni C ne corrige (les 3 vraies causes)

| # | Cause mesurée | Preuve | Réparation (hors arbitrage A/B/C) |
|---|---|---|---|
| 1 | Les 2 derniers rapports ont été calculés avec le **Ratio Q2**, pas Q3 | `reports.data.ratiosMeta.label` = « RATIOS Q2 2026.xlsx · Chargés le 21/10/2026 » sur BK1 (23/10 09:35) et BK COCODY (22/10 00:33) ; le Ratio Q3 n'est actif que depuis 23/10 09:56 | **recalculer/régénérer** les rapports avec le Ratio Q3 actif (706 : 229,74 F en Q3 contre 242,11 F appliqué ; 717 : 411,07 contre 433,82) |
| 2 | **83,6 %** de la valorisation Pepsi/frites vient du complément PMIX, pas du Ratio | 135 366,90 F sur 161 975,72 F (5 PLU sur 9 : 713, 400265, 705, 715, 400266) | sécuriser la KV `bk_sia_pmix_complement_v1` (backup + contrôle après chaque import) ; 705 n'existe plus dans le Ratio Q3 (remplacé par 706) |
| 3 | 4 noms Pepsi/frites de la liste Pertes ne s'apparient à rien | CSV joint, type `NOM_PERTES_SANS_APPARIEMENT` (sur 37 noms orphelins sur 188) | corrections de noms (variante B+) ou renseignement par le CDG |

---

## 6. Comparatif et case à cocher

| | A — strict | B — union | C — complet |
|---|---|---|---|
| Lignes Inventaires par classeur | 318 | 319 | 621 (ou **282** triées « matières seules ») |
| Pepsi/frites matières valorisés | oui (12/13) | oui (13/13) | oui (13/13) |
| Lignes à prix 0 dans les classeurs | 31 (+6) | 31 (+6) | **91** (+6) — ou 48 (+6) en C-triée |
| Couverture du référentiel actif | 51 % | 51 % | 100 % (ou 45 % en C-triée) |
| Développement | 0 | 0 | ≈ 1 semaine + recette |
| Charge de comptage magasin | inchangée | inchangée | × 1,95 (ou × 0,89 en C-triée) |
| Effet attendu sur l'écart déclaré | nul | nul | **inconnu avant régénération** |

```
Réponse du CDG — « Quelle option pour les modèles ? A / B / C »

[ ] A — strict (318 lignes, statu quo)
[ ] B — union  (318 + 1 = 319 lignes)      [ ] B+ (B + corrections des 4 noms Pertes)
[ ] C — complet (621 lignes)                [ ] C-triée (282 lignes matières seules)

Commentaires / catégories à exclure : ..............................................

Nom, date, signature : ..................................................
```

Contrainte à rappeler dans la réponse : **le choix de l'option ne dispense pas du point 5.1**
(recalcul des rapports avec le Ratio Q3) ; sans lui, « Pepsi/frites non valorisés » restera observable
dans les livrables, quelle que soit la liste retenue.

---

## 7. Reproductibilité

```bash
# métriques du référentiel (lecture seule ; ne toucher ni --prd ni la memo)
python scripts/audit_referentiel.py --no-docs
```

- `articles`, `kv`, `reports` : `backend/data.db`, ouvert en `mode=ro` — jamais écrit.
- Liste des modèles : `frontend/public/exemple inventaire.xlsx` → feuille `inventaire`,
  `rows.slice(6)` filtré sur `row[3] && row[14]` (`BaseArticlesTab.jsx:20-59`), appariement par
  `normalizeInventoryValue` **code d'abord, nom ensuite**.
- Ratio : KV `bk_sia_ratios_v1` (méta) et `bk_sia_ratios_parsed_v1` (`byPlu`, `waByCode`, `pmpByIng`).
- Complément PMIX : KV `bk_sia_pmix_complement_v1` (231 PLU).
- Quantités et coûts Pepsi/frites : `reports.data.calc.pmixTheo[]`, colonnes `plu`, `nom`, `qty`,
  `coutUnit`, `amount` (lignes Ratio) et `coutTheo` (lignes complément), sur les 2 rapports les plus
  récents (BK1 23/10 09:35:47, BK COCODY 22/10 00:33:41).
- Liste Pertes : `const PERTES_WHITELIST` dans `frontend/src/utils/excelExporter.js` (188 noms).

**Périmètre de ce dossier : aucune modification de whitelist, de Ratio, de code ou de base.**
Le CSV joint est une proposition d'exécution, pas un correctif appliqué.
