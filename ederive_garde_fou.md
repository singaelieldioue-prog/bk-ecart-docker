# E-DERIVE-GARDE-FOU — protection contre les colisages D > 1000

**PROMPT 1bis/11 — 2026-10-25.** Objet : borné la dérivation `E = D` (feuille Inventaires) par un
garde-fou sur le colisage, pour ne plus amplifier une valeur aberrante du fichier CDG.
Lecture seule sur les fichiers du CDG ; une seule fonction d'export modifiée ; rien commité.

---

## 1. Ce qui a été changé

`frontend/src/utils/excelExporter.js`

| Emplacement | Changement |
|---|---|
| ligne 270 | `export const SEUIL_COLISAGE_ABSURDE = 1000;` |
| lignes 271-278 | `deriveInnerDepuisColisage(article)` — 4 branches (tableau ci-dessous) |
| lignes 405-410 (boucle Inventaires, `invSheet`) | trace `a.conditionnement_source` + `console.warn` par ligne bloquée (émis une seule fois, sur la feuille « Inventaire Initial », pour que chaque article bloqué produise un seul signal) |

Règles appliquées, exactement celles demandées :

| Cas | Valeur écrite en E | `conditionnement_source` |
|---|---|---|
| E > 0 (déjà renseigné) | **E inchangé** | *non posée* (`null`) |
| E vide et 1 < D ≤ 1000 | **D** | `derive_E` |
| E vide et D > 1000 | **vide** (aucune dérivation) | `derive_E_bloque_D_absurde` |
| E vide et D ≤ 1 (ou D non numérique) | **vide** | `non_derive` |

Formule de la colonne I inchangée : `F + IF(D>0;G*E/D;0) + IF(D>0;H/D;0)`.
**D n'est écrit nulle part depuis le garde-fou** — la colonne 3 (`put(r, 3, Cn(a.conditionnement…))`)
n'a pas bougé, et aucun test d'écriture de D n'a été ajouté/modifié.

Message de log (format imposé) :

```
D=4000 > 1000 pour SFP4000 — dérivation E bloquée, à corriger dans le fichier CDG
```

---

## 2. Lignes bloquées — `nb_lignes_bloquees_D_absurde = 4` (et non 1)

Le prompt attendait `SACHET FRITES PETIT 4000`. Mesure sur le fichier du CDG
`frontend/public/exemple inventaire.xlsx`, feuille `inventaire`, lignes 7 et suivantes
(colonne D = article, E = colisage, F = inner, O = code) : **4 lignes** du modèle ont
E vide et D > 1000.

| Ligne exemplaire | Article | Code | D (colisage) | E avant garde-fou | E après | `conditionnement_source` |
|---|---|---|---|---|---|---|
| 115 | `DOSETTE KETCHUP PORTION - 10GR` | 518852 | **1500** | 1500 | **vide** | `derive_E_bloque_D_absurde` |
| 225 | `SACHET FRITES PETIT 4000` | SFP4000 | **4000** | 4000 | **vide** | `derive_E_bloque_D_absurde` |
| 230 | `SACHET SNACK MOYEN 2000` | SSM30700 | **2000** | 2000 | **vide** | `derive_E_bloque_D_absurde` |
| 231 | `SACHET SNACK MOYEN 4000` | SSM30700 | **4000** | 4000 | **vide** | `derive_E_bloque_D_absurde` |

Note : `SACHET SNACK MOYEN 2000` (ligne 230) et `SACHET SNACK MOYEN 4000` (ligne 231) portent
**le même code SSM30700** avec deux colisages différents — l'un des deux est forcément faux,
et c'est une deuxième raison de ne pas dériver automatiquement.

Ces 4 lignes redeviennent des lignes « inner annulé » (G saisi × E vide = 0) : le garde-fou
**ne répare pas** ces lignes, il empêche l'exporter d'inventer une valeur. Leur réparation
est dans le fichier du CDG (voir §6).

---

## 3. Impact sur les lignes dérivées : 181 → 177, aucun autre changement

