import * as XLSX from 'xlsx';
import { norm, matchBkNumber, parseDate } from './formatters.js';
import { resoudrePrix } from './calculators.js';

export function normalizePlu(raw) {
  if (raw === null || raw === undefined) return "";
  const text = String(raw).trim().replace(/\s+/g, "");
  if (!text || text === "0") return "";
  return text;
}

export function isExcludedCategory(category) {
  const value = String(category || "").trim().toLowerCase();
  return value.includes("produits de nettoyage") || value.includes("produit de nettoyage");
}

export function parseRatios(wb) {
  // ── WA Landed Cost → prix par carton + conditionnement ────────────────────
  // La feuille contient deux sections : IMPORTED ITEMS (qté/carton en col4, PMP carton en col5)
  // et LOCAL ITEMS (repérée par le marqueur "LOCAL ITEMS" en col0) où seul le prix PIÈCE
  // est donné directement en col3 — le prix carton doit alors être déduit via le
  // conditionnement (colisage) du base article, calculé plus tard dans resoudrePrix.
  const waLandedCost = {};
  const waByCode = {};   // index par code, construit en même temps — jamais écrasé par un doublon de désignation
  const wsWA = wb.Sheets["WA Landed Cost"];
  if(wsWA){
    const rows = XLSX.utils.sheet_to_json(wsWA,{header:1,defval:null});
    let inLocal=false;
    for(let i=0;i<rows.length;i++){
      const r=rows[i]; if(!r) continue;
      if(r[0]==="LOCAL ITEMS") inLocal=true;
      const desig=r[2];
      let corresp="",statut="",qteCdt=null,pmpCarton=null,puPieceDirect=null;
      // Détection de la disposition : basée sur le STATUT (texte ACTIF/INACTIF, toujours fiable),
      // pas sur le type de la colonne CORRESPONDANCE — celle-ci peut être un texte ("BKFR22CCP")
      // ou un nombre pur selon les lignes (ex. code "69740" auto-typé en nombre par Excel).
      const st4 = typeof r[4]==="string" ? r[4].trim().toUpperCase() : "";
      if(!inLocal && (st4==="ACTIF" || st4==="INACTIF")){                  // disposition « Correspondance »
        corresp = r[3]!=null ? String(r[3]).trim() : ""; statut=r[4]; qteCdt=r[6]; pmpCarton=r[7];
      } else if(!inLocal){                                                // disposition « Ratio » (IMPORTED)
        qteCdt=r[4]; pmpCarton=r[5];
      } else {
        // Section LOCAL ITEMS : deux formats rencontrés selon le trimestre.
        //  - Nouveau (avec code) : désignation(2), CORRESPONDANCE(3), STATUT « ACTIF »/« INACTIF »(4), prix pièce(5).
        //  - Ancien (sans code)  : désignation(2), prix pièce(3) directement.
        // Le format se détecte via la colonne 4 : si elle contient ACTIF/INACTIF, c'est le nouveau format.
        const st4 = typeof r[4]==="string" ? r[4].trim().toUpperCase() : "";
        if(st4==="ACTIF" || st4==="INACTIF"){
          // Nouveau format. La colonne CORRESPONDANCE(3) doit être un CODE TEXTE ; si le fichier
          // source y contient un nombre (donnée corrompue, ex. un ID collé par erreur), on l'ignore
          // plutôt que de le prendre pour un prix ou un code.
          if(typeof r[3]==="string") corresp=r[3];
          statut=r[4];
          puPieceDirect = (typeof r[5]==="number"&&r[5]>0) ? r[5] : null;
        } else {
          puPieceDirect = (typeof r[3]==="number"&&r[3]>0) ? r[3] : null;
        }
      }
      // Garde-fou : une cellule corrompue (ex. un identifiant collé par erreur à la place d'un
      // code texte) peut produire un prix aberrant. Un carton/pièce à plus de 50M F n'est pas
      // plausible pour un article alimentaire — on l'ignore plutôt que de fausser tout le calcul.
      const PRIX_MAX_PLAUSIBLE = 50000000;
      if(typeof pmpCarton==="number" && pmpCarton>PRIX_MAX_PLAUSIBLE) pmpCarton=null;
      if(puPieceDirect!=null && puPieceDirect>PRIX_MAX_PLAUSIBLE) puPieceDirect=null;
      const hasPrice = (typeof pmpCarton==="number"&&pmpCarton>0) || puPieceDirect!=null;
      if(desig&&typeof desig==="string"&&hasPrice){
        const k=norm(desig);
        const puPiece = puPieceDirect!=null ? puPieceDirect
          : ((typeof qteCdt==="number"&&qteCdt>0) ? pmpCarton/qteCdt : 0);
        const entry={designation:desig.trim(),corresp:corresp||"",statut:statut||"",
          qteCdt:qteCdt||null, pmpCarton:pmpCarton||null, puPiece,
          // Les lignes locales dont la désignation se termine par « (kg) » sont tarifées au
          // KILOGRAMME (ICEBERG SALAD (kg) = 6 019,99 F/kg) : le prix n'est pas le prix de la
          // pièce et ne se multiplie pas tel quel par le colisage.
          parKg:/\(\s*kg\s*\)/i.test(desig)};
        // Index par code : à construire ICI, ligne par ligne — deux lignes peuvent partager la
        // même désignation (ex. « BEEF PATTY WHOPPER HALAL » chez 2 fournisseurs, codes différents) ;
        // indexer après coup depuis waLandedCost perdrait les entrées masquées par le doublon.
        if(corresp){ String(corresp).split("/").forEach(c=>{ const cc=norm(c.trim()); if(cc && (!waByCode[cc]||statut==="ACTIF")) waByCode[cc]=entry; }); }
        // Garder ACTIF en priorité si doublon (dédoublonnage par désignation, pour l'accès par nom)
        if(!waLandedCost[k] || (statut==="ACTIF"&&waLandedCost[k].statut!=="ACTIF")){
          waLandedCost[k]=entry;
        }
      }
    }
  }

  // ── PMP marchandises → PMP unitaire par ingrédient ────────────────────────
  const pmpByIng = {};
  const wsPmp = wb.Sheets["PMP marchandises"];
  if(wsPmp){
    const rows = XLSX.utils.sheet_to_json(wsPmp,{header:1,defval:null});
    const header = rows[3]||[]; const vals = rows[4]||[];
    header.forEach((name,j)=>{
      if(name&&typeof name==="string"){
        const v=vals[j];
        if(typeof v==="number"&&v>0) pmpByIng[norm(name)]=v;
      }
    });
  }

  // ── COST → valorisation officielle par produit × ingrédient (FCFA) ────────
  // Feuille de référence de Burger King : pour chaque produit (ligne), la valeur en FCFA
  // de chaque ingrédient (colonne) est donnée directement — la somme des colonnes égale
  // le coût total du produit (colonne "COST"). Source la plus fiable : utilisée en priorité
  // pour valoriser la recette ; repli sur Data sheet × PMP marchandises si absente/incomplète.
  const costMatrix = {};   // costMatrix[NOM_PRODUIT_NORM] = { ING_NORM: valeurFCFA }
  const wsCost = wb.Sheets["COST"];
  if(wsCost){
    const rows = XLSX.utils.sheet_to_json(wsCost,{header:1,defval:null});
    const ingHeaderCost=(rows[3]||[]).map((v,j)=>({j,name:v&&typeof v==="string"?v.trim():null})).filter(x=>x.name&&x.j>2);
    for(let i=4;i<rows.length;i++){
      const r=rows[i]; const nom=r[1]; if(!nom||typeof nom!=="string") continue;
      const byIng={};
      ingHeaderCost.forEach(({j,name})=>{ const v=r[j]; if(typeof v==="number"&&v>0) byIng[norm(name)]=v; });
      if(Object.keys(byIng).length) costMatrix[norm(nom)]=byIng;
    }
  }

  // ── Ratios → prix de vente TTC par produit (feuille « Ratios ») ────────────
  // Structure : ligne 3 = blocs ("SANDWICH ONLY", "MENU LARGE"…), ligne 4 = intitulés de
  // colonnes ("PV TTC", "COÛT", …). Le premier "PV TTC" est le prix de vente du produit
  // seul (SANDWICH ONLY) — utilisé pour valoriser la colonne Price du template PMIX.
  const pvByNom = {};
  const wsRatios = wb.Sheets["Ratios"];
  if(wsRatios){
    const rows = XLSX.utils.sheet_to_json(wsRatios,{header:1,defval:null});
    const blocs = rows[2]||[], titres = rows[3]||[];
    let pvCol = -1;
    for(let j=0;j<titres.length;j++){
      if(typeof titres[j]==="string" && titres[j].trim().toUpperCase()==="PV TTC"){ pvCol=j; break; }
    }
    if(pvCol>=0){
      for(let i=4;i<rows.length;i++){
        const r=rows[i]; if(!r) continue;
        const nom=r[1];
        if(typeof nom==="string" && nom.trim() && typeof r[pvCol]==="number" && r[pvCol]>0){
          const k=norm(nom.trim());
          if(pvByNom[k]==null) pvByNom[k]=r[pvCol];
        }
      }
    }
  }

  // ── Data sheet → recettes produits ───────────────────────────────────────
  const byPlu={}, byNom={}, allProducts=[];
  const wsData = wb.Sheets["Data sheet"];
  if(wsData){
    const rows = XLSX.utils.sheet_to_json(wsData,{header:1,defval:null});
    const ingHeader=(rows[3]||[]).map((v,j)=>({j,name:v&&typeof v==="string"?v.trim():null})).filter(x=>x.name&&x.j>2);
    let cat="";
    for(let i=4;i<rows.length;i++){
      const r=rows[i];
      if(r[0]&&typeof r[0]==="string") cat=r[0].trim();
      const nom=r[1]; const plu=r[2];
      if(!nom||typeof nom!=="string") continue;
      const recipe={};
      const coutParIng=[];
      let coutTheo=0;
      const costRow = costMatrix[norm(nom)];    // valeurs officielles COST pour ce produit, si dispo
      ingHeader.forEach(({j,name})=>{
        const qty=r[j];
        if(typeof qty==="number"&&qty>0){
          const pmpU=pmpByIng[norm(name)]||0;
          const valFallback=pmpU*qty;
          // Priorité à la valeur officielle de la feuille COST ; sinon reconstruction qty × PMP.
          const valCost = costRow ? costRow[norm(name)] : undefined;
          const val = (typeof valCost==="number"&&valCost>0) ? valCost : valFallback;
          recipe[name]=qty;
          coutParIng.push({ing:name,qty,pmp:qty>0?val/qty:pmpU,valeur:val,source:(valCost!=null?"COST":"PMP×qté")});
          coutTheo+=val;
        }
      });
      if(Object.keys(recipe).length===0) continue;
      const prod={plu:typeof plu==="number"?Math.round(plu):null,nom:nom.trim(),categorie:cat,recipe,coutTheo,coutParIng,pvTtc:pvByNom[norm(nom.trim())]||null};
      allProducts.push(prod);
      if(prod.plu) byPlu[prod.plu]=prod;
      byNom[norm(nom)]=prod;
    }
  }

  return {byPlu,byNom,pmpByIng,costMatrix,allProducts,waLandedCost,waByCode};
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── CONDITIONNEMENT TEXTUEL ───────────────────────────────────────────────────
// 109 lignes du base article sur 523 décrivent le colisage en texte (« 10 boules ≈ 6,5kg »,
// « 16*400 gr », « Sac de 5kg », « 5 Inner de 100 »). Réduites à 1, elles perdaient le prix
// pièce et, pour les lignes tarifées au kg, le prix carton. Renvoie { n, kg } :
//   n  = unités contenues dans le carton (10 boules, 16 barres, 5*1000 → 5 000 wraps)
//   kg = masse nette du carton en kg, uniquement quand le texte l'exprime (jamais les litres)
export function parseConditionnement(raw){
  if(typeof raw==="number" && isFinite(raw) && raw>0) return { n:raw, kg:null };
  const t=String(raw==null?"":raw).toLowerCase().replace(/×/g,"*").replace(/,/g,".").replace(/\s+/g," ").trim();
  if(!t) return { n:null, kg:null };
  let n=null, kg=null;
  const mInner=t.match(/(\d+)\s*(?:inners?|packs?|paquets?|lots?)\s*(?:de|\*|d')\s*(\d+)/);
  const mMult=t.match(/(\d+(?:\.\d+)?)\s*\*\s*(\d+(?:\.\d+)?)(?:\s*(kg|gr|g|cl|ml|l))?/);
  const mMasse=t.match(/(\d+(?:\.\d+)?)\s*(kg|gr|g)\b/);
  const mPiece=t.match(/(\d+)(?![.\d])\s*(?:boules?|pi[èe]ces?|pcs|unites?|sachets?|parts?)/);
  const mContenant=t.match(/(?:pack|paquet|boite|bidon|seau)\s*(?:de|d')\s*(\d+)(?![.\d])(?!\s*(?:kg|gr|g|cl|ml|l)\b)/);
  if(mInner) n=Number(mInner[1])*Number(mInner[2]);
  else if(mMult){
    const a=Number(mMult[1]), b=Number(mMult[2]), u=mMult[3];
    if(u==="kg"||u==="gr"||u==="g"){ n=a; kg=a*(u==="kg"?b:b/1000); }
    else n=u?a:b*a;                     // volume : on compte les contenants ; sans unité : total de pièces
  }
  if(kg==null && mMasse){ const v=Number(mMasse[1]); kg=mMasse[2]==="kg"?v:v/1000; }
  if(n==null){ if(mPiece) n=Number(mPiece[1]); else if(mContenant) n=Number(mContenant[1]); }
  return { n, kg };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── PARSEUR BASE ARTICLE ─────────────────────────────────────────────────────
// Retourne map : NOM_STOCK_NORM → { categorie, famille, designation, corresponRatio, fournisseur, codeBollore, unite, cdt }
// ═══════════════════════════════════════════════════════════════════════════════
export function parseBaseArticle(wb){
  const map={};
  const ws=wb.Sheets["base article "]||wb.Sheets["base article"]||wb.Sheets[wb.SheetNames.find(n=>/base article/i.test(n))]||wb.Sheets[wb.SheetNames[0]];
  if(!ws) return map;
  const rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:null});
  // Colonnes réelles : A Catégorie, B Famille, C Désignation stock, D Correspondance Ratio,
  //                     E Fournisseur, F Code article Bolloré, G Unité, H Conditionnement.
  for(let i=1;i<rows.length;i++){
    const r=rows[i];
    const desig=r[2];
    if(!desig||typeof desig!=="string"||!desig.trim()) continue;
    const cdtBrut=r[7];
    const uniteLu=String(r[6]||"").trim().toLowerCase();
    let cdtLu;
    if(typeof cdtBrut==="number" && cdtBrut>0){
      // Colisage numérique + unité de masse = POIDS du carton, pas un nombre de pièces
      // (SALADE TREVISE : conditionnement 1000, unité « Gramme » → carton de 1 kg).
      const kg = uniteLu.indexOf("kg")===0 ? cdtBrut
        : (uniteLu.indexOf("gramme")===0 || uniteLu==="g" ? cdtBrut/1000 : null);
      cdtLu = { n:cdtBrut, kg };
    } else cdtLu = parseConditionnement(cdtBrut);
    map[norm(desig)]={
      categorie:r[0]||"", famille:r[1]||"", designation:desig.trim(),
      corresponRatio:(r[3]&&r[3]!==0&&r[3]!=="0")?String(r[3]).trim():"",
      fournisseur:r[4]||"", codeBollore:r[5]||"", unite:r[6]||"",
      cdt: cdtLu.n || 1, cdtKg: cdtLu.kg,
      ordre_affichage: i
    };
  }
  return map;
}

// Rafraîchit un fichier de suivi rempli : réécrit les PRIX depuis le référentiel courant
// (issu du Ratio) en gardant quantités, dates et saisies. Les valeurs (formules) se recalculent.
export function parseCorrespondance(wb){
  const map={}, byCode={};
  const ws=wb.Sheets["WA Landed Cost"]||wb.Sheets[wb.SheetNames.find(n=>/landed cost|correspond/i.test(n))];
  if(!ws) return { map, byCode };
  const rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:null});
  const PRIX_MAX_PLAUSIBLE=50000000;
  let inLocal=false;
  for(let i=0;i<rows.length;i++){
    const r=rows[i];
    if(r[0]==="LOCAL ITEMS") inLocal=true;
    const desig=r[2]; if(!desig||typeof desig!=="string"||!desig.trim()) continue;
    if(norm(desig)==="DESIGNATION") continue;
    let code="", statut="", qteCdt=null, pmpCarton=null, puPieceDirect=null;
    // Même détection que parseRatios : le STATUT (texte ACTIF/INACTIF) révèle la disposition.
    // IMPORTED : prix CARTON en col7 (nouveau) ou col5 (ancien). LOCAL ITEMS : seul le prix
    // PIÈCE est connu — la col5 des lignes importées contient le POIDS kg, jamais un prix.
    const st4 = typeof r[4]==="string" ? r[4].trim().toUpperCase() : "";
    const formatAvecCode = (st4==="ACTIF" || st4==="INACTIF");
    if(!inLocal && formatAvecCode){                         // disposition « Correspondance » (importés)
      code = r[3]!=null ? String(r[3]).trim() : ""; statut=r[4]; qteCdt=r[6]; pmpCarton=r[7];
    } else if(!inLocal){                                    // disposition « Ratio » (importés, sans code)
      qteCdt=r[4]; pmpCarton=r[5];
    } else if(formatAvecCode){                              // LOCAL ITEMS récent : code(3) statut(4) prix pièce(5)
      if(typeof r[3]==="string") code=r[3].trim(); statut=r[4];
      puPieceDirect=(typeof r[5]==="number"&&r[5]>0)?r[5]:null;
    } else {                                                // LOCAL ITEMS ancien : prix pièce(3) directement
      puPieceDirect=(typeof r[3]==="number"&&r[3]>0)?r[3]:null;
    }
    if(typeof pmpCarton==="number"&&pmpCarton>PRIX_MAX_PLAUSIBLE) pmpCarton=null;
    if(puPieceDirect!=null && puPieceDirect>PRIX_MAX_PLAUSIBLE) puPieceDirect=null;
    const priced=(typeof pmpCarton==="number"&&pmpCarton>0)||puPieceDirect!=null;
    const entry={
      designation:desig.trim(), code:(code!=null && code!==""?String(code).trim():""), statut:statut||"",
      qteCdt:(typeof qteCdt==="number"&&qteCdt>0)?qteCdt:null,
      pmpCarton:(typeof pmpCarton==="number"&&pmpCarton>0)?pmpCarton:null,
      puPiece: puPieceDirect!=null ? puPieceDirect
        : ((priced&&typeof qteCdt==="number"&&qteCdt>0)?pmpCarton/qteCdt:0),
      parKg:/\(\s*kg\s*\)/i.test(desig)
    };
    if(priced){
      map[norm(desig)]=entry;
      // Index par CODE (un article Ratio peut avoir plusieurs codes Bolloré, séparés par "/")
      if(entry.code){ entry.code.split("/").forEach(c=>{ const cc=c.trim(); if(cc) byCode[norm(cc)]=entry; }); }
    }
  }
  return { map, byCode };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── PARSEUR BASE ARTICLE LOCAL ──────────────────────────────────────────────
// Fichier complémentaire au Ratio : articles locaux (boissons, IFB, etc.)
// avec prix d'achat défini mais absents du WA Landed Cost du Ratio.
// Structure attendue : Catégorie(0), Nom Article(1), Code Bolloré(2),
//                      Unité(3), Conditionnement(4), Prix unitaire(5)
// La colonne 5 est le prix de l'unité d'ACHAT (col3/col4 : carton, pack, inner), pas le
// prix pièce : PRESSEA 200ML = 3 051 F le PACK de 24 (≈127 F la bouteille). Le lire comme
// prix pièce multipliait une seconde fois par le conditionnement (3 051 → 73 224 le carton).
// Retourne map : NORM(nom) → { nom, code, unite, cdt, puPiece, pmpCarton, categorie }
// ═══════════════════════════════════════════════════════════════════════════════
export function parseBaseArticleLocal(wb) {
  const map = {};
  const ws = wb.Sheets["Articles"] || wb.Sheets[wb.SheetNames.find(n => /articles?/i.test(n))] || wb.Sheets[wb.SheetNames[0]];
  if (!ws) return map;
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
  // En-têtes à la ligne 3 (index 3), données à partir de la ligne 4
  for (let i = 4; i < rows.length; i++) {
    const r = rows[i];
    const nom = r[1];
    if (!nom || typeof nom !== "string" || !nom.trim()) continue;
    const prix = typeof r[5] === "number" && r[5] > 0 ? r[5] : null;
    if (!prix) continue;
    const cdtRaw = r[4];
    const cdt = typeof cdtRaw === "number" && cdtRaw > 0 ? cdtRaw : 1;
    map[norm(nom)] = {
      nom: nom.trim(),
      code: r[2] != null ? String(r[2]).trim() : "",
      unite: r[3] || "",
      cdt,
      pmpCarton: prix,
      puPiece: cdt > 1 ? prix / cdt : prix,
      categorie: r[0] || "",
    };
  }
  return map;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Base complémentaire PMIX (feuille « Ecarts ») — PLU | Item Name | Qty Sold |
// Unit Cost Price RATIO | Unit Cost Price PMIX. Apporte le coût unitaire des produits
// finis que le Ratio ne couvre pas. Les quantités du fichier ne sont jamais lues : la
// source des quantités reste le PMIX du classeur de suivi.
// Retourne map : PLU → { nom, cout }
// ═══════════════════════════════════════════════════════════════════════════════
export function parseBaseComplementairePmix(wb) {
  const map = {};
  if (!wb) return map;
  const ws = wb.Sheets["Ecarts"]
    || wb.Sheets[wb.SheetNames.find(n => /écart|compl/i.test(n))]
    || wb.Sheets[wb.SheetNames[0]];
  if (!ws) return map;
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
  const txt = (c) => (typeof c === "string" ? c.replace(/\s+/g, " ").trim() : "");
  let h = -1, cPlu = -1, cNom = -1, cRatio = -1, cPmix = -1;
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    const r = rows[i] || [];
    const plu = r.findIndex(c => /plu|code\s*article/i.test(txt(c)));
    const nom = r.findIndex(c => /name|nom|d[ée]signation/i.test(txt(c)));
    const tarif = (re) => r.findIndex(c => re.test(txt(c)) && /cost|co.?t|prix/i.test(txt(c)));
    const unePrix = r.findIndex((c, j) => j !== plu && j !== nom && /cost|co.?t|prix/i.test(txt(c)));
    const ratio = tarif(/ratio/i);
    const pmix = tarif(/pmix/i);
    if (plu >= 0 && (ratio >= 0 || pmix >= 0 || unePrix >= 0)) {
      h = i; cPlu = plu; cNom = nom;
      cRatio = ratio >= 0 ? ratio : unePrix;
      cPmix = pmix;
      break;
    }
  }
  if (h < 0) return map;
  for (let i = h + 1; i < rows.length; i++) {
    const r = rows[i] || [];
    const plu = normalizePlu(r[cPlu]);
    if (!plu) continue;
    const b = cPmix >= 0 && typeof r[cPmix] === "number" ? r[cPmix] : 0;
    const a = cRatio >= 0 && typeof r[cRatio] === "number" ? r[cRatio] : 0;
    const cout = b > 0 ? b : (a > 0 ? a : 0);
    if (!cout) continue;
    map[plu] = { nom: txt(r[cNom]), cout };
  }
  return map;
}

// Construit la liste d'articles (référentiel) à partir du base article (maître, mémorisé),
// de la correspondance (statut + prix compl., mémorisée — {map, byCode}) et des prix du Ratio
// (WA Landed Cost, incluant la section LOCAL ITEMS où seul le prix pièce est connu).
// Réutilisée par majRatios (Ratio seul) et par l'écran de gestion du base article (chargement initial).
// corrMap : accepte soit {map,byCode} (nouveau format), soit un objet plat (ancien format KV) → normalisé.
export function buildArtListFromReferentiel(baseArtMap, corrMapRaw, wa, waByCode, localArticles){
  const corrMap = corrMapRaw && corrMapRaw.map ? corrMapRaw : { map: corrMapRaw||{}, byCode: {} };
  const byName=corrMap.map||{}, byCodeCorr=corrMap.byCode||{};
  const hasAnyPrice=(o)=> o && ((o.pmpCarton>0) || (o.puPiece>0));
  const resolveByName=(key)=>{ const w=wa[key]; if(hasAnyPrice(w)) return w; const c=byName[key]; if(hasAnyPrice(c)) return c; return null; };
  // Index par CODE : celui construit ligne par ligne dans parseRatios (waByCode, fiable même en cas
  // de doublon de désignation) en priorité ; sinon reconstruction de repli depuis wa (compatibilité).
  const byCodeWa = waByCode || (()=>{ const idx={}; Object.values(wa).forEach(w=>{
    if(hasAnyPrice(w) && w.corresp){ String(w.corresp).split("/").forEach(c=>{ const cc=c.trim(); if(cc) idx[norm(cc)]=w; }); }
  }); return idx; })();
  const resolveByCode=(code)=>{ if(!code) return null; const k=norm(code); return byCodeWa[k] || byCodeCorr[k] || null; };

  let nbCode=0, nbPrix=0, nbInactif=0, nbViaCode=0, nbCondDerives=0;
  const condDerives=[];
  const artList = Object.values(baseArtMap).map(ba=>{
    let price = resolveByName(norm(ba.corresponRatio)) || resolveByName(norm(ba.designation));
    let viaCode=false;
    if(!price && ba.codeBollore){                    // repli : résolution par Code Bollore
      const c = resolveByCode(ba.codeBollore);
      if(hasAnyPrice(c)){ price=c; viaCode=true; }
    }
    // Repli base locale : articles absents du Ratio mais avec prix défini localement
    if(!hasAnyPrice(price) && localArticles){
      const asPrice=(loc)=> loc && ({ puPiece:loc.puPiece, pmpCarton:loc.pmpCarton, qteCdt:loc.cdt });
      const locByName = asPrice(localArticles[norm(ba.designation)]);
      if(hasAnyPrice(locByName)){ price=locByName; }
      else if(ba.codeBollore){
        const codeKey=norm(ba.codeBollore);
        const locByCode=asPrice(Object.values(localArticles).find(a=>a.code && norm(a.code)===codeKey));
        if(hasAnyPrice(locByCode)){ price=locByCode; viaCode=true; }
      }
    }
    price = price || {};
    const statut = (byName[norm(ba.corresponRatio)]||byName[norm(ba.designation)]||(viaCode?price:{})).statut || "";
    const inactif = norm(statut)==="INACTIF";
    // Le Ratio récent peut corriger le conditionnement ; le base article reste le repli.
    let cond = price.qteCdt || ba.cdt || 1;
    // A7-ter : quand le Ratio donne les deux prix mais un colisage non parsable (textuel/kg),
    // cond restait à 1 et pu_carton ≠ pu_piece×1 était importé en incohérence systématique.
    // On dérive le colisage = round(prix carton / prix pièce) au lieu de laisser 1.
    if(!price.parKg && cond <= 1 && price.pmpCarton > 0 && price.puPiece > 0){
      const derived = Math.round(price.pmpCarton / price.puPiece);
      if(derived > 1){ cond = derived; nbCondDerives++; condDerives.push(ba.designation || norm(ba.designation)); }
    }
    // Dérive le prix manquant (carton ↔ pièce) via le conditionnement quand un seul est connu
    // (cas des articles locaux, où seul le prix pièce est donné directement).
    let puCarton, puPiece;
    if(price.parKg){
      // Ligne locale tarifée AU KILOGRAMME : le prix carton = prix kg × masse du carton
      // (« 10 boules ≈ 6,5kg » → ICEBERG SALAD 6 019,99 F/kg donne 39 130 F le carton et
      // 3 913 F la boule). Sans masse dans le conditionnement, rien n'est dérivé : un prix
      // carton au kilogramme serait aussi faux que de le confondre avec le prix de la pièce.
      const kg = Number(ba.cdtKg)>0 ? Number(ba.cdtKg) : null;
      puCarton = kg==null ? null : price.puPiece*kg;
      puPiece  = puCarton==null ? null : (cond>1 ? puCarton/cond : puCarton);
    } else {
      puCarton = price.pmpCarton>0 ? price.pmpCarton : (price.puPiece>0 ? price.puPiece*cond : null);
      puPiece  = price.puPiece>0   ? price.puPiece   : (price.pmpCarton>0 && cond>0 ? price.pmpCarton/cond : null);
    }
    // Garde-fou : une dérivation prix-pièce × conditionnement peut devenir implausible quand
    // l'unité du prix Ratio (souvent "au kg") ne correspond pas à l'unité du conditionnement du
    // base article (souvent en pièces ou en grammes) — ex. SALADE TREVISE (1000 g) rattachée à
    // ICEBERG SALAD (prix au kg) donne un carton à 6,8M F. On rejette plutôt qu'un chiffre faux.
    const PRIX_MAX_PLAUSIBLE = 5000000;
    if(puCarton>PRIX_MAX_PLAUSIBLE || puPiece>PRIX_MAX_PLAUSIBLE){ puCarton=null; puPiece=null; }
    if(ba.codeBollore) nbCode++;
    const hasValidPrice = Number.isFinite(puCarton) && puCarton > 0 || Number.isFinite(puPiece) && puPiece > 0;
    if(hasValidPrice){ nbPrix++; if(viaCode) nbViaCode++; }
    if(inactif) nbInactif++;
    return {
      ref: norm(ba.designation), nom: ba.designation,
      code: ba.codeBollore||null, unite: ba.unite||null, categorie: ba.categorie||null,
      conditionnement: cond||null,
      puCarton: puCarton && puCarton > 0 ? puCarton : null,
      puPiece: puPiece && puPiece > 0 ? puPiece : null,
      corresp: ba.corresponRatio||null, statut: statut||null,
      actif: inactif ? 0 : 1,
      ordre_affichage: ba.ordre_affichage || 0
    };
  });
  return { artList, nbCode, nbPrix, nbInactif, nbViaCode, nbCondDerives, condDerives };
}

// Enrichit un tableau d'articles (format BDD snake_case) avec les prix et conditionnements
// de la base locale. La base locale est source d'autorité pour les articles qu'elle contient,
// SAUF quand elle contredit grossièrement un prix Ratio ACTIF (écart > ×20) : un tel écart
// signale une incohérence d'unité dans l'un des deux fichiers, et le prix Ratio garde la main.
// Le conditionnement local reste autoritaire (décision 29/09 : le colisage local gagne).
export function enrichirAvecBaseLocale(articles, localArticles){
  if(!localArticles || !articles?.length) return articles;
  const byCode={};
  Object.values(localArticles).forEach(a=>{ if(a.code) byCode[norm(a.code)]=a; });
  const FACTEUR_MAX=20;
  const coherent=(x,y)=>{ if(!(x>0)||!(y>0)) return true; const f=x/y; return f>=1/FACTEUR_MAX && f<=FACTEUR_MAX; };
  return articles.map(a=>{
    const loc = localArticles[norm(a.nom)] || (a.code ? byCode[norm(a.code)] : null);
    if(!loc) return a;
    const ratioActif = norm(a.statut)!=="INACTIF" && (a.pu_carton>0 || a.pu_piece>0);
    const cmpCarton = (loc.pmpCarton>0 && a.pu_carton>0) ? coherent(loc.pmpCarton,a.pu_carton) : true;
    const cmpPiece  = (loc.puPiece>0 && a.pu_piece>0) ? coherent(loc.puPiece,a.pu_piece) : true;
    const prixOk = !ratioActif || (cmpCarton && cmpPiece);
    // Un colisage local à 1 signifie « non renseigné » dans ce fichier : le base article garde
    // alors le sien (ex. salades : 10 boules ≈ 6,5 kg). Le prix local est un prix de CARTON,
    // donc le prix pièce s'en dérive via ce colisage et non pas en le lui surcollant.
    const condLocal = loc.cdt>1 ? loc.cdt : 0;
    const cond = condLocal || a.conditionnement || 1;
    const pieceLoc = !prixOk || !(loc.pmpCarton>0) ? null
      : (condLocal>0 || cond<=1 ? loc.puPiece : loc.pmpCarton/cond);
    return {
      ...a,
      pu_piece: pieceLoc!=null && pieceLoc>0 ? pieceLoc : a.pu_piece,
      pu_carton: (prixOk && loc.pmpCarton>0) ? loc.pmpCarton : a.pu_carton,
      conditionnement: condLocal || a.conditionnement || null,
    };
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── RÉSOUDRE PRIX ARTICLE ────────────────────────────────────────────────────
// Stratégie de résolution du prix pour un article stock :
// 1. Chercher dans waLandedCost par nom stock direct
// 2. Chercher via corresponRatio (BASE_ARTICLE)
// 3. Chercher via pmpByIng (nom ingrédient)
// Retourne : { puPiece, pmpCarton, qteCdt, source }
// ═══════════════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════
// ─── OFFSET DE COLONNES (mise en page) ────────────────────────────────────────
// Anciens classeurs : colonne A = zone logo vide, tableaux démarrant en B (offset 0).
// Nouveaux classeurs (depuis harmonisation « tout démarrer en A ») : tableaux en A
// (offset 1). Chaque lecture se fait via r[ancienIndice - offset], l'offset étant
// détecté automatiquement grâce aux en-têtes de chaque feuille.
// ═══════════════════════════════════════════════════════════════════════════════
const hnorm=(v)=>String(v??"").trim().toLowerCase();
const offsetInventaire=(rows)=>hnorm(rows[5]?.[3]).startsWith("nb articles")?1:0;
const offsetPertes=(rows)=>hnorm(rows[3]?.[1])==="nom article"?1:0;
const offsetDouane=(rows)=>hnorm(rows[1]?.[0])==="article"?1:0;
const offsetOffert=(rows)=>hnorm(rows[1]?.[0])==="bk"?1:0;
// P.Douane « vide » (modèle courant) : tableau non pré-rempli, en-têtes
//   Date | Article | Catégorie | Code / Désignation | Cond. | Qté | Px carton | Px pièce | Valeur.
// Renvoie l'indice de la ligne d'en-têtes, ou -1 pour l'ancien format pré-rempli (Article en A).
const douaneNewHeaderRow=(rows)=>{
  for(let i=1;i<=4&&i<rows.length;i++){
    const r=rows[i]; if(!r) continue;
    if(hnorm(r[0])==="date"&&hnorm(r[2]).startsWith("cat")) return i;
  }
  return -1;
};

export function parseSuivisStock(wb, baseArticle, ratios, localArticles){
  // Index des articles par Code Bolloré : c'est la clé saisie en colonne E de la feuille Transferts
// et celle que son VLOOKUP utilise. Sans lui, une ligne collée par le magasin (la désignation de
// C reste le texte résiduel du modèle pendant que E porte un autre article) était rattachée et
// valorisée sur le mauvais article.
function indexerParCode(baseArticle, ratios, localArticles){
  const idx={};
  const set=(code,o)=>{ const k=norm(code); if(k&&!idx[k]) idx[k]=o; };
  Object.values(localArticles||{}).forEach(a=>set(a.code,
    {nom:a.nom||"",puPiece:a.puPiece,pmpCarton:a.pmpCarton,qteCdt:a.cdt||1,source:"Base locale (code)"}));
  Object.entries(ratios&&ratios.waByCode||{}).forEach(([k,wa])=>{ if(!idx[k]) idx[k]=
    {nom:wa.designation||"",puPiece:wa.puPiece,pmpCarton:wa.pmpCarton,qteCdt:wa.qteCdt||1,source:"Ratio (code)"}; });
  Object.entries(baseArticle||{}).forEach(([nom,a])=>{
    if(!a.codeBollore||idx[norm(a.codeBollore)]) return;
    const p=resoudrePrix(nom,baseArticle,ratios,localArticles);
    set(a.codeBollore,{nom:a.designation||nom,puPiece:p.puPiece,pmpCarton:p.pmpCarton,qteCdt:p.qteCdt||a.cdt||1,source:p.source});
  });
  return idx;
}

// Inventaire helper : rows→ articles avec prix résolus
  function parseInventaire(ws){
    if(!ws) return {items:{}, site:"", dateInv:null};
    const rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:null});
    const o=offsetInventaire(rows);
    const g=(r,j)=>r[j-o];
    const items={};
    let site="", dateInv=null;
    if(rows[2]){
      if(g(rows[2],3)) site=String(g(rows[2],3)).trim();
      const dv=parseDate(g(rows[2],6)); if(dv) dateInv=dv.toISOString();
    }
    for(let i=6;i<rows.length;i++){
      const r=rows[i];
      // Format exemplaire 2026 (o=0) : A vide, catégorie en B, fournisseur en C, article en D.
      // Nouveau format (o=1) : catégorie en A, fournisseur en B, article en C.
      const nom=typeof g(r,3)==="string"&&g(r,3).trim()?g(r,3):g(r,2);
      if(!nom||typeof nom!=="string"||!nom.trim()) continue;
      // La ligne de total du classeur écrit « TOTAL STOCK » en colonne B : ce n'est pas un article,
      // et surtout elle clôt le tableau — tout ce qui suit est le récapitulatif par catégorie
      // (libellés « Boissons », « Nourriture - Sec »… écrits dans la colonne de désignation), qui
      // sinon peuplerait l'import de faux articles.
      if(/^total\b/i.test(nom.trim())) break;
      const cartons=typeof g(r,6)==="number"?g(r,6):0;
      const inner  =typeof g(r,7)==="number"?g(r,7):0;
      const unites =typeof g(r,8)==="number"?g(r,8):0;
      const innerCdt=typeof g(r,5)==="number"?g(r,5):0;
      const nombreFichier=typeof g(r,9)==="number"?g(r,9):0;
      const puFichier=typeof g(r,11)==="number"?g(r,11):0;
      const valFichier=typeof g(r,12)==="number"?g(r,12):0;
      // Résoudre prix depuis ratios
      const prix=resoudrePrix(nom, baseArticle, ratios, localArticles);
      const cdtFichier=typeof g(r,4)==="number"&&g(r,4)>0?g(r,4):0;
      const qteCdt=cdtFichier||prix.qteCdt||1;
      // Prix de l'unité d'achat (le carton) : référentiel, à défaut le prix saisi en K, à défaut
      // le prix pièce du référentiel × colisage. Le classeur valorise L = Nombre × Prix carton ;
      // valoriser ici « pièces × prix pièce » mélangeait deux référentiels différents (un prix
      // pièce de carton multiplié par le colisage lu dans la feuille : MOZZARELLA STICKS BIS ×204,
      // CRISPY CHICKEN PATTY ×136) et les totaux de l'appli ne correspondaient plus au fichier.
      const puCarton=prix.pmpCarton>0?prix.pmpCarton:(puFichier>0?puFichier:(prix.puPiece>0?prix.puPiece*qteCdt:0));
      const puPiece=puCarton>0?puCarton/qteCdt:0;
      // Les fichiers générés peuvent ne pas conserver la valeur calculée de J.
      // On la reconstruit à partir des quantités pour éviter un stock nul après import.
      const nombreCalcule=cartons+(inner*innerCdt/qteCdt)+(unites/qteCdt);
      const nombre=nombreFichier>0?nombreFichier:nombreCalcule;
      const qtePieces = nombre>0 ? nombre*qteCdt : 0;
      const valeur=nombre>0?nombre*puCarton:0;
      items[norm(nom)]={
        nom:nom.trim(), categorie:g(r,1)||"", colisage:g(r,4)||"",
        nbCartons:nombre>0?nombre:cartons, inner, unites, qtePieces,
        puCarton, qteCdt, puPiece, valeur, valFichier,
        prixSource:prix.source
      };
    }
    return {items, site, dateInv};
  }

  const ini = parseInventaire(wb.Sheets["Inventaire initial "]||wb.Sheets["Inventaire Initial"]);
  const fin = parseInventaire(wb.Sheets["Inventaire Final "]||wb.Sheets["Inventaire Final"]);

  // ── Transferts AGL → BK (entrées de stock) ───────────────────────────────────────────
  const sorties=[];
  let transfertsExclus=0;
  const siteBkNum=matchBkNumber(ini.site);
  const wsSorties=wb.Sheets["Transferts"]||wb.Sheets["Sorties"];
  if(wsSorties){
    const rows=XLSX.utils.sheet_to_json(wsSorties,{header:1,defval:null});
    const idxParCode=indexerParCode(baseArticle,ratios,localArticles);
    for(let i=4;i<rows.length;i++){
      const r=rows[i];
      const dv=parseDate(r[0]);
      // colonnes du fichier réel : 0 Date,1 BK,2 Désignation,3 Catégorie,4 Code,5 Unité,
      // 6 Conditionnement,7 Quantité,8 Prix carton,9 Valeur sortie,10 CTRL
      // La date est facultative : une ligne est comptée dès qu'elle a une désignation et
      // une quantité (ou une valeur) > 0 — sinon c'est une ligne vide du modèle.
      const nom=r[2]&&typeof r[2]==="string"?r[2].trim():"";
      const cle=r[4]!=null&&r[4]!==""?String(r[4]).trim():"";    // E : code Bolloré, ou désignation
      const qte=typeof r[7]==="number"?r[7]:0;                 // en unités (cartons/kg)
      // Les feuilles comportent des lignes de récapitulatif dont la cellule « Valeur sortie »
      // est un agrégat (SUMIF/SOUS.TOTAL sur tout le bloc) : la lire comme le montant d'une
      // ligne double comptait la période (11 909 827 F relevés sur une ligne à quantité 1).
      // La ligne reste comptée, mais valorisée sur le prix du référentiel.
      const cellJ=wsSorties[XLSX.utils.encode_cell({r:i,c:9})];
      const estAgrégat=!!cellJ?.f && /SUMIF|SOUS\.TOTAL|SUBTOTAL|AGREGAT|CONSOLIDAT/i.test(cellJ.f);
      const valFichier=!estAgrégat&&typeof r[9]==="number"?r[9]:0;
      if(!nom||(qte<=0&&valFichier<=0)) continue;
      // Seuls les transferts AGL → BK DU SITE sont des entrées : une ligne dont le
      // destinataire est un autre BK est exclue (tolérant si l'un des deux n'est pas lisible).
      const bkNum=matchBkNumber(String(r[1]??""));
      if(siteBkNum&&bkNum&&bkNum!==siteBkNum){transfertsExclus++;continue;}
      // Résolution par la clé E (celle du VLOOKUP), avec repli sur la désignation C : un code
      // qui ne désigne aucun article connu ne doit pas faire perdre la ligne.
      const parCode=idxParCode[norm(cle)];
      const parNom=cle?resoudrePrix(cle,baseArticle,ratios,localArticles):null;
      const prixRésolu=parCode||(parNom&&(parNom.pmpCarton>0||parNom.puPiece>0)?parNom:null);
      const prix=prixRésolu||resoudrePrix(nom,baseArticle,ratios,localArticles);
      const designation=(cle&&prix.nom&&norm(prix.nom)!==norm(nom))?prix.nom:nom;   // E fait foi
      const cond=(typeof r[6]==="number"&&r[6]>0)?r[6]:(prix.qteCdt||1);
      // Prix de l'unité saisie en H (le carton) : colonne I du classeur, à défaut le prix
      // carton du référentiel. Le prix pièce ne doit jamais être multiplié par le « Cond. » lu
      // dans la feuille : les deux grandeurs viennent de référentiels différents (PAILLE SODAS :
      // prix d'achat 10 F l'unité × 3 500 = 35 000 F, mais 35 000 F est déjà le prix carton).
      const puUnite=(typeof r[8]==="number"&&r[8]>0)?r[8]:(prix.pmpCarton>0?prix.pmpCarton:(prix.puPiece>0?prix.puPiece*(prix.qteCdt||1):0));
      const valeur=valFichier>0?valFichier:qte*puUnite;        // = Quantité × Prix carton
      const qtePieces=qte*cond;                                 // conversion en pièces
      sorties.push({
        date:dv?dv.toISOString():null, bk:String(r[1]??"").trim(), designation,
        categorie:r[3]||"", codeBollore:cle||r[4]||"", unite:r[5]||"",
        qte, qtePieces, qteCdt:cond, puUnite, puPiece:prix.puPiece, valeur,
        valFichier, prixSource:prix.source
      });
    }
  }

  // ── Pertes (valorisées à la pièce) ───────────────────────────────────────
  const pertes=[];
  const wsPertes=wb.Sheets["Perte_Q1 2026"]||wb.Sheets["Pertes"];
  if(wsPertes){
    const rows=XLSX.utils.sheet_to_json(wsPertes,{header:1,defval:null});
    const o=offsetPertes(rows);
    const g=(r,j)=>r[j-o];
    for(let i=3;i<rows.length;i++){
      const r=rows[i];
      const nom=g(r,2);
      if(!nom||typeof nom!=="string"||!nom.trim()) continue;
      if(/^(nom article|cat[ée]gorie)$/i.test(nom.trim())) continue;  // ligne d'en-tête (fichiers anciens)
      let qtePieces=typeof g(r,7)==="number"?g(r,7):0;
      if(!qtePieces&&o===1){
        // Le modèle généré écrit Quantité perte = SOMME des 31 cellules journalières
        // (colonnes J..AN, indices 9..39). Si Excel n'a pas recalculé la formule
        // (aucune valeur en cache), on somme directement les saisies journalières.
        let sommeJours=0;
        for(let j=9;j<=39;j++){ const v=r[j]; if(typeof v==="number") sommeJours+=v; }
        qtePieces=sommeJours;
      }
      if(qtePieces===0) continue;
      const prix=resoudrePrix(nom,baseArticle,ratios,localArticles);
      // Valorisation à la PIÈCE : qtePieces × puPiece. Le prix pièce de la feuille fait foi —
      // le rapport doit annoncer la même valeur que le TOTAL du classeur ; le référentiel ne
      // sert que si la cellule est vide (formule non recalculée) ou absente du modèle.
      const puFichier=typeof g(r,5)==="number"&&g(r,5)>0?g(r,5):0;
      const puPiece=puFichier>0?puFichier:prix.puPiece;
      const valeur=qtePieces*puPiece;
      pertes.push({
        categorie:g(r,1)||"", nom:nom.trim(),
        qteCdt:prix.qteCdt||1, puPiece,
        qtePieces, valeur,
        prixSource:puFichier>0?"fichier (prix pièce)":prix.source
      });
    }
  }

  // ── Prélèvements Douane ───────────────────────────────────────────────────
  const douane=[];
  let douaneTotal=0;
  const wsDouane=wb.Sheets["P.Douane"];
  if(wsDouane){
    const rows=XLSX.utils.sheet_to_json(wsDouane,{header:1,defval:null});
    const headNew=douaneNewHeaderRow(rows);
    if(headNew>=0){
      // Modèle « vide » : A Date · B Article · C Catégorie · D Code / Désignation (clé saisie)
      // E Cond. · F Qté · G Px carton · H Px pièce · I Valeur. Une ligne est retenue si elle
      // porte une clé ET une saisie réelle (quantité ou valeur non nulle).
      const num=(v)=>typeof v==="number"?v:(typeof v==="string"&&v.trim()?Number(v.replace(/\s/g,"").replace(",", "."))||0:0);
      for(let i=headNew+1;i<rows.length;i++){
        const r=rows[i]; if(!r) continue;
        const cle=r[3];
        const cleTxt=typeof cle==="string"?cle.trim():(cle==null?"":String(cle).trim());
        if((typeof r[0]==="string"?r[0].trim():"")==="TOTAL"){ douaneTotal=num(r[8]); break; }
        if(!cleTxt) continue;
        const qte=num(r[5]), val=num(r[8]);
        if(qte<=0&&val<=0) continue;
        const nom=typeof r[1]==="string"?r[1].trim():"";
        const dt=parseDate(r[0]);
        douane.push({article:(nom||cleTxt),code:cleTxt,
          categorie:typeof r[2]==="string"?r[2].trim():"",
          date:dt?dt.toISOString():null,
          qte,pxCarton:num(r[6]),cdt:num(r[4]),pxPiece:num(r[7]),valeur:val});
      }
    } else {
      const o=offsetDouane(rows);
      const g=(r,j)=>r[j-o];
      for(let i=2;i<rows.length;i++){
        const r=rows[i];
        const art=g(r,1);
        if(art==="TOTAL"){douaneTotal=typeof g(r,7)==="number"?g(r,7):0; break;}
        if(art&&typeof art==="string"&&art.trim()){
          // Les anciens modèles pré-remplissaient la colonne Article : ne retenir une ligne que
          // si elle contient une réelle saisie (date, quantité ou valeur non nulle).
          const dt=parseDate(g(r,2));
          const qte=typeof g(r,3)==="number"?g(r,3):0;
          const val=typeof g(r,7)==="number"?g(r,7):0;
          if(!dt&&qte<=0&&val<=0) continue;
          douane.push({article:art.trim(),date:dt?dt.toISOString():null,
            qte,pxCarton:g(r,4)||0,cdt:g(r,5)||0,pxPiece:g(r,6)||0,valeur:g(r,7)||0});
        }
      }
    }
  }

  // ── Offerts ───────────────────────────────────────────────────────────────
  const offerts={};
  const wsOff=wb.Sheets["Offert"];
  if(wsOff){
    const rows=XLSX.utils.sheet_to_json(wsOff,{header:1,defval:null});
    const o=offsetOffert(rows);
    const g=(r,j)=>r[j-o];
    for(let i=2;i<rows.length;i++){
      const r=rows[i];
      if(g(r,1)&&typeof g(r,1)==="string"&&g(r,1).startsWith("BK"))
        offerts[g(r,1).trim()]={bk:g(r,1).trim(),staffM:g(r,2)||0,mngrM:g(r,3)||0,gt:g(r,4)||0,offer:g(r,5)||0,ho:g(r,6)||0,discountCJ:g(r,7)||0,total:g(r,8)||0};
    }
  }

  return {
    invIni:ini.items, invFin:fin.items,
    site:ini.site||"BK ?", dateInv:ini.dateInv,
    sorties, pertes, douane, douaneTotal, offerts, transfertsExclus
  };
}

// Diagnostic avant calcul : onglets manquants, formules Excel vides, prix non résolus.
export function diagnosticPreAnalyse(wb, baseArticle, ratios, localArticles){
  const alertes=[];
  const refVide = !baseArticle || Object.keys(baseArticle).length===0;
  const cellAddress=(row,col)=>`${String.fromCharCode(65+col)}${row+1}`;

  // 1. Référentiel base article vide
  if(refVide){
    alertes.push({
      niveau: "critique",
      titre: "Référentiel base article non chargé sur cet environnement",
      detail: "Aucun article n'est mémorisé dans l'application. Tous les prix d'inventaire seront résolus à 0 F et le calcul du Réel sera totalement faussé.",
      solution: "Allez dans le menu « 🏷️ Gestion base article » ou l'onglet « 📦 Base articles » pour charger le fichier base article de référence avant de continuer.",
      nb: null
    });
  }

  // 2. Feuilles indispensables du fichier de stock
  const hasIni = !!(wb.Sheets["Inventaire Initial"] || wb.Sheets["Inventaire initial "] || wb.Sheets["Inventaire initial"]);
  const hasFin = !!(wb.Sheets["Inventaire Final"] || wb.Sheets["Inventaire final "] || wb.Sheets["Inventaire final"]);
  if(!hasIni || !hasFin){
    alertes.push({
      niveau: "critique",
      titre: "Onglets d'inventaire obligatoires manquants",
      detail: `Le fichier Excel doit comporter les onglets « Inventaire Initial » et « Inventaire Final ». Manquant(s) : ${!hasIni ? "Inventaire Initial " : ""}${!hasFin ? "Inventaire Final" : ""}.`,
      emplacement: "Onglets du classeur Excel (barre des onglets en bas).",
      solution: "Vérifiez les noms des onglets dans votre fichier Excel et renommez-les exactement en « Inventaire Initial » et « Inventaire Final ».",
      nb: null
    });
  }

  // 3. Fichier probablement non recalculé (quantité présente mais désignation vide)
  let nonRecalcule=0;
  const nonRecalculeLocations=[];
  const offsetOf=(sn,detect)=>{const ws=wb.Sheets[sn]; if(!ws) return 0;
    return detect(XLSX.utils.sheet_to_json(ws,{header:1,defval:null}));};
  ["Inventaire initial ","Inventaire Initial","Inventaire Final ","Inventaire Final"].forEach(sn=>{
    const ws=wb.Sheets[sn]; if(!ws) return;
    const rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:null});
    const o=offsetInventaire(rows);
    for(let i=6;i<rows.length;i++){ const r=rows[i]; if(!r) continue;
      const q=[6,7,8,9].some(c=>typeof r[c-o]==="number"&&r[c-o]>0);
      const desig=r[3-o]&&String(r[3-o]).trim();
      if(q&&!desig){
        nonRecalcule++;
        const quantityColumn=[6,7,8,9].find(c=>typeof r[c-o]==="number"&&r[c-o]>0);
        if(nonRecalculeLocations.length<10){
          const quantityCell=quantityColumn==null?"colonne stock":cellAddress(i,quantityColumn-o);
          nonRecalculeLocations.push(`${sn} ! ${cellAddress(i,3-o)} (quantité en ${quantityCell})`);
        }
      }
    }
  });
  if(nonRecalcule>0){
    alertes.push({
      niveau: "critique",
      titre: "Fichier non recalculé dans Excel (formules vides)",
      detail: `${nonRecalcule} ligne(s) d'inventaire ont une quantité saisie mais aucune désignation calculée par les formules Excel.`,
      emplacement: `${nonRecalculeLocations.join(", ")}${nonRecalcule>10?" …":""}`,
      solution: "Ouvrez ce fichier dans Microsoft Excel, appuyez sur Ctrl+S (pour forcer le calcul des formules et l'enregistrement), puis rechargez-le.",
      nb: nonRecalcule
    });
  }

  // 4. Vérification des ventes PMIX
  const wsPmix = wb.Sheets["PMIX"] || wb.Sheets["pmix"] || wb.Sheets["Pmix"] || wb.Sheets[wb.SheetNames.find(n=>/pmix/i.test(n))];
  if(!wsPmix){
    alertes.push({
      niveau: "attention",
      titre: "Onglet « PMIX » introuvable dans le fichier de suivi",
      detail: "Le classeur ne contient aucun onglet nommé « PMIX ». Le calcul du stock théorique basé sur les ventes sera à 0.",
      emplacement: "Onglets du classeur Excel (barre des onglets en bas).",
      solution: "Ajoutez un onglet nommé « PMIX » dans votre classeur avec les colonnes Item PLU, Item Name, Qty Sold (ou générez un modèle à jour depuis l'onglet Base articles).",
      nb: null
    });
  }

  // 5. Articles avec une désignation renseignée mais AUCUN prix résolu dans le référentiel
  if(!refVide){
    const sansPrix=new Map();
    const prixFichierNul=new Map();
    const wsDouaneDiag=wb.Sheets["P.Douane"];
    const checkSheet=(sn, colNom, minRow, quantityColumns, priceColumn=null, o=0)=>{
      const ws=wb.Sheets[sn]; if(!ws) return;
      const rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:null});
      for(let i=minRow;i<rows.length;i++){ const r=rows[i]; if(!r) continue;
        const nom=r[colNom-o]; if(!nom || typeof nom!=="string" || !nom.trim()) continue;
        const quantityColumn=quantityColumns.find((column)=>{
          const value=r[column-o];
          if(typeof value === "number") return value>0;
          if(typeof value === "string"){
            const parsed=Number(value.replace(/\s/g, "").replace(",", "."));
            return Number.isFinite(parsed) && parsed>0;
          }
          return false;
        });
        const hasQty=quantityColumn!=null;
        if(!hasQty) continue;
        const prix=resoudrePrix(nom,baseArticle,ratios,localArticles);
        const filePrice=priceColumn==null?0:(typeof r[priceColumn-o]==="number"?r[priceColumn-o]:0);
        if(priceColumn!=null && !(filePrice>0)){
          const key=nom.trim();
          if(!prixFichierNul.has(key)) prixFichierNul.set(key,[]);
          if(prixFichierNul.get(key).length<3){
            const priceCell=cellAddress(i,priceColumn-o);
            const quantityCell=quantityColumn==null?"quantité":cellAddress(i,quantityColumn-o);
            prixFichierNul.get(key).push(`${sn} ! ${priceCell} (quantité en ${quantityCell})`);
          }
        }
        // Le fichier de suivi contient déjà un prix calculé en colonne L. Il reste
        // utilisable même si le référentiel mémorisé ne retrouve pas la désignation.
        if(!(prix.puPiece>0) && !(filePrice>0)){
          const key=nom.trim();
          if(!sansPrix.has(key)) sansPrix.set(key,[]);
          if(sansPrix.get(key).length<3) sansPrix.get(key).push(`${sn} ! ${cellAddress(i,colNom-o)}`);
        }
      }
    };
    checkSheet("Inventaire Initial",3,6,[6,7,8,9],11,offsetOf("Inventaire Initial",offsetInventaire));
    checkSheet("Inventaire initial ",3,6,[6,7,8,9],11,offsetOf("Inventaire initial ",offsetInventaire));
    checkSheet("Inventaire Final",3,6,[6,7,8,9],11,offsetOf("Inventaire Final",offsetInventaire));
    checkSheet("Inventaire final ",3,6,[6,7,8,9],11,offsetOf("Inventaire final ",offsetInventaire));
    checkSheet("Transferts",2,4,[7],8); checkSheet("Sorties",2,4,[7],8);
    checkSheet("Pertes",2,3,[7],5,offsetOf("Pertes",offsetPertes));
    const dHead = wsDouaneDiag ? douaneNewHeaderRow(XLSX.utils.sheet_to_json(wsDouaneDiag,{header:1,defval:null})) : -1;
    if(dHead>=0) checkSheet("P.Douane",1,dHead+1,[5],6,0);      // modèle vide : Article en B, Qté en F, Px carton en G
    else checkSheet("P.Douane",1,2,[3],6,offsetOf("P.Douane",offsetDouane));
    if(prixFichierNul.size>0){
      const details=[...prixFichierNul.entries()].slice(0,8).map(([nom,locations])=>`${nom} (${locations.join(", ")})`);
      alertes.push({
        niveau: "attention",
        titre: `${prixFichierNul.size} article(s) avec un prix nul dans le fichier chargé`,
        detail: `Une quantité est saisie mais la colonne du prix contient 0 ou est vide : ${details.join(" ; ")}${prixFichierNul.size>8?" …":""}`,
        emplacement: "Les cellules de prix et de quantité sont indiquées entre parenthèses.",
        solution: "Vérifiez le prix affiché dans la cellule indiquée. Si le prix doit venir du Ratio, rechargez le fichier Ratios puis régénérez le suivi de stock.",
        nb: prixFichierNul.size
      });
    }
    if(sansPrix.size>0){
      const prixDetails=[...sansPrix.entries()].slice(0,8).map(([nom,locations])=>`${nom} (${locations.join(", ")})`);
      alertes.push({
        niveau: "attention",
        titre: `${sansPrix.size} article(s) saisis sans prix dans le référentiel`,
        detail: `Ces articles ont une quantité saisie mais leur prix est résolu à 0 F : ${prixDetails.join(" ; ")}${sansPrix.size>8?" …":""}`,
        emplacement: "Les emplacements sont indiqués entre parenthèses après chaque article (onglet ! cellule).",
        solution: "Vérifiez que la désignation correspond au base article ou mettez à jour les Ratios (« 🔄 Ratios ») pour intégrer ces nouveaux prix.",
        nb: sansPrix.size
      });
    }
  }

  // 6. En-tête d'inventaire incomplet (site)
  const wsIni=wb.Sheets["Inventaire Initial"]||wb.Sheets["Inventaire initial "];
  if(wsIni){
    const rows=XLSX.utils.sheet_to_json(wsIni,{header:1,defval:null});
    const o=offsetInventaire(rows);
    const siteCell=cellAddress(2,3-o);
    const site=rows[2]?.[3-o];
    if(!site || typeof site!=="string" || !site.trim()){
      alertes.push({
        niveau: "attention",
        titre: `Nom du restaurant (Site) non renseigné en cellule ${siteCell}`,
        detail: `La cellule ${siteCell} de l'onglet « Inventaire Initial » est vide. Le rapport sera nommé avec un nom par défaut.`,
        emplacement: `Inventaire Initial ! ${siteCell}`,
        solution: `Renseignez le nom du restaurant (ex: BK 3 - Plateau) en cellule ${siteCell} de l'onglet Inventaire Initial.`,
        nb: null
      });
    }
  }

  return alertes;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── PARSEUR PMIX CONSOLIDÉ (1 fichier, BK1→BK9 côte à côte) ──────────────────
// ═══════════════════════════════════════════════════════════════════════════════
// Repère dynamiquement, sur la ligne d'étiquettes BK (proche du haut de la feuille),
// les cellules "BK1".."BK9" (ou "BK 1", "BK1 - ...") pour retrouver la colonne de
// départ de chaque bloc — robuste à un décalage de colonnes plutôt qu'une position figée.
// Chaque bloc : Item PLU, Item Name, Qty Sold, Price, Amount (+ éventuelles colonnes vides).
export function findPmixSheet(wb){
  return wb.Sheets["PMIX"]||wb.Sheets[wb.SheetNames.find(n=>/pmix/i.test(n))]||wb.Sheets[wb.SheetNames[0]];
}
export function parsePmixConsolideMap(wb){
  const ws=findPmixSheet(wb); if(!ws) return {};
  const rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:null});
  // Ligne d'étiquettes BK : cherchée dans les 5 premières lignes (celle qui contient le plus de "BKn")
  let labelRow=-1, best=0;
  for(let i=0;i<Math.min(5,rows.length);i++){
    const r=rows[i]||[]; let n=0;
    r.forEach(c=>{ if(typeof c==="string" && /^BK\s*\d+/i.test(c.trim())) n++; });
    if(n>best){ best=n; labelRow=i; }
  }
  if(labelRow<0) return {};
  const startCols={};
  (rows[labelRow]||[]).forEach((c,idx)=>{
    if(typeof c!=="string") return;
    const m=c.trim().match(/^BK\s*(\d+)/i);
    if(m) startCols[Number(m[1])]=idx;
  });
  // Ligne d'en-têtes de colonnes (Item PLU/Item Name/Qty Sold), cherchée juste après la ligne de labels
  let headRow=labelRow;
  for(let i=labelRow;i<Math.min(labelRow+4,rows.length);i++){
    const r=rows[i]||[]; if(r.some(c=>typeof c==="string" && /item plu/i.test(c))){ headRow=i; break; }
  }
  const dataStart=headRow+1;
  const byBk={};
  Object.entries(startCols).forEach(([bkStr,c0])=>{
    const bk=Number(bkStr); const items=[];
    for(let i=dataStart;i<rows.length;i++){
      const r=rows[i]; if(!r) continue;
      const pluRaw=r[c0], nomRaw=r[c0+1], qteRaw=r[c0+2], priceRaw=r[c0+3], amountRaw=r[c0+4];
      const plu = normalizePlu(pluRaw);
      const nom = nomRaw ? String(nomRaw).trim() : "";
      const qte = typeof qteRaw === "number" ? qteRaw : parseFloat(String(qteRaw ?? "").replace(/\s+/g, "").replace(/,/, "."));
      if(!plu || !Number.isFinite(qte) || qte === 0 || isExcludedCategory(nom)) continue;
      const price = typeof priceRaw === "number" ? priceRaw : parseFloat(String(priceRaw ?? "").replace(/\s+/g, "").replace(/,/, "."));
      const amount = typeof amountRaw === "number" ? amountRaw : parseFloat(String(amountRaw ?? "").replace(/\s+/g, "").replace(/,/, "."));
      items.push({plu, nom, qty:qte,
        price:Number.isFinite(price)?price:0, amount:Number.isFinite(amount)?amount:0});
    }
    byBk[bk]=items;
  });
  return byBk;                                    // { 1:[{plu,nom,qty}...], 2:[...], ... }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── EXTRACTION DU PMIX DIRECTEMENT DEPUIS UN FICHIER SUIVI DE STOCK ──────────
