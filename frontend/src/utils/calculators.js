import { norm } from './formatters.js';

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

// ═══════════════════════════════════════════════════════════════════════════════
// ─── PARSEUR SUIVI STOCK ──────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
export function calculer(stockData, pmixList, ratios, baseArticle={}){
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

  // ── Consommation théorique (PMIX × fiches techniques) ─────────────────────
  let consoTheoTotal=0, couverts=0, ficheMatchees=0;
  const consoParIng={};  // ing_norm → {nom,qteTotal,valeurTotal,pmp}
  const pmixTheo=[];     // [{plu,nom,qty,coutTheo,coutUnit,match}]

  if(ratios&&pmixList.length>0){
    pmixList.forEach(pmix=>{
      pmix.items.forEach(item=>{
        couverts+=item.qty;
        const fiche=ratios.byPlu[item.plu]||ratios.byNom[norm(item.nom)];
        const ct=fiche?fiche.coutTheo*item.qty:0;
        consoTheoTotal+=ct;
        if(fiche){ficheMatchees++;
          fiche.coutParIng.forEach(({ing,qty,pmp,valeur})=>{
            const qT=qty*item.qty; const vT=valeur*item.qty;
            const k=norm(ing);
            if(!consoParIng[k]) consoParIng[k]={nom:ing,qteTotal:0,valeurTotal:0,pmp};
            consoParIng[k].qteTotal+=qT; consoParIng[k].valeurTotal+=vT;
          });
        }
        pmixTheo.push({plu:item.plu,nom:item.nom,qty:item.qty,price:item.price||0,amount:item.amount||((item.price||0)*item.qty),
          coutTheo:ct,coutUnit:fiche?fiche.coutTheo:null,match:!!fiche,categorie:fiche?.categorie||""});
      });
    });
  }

  // ── PLU non matchés (anomalies) ───────────────────────────────────────────
  const pluNonMatchés = pmixTheo.filter(p=>!p.match);

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

  // Initialiser depuis inventaire initial
  Object.entries(invIni).forEach(([k,a])=>{
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
    ecartMatiere, ecartMatiereP,
    coutMatiereVendue, destructionControlee, pertesNonControlees,
    staffMealTotal, offertsProduitsTotal,
    pluNonMatchés,
    consoParIng: Object.values(consoParIng).sort((a,b)=>b.valeurTotal-a.valeurTotal),
    pmixTheo: pmixTheo.sort((a,b)=>b.qty-a.qty),
    // Tous les articles sans exception (R-03)
    articlesEcart: Object.values(articlesEcart).filter(
      a=>a.iniPieces||a.entreesPieces||a.finPieces||a.ventesPieces||a.pertesPieces
    ),
  };
}

export function calculerMultiRestaurants(stocksData, pmixLists, ratios, baseArticle={}){
  let totalValIni=0, totalValFin=0, totalEntrees=0, totalPertes=0;
  let totalOfferts=0, douaneTotal=0, ca=0, couverts=0, ficheMatchees=0;
  const consoParIngTotal={};
  const pmixTheoTotal=[];
  const parRestaurant=[];
  const allPluNonMatchés=[];

  stocksData.forEach((stockData, idx)=>{
    // pmixLists[idx] est un tableau d'items => on en fait un pmixList standard
    const pmixList = Array.isArray(pmixLists[idx])
      ? (pmixLists[idx][0]?.items ? pmixLists[idx] : [{restaurant:stockData.site||`BK ${idx+1}`,periode:"",items:pmixLists[idx]}])
      : [];
    const calc=calculer(stockData, pmixList, ratios, baseArticle);
    totalValIni   += calc.totalValIni   ||0;
    totalValFin   += calc.totalValFin   ||0;
    totalEntrees  += calc.totalEntrees  ||0;
    totalPertes   += calc.totalPertes   ||0;
    totalOfferts  += calc.totalOfferts  ||0;
    douaneTotal   += calc.douaneTotal   ||0;
    ca            += calc.ca            ||0;
    couverts      += calc.couverts      ||0;
    ficheMatchees += calc.ficheMatchees ||0;
    (calc.consoParIng||[]).forEach(v=>{
      const k=norm(v.nom);
      if(!consoParIngTotal[k]) consoParIngTotal[k]={nom:v.nom,qteTotal:0,valeurTotal:0,pmp:v.pmp};
      consoParIngTotal[k].qteTotal   +=v.qteTotal;
      consoParIngTotal[k].valeurTotal+=v.valeurTotal;
    });
    pmixTheoTotal.push(...(calc.pmixTheo||[]));
    allPluNonMatchés.push(...(calc.pluNonMatchés||[]));
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
    });
  });

  const variationStock = totalValIni - totalValFin;
  const consoReelle    = variationStock + totalEntrees;
  const consoTheoTotal = parRestaurant.reduce((s,r)=>s+(r.consoTheoTotal||0),0);
  const ecartMatiere   = consoReelle - consoTheoTotal;
  const ecartMatiereP  = consoTheoTotal>0 ? ecartMatiere/consoTheoTotal : null;
  // Dédupliquer les PLU non matchés
  const pluNonMatchés=allPluNonMatchés.filter((v,i,a)=>a.findIndex(x=>x.plu===v.plu)===i);

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
    ecartMatiere, ecartMatiereP,
    consoParIng:Object.values(consoParIngTotal).sort((a,b)=>b.valeurTotal-a.valeurTotal),
    pmixTheo:pmixTheoTotal,
    pluNonMatchés,
    articlesEcart:Array.from(articlesEcartMap.values()).filter(
      (a) => a.iniPieces || a.entreesPieces || a.finPieces || a.ventesPieces || a.pertesPieces
    ),
    parRestaurant,
    isMulti:true,
  };
}