Mesuré sur la génération réelle (`buildModelesWb` alimenté par les 318 lignes de l'exemplaire),
dans `frontend/tests/derive-inner-colisage.mjs` :

| Population | Avant garde-fou | Après garde-fou |
|---|---|---|
| Lignes générées (Inventaire Initial) | 318 | 318 |
| E vide dans l'exemplaire | 203 | 203 |
| E renseigné — **intactes** | 115 | **115** |
| Dérivées `E = D` (1 < D ≤ 1000) | 181 | **177** (identiques ligne à ligne) |
| Bloquées (D > 1000) | — | **4** (E reste vide) |
| Non dérivables (D ≤ 1), E vide | 22 | **22** (trace `non_derive`) |
| Colisages D modifiés | 0 | **0** |

Les 177 lignes dérivées ne changent pas : la valeur écrite en E est toujours D, le test
« Toutes les lignes à E vide et 1 < D ≤ 1000 sont dérivées (E = D) » compare E généré ↔ D généré
ligne par ligne et reste vert. Seules les 4 lignes du §2 sortent du lot.

**Effet chiffré sur la ligne que le prompt visait** — sonde A/B sur le même classeur généré
(`frontend/tests/tmp_edrive_roundtrip.mjs`, 11 inners saisis en G sur 7 lignes Pepsi/frites) :

| | Total pièces importées | Total valeur importée |
|---|---|---|
| E-DERIVE sans garde-fou | 44 913 | 465 362 F |
| E-DERIVE **avec** garde-fou | **913** | **241 080 F** |
| dont `SACHET FRITES PETIT 4000` | 44 000 pièces → **0** | 224 282 F → **0** |

Les 6 autres lignes Pepsi/frites (D = 5, 6, 12, 24) restent réparées comme prévu :
`BOUTEILLE PEPSI ZERO 30CL` 132 pièces, `BOUTEILLE PEPSI 30CL` 132, `BOUTEILLE PEPSI 1,5L` 66,
`CAN PEPSI 250 ml` 264, `CANETTE PEPSI ZERO 25 CL` 264, `FRITES` 55.

---

## 4. Justification du seuil 1000 (et pourquoi pas un autre)

- Dans le modèle du CDG, le plus grand colisage **vraisemblable** observé est exactement 1000 :
  5 lignes à D = 1000 qui restent dérivées — `DOSETTE KETCHUP PUIDOR - 9GR` (exemplaire ligne 116),
  `COFFRET A FRITE` (190), `Sac à emporter moyen (1000p)` (218), `Sac à emporter petit (1000p)`
  (219), `SAC ENFANT 1000` (221). Ces désignations disent « 1000 par carton » : la dérivation
  E = D y est correcte.
- Le premier colisage au-dessus est 1500 (`DOSETTE KETCHUP PORTION - 10GR`), puis 2000, 4000 :
  aucun ne porte une mention de quantité dans son libellé qui le confirme, sauf les sachets
  « … 2000 / … 4000 » dont le libellé est ambigu (§2, code dupliqué).
- Échelle plus large : le référentiel complet (`BASE ARTICLE SIA.xlsx` + correspondance Ratio,
  523 articles construits) contient **52 articles à D > 1000** — 43 en Packaging, 8 en Nourriture,
  1 en Produits de Nettoyage, jusqu'à D = 10 000 (ex. `FROMAGE TRANCHE` [69740] D = 1056,
  `CORNICHONS` [845628] D = 2004, `COUVERCLE GOBELET 25 CL` [916551] D = 2000). Pour le
  packaging, ces valeurs sont souvent **de vraies quantités par carton** : elles ne sont pas
  « fausses », elles sont **invérifiables automatiquement**. Le garde-fou bloque et avertit
  au lieu d'amplifier ; il ne prétend pas que D est une erreur.
- Conséquence du choix : 1000 est le seuil le plus haut qui ne bloque aucune ligne dont le
  libellé confirme le colisage. Le descendre (500, 200…) bloquerait des lignes correctement
  dérivées ; le monter (1500, 2000…) laisserait passer les ampliturations déjà mesurées.

---

## 5. Preuves d'exécution (sorties brutes, 25/10/2026)

```
$ node tests/derive-inner-colisage.mjs      → exit 0, 18 PASS
PASS Article avec D=12, E vide → E dérivé à 12
PASS Article avec D=12, E=6 → E reste 6
PASS Article avec D=1, E vide → E reste vide
PASS Article avec D=24, E=0 → E dérivé à 24
PASS Garde-fou : seuil à 1000
PASS D=12, E vide → E = 12, source 'derive_E'
PASS D=4000, E vide → E vide, source 'derive_E_bloque_D_absurde'
PASS D=1000, E vide → E = 1000 (collé au seuil, toujours dérivable)
PASS D=1, E vide → E vide, source 'non_derive'
PASS D=12, E=6 → E = 6, source nulle (jamais écrasé)
PASS Le modèle contient bien les lignes E vide et les lignes E renseigné
PASS Aucune ligne de l'exemplaire n'est perdue à la génération
PASS Toutes les lignes à E vide et 1 < D ≤ 1000 sont dérivées (E = D)
PASS Les lignes à D > 1000 ne sont pas dérivées (E reste vide)
PASS Aucune ligne à E renseigné n'est modifiée
PASS Aucune ligne à D=1 n'est dérivée (E reste vide)
PASS Aucun colisage D n'est modifié
PASS Traces : derive_E sur les dérivées, derive_E_bloque_D_absurde sur les bloquées
```

