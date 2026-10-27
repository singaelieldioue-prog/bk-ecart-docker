# RATIO-Q3 — Comparaison Ratio actuel vs Ratio Q3 officiel (24/10/2026)

Fichiers : `sample_data/RATIOS BURGER KING ABJ Q1 2026.xlsx` (échantillon) et `sample_data/RATIOS BURGER KING ABJ Q3 2026.xlsx` (officiel), tous deux présents, parsés par `parseRatios` (`frontend/src/utils/parsers.js`), lecture seule.

## 1. Verdict : le Ratio Q3 EST DÉJÀ le référentiel actif — la prémisse du prompt est fausse

| Contrôle | Résultat |
|---|---|
| KV `bk_sia_ratios_v1` (référentiel Ratio actif) | `{"label":"RATIOS BURGER KING ABJ Q3 2026.xlsx","date":"23/10/2026","nbProduits":104,"nbIngredients":122}` |
| Signature `byPlu` — KV stocké vs parse frais Q3 | identiques : 87 lignes, hash `6c7cb1e5` |
| Signature `byPlu` — KV stocké vs parse frais Q1 | différentes : Q1 = 76 lignes, hash `aafb4c72` |
| Signature des clefs `waLandedCost` — KV vs Q3 | identiques : hash `b65ec031` (Q1 : `3ac45d3`) |

Preuve de la promesse des clés → la valeur de chaque clé → hachage : les deux fichiers de référence (KV et Q3) donnent le même résultat, le Q1 non. Le Q3 a été chargé comme référentiel le 23/10 à 09:56 ; c'est ce qu'on voit en base et ce que l'UI affiche (« Ratios mémorisés : RATIOS BURGER KING ABJ Q3 2026.xlsx · Chargés le 23/10/2026 · 104 produits · 122 ingrédients », `App.jsx:1044`). Il n'y a donc eu **aucun rechargement, aucune écriture, aucun Ratio Q1 écrasé** ; le « Ratio Q1 échantillon » évoqué dans le prompt n'est pas le référentiel actif.

La comparaison Q1 vs Q3 ci-dessous est produite avec les deux fichiers : les 104 produits annoncés par les métadonnées sont ceux du Q3, et le fichier Q1 échantillon en contient également 104 (les deux sont des échantillons de 104 lignes `allProducts`) ; ils se distinguent par leurs PLU, leurs coûts et leurs ingrédients, pas par ce compteur.

## 2. Q1 → Q3 : chiffres comparés

| Indicateur | Q1 échantillon | Q3 officiel | Évolution |
|---|---|---|---|
| `allProducts` | 104 | 104 | = |
| Lignes avec PLU (`byPlu`) | 76 | 87 | +11 |
| Ingrédient (`pmpByIng`) | 122 | 122 | = |
| Lignes WA Landed Cost | 127 | 125 | −2 |
| Prix WA modifiés | — | — | 60 |
| Coûts théoriques produit modifiés | — | — | 55 |
| Recettes modifiées | — | — | 8 |
| Clés `plu\|Nom` ajoutées / supprimées | — | — | 29 / 29 |

## 3. Les PLU réaffectés (groupe le plus important des 29/29)

Ces lignes ne sont pas des créations ou disparitions de produits : le même PLU change de marque de boisson.

| PLU | Q1 | Q3 |
|---|---|---|
| 400101 / 400102 / 400103 | COCA COLA S/M/L | PEPSI S/M/L |
| 400121 / 400122 / 400123 | COCA COLA ZERO S/M/L | PEPSI ZERO S/M/L |
| 400111 / 400112 / 400113 | SPRITE S/M/L | 7UP S/M/L |
| 400116 / 400117 / 400118 (goûts 1 et 2) | FANTA S/M/L | MIRINDA S/M/L |
| 705 | SMALL FRIES | — (supprimé, reporté sur **706**) |
| 835 | 4 NUGGETS | — (reporté sur **369**) |
| 754 / 755 / 756 | (sans PLU) CHILI CHEESE BITES 4/6/9 | PLU attribués |
| 369 | — | 4 NUGGETS |
| 383 | (sans PLU) KING FISH | PLU attribué |
| 500147 / 500148 / 500150 | (sans PLU) CHICKEN STRIPS 3/6, VALUE CHICKEN | PLU attribués |
| 2507 / 2509 / 2530 | (sans PLU) CONE, SUNDAE CARAMEL, FUSION OREO | PLU attribués |

Sans PLU dans les deux fichiers : CANETTE PREESEA / JUS PRESSEA (Q3) remplacent SCHWEPPES AGRUMES / JUS DARCY (Q1).

