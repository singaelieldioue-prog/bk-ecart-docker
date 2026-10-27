import { norm } from './formatters.js';
import { PMIX_HORS_MATIERE, estCategorieHorsEcart } from '../constants.js';

// Renvoie map[NORM(désignation ratio)] = { code, statut, qteCdt, pmpCarton, puPiece }.
// localArticles : optionnel — base d'articles locaux complémentaires au Ratio
export function resoudrePrix(nomStock, baseArticle, ratios, localArticles){
  const k=norm(nomStock);
  const baseEntry=baseArticle[k];
  const withCdtFallback=(obj)=> obj.qteCdt ? obj : {...obj, qteCdt: baseEntry?.cdt||1};
  // 1. Direct dans WA Landed Cost
  if(ratios.waLandedCost[k]) return {...withCdtFallback(ratios.waLandedCost[k]),source:"WA Landed Cost"};
  // 2. Via corresponRatio dans BASE_ARTICLE → WA Landed Cost
  if(baseEntry?.corresponRatio){
    const kc=norm(baseEntry.corresponRatio);
    if(ratios.waLandedCost[kc]) return {...withCdtFallback(ratios.waLandedCost[kc]),source:"Base article → WA"};
  }
  // 3. Base article local (articles absents du Ratio mais avec prix défini)
  if(localArticles && localArticles[k]){
    const loc=localArticles[k];
    return {puPiece:loc.puPiece,pmpCarton:loc.pmpCarton,qteCdt:loc.cdt||baseEntry?.cdt||1,source:"Base locale"};
  }
  // 4. Via code Bolloré dans la base locale
  if(localArticles && baseEntry?.codeBollore){
    const codeKey=norm(baseEntry.codeBollore);
    const byCode=Object.values(localArticles).find(a=>a.code && norm(a.code)===codeKey);
    if(byCode) return {puPiece:byCode.puPiece,pmpCarton:byCode.pmpCarton,qteCdt:byCode.cdt||baseEntry?.cdt||1,source:"Base locale (code)"};
  }
  // 5. Via pmpByIng (article = ingrédient direct dans recettes)
  if(ratios.pmpByIng[k]) return {puPiece:ratios.pmpByIng[k],pmpCarton:null,qteCdt:baseEntry?.cdt||1,source:"PMP ingrédients"};
  // 6. Conditionnement depuis BASE_ARTICLE uniquement (prix inconnu)
  if(baseEntry) return {puPiece:null,pmpCarton:null,qteCdt:baseEntry.cdt||1,source:"BASE (prix inconnu)"};
  return {puPiece:null,pmpCarton:null,qteCdt:1,source:"inconnu"};
}

// Statut d'un PLU vendu. Un coût nul ou absent est bloquant : il ne peut jamais passer « OK »,
// sinon un PLU vendu sans valorisation disparaît silencieusement de la consommation théorique.
export function statutPluPmix({ trouve = true, coutUnit = null } = {}){
  if(!trouve) return "PLU ABSENT DU RATIO";
  if(coutUnit == null || !Number.isFinite(Number(coutUnit)) || Number(coutUnit) <= 0) return "COÛT NUL";
  return "OK";
}