Les 4 cas unitaires demandés par le prompt sont les lignes « D=12, E vide », « D=4000, E vide »,
« D=1, E vide », « D=12, E=6 ». Les 11 vérifications E-DERIVE du tour précédent restent présentes
et vertes (18 = 11 + les nouvelles).

```
$ node tests/regressions-cdg.mjs            → exit 0, 6 PASS (inchangé)
$ npx vite build                            → ✓ built in 4.50s, exit 0
```

Sortie des preuves du même test :

```
lignes de l'exemplaire retenues = 318 (noms distincts : 317)
lignes générées dans Inventaire Initial = 318
E vide dans l'exemplaire = 203 ; E renseigné = 115
E vide et D > 1 (dérivables) = 181 ; E vide et D ≤ 1 (non dérivables) = 22
seuil garde-fou = 1000 ; dérivables ≤ seuil = 177 ; bloquées (D > seuil) = 4
lignes du classeur avec E = D et D > 1 = 177
traces conditionnement_source = derive_E = 177
```

Les `console.warn` des 4 lignes bloquées apparaissent bien à l'exécution (et 47 dans le test
`regressions-cdg.mjs`, qui alimente `buildModelesWb` avec les 523 articles du référentiel
au lieu des seules 318 lignes du modèle — même signal, population plus large).

---

## 6. Recommandation à Aristide (prête à coller dans le mail)

> **Colisages à corriger dans le fichier CDG (`exemple inventaire.xlsx`, feuille `inventaire`).**
> La dérivation automatique de la colonne E (« Nb articles / inner ») depuis le colisage est
> **bloquée** pour les articles dont le colisage dépasse 1000 : sur ces lignes, un « Inner »
> saisi risquerait d'être multiplié par un colisage faux (ex. 11 inners × 4000 = 44 000 pièces).
> Merci de confirmer ou corriger les 4 lignes suivantes, puis de nous renvoyer le fichier :
>
> | Ligne | Article | Code | Colisage actuel | Question |
> |---|---|---|---|---|
> | 115 | DOSETTE KETCHUP PORTION - 10GR | 518852 | **1500** | 1500 dosettes par carton ? |
> | 225 | SACHET FRITES PETIT 4000 | SFP4000 | **4000** | 4000 sachets par carton, ou 4000 = référence ? |
> | 230 | SACHET SNACK MOYEN 2000 | SSM30700 | **2000** | code identique à la ligne 231 avec un colisage différent : un des deux est faux |
> | 231 | SACHET SNACK MOYEN 4000 | SSM30700 | **4000** | idem |
>
> En attendant, ces 4 lignes restent **sans inner dérivé** (colonne E vide) : si un magasin y
> saisit des inners, la quantité ne sera pas comptabilisée. Les 177 autres lignes à E vide ont
> bien été recalées sur E = colisage, les 115 lignes déjà renseignées sont intactes, et aucun
> colisage n'a été modifié.

Pour information : le référentiel complet contient 52 articles à D > 1000 (43 en Packaging,
jusqu'à 10 000). Seules les 4 lignes ci-dessus touchent le modèle d'inventaire ; les autres
n'entrent pas dans les 318 lignes et ne sont pas affectées.

---

## 7. Méthode et intégrité

- Modèle alimenté comme en production : les 318 lignes de `frontend/public/exemple inventaire.xlsx`
  (mêmes champs `nom/code/categorie/conditionnement/qteInner/unite` que
  `BaseArticlesTab.orderArticlesByInventoryExample`), puis `buildModelesWb`, puis relecture de la
  feuille « Inventaire Initial » générée.
- Appariement ligne à ligne occurrence par occurrence : deux lignes de l'exemplaire partagent le
  libellé `SANITIZER TABLETTE ` (318 lignes, 317 noms distincts) ; un appariement par nom seul
  rapprocherait deux articles différents et ferait échouer les vérifications à tort.
- `parseSuivisStock` rejoué sur le classeur généré (sonde A/B) pour la mesure d'impact §3 —
  la variante « E = 0 » simule l'état avant E-DERIVE sur **le même fichier**.
- Fichiers du CDG non modifiés (`exemple inventaire.xlsx`, `BASE ARTICLE SIA.xlsx`,
  `RATIOS BURGER KING ABJ Q3 2026.xlsx`), base `backend/data.db` non touchée, **rien commité**.
- Code touché : uniquement `frontend/src/utils/excelExporter.js` (constante + fonction + 3 lignes
  dans la boucle Inventaires). Test ajouté : `frontend/tests/derive-inner-colisage.mjs`.
  Sonde : `frontend/tests/tmp_edrive_roundtrip.mjs`.
- Le correctif n'est **pas déployé** sur le prod VPS (vmi2774944) ; les classeurs déjà remplis par
  les magasins doivent être régénérés pour bénéficier de la règle.