Côté WA Landed Cost : 19 ingrédients ajoutés (bloc PEPSI / 7UP / MIRINDA, KOKI CHICKEN BURGER CORNFLAKES, MAYO AMERIGO 10 ML CHILI, BARBECUE SACHET 10 ML, CANNETTE PRESSEA), 21 supprimés (bloc COCA COLA / FANTA / SPRITE, MUSTARD BULK, CHILI CHEESE SAUCE, les dips 25 ML, TOMATO KETCHUP 10G).

## 4. Les 55 coûts modifiés — extraits les plus marqués

| PLU \| produit | Q1 | Q3 | Δ |
|---|---|---|---|
| LTO #5 MOZZARELLA STICKS X6 | 1 134 | 952 | −182 |
| LTO #6 MOZZARELLA STICKS X9 | 1 597 | 1 420 | −177 |
| 494 CRISPY CHICKEN SALAD | 1 567 | 1 703 | +136 |
| 479 GRILLED CHICLEN SALAD | 1 902 | 2 037 | +135 |
| 410 SALADE FRAICHEUR | 1 074 | 1 202 | +128 |
| 120 DOUBLE WHOPPER | 1 642 | 1 759 | +117 |
| 1106 12 NUGGETS | 1 145 | 1 037 | −108 |
| **110 WHOPPER** | **1 095** | **1 187** | **+92** |
| 150111 DELUXE | 1 243 | 1 330 | +87 |
| 115 WHOPPER CHEESE | 1 220 | 1 295 | +75 |
| 1102 BIG KING XXL | 1 762 | 1 831 | +69 |

Les 44 restantes vont de +52 à ±1 F. Le PLU 110 passe à 1 186,67 F arrondi à 1 187 F : la valeur attendue par le prompt est bien celle du Q3 en base.

## 5. Garde-fous du chargement (déjà en place, vérifiés)

Le chemin de chargement est `majRatios` (`App.jsx:249-355`) : `readWb` → `parseRatios` → garde → `saveRatiosMemo(meta)` → `saveRatiosParsed(r)` → synchro base articles.

- **Fichier vide / non reconnu rejeté** : `if (!r.allProducts.length)` (`App.jsx:261`) refuse la mise à jour, conserve le ratio précédent et nomme les feuilles attendues (Data sheet, PMP marchandises, COST, WA Landed Cost).
- **Colonnes PLU / Nom / Coût absentes** : rejet implicite — sans ces colonnes, `parseRatios` ne produit aucun produit, donc la garde ci-dessus déclenche.
- **Journal `{label, date, nbProduits, nbIngredients}`** : `meta` est persistée en KV (`App.jsx:271-279`), affichée dans l'UI (`App.jsx:1044`, `1459`) et reconduite dans chaque rapport sous `ratiosMeta.label` au format `<label> · Chargés le <date>` (`App.jsx:552-570`).
- **Traçabilité prix** : la synchro articles reçoit `meta.label` comme `source_prix`, d'où la mention « RATIOS BURGER KING ABJ Q3 2026.xlsx » sur les 41 lignes de `A7_diff_12_23.csv`.

## 6. Test unitaire des PLU critiques — 6/6 OK (ratio actif en base)

```
OK PLU 110 WHOPPER présent dans le référentiel actif
OK PLU 110 coût = 1186.67 ≈ 1 187 F
OK PLU 706 (équivalent officiel de 705) présent
OK PLU 710 et 717 présents
OK Pepsi présent : 6 entrées WA, 6 PLU
OK PLU 705 absent du Ratio Q3 (attendu : remplacé par 706)
```

## 7. PLU critique absent → `ratio_q3_plu_manquants.csv`

Un seul PLU critique du prompt est absent du Q3 : **705 (frites)**. Il est documenté dans `ratio_q3_plu_manquants.csv`, avec la quantité PMIX associée relevée dans les rapports (19 sur les deux sites) et son coût pris en charge par le complément PMIX (242 F/ unité, soit 4 598 F sur 19 unités).

## 8. Backup

`backend/data.backup-ratio-q3-261024-011906.db` — 12 840 960 octets, copié avant toute vérification et pris alors qu'aucune écriture n'était engagée.

## 9. Critères d'acceptation

| Critère | État |
|---|---|
| Ratio Q3 actif en base | ✅ déjà actif depuis le 23/10 (preuve §1), aucun rechargement nécessaire |
| Label/date visibles dans l'UI | ✅ `ratiosMemo` + `ratiosMeta.label` dans les rapports |
| PLU 110 / 705 / Pepsi / frites résolus au test unitaire | ✅ 6/6 — 705 documenté comme absent-replacé par 706 |
| Backup pris | ✅ `data.backup-ratio-q3-261024-011906.db` |
| Rapport de comparaison Q1 vs Q3 | ✅ ce fichier |
| Interdit : écraser le Q1 sans backup / charger un fichier vide | ✅ rien écrasé ; la garde du fichier vide est en place |