// ═══════════════════════════════════════════════════════════════════════════════
export function extractPmixFromWorkbook(wb, siteName){
  if(!wb) return [];
  const ws = wb.Sheets["PMIX"] || wb.Sheets["pmix"] || wb.Sheets["Pmix"] || wb.Sheets[wb.SheetNames.find(n=>/pmix/i.test(n))];
  if(!ws) return [];

  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
  if(!rows || rows.length === 0) return [];

  // 1. Essayer le format consolidé multi-colonnes (BK1..BK9)
  const byBk = parsePmixConsolideMap(wb);
  if(byBk && Object.keys(byBk).length > 0){
    const bkNum = matchBkNumber(siteName);
    if(bkNum && byBk[bkNum] && byBk[bkNum].length > 0){
      return byBk[bkNum].map(it => ({ plu: it.plu, nom: it.nom, qty: it.qty, price: it.price, amount: it.amount }));
    }
    const nonEmpties = Object.values(byBk).filter(l => l && l.length > 0);
    if(nonEmpties.length === 1){
      return nonEmpties[0].map(it => ({ plu: it.plu, nom: it.nom, qty: it.qty, price: it.price, amount: it.amount }));
    }
  }

  // 2. Format tabulaire standard (feuille PMIX propre au restaurant)
  let headRow = -1, colPlu = 0, colNom = 1, colQty = 2, colPrice = -1, colAmount = -1;
  for(let i = 0; i < Math.min(10, rows.length); i++){
    const r = rows[i] || [];
    let p = -1, n = -1, q = -1, pr = -1, a = -1;
    r.forEach((c, idx) => {
      if(typeof c === 'string'){
        const cs = c.trim().toLowerCase();
        // Les libellés du récapitulatif (INDICATEUR, TOTAL, COÛT MOYEN…) ne sont pas des
        // en-têtes de colonnes : « INDICATEUR » contient « ca » et était pris pour la colonne
        // du montant, ce qui ramenait tous les montants PMIX à 0 à la relecture.
        if(/^(indicateur|total|co[uû]t moyen)\b/.test(cs)) return;
        if(/plu|code/i.test(cs)) p = idx;
        if(/name|nom|desig|article/i.test(cs)) n = idx;
        if(/qty|qte|quantite|vendu/i.test(cs)) q = idx;
        if(/price|prix|pu/i.test(cs)) pr = idx;
        if(/^amount|^montant|^ca\b/i.test(cs)) a = idx;
      }
    });
    if(p >= 0 && q >= 0){
      headRow = i;
      colPlu = p;
      if(n >= 0) colNom = n;
      colQty = q;
      colPrice = pr;
      colAmount = a;
      break;
    }
  }

  const startRow = headRow >= 0 ? headRow + 1 : 0;
  const items = [];
  for(let i = startRow; i < rows.length; i++){
    const r = rows[i];
    if(!r) continue;
    const pluRaw = r[colPlu];
    const nomRaw = r[colNom];
    const qtyRaw = r[colQty];
    const plu = normalizePlu(pluRaw);
    if(!plu) continue;
    const qty = typeof qtyRaw === 'number' ? qtyRaw : parseFloat(String(qtyRaw ?? '').replace(/\s+/g, '').replace(',', '.'));
    if(!Number.isFinite(qty) || qty === 0) continue;
    const priceRaw = colPrice >= 0 ? r[colPrice] : null;
    const amountRaw = colAmount >= 0 ? r[colAmount] : null;
    const price = typeof priceRaw === 'number' ? priceRaw : parseFloat(String(priceRaw ?? '').replace(/\s+/g, '').replace(',', '.'));
    const amount = typeof amountRaw === 'number' ? amountRaw : parseFloat(String(amountRaw ?? '').replace(/\s+/g, '').replace(',', '.'));
    const nom = nomRaw ? String(nomRaw).trim() : "";
    if (isExcludedCategory(nom)) continue;
    items.push({
      plu,
      nom,
      qty: Math.round(qty * 100) / 100,
      price: Number.isFinite(price) ? price : 0,
      amount: Number.isFinite(amount) ? amount : 0
    });
  }
  return items;
}