function agregerParPlu(list, totalVentes){
  const parPlu=new Map();
  (list||[]).forEach(p=>{
    const k=String(p.plu);
    const s=parPlu.get(k)||{...p,qty:0};
    s.qty+=Number(p.qty)||0;
    parPlu.set(k,s);
  });
  return [...parPlu.values()].map(p=>({...p,partVentes:totalVentes>0?p.qty/totalVentes:0}));
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── PARSEUR SUIVI STOCK ──────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
// pmixComplement : PLU → { nom, cout }, issu de la base complémentaire PMIX (mémorisée).
// Sert de coût unitaire pour les PLU sans fiche technique Ratio ; jamais d'ingrédient.
export function calculer(stockData, pmixList, ratios, baseArticle={}, pmixComplement={}){
  const {invIni,invFin,sorties,pertes}=stockData;

  // ── Flux stock (RG-03 v3.0) ───────────────────────────────────────────────
  // Formule officielle : Conso Réelle = Variation de stock + Transferts
  // Variation de stock = Stock Initial − Stock Final
  // Les PERTES sont HORS flux stock (traitées séparément)
  const totalValIni  = Object.values(invIni).reduce((s,a)=>s+a.valeur,0);
  const totalValFin  = Object.values(invFin).reduce((s,a)=>s+a.valeur,0);
  const totalEntrees = sorties.reduce((s,x)=>s+x.valeur,0);
  const totalPertes  = pertes.reduce((s,x)=>s+x.valeur,0);
  const variationStock = totalValIni - totalValFin;          // Variation de stock
  const consoReelle    = variationStock + totalEntrees;      // RG-03 v3.0 : SANS pertes
  const totalOfferts = Object.values(stockData.offerts||{}).reduce((s,o)=>s+o.total,0);

  // C-10 / C-12 : écarts entre le prix saisi dans le classeur et le prix du référentiel, et
  // lignes qu'aucun prix ne valorise. Signalés, jamais corrigés en silence : le choix du prix
  // relève du CDG, pas de l'application.
  const ecartsPrix=[], valorisationsBloquees=[];
  const tracerPrixInventaire=(origine, map)=>{
    Object.values(map||{}).forEach(a=>{
      if(a.ecartPrix) ecartsPrix.push({origine, nom:a.nom, qte:a.qtePieces||0, puSaisi:a.puSaisi, puRef:a.puRef, ...a.ecartPrix});
      if(a.valorisationBloquee) valorisationsBloquees.push({origine, nom:a.nom, qte:a.qtePieces||0});
    });
  };
  tracerPrixInventaire("Inventaire initial", invIni);
  tracerPrixInventaire("Inventaire final", invFin);
  (pertes||[]).forEach(p=>{
    if(p.ecartPrix) ecartsPrix.push({origine:"Pertes", nom:p.nom, qte:p.qtePieces||0, puSaisi:p.puSaisi, puRef:p.puRef, ...p.ecartPrix});
    if(p.valorisationBloquee) valorisationsBloquees.push({origine:"Pertes", nom:p.nom, qte:p.qtePieces||0});
  });
  // Doublons et défauts d'intégrité lus dans le classeur : signalés, jamais fusionnés.
  const doublonsInventaire=stockData.doublonsInventaire||[];
  const anomaliesIntegrite=stockData.anomaliesIntegrite||[];

  // ── Consommation théorique (PMIX × fiches techniques) ─────────────────────
  let consoTheoTotal=0, couverts=0, ficheMatchees=0;
  let complementMatchees=0, consoTheoComplement=0;
  const consoParIng={};  // ing_norm → {nom,qteTotal,valeurTotal,pmp}
  const pmixTheo=[];     // [{plu,nom,qty,coutTheo,coutUnit,match,source,horsMatiere}]

  if((ratios||Object.keys(pmixComplement).length>0)&&pmixList.length>0){
    pmixList.forEach(pmix=>{
      pmix.items.forEach(item=>{
        couverts+=item.qty;
        // La fiche Ratio reste autoritaire ; la base complémentaire PMIX ne fournit qu'un
        // coût unitaire (pas de recette), donc rien n'entre dans consoParIng pour elle.
        const fiche=ratios?(ratios.byPlu[item.plu]||ratios.byNom[norm(item.nom)]):null;
        const comp=fiche?null:pmixComplement[String(item.plu).trim()];
        const coutUnit=fiche?fiche.coutTheo:(comp?comp.cout:null);
        const ct=coutUnit!=null?coutUnit*item.qty:0;
        consoTheoTotal+=ct;
        if(fiche){ficheMatchees++;
          fiche.coutParIng.forEach(({ing,qty,pmp,valeur})=>{
            const qT=qty*item.qty; const vT=valeur*item.qty;
            const k=norm(ing);
            if(!consoParIng[k]) consoParIng[k]={nom:ing,qteTotal:0,valeurTotal:0,pmp};
            consoParIng[k].qteTotal+=qT; consoParIng[k].valeurTotal+=vT;
          });
        } else if(comp){
          complementMatchees++; consoTheoComplement+=ct;
        }
        pmixTheo.push({plu:item.plu,nom:item.nom,qty:item.qty,price:item.price||0,amount:item.amount||((item.price||0)*item.qty),
          coutTheo:ct,coutUnit,match:!!(fiche||comp),statut:statutPluPmix({trouve:!!(fiche||comp),coutUnit}),
          horsMatiere:!(fiche||comp)&&!!PMIX_HORS_MATIERE[String(item.plu).trim()],
          source:fiche?"ratio":(comp?"complement":null),categorie:fiche?.categorie||""});
      });
    });
  }

  // ── PLU non matchés (anomalies) ───────────────────────────────────────────
  // Les lignes hors matière (PMIX_HORS_MATIERE) en sont exclues : aucune fiche n'a lieu
  // d'exister pour elles, ce serait une anomalie permanente.
  const pluNonMatchés = pmixTheo.filter(p=>!p.match&&!p.horsMatiere);
  const pluHorsMatiere = pmixTheo.filter(p=>p.horsMatiere);

  // ── PLU à coût nul (C-09 / C-13) ──────────────────────────────────────────
  // Coût résolu nul ou absent : la ligne est vendue mais ne contribue pas à la conso théorique.
  // On l'agrège par PLU (un PLU peut apparaître sur plusieurs lignes du PMIX) et on mesure sa
  // part des ventes, pour chiffrer l'impact sur le coût moyen par couvert.
  const pluCoutNul = agregerParPlu(pmixTheo.filter(p=>p.statut==="COÛT NUL"), couverts);
  const qtyCoutNul = pluCoutNul.reduce((s,p)=>s+p.qty,0);
  const coutMoyenAvec = couverts>0 ? consoTheoTotal/couverts : 0;
  const coutMoyenSans = (couverts-qtyCoutNul)>0 ? consoTheoTotal/(couverts-qtyCoutNul) : 0;

  // Doublons de PLU dans les ventes : deux lignes pour un même PLU faussent la lecture par PLU.
  const pmixDoublons = (()=>{
    const m=new Map();
    pmixTheo.forEach(p=>{
      const k=String(p.plu);
      const s=m.get(k)||{plu:p.plu,nom:p.nom,lignes:0,qty:0};
      s.lignes++; s.qty+=Number(p.qty)||0;
      m.set(k,s);
    });
    return [...m.values()].filter(d=>d.lignes>1);
  })();

  // Référentiel : PLU à coût nul (distincts des PLU à 0 du PMIX). Sans le référentiel, non calculé.
  const ratioPluCoutNul = ratios?.byPlu ? Object.values(ratios.byPlu).filter(f=>!(Number(f.coutTheo)>0)) : [];
  const ratioCoutNulCount = ratios?.byPlu ? ratioPluCoutNul.length : 0;
  const ratioCoutNulVendus = ratioPluCoutNul.filter(f=>pmixTheo.some(p=>String(p.plu)===String(f.plu))).length;


  // ── Écart matières (RG-06) ────────────────────────────────────────────────
  // Écart = Conso Réelle − Conso Théorique
  // Les pertes entrent dans l'analyse de l'écart mais pas dans la formule directe
  const ca=pmixList.reduce((s,p)=>s+p.items.reduce((ss,i)=>ss+i.amount,0),0);
  const ecartMatiere=consoReelle-consoTheoTotal;
  const ecartMatiereP=consoTheoTotal>0?ecartMatiere/consoTheoTotal:null;

  // ── Décomposition écart matière (spec officielle 29/09) ───────────────────
  // Hypothèses affichées dans le rapport :
  //   Destruction contrôlée = total feuille Pertes
  //   Coût matière vendue   = Conso théorique − staff meal − produits offerts
  const offreList = Object.values(stockData.offerts||{});
  const staffMealTotal        = offreList.reduce((s,o)=>s+(Number(o.staffM)||0),0);
  const offertsProduitsTotal  = offreList.reduce((s,o)=>s+(Number(o.offer)||0),0);
  const coutMatiereVendue     = consoTheoTotal - staffMealTotal - offertsProduitsTotal;
  const destructionControlee  = totalPertes;
  const pertesNonControlees   = consoReelle - consoTheoTotal - destructionControlee;

  // ── Écart par article (RG-07 v3.0) ───────────────────────────────────────
  // Formule corrigée : ventes théoriques intégrées
  // StockThéo = Ini + Transferts (entrées DC) − Ventes théoriques (consoParIng) − Pertes déclarées
  // Écart = StockThéo − Inventaire Final réel
  const articlesEcart={};

  // A-02 / C-11 : les catégories non-matière du paramètre CATEGORIES_HORS_ECART (PMC, IFB,
  // PACKAGING) sortent du calcul d'écart. Elles restent tracées à part pour que le CDG voie
  // ce qui a été écarté — et elles ne comptent plus dans les « articles sans prix ».
  const horsEcartMap=new Map();
  const tracerHorsEcart=(origine,a)=>{
    const k=norm(a.nom);
    const s=horsEcartMap.get(k)||{nom:a.nom,categorie:a.categorie||"",
      iniPieces:0,entreesPieces:0,pertesPieces:0,finPieces:0,
      iniValeur:0,entreesValeur:0,pertesValeur:0,finValeur:0};
    s[`${origine}Pieces`]+=Number(a.qtePieces)||0;
    s[`${origine}Valeur`]+=Number(a.valeur)||0;
    horsEcartMap.set(k,s);
  };

  // Initialiser depuis inventaire initial
  Object.entries(invIni).forEach(([k,a])=>{
    if(estCategorieHorsEcart(a.categorie)){tracerHorsEcart("ini",a);return;}
    articlesEcart[k]={
      nom:a.nom, categorie:a.categorie, qteCdt:a.qteCdt, puPiece:a.puPiece,
      iniPieces:a.qtePieces,
      entreesPieces:0,   // transferts DC → BK
      ventesPieces:0,    // ventes théoriques depuis PMIX × recette (RG-07 v3.0)
      pertesPieces:0,    // pertes déclarées
      finPieces:0,
      stockTheo:0, ecartPieces:0, ecartVal:0
    };
  });

  // Ajouter entrées (transferts AGL → restaurant), converties en pièces
  sorties.forEach(s=>{
    if(estCategorieHorsEcart(s.categorie)){tracerHorsEcart("entrees",s);return;}
    const k=norm(s.designation);
    if(articlesEcart[k]) articlesEcart[k].entreesPieces+=s.qtePieces;
    else articlesEcart[k]={
      nom:s.designation, categorie:s.categorie, qteCdt:s.qteCdt, puPiece:s.puPiece,
      iniPieces:0, entreesPieces:s.qtePieces, ventesPieces:0, pertesPieces:0, finPieces:0,
      stockTheo:0, ecartPieces:0, ecartVal:0
    };
  });

  // Ajouter pertes déclarées (à la pièce)
  pertes.forEach(p=>{
    if(estCategorieHorsEcart(p.categorie)){tracerHorsEcart("pertes",p);return;}
    const k=norm(p.nom);
    if(articlesEcart[k]) articlesEcart[k].pertesPieces+=p.qtePieces;
  });

  // Ajouter ventes théoriques par ingrédient (RG-07 v3.0)
  // consoParIng est indexé par NOM D'INGRÉDIENT (recette) ; articlesEcart par NOM D'ARTICLE STOCK.
  // On tente : (1) correspondance directe, puis (2) via corresponRatio de la BASE ARTICLE
  // (article de stock dont corresponRatio == nom ingrédient). Heuristique — à valider métier.
  const ratioToStock={};
  Object.entries(baseArticle).forEach(([stockKey,e])=>{
    if(e&&e.corresponRatio){ const rk=norm(e.corresponRatio); if(!ratioToStock[rk]) ratioToStock[rk]=stockKey; }
  });
  Object.entries(consoParIng).forEach(([k,v])=>{
    const target = articlesEcart[k] ? k
      : (ratioToStock[k] && articlesEcart[ratioToStock[k]]) ? ratioToStock[k]
      : null;
    if(target){
      articlesEcart[target].ventesPieces+=v.qteTotal;
      // Prix unitaire officiel BK (feuille COST : valeur/qté), utilisé en repli si notre
      // propre prix (Ratio/base article) n'est pas encore résolu pour cet article.
      if(v.pmp>0) articlesEcart[target].puPieceCost=v.pmp;
    }
  });

  // Inventaire final
  Object.entries(invFin).forEach(([k,a])=>{
    if(estCategorieHorsEcart(a.categorie)){tracerHorsEcart("fin",a);return;}
    if(articlesEcart[k]) articlesEcart[k].finPieces=a.qtePieces;
    else if(a.qtePieces>0){
      // Article en fin mais pas en début : créer l'entrée
      articlesEcart[k]={
        nom:a.nom, categorie:a.categorie, qteCdt:a.qteCdt, puPiece:a.puPiece,
        iniPieces:0, entreesPieces:0, ventesPieces:0, pertesPieces:0, finPieces:a.qtePieces,
        stockTheo:0, ecartPieces:0, ecartVal:0
      };
    }
  });

  // Calcul final de l'écart par article (RG-07 v3.0)
  // StockThéo = Ini + Transferts − Ventes théoriques − Pertes
  // Écart = StockThéo − InvFin
  Object.values(articlesEcart).forEach(a=>{
    a.stockTheo   = a.iniPieces + a.entreesPieces - a.ventesPieces - a.pertesPieces;
    a.ecartPieces = a.stockTheo - a.finPieces;
    // Prix effectif : notre propre prix résolu (Ratio/base article) en priorité ;
    // sinon repli sur le prix unitaire officiel de la feuille COST (BK), quand disponible.
    const puEff = a.puPiece>0 ? a.puPiece : (a.puPieceCost>0 ? a.puPieceCost : 0);
    a.puPieceSource = a.puPiece>0 ? "stock" : (a.puPieceCost>0 ? "cost" : "aucun");
    a.ecartVal    = a.ecartPieces * puEff;
  });

  return {
    ca, totalValIni, totalEntrees, variationStock, totalValFin, totalPertes,
    consoReelle, totalOfferts, douaneTotal:stockData.douaneTotal||0,
    consoTheoTotal, couverts, ficheMatchees,
    complementMatchees, consoTheoComplement,
    ecartMatiere, ecartMatiereP,
    coutMatiereVendue, destructionControlee, pertesNonControlees,
    staffMealTotal, offertsProduitsTotal,
    pluNonMatchés,
    pluHorsMatiere,
    pluCoutNul,
    pmixDoublons,
    qtyCoutNul,
    coutMoyenAvec,
    coutMoyenSans,
    ratioCoutNulCount,
    ratioCoutNulVendus,
    ecartsPrix,
    valorisationsBloquees,
    doublonsInventaire,
    anomaliesIntegrite,
    consoParIng: Object.values(consoParIng).sort((a,b)=>b.valeurTotal-a.valeurTotal),
    pmixTheo: pmixTheo.sort((a,b)=>b.qty-a.qty),
    // Tous les articles sans exception (R-03)
    articlesEcart: Object.values(articlesEcart).filter(
      a=>a.iniPieces||a.entreesPieces||a.finPieces||a.ventesPieces||a.pertesPieces
    ),
    // Articles sortis du calcul d'écart par catégorie (paramètre CATEGORIES_HORS_ECART).
    articlesHorsEcart: [...horsEcartMap.values()]
      .map(a=>({...a, qte:a.iniPieces+a.entreesPieces+a.pertesPieces+a.finPieces}))
      .filter(a=>a.qte>0),
  };
}

export function calculerMultiRestaurants(stocksData, pmixLists, ratios, baseArticle={}, pmixComplement={}){
  let totalValIni=0, totalValFin=0, totalEntrees=0, totalPertes=0;
  let totalOfferts=0, douaneTotal=0, ca=0, couverts=0, ficheMatchees=0;
  let complementMatchees=0, consoTheoComplement=0;
  const consoParIngTotal={};
  const pmixTheoTotal=[];
  const parRestaurant=[];
  const allPluNonMatchés=[];
  const allPluHorsMatiere=[];
  const allPluCoutNul=[];
  const allEcartsPrix=[], allValorisationsBloquees=[];
  const allDoublonsInventaire=[], allAnomaliesIntegrite=[];
  const allArticlesHorsEcart=[];

  stocksData.forEach((stockData, idx)=>{
    // pmixLists[idx] est un tableau d'items => on en fait un pmixList standard
    const pmixList = Array.isArray(pmixLists[idx])
      ? (pmixLists[idx][0]?.items ? pmixLists[idx] : [{restaurant:stockData.site||`BK ${idx+1}`,periode:"",items:pmixLists[idx]}])
      : [];
    const calc=calculer(stockData, pmixList, ratios, baseArticle, pmixComplement);
    totalValIni   += calc.totalValIni   ||0;
    totalValFin   += calc.totalValFin   ||0;
    totalEntrees  += calc.totalEntrees  ||0;
    totalPertes   += calc.totalPertes   ||0;
    totalOfferts  += calc.totalOfferts  ||0;
    douaneTotal   += calc.douaneTotal   ||0;
    ca            += calc.ca            ||0;
    couverts      += calc.couverts      ||0;
    ficheMatchees += calc.ficheMatchees ||0;
    complementMatchees += calc.complementMatchees ||0;
    consoTheoComplement += calc.consoTheoComplement ||0;
    (calc.consoParIng||[]).forEach(v=>{
      const k=norm(v.nom);
      if(!consoParIngTotal[k]) consoParIngTotal[k]={nom:v.nom,qteTotal:0,valeurTotal:0,pmp:v.pmp};
      consoParIngTotal[k].qteTotal   +=v.qteTotal;
      consoParIngTotal[k].valeurTotal+=v.valeurTotal;
    });
    pmixTheoTotal.push(...(calc.pmixTheo||[]));
    allPluNonMatchés.push(...(calc.pluNonMatchés||[]));
    allPluHorsMatiere.push(...(calc.pluHorsMatiere||[]));
    allPluCoutNul.push(...(calc.pluCoutNul||[]));
    allEcartsPrix.push(...(calc.ecartsPrix||[]));
    allValorisationsBloquees.push(...(calc.valorisationsBloquees||[]));
    allDoublonsInventaire.push(...(calc.doublonsInventaire||[]));
    allAnomaliesIntegrite.push(...(calc.anomaliesIntegrite||[]));
    allArticlesHorsEcart.push(...(calc.articlesHorsEcart||[]));
    parRestaurant.push({
      site:stockData.site||`BK ${idx+1}`,
      consoReelle    :calc.consoReelle,
      consoTheoTotal :calc.consoTheoTotal,
      ecartMatiere   :calc.ecartMatiere,
      ecartMatiereP  :calc.ecartMatiereP,
      totalValIni    :calc.totalValIni,
      totalValFin    :calc.totalValFin,
      totalEntrees   :calc.totalEntrees,
      totalPertes    :calc.totalPertes,
      variationStock :calc.variationStock,
      couverts       :calc.couverts,
      articlesEcart  :calc.articlesEcart||[],
      pluNonMatchés  :calc.pluNonMatchés||[],
      pluHorsMatiere :calc.pluHorsMatiere||[],
    });
  });

  const variationStock = totalValIni - totalValFin;
  const consoReelle    = variationStock + totalEntrees;
  const consoTheoTotal = parRestaurant.reduce((s,r)=>s+(r.consoTheoTotal||0),0);
  const ecartMatiere   = consoReelle - consoTheoTotal;
  const ecartMatiereP  = consoTheoTotal>0 ? ecartMatiere/consoTheoTotal : null;
  // Dédupliquer les PLU non matchés
  const pluNonMatchés=allPluNonMatchés.filter((v,i,a)=>a.findIndex(x=>x.plu===v.plu)===i);
  const pluHorsMatiere=allPluHorsMatiere.filter((v,i,a)=>a.findIndex(x=>x.plu===v.plu)===i);

  // C-09 / C-13 : PLU à coût nul agrégés sur l'ensemble des sites.
  const pluCoutNul=agregerParPlu(allPluCoutNul, couverts);
  const qtyCoutNul=pluCoutNul.reduce((s,p)=>s+p.qty,0);
  const coutMoyenAvec=couverts>0 ? consoTheoTotal/couverts : 0;
  const coutMoyenSans=(couverts-qtyCoutNul)>0 ? consoTheoTotal/(couverts-qtyCoutNul) : 0;
  const pmixDoublons=(()=>{
    const m=new Map();
    pmixTheoTotal.forEach(p=>{
      const k=String(p.plu);
      const s=m.get(k)||{plu:p.plu,nom:p.nom,lignes:0,qty:0};
      s.lignes++; s.qty+=Number(p.qty)||0;
      m.set(k,s);
    });
    return [...m.values()].filter(d=>d.lignes>1);
  })();
  const ratioPluCoutNul=ratios?.byPlu ? Object.values(ratios.byPlu).filter(f=>!(Number(f.coutTheo)>0)) : [];
  const ratioCoutNulCount=ratios?.byPlu ? ratioPluCoutNul.length : 0;
  const ratioCoutNulVendus=ratioPluCoutNul.filter(f=>pmixTheoTotal.some(p=>String(p.plu)===String(f.plu))).length;

  const articlesEcartMap = new Map();
  parRestaurant.forEach((restaurant) => {
    (restaurant.articlesEcart || []).forEach((item) => {
      const key = norm(item.nom || item.article || item.designation || '');
      const slot = articlesEcartMap.get(key) || {
        nom: item.nom,
        categorie: item.categorie,
        iniPieces: 0,
        entreesPieces: 0,
        ventesPieces: 0,
        pertesPieces: 0,
        finPieces: 0,
        stockTheo: 0,
        ecartPieces: 0,
        ecartVal: 0,
      };

      slot.iniPieces += Number(item.iniPieces || 0);
      slot.entreesPieces += Number(item.entreesPieces || 0);
      slot.ventesPieces += Number(item.ventesPieces || 0);
      slot.pertesPieces += Number(item.pertesPieces || 0);
      slot.finPieces += Number(item.finPieces || 0);
      slot.stockTheo += Number(item.stockTheo || 0);
      slot.ecartPieces += Number(item.ecartPieces || 0);
      slot.ecartVal += Number(item.ecartVal || 0);
      articlesEcartMap.set(key, slot);
    });
  });

  return {
    totalValIni, totalValFin, variationStock, totalEntrees, totalPertes,
    consoReelle, totalOfferts, douaneTotal,
    consoTheoTotal, ca, couverts, ficheMatchees,
    complementMatchees, consoTheoComplement,
    ecartMatiere, ecartMatiereP,
    consoParIng:Object.values(consoParIngTotal).sort((a,b)=>b.valeurTotal-a.valeurTotal),
    pmixTheo:pmixTheoTotal,
    pluNonMatchés,
    pluHorsMatiere,
    pluCoutNul,
    pmixDoublons,
    qtyCoutNul,
    coutMoyenAvec,
    coutMoyenSans,
    ratioCoutNulCount,
    ratioCoutNulVendus,
    ecartsPrix:allEcartsPrix,
    valorisationsBloquees:allValorisationsBloquees,
    doublonsInventaire:allDoublonsInventaire,
    anomaliesIntegrite:allAnomaliesIntegrite,
    articlesEcart:Array.from(articlesEcartMap.values()).filter(
      (a) => a.iniPieces || a.entreesPieces || a.finPieces || a.ventesPieces || a.pertesPieces
    ),
    articlesHorsEcart:allArticlesHorsEcart,
    parRestaurant,
    isMulti:true,
  };
}
