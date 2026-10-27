# PRD : BK Écart Matières

**Version** : v1.0
**Auteur** : [待填写 — à compléter]
**Date** : 2026-10-23
**Statut** : Draft (document rétro-actif : rédigé par analyse du code existant)
**Type de produit** : Outil interne (contrôle de gestion / restauration)

---

## 1. Contexte et objectifs

### 1.1 Contexte
Burger King Abidjan gère un réseau de restaurants dont le contrôle des pertes de matières premières repose sur des classeurs Excel de suivi de stock, manipulés manuellement chaque mois. Avant cet outil :

- Les modèles de suivi sont re-créés à la main, avec des incohérences de listes d'articles, de prix et de colonnage entre restaurants.
- Le calcul de l'écart matières (consommation théorique issue des ventes PMIX vs mouvements réels d'inventaire et de transferts) est fait hors système, sans traçabilité.
- Le circuit de validation CDG → DAF → DG se fait par email/classeur partagé, sans historique des actions ni commentaires.

Sans outil centralisé : écarts non détectés, coûts matières non fiables, validation sans piste d'audit. Avec : génération normalisée des classeurs, calcul automatique de l'écart par article et par produit fini, et workflow de validation horodaté.

### 1.2 Utilisateur cible

| Rôle | Profil | Besoin central | Scénario d'utilisation |
|---|---|---|---|
| **CDG** (Contrôle de Gestion) | Administrateur fonctionnel, expert Excel/metiers stock | Préparer et contrôler les fichiers mensuels, créer les rapports | Début de mois : génère les modèles pour chaque restaurant, fin de mois : saisie/reception des fichiers remplis, import, vérification de l'écart, soumission au DAF |
| **DAF** | Validation de premier niveau | Examiner un rapport soumis, approuver ou rejeter avec commentaire | En début de période de clôture, traite la file « Soumis au DAF » |
| **DG** | Validation de second niveau + vision réseau | Synthèse consolidée multi-restaurants, arbitrage des écarts significatifs | Consulte la Synthèse Réseau, valide/rejette les rapports approuvés par le DAF |
| **Admin** | Support technique | Débloquer un dossier, corriger les référentiels | Transitions forcées dans le respect de la machine à états |

### 1.3 Objectifs métier et indicateurs de succès

| Objectif | Indicateur de succès | Valeur cible | Moyen de suivi |
|---|---|---|---|
| Supprimer la re-création manuelle des modèles | Temps de préparation mensuel CDG | [À compléter] | Enquête CDG |
| Fiabiliser l'écart matières | % de rapports validés sans correction après réimport | [À compléter] | Historique des transitions |
| Traçabilité de la validation | 100 % des transitions horodatées avec acteur + commentaire | 100 % | Table d'historique workflow |
| Détection des anomalies | Nombre d'articles « anomalie » (écart < 0 ou > seuil) identifiés par rapport | Pilotage mensuel [À compléter] | Onglet Écart produits |

---

## 2. Périmètre des besoins

Générer, importer, calculer et valider mensuellement l'écart matières de chaque restaurant du réseau, avec référentiels centralisés (articles, ratios PMIX) et circuit de validation CDG → DAF → DG.

---

## 3. Conception fonctionnelle détaillée

### 3.1 Authentification et rôles
**Description** : connexion par identifiant/mot de passe ; 4 rôles (cdg, daf, dg, admin) qui pilotent navigation et droits d'action.
**User story** : En tant que membre du service financier, je veux me connecter avec mon compte pour n'accéder qu'aux actions de mon rôle.
**Priorité** : P0

**Règles métier** :
1. Chaque compte porte un rôle unique parmi cdg / daf / dg / admin.
2. Les actions d'écriture référentiels et de création/édition de rapport sont réservées cdg (et admin).
3. Toute action API non publique exige un jeton de session valide ; le rôle est re-vérifié côté serveur pour chaque transition et chaque écriture.
4. Le DG arrive par défaut sur la Synthèse Réseau ; les autres rôles sur le Tableau de bord.

**Exception** :
| Cas | Comportement | Message |
|---|---|---|
| Jeton absent/expiré | Refus 401, retour à l'écran de connexion | Session invalide |
| Rôle insuffisant | Refus 403 | « Réservé aux rôles : … » |

