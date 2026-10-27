# A7-bis — Analyse des nouvelles incohérences prix (12/10 → 23/10)

**Périmètre : lecture seule. Aucun prix corrigé, aucune écriture en base.** Référence de l'audit recalée : `incoherences_prix = 82` (scripts/audit_referentiel.py, ligne commentée « Recalibrée le 23/10 »).

## 1. Prémisse vs mesure

La prémisse « 18 nouvelles incohérences (82 − 64) » n'est **pas reproductible** : la valeur 64 du 12/10 correspond à l'état *post-re-dérivation* qui n'a jamais été snapshoté. Le seul snapshot 12/10 disponible (`backend/data.db.bak-20261012`) est l'état *pré*-re-dérivation (58 incohérences). En reconstruisant le baseline « 22/10 au soir » (lignes touchées le 23/10 remplacées par leur valeur du snapshot), la mesure réelle est :

- baseline 22/10 : **43** incohérences → actuel : **82** ⇒ **41 lignes nouvelles** (et 2 disparues : MUFFIN CHOCOLAT - NOUGATINE, SPICY NUGGETS, devenues cohérentes).

Les 41 nouvelles sont toutes `updated_at = 2026-10-23 09:56:02`, `source = RATIOS BURGER KING ABJ Q3 2026.xlsx`, et étaient à `pu_carton = 0, pu_piece = 0, conditionnement = 1` au 12/10 : ce ne sont pas des mises à jour partielles d'un champ, mais des **remplissages complets par l'import du Ratio Q3** qui introduisent l'incohérence.

## 2. Causes (41 lignes, 2 profils — détail complet dans A7_diff_12_23.csv)

| Groupe | Lignes | Cause | Preuve |
|---|---|---|---|
| **C — colisage absent du Ratio Q3** | **21** | `pu_carton` et `pu_piece` importés, mais `conditionnement` resté à 1 (colisage textuel/kg dans le Ratio, non parsé — cf. retour CDG 23/10). Écart relatif 92–99,9 %. | Le quotient `pu_carton ÷ pu_piece` est quasi entier et correspond au colisage réel : BKFR30B → 24 (« 24 pièces »), SSM30700 → 2000 (« MOYEN 2000 »), BKCI BIERE → 12, BKFR01 → 120, 73101SIKO → 4000… |
| **R — arrondi du prix pièce** | **20** | Les deux prix viennent de la **même ligne du Ratio Q3** (timestamp d'import identique) ; `pu_piece` est le prix pièce arrondi à l'unité, `pu_carton` le prix exact ⇒ petit écart. Écart absolu 2–26 F, relatif ≤ 0,65 %. | BKCI BOCK/FANTA/SPRITE 7950 = 331×24 + 6 ; BTL* 1288 = 107×12 + 4 ; BKDA/DM/DO/DP200 3051 = 127×24 + 3 ; GOB 6099 2598 = 52×50 − 2 ; 250K 4026 = 16×250 + 26. |

Sur les 4 causes probables du prompt : « pu_carton seul mis à jour » = 0, « pu_piece seul mis à jour » = 0, « conditionnement modifié » = 0 (il n'a **pas** été modifié, c'est le défaut du groupe C), « deux prix de sources différentes » = 0 au sens littéral (même fichier, même horodatage) — le groupe R est la variante « même source, précisions différentes ».

Lignes du groupe C : BKCI BIERE, BKCI BIERE 50CL, BZ08279, BR20965035, BKFR01-02-03-04, BKFR12, BKFR22, BKFR30B, BKFR33N, JOUETMAO1, MEHDIFR12, ONRILOC01, LOC998724, LOC998757, 73101SIKO, SSM30700, PAP00087, VEU500.
Lignes du groupe R : 250K, BKCI BOCK 33/50CL, BKCI EAU, BKCI EAU12, BKCI EAUK13, BKCI FANTA, BKCI SPRITE, BKDA/DM/DO/DP200, BTL FANTA (×5), BTL SCHWAG, BTL SPRITE, GOB 6099.

## 3. Recommandation (>10 lignes par cause → correctif d'import, pas d'arbitrage CDG)

1. **Groupe C (21 lignes)** : à l'import d'un Ratio, quand `pu_carton > 0`, `pu_piece > 0` et `conditionnement` absent/1, déduire `conditionnement = round(pu_carton / pu_piece)` et le publier dans les Anomalies pour validation, au lieu de laisser 1. Pas de correction manuelle ligne à ligne.
2. **Groupe R (20 lignes)** : incohérence de forme sans impact monétaire (la conso est valorisée au `pu_carton`) ; traiter par tolérance à l'audit (écarter du critère les écarts < 1 % *et* < 30 F) plutôt que par correction de prix.
3. Aucune de ces deux corrections n'est appliquée ici (consigne lecture seule) ; à faire arbitrer avant next import.

**Note annexe** : l'audit signale encore `cdt_non_parsables = 1` vs attendu 10 — valeur attendue périmée elle aussi (le re-import Q3 a rendu la plupart des colisages parsables) ; hors périmètre A7-bis, non recalée.

## 4. A7-quater (24/10) — cas de SAUCE MAYONNAISE (58185), absorbée par la tolérance

Données brutes en base (lecture seule) :

| champ | valeur |
|---|---|
| pu_carton | 37 288 F |
| pu_piece | 518 F |
| conditionnement | 72 |
| source_prix | Complément base locale (29/09) |
| date_dernier_import | 2026-10-22 09:28:52 |
| écart_absolu | \|37 288 − 518×72\| = 8 F |
| écart_relatif | 8 ÷ 37 288 = 0,0215 % |

**Verdict : arrondi légitime ✅ — classification : tolérée, pas réintégrée à A7.** Justification chiffrée, au-delà du simple franchissement de seuils : `pu_carton ÷ conditionnement = 37 288 ÷ 72 = 517,8889`, et `pu_piece = 518 = arrondi au franc le plus proche` (écart 0,1111 F/pièce ≤ 0,5). L'écart absolu est exactement la trace de cet arrondi : `72 × 0,1111 = 8 F`. C'est le même mécanisme que le groupe R (prix pièce arrondi à l'unité dans la source), la ligne en plus étant préexistante et issue du Complément base locale plutôt que du Ratio Q3. Impact monétaire nul (valorisation au `pu_carton`).

Conséquence sur la cible : la tolérance absorbe **21 = 20 (groupe R) + 1 (58185)** lignes pour une cause démontrée, non par coïncidence de seuil. **A7 post-correctif reste 41** ; l'hypothèse « 42, cible rejetée » n'est pas retenue, 58185 n'étant pas une incohérence réelle. Tolérance et prix inchangés.