### 3.2 Référentiel articles (Base articles)
**Description** : consulser, rechercher, paginer et éditer le référentiel des matières (code, nom, catégorie, unité, conditionnement nb/carton et nb/inner, prix carton, prix pièce, statut, actif, ordre d'affichage, source).
**User story** : En tant que CDG, je veux maintenir une base articles unique et à jour pour que tous les restaurants partent du même référentiel.
**Priorité** : P0

**Règles métier** :
1. Sources d'enrichissement possibles : import d'une base articles (fichier Excel colonnes A–H), synchronisation depuis la feuille « WA Landed Cost » du fichier Ratios, base locale (prix du restaurant), coûts PMIX complémentaires, saisie manuelle.
2. Dédoublonnage automatique : un même article (clé code/nom canonic) ne peut exister en double ; la meilleure ligne est conservée selon un score de complétude (code, nom, catégorie, conditionnement, prix réel, prix non nuls, actif).
3. Les prix nul-vs-0 : une ligne avec pu_carton = 0 et pu_piece = 0 est normalisée en prix vides (pas de prix fantôme).
4. Un article désactivé (actif = 0) sort des modèles générés mais reste dans la base.
5. La résolution de prix pour les calculs suit l'ordre : WA Landed Cost → correspondance ratio → WA → coût moyen pondéré par ingrédient (PMP) → base articles (conditionnement) → inconnu.
6. [Écart documenté] La liste des articles des modèles générés est aujourd'hui **restreinte aux lignes du fichier « exemple inventaire.xlsx »** (318 lignes, audit du 24/10) ; ≈ 50 % des articles actifs de la base (308/621 après dédoublonnage) n'y figurent pas et sont donc exclus des classeurs. Décision de remédiation en attente du CDG (voir §8 Risques R1).

**Exception** :
| Cas | Comportement | Message |
|---|---|---|
| Import d'un fichier sans aucune ligne exploitable | Refus d'écrasement du référentiel en place | Alerte explicite (garde anti-écrasement silencieuse) |
| Code inexistant ajouté manuellement | Création possible, article signalé sans prix | Champs prix vides |

### 3.3 Référentiel Ratios PMIX
**Description** : charger le fichier trimestriel « RATIOS BURGER KING » (recettes standard : PLU produit fini, ingrédients et quantités, coûts, ratios, prix de vente) ; il alimente le calcul théorique et la liste des produits PMIX.
**User story** : En tant que CDG, je charge le Ratio du trimestre et l'app conserve la date/label de la version utilisée.
**Priorité** : P0

**Règles métier** :
1. Le fichier doit contenir des produits ; un fichier analysé à 0 produit est rejeté (ne remplace jamais un ratio valide).
2. Les produits du ratio (par ex. 104) portent : PLU, nom, prix de vente TTC, coût théorique, blocs formats/combos (le coût d'un menu = produit + frites + boisson).
3. Les coûts de recettes combinent prix carton/PMP et compléments PMIX importés séparément (coût seul, priorité au Ratio en cas de conflit).
4. Les lignes « hors matière » (ex. GLOVO, JOUET, NO Sauce) sont exclues du calcul d'écart.

### 3.4 Génération des classeurs de suivi (modèles)
**Description** : générer pour un restaurant et une période (mois) le classeur Excel de suivi stock avec le logo, ou un ZIP de plusieurs restaurants, ou un modèle vierge.
**User story** : En tant que CDG, je génère en un clic les classeurs normalisés pour tous les restaurants du mois.
**Priorité** : P0

**Feuilles produites** :
1. **Inventaire Initial** et **Inventaire Final** — liste articles (désignation, catégorie, code, conditionnements, unité, prix, colonnes quantité saisissables), tableaux figés.
2. **Transferts** — saisie des entrées/sorties lignes par jour du mois (en-têtes 1..31), 500 lignes pré-remplies côté article, récaps Somme/Sommetif N et O avec cumul et total.
3. **Pertes** — pertes par produit fini avec prix pièce, calculs journaliers (produit × prix), CA HT du jour saisi, ratio perte/CA.
4. **P.Douane** et **Offert** — catégories particulières hors flux normal.
5. **Référentiel PMIX** et **Référentiel Articles** — masquées, servent de base de calcul.
6. Le nom du restaurant et la période figurent en tête de chaque feuille ; logo BK/Servair en haut à gauche de chaque feuille visible, titre à 1 cm du logo.

**Règles métier** :
1. Les prix écrits proviennent de la base articles au moment de la génération (prix carton, et prix pièce quand connu).
2. Les colonnes calculées portent de vraies formules Excel et doivent se recalculer à l'ouverture (recalcul complet forcé).
3. L'ordre des articles suit celui du modèle de référence « exemple inventaire » (et l'ordre d'affichage de la base).
4. La liste d'articles est celle du modèle de référence (voir règle 6 de §3.2 — limitation connue).

**Exception** :
| Cas | Comportement | Message |
|---|---|---|
| Fichier modèle de référence indisponible | Génération interrompue | « Le fichier exemple inventaire.xlsx est indisponible. » |
| Ratio non chargé | Génération possible mais référentiel PMIX signalé vide | Avertissement + invitation à charger les Ratios |

### 3.5 Import des fichiers remplis et calcul de l'écart
**Description** : importer le classeur complété par le restaurant (ou plusieurs fichiers d'un coup pour un rapport multi-restaurants), calculer l'écart matières et créer le rapport.
**User story** : En tant que CDG, je dépose le fichier rempli et l'app me sort l'écart en valeur et en pourcentage, article par article.
**Priorité** : P0

**Règles métier** :
1. Quantités réelles = Inventaire Initial + Transferts (entrées/sorties, y compris lignes sans date) − Inventaire Final.
2. Quantités théoriques = ventes de chaque produit fini (PLU) × quantités d'ingrédients du Ratio, addition des théoriques des produits achetés/offerts/douane.
3. Écart = consommation réelle − consommation théorique, valorisé en FCFA via la résolution de prix (§3.2-5) ; % = écart / coût théorique.
4. Un écart **négatif est une anomalie de traçabilité** (réceptions non tracées, erreurs d'inventaire) : jamais traité comme une performance, jamais mis en valeur absolue ni plafonné à 0.
5. Classement par seuils : excellent / à améliorer / anomalie (danger) selon le % d'écart ; les lignes sans consommation ni écart exploitable ne sont pas comptées comme anomalies.
6. Les catégories hors périmètre matières (Produits de Nettoyage, Packaging pour les pertes ; lignes hors matière du ratio) sont exclues des calculs concernés.
7. Les fichiers acceptés à l'import : formats générés par l'app et fichiers de pilotage externes (géométries multiples reconnues par l'analyseur).
8. Un rapport porte : restaurant (ou liste de restaurants), période, données de stock, résultats de calcul, statut workflow.

**Exception** :
| Cas | Comportement | Message |
|---|---|---|
| Onglet attendu absent ou illisible | Import refusé pour ce fichier, autres fichiers du lot non bloqués | Détail de l'échec par fichier |
| Prix inconnu pour un article | Ligne conservée, valeur monétaire non calculée, source de prix « inconnu » tracée | Visible dans le détail |
| Écart global négatif important | Rapport généré avec avertissement de traçabilité | Expliquer via réceptions non saisies aux Transferts |

### 3.6 Circuit de validation (workflow)
**Description** : machine à états à 7 statuts, portée côté serveur, avec historique complet.
**User story** : En tant que DAF, j'approuve ou rejette avec commentaire ; en tant que DG, je vois les rapports approuvés par le DAF.
**Priorité** : P0

**Transitions autorisées** (source de vérité serveur) :

| Action | Rôle | Depuis | Vers |
|---|---|---|---|
| Soumettre au DAF | cdg | Brouillon | Soumis au DAF |
| Approuver | daf | Soumis au DAF | Approuvé DAF |
| Rejeter | daf | Soumis au DAF | Rejeté DAF |
| Soumettre au DG | daf | Approuvé DAF | Soumis au DG |
| Valider | dg | Soumis au DG | Validé DG |
| Rejeter | dg | Soumis au DG | Rejeté DG |
| Corriger (rouvrir) | cdg | Rejeté DAF / Rejeté DG | Brouillon |

**Règles métier** :
1. Chaque transition est horodatée, enregistrée avec acteur (rôle) et commentaire dans l'historique du rapport.
2. L'admin peut forcer une action **valide** (jamais une transition impossible) pour débloquer un dossier.
3. L'édition d'un rapport n'est permise au CDG que tant qu'il est en Brouillon (hors admin).
4. La suppression : admin, ou CDG si Brouillon.
5. Les boutons disponibles sont calculés côté serveur par rapport (statut × rôle) et rendus tels quels.

**Exception** :
| Cas | Comportement | Message |
|---|---|---|
| Transition depuis un statut incorrect | Refus 409 | « Transition impossible depuis « X » » |
| Mauvais rôle | Refus 403 | « Action « X » réservée au rôle Y » |

### 3.7 Consultation et analyse
**Description** : tableaux et onglets de lecture selon le rôle.
**User story** : En tant que DG, je consulte la Synthèse Réseau ; en tant que CDG, je compare deux périodes et je creuse l'écart par produit.
**Priorité** : P1

Modules :
1. **Tableau de bord** : file d'attente personnelle (rapports nécessitant une action selon rôle/statut), accès actions CDG, mémos référentiels chargés (label/date Ratios, base article, base locale, coûts PMIX).
2. **Détail rapport** : résultats écart, onglet **Écart produits** (par produit fini), export Excel des résultats.
3. **Synthèse Réseau** (DG) : consolidation multi-restaurants de la période.
4. **Comparaison** : évolution d'un rapport vers une autre période.
5. **Historique** : liste des rapports passés avec statut ; vue détaillée d'un rapport archivé (HistView).
6. **Guidage d'onboarding** : étapes affichées selon le rôle (ex. CDG : « Commencez par les Ratios »).

### 3.8 Fiches LTO (produits temporaires)
**Description** : charger des fiches techniques de produits LTO pour intégrer leurs recettes aux calculs.
**User story** : En tant que CDG, j'ajoute la fiche d'un produit promotionnel pour que sa consommation soit théoriquement calculée.
**Priorité** : P2 — [À compléter : règles détaillées à confirmer avec le CDG]

---

## 4. Exigences non fonctionnelles

| Catégorie | Exigence | Critère d'acceptation |
|---|---|---|
| Performance | Import de fichiers lourds (jusqu'à 20 000 lignes de transferts) | Import unitaire accepté jusqu'à 25 Mo ; pas de timeout à l'échelle mensuelle réseau |
| Compatibilité | Classeurs produits lisibles et recalculés dans Excel (poste de gestion) | Formules calculées à l'ouverture (recalcul forcé), valeurs jamais figées |
| Présentation | Identité visuelle sur chaque feuille produite | Logo présent en A1, titre à 1 cm, tableaux figés, colonnage stable |
| Sécurité | Secrets et données hors dépôt ; accès par jeton | Comptes/mots de passe et base jamais exposés dans le code livré ; 401/403 systématiques |
| Auditabilité | Piste d'audit du workflow | Historique complet statut/acteur/date/commentaire consultable |
| Disponibilité | Outil interne sur serveur local/hébergé | [À compléter : SLA interne] |

---

## 5. Exigences relatives aux données

| Événement | Déclencheur | Attributs clés | Finalité |
|---|---|---|---|
| Creation rapport | Import réussi | restaurant(s), période, écart FCFA, écart %, nb anomalies | Suivi activité CDG |
| Transition workflow | Action sur rapport | rapport, action, rôle acteur, commentaire, durée depuis statut précédent | Délais de validation |
| Chargement Ratios | Import ratio | label, date, nb produits, nb ingrédients | Fraîcheur du référentiel |
| Chargement base articles | Sync/import | nb articles, nb sans prix, source | Complétude référentiel |
| Génération modèle | Clic CDG | restaurant, nb articles, nb lignes sans prix | Couverture du référentiel |

(Interne : journaux d'audit base de données ; pas d'analytics produit grand public.)

---

## 6. Critères d'acceptation (Given-When-Then)

| # | Scénario | Given | When | Then |
|---|---|---|---|---|
| AC1 | Connexion par rôle | Compte DAF actif | Connexion | Navigation sans actions CDG ; file « Soumis au DAF » visible |
| AC2 | Génération modèle | Base + Ratios chargés, restaurant sélectionné, période = mois | Clic Générer | Classeur contenant les 10 feuilles attendues, logo sur chaque feuille visible, tableaux figés, articles dans l'ordre de référence |
| AC3 | Recalcul à l'ouverture | Classeur généré | Ouverture dans Excel | Colonnes calculées affichent des valeurs (non vides) |
| AC4 | Import fichier rempli | Classeur complet (inventaires + transferts + ventes) | Import par le CDG | Rapport créé en Brouillon avec écart FCFA, écart %, listes d'anomalies par article et par produit |
| AC5 | Transfert sans date | Fichier avec lignes Transferts sans date | Import | Quantités comptées quand même, écart impacté |
| AC6 | Écart négatif | Réel > théorique global | Calcul | Écart affiché négatif, classé anomalie, sans valeur absolue |
| AC7 | Workflow complet | Rapport Brouillon | CDG soumet → DAF approuve → DAF soumet → DG valide | Statuts successifs corrects, historique avec 4 entrées horodatées |
| AC8 | Rejet et réouverture | Rapport Rejeté DAF | CDG cliquet « Corriger » | Retour Brouillon, édition à nouveau possible |
| AC9 | Transition illégale | Rapport Approuvé DAF | DG tente « Valider » | Refus 409 « Transition impossible depuis Approuvé DAF » |
| AC10 | Anti-écrasement ratio | Ratios valides en base | Import d'un fichier à 0 produit | Refus explicite, ratio conservé |
| AC11 | Dédoublonnage articles | Deux lignes même code/nom | Sync base articles | Une ligne fusionnée, meilleure complétude/prix conservés |
| AC12 | Prix 0 neutralisé | Article avec pu_carton=0 et pu_piece=0 | Ouverture base | Prix affichés vides, non zéro |

---

## 7. Planification

| Phase | Contenu estimé | Effort | Dépendances | Risques |
|---|---|---|---|---|
| MVP (existant consolidé) | Auth, référentiels, génération, import+calcul, workflow, tableaux de bord | Déjà développé — stabilisation & recette [À compléter] | Fichiers réels CDG | Couverture base articles (R1) |
| V1.1 | Décision liste modèles (règle §3.2-6), alias d'appariement (SEL Local, PEPSI…), réimport ratio officiel | ~1 semaine dev + recette CDG | Arbitrage CDG | Changement d'apparence des classeurs |
| V1.2 | Fiches LTO industrialisées, comparaison multi-périodes enrichie, hygiène d'import (lignes TOTAL/en-tête) | [À compléter] | Données LTO | — |

---

## 8. Risques et dépendances

| # | Risque | Probabilité | Impact | Atténuation |
|---|---|---|---|---|
| R1 | **Couverture du référentiel dans les modèles** (audit automatique) : liste des classeurs = 318 lignes de l'exemple de référence ; 308/621 articles actifs dédupliqués exclus ; 6 lignes de référence non appariées ; 31 lignes appariées sans prix carton | Élevé (constaté) | Écarts sous-estimés, articles non suivis | Décision CDG à trancher : référentiel complet trié, union, ou corrections d'appariement — voir §7 V1.1 |
| R2 | Ratio en base restauré depuis un échantillon (Q1) et non depuis le fichier officiel le plus récent | Moyen | Coûts théoriques faux | Réimport « Ratios » recommandé + mémo label/date affiché |
| R3 | Réceptions directes Produits de Nettoyage/Packaging non tracées → écart réseau négatif (constaté −41 % sur un restaurant) | Élevé | Fausse lecture de la performance | Arbitrage métier en attente : saisir dans Transferts OU exclure ces catégories |
| R4 | Différence base de production vs base locale (320 articles prod vs 621 locaux) | Moyen | Résultats différents selon l'environnement | Procédure de re-dérivation + vérification croisée |
| R5 | Qualité des fichiers remplis à la main (dates manquantes, géométries dérivées) | Moyen | Imports incomplets | Analyseurs multi-format + messages d'erreur par fichier |
| R6 | Dépendance Excel/SheetJS : les formules ne sont pas évaluées à l'écriture | Faible | Valeurs vides à l'ouverture | Recalcul forcé à l'ouverture (mis en place, testé) |

**Dépendances** : fichiers Références (Ratio trimestriel, exemple inventaire, fiches LTO) fournis par le CDG ; accès au serveur interne ; comptes utilisateurs créés par l'admin.

---

## Annexe
- **Périmètre exclu de ce PRD** : choix techniques d'implémentation (stack, formats, hébergement) — le produit s'appuie sur l'implémentation existante (application web locale + Docker de production, détails dans le code).
- **Constantes métier** : seuils de classement de l'écart, catégories hors périmètre (Produits de Nettoyage, Packaging), lignes hors matière (GLOVO, JOUET, NO Sauce).
- **[À compléter]** : objectifs chiffrés CDG, SLA interne, règles détaillées des fiches LTO.

---

## Auto-contrôle qualité du PRD

| # | Élément de contrôle | Verdict |
|---|---|---|
| 1 | Contexte non générique (pourquoi maintenant) | ✅ |
| 2 | Objectifs chiffrés | ⚠️ partiels — métriques non fournies par l'utilisateur → [À compléter] |
| 3 | Personas concrets | ✅ (4 rôles nommés) |
| 4 | Règles métier exhaustives | ✅ sur les modules observés ; LTO marqué à confirmer |
| 5 | Couverture des cas d'exception | ✅ ≥2 par module P0/P1 |
| 6 | Critères d'acceptation testables | ✅ 12 en Given-When-Then, rejouables sur la chaîne actuelle |
| 7 | Exigences données complètes | ✅ (événements internes ; pas de parcours client à instrumenter) |
| 8 | Pas de solution technique | ✅ (la stack n'apparaît qu'en annexe/contexte) |
| 9 | Priorités définies | ✅ P0/P1/P2 |
| 10 | Planification justifiée | ⚠️ efforts à compléter pour V1.2 (produit déjà développé en grande partie) |
