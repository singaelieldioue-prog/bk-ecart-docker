import XLSX from 'xlsx-js-style';
import { fmtDate, statEcart, matchBkNumber } from './formatters.js';
import { ROLES, WORKFLOW } from '../constants.js';
import { sortArticles } from './articleSorter.js';
import { sortArticlesByCustomOrder, CUSTOM_ARTICLES_ORDER } from './customArticleOrder.js';
import { MISSING_PMIX } from './missingPmix.js';
import { PERTES_REFERENTIEL_CDG } from './pertesReferentielCdg.js';
import { INVENTAIRE_REFERENTIEL_CDG } from './inventaireReferentielCdg.js';
import { telechargerXlsx } from './xlsxLogo.js';

// Le logo BK/Servair (137×102 px natif, affiché à 75 % de large → 103×102 px) est injecté en
// haut à gauche de la ligne 1 de chaque feuille visible. La colonne A de chaque feuille a une
// largeur de 143 px = marge 2 px + logo 103 px + écart 38 px (1 cm) : le titre démarre donc
// exactement au bord gauche de la colonne B (index 1) — écart identique sur toutes les feuilles.
// Sur TOUTES les feuilles, les tableaux démarrent en colonne A (sous le logo) : aucune colonne
// vide entre le logo et les données.
const LOGO_PX_W = 103;                 // largeur affichée du logo (137 px × 75 %)
const ECART_LOGO_TITRE_PX = 38;        // 1 cm ≈ 37,8 px à 96 dpi
const HPT_LIGNE_TITRE = 80;   // ≈ 107 px de haut : contient le logo (102 px) sans déborder
const PX_ZONE_LOGO = 2 + LOGO_PX_W + ECART_LOGO_TITRE_PX;   // 143 px
// Excel affiche px = round(width × 7) + 5, mais xlsx-js-style convertit wch → width avec MDW = 6
// (width ≈ wch + 5/6). On retire donc 5/6 pour que la largeur écrite soit bien 19,714 → 143 px.
const WCH_ZONE_LOGO = (PX_ZONE_LOGO - 5) / 7 - 5 / 6;       // 18.881 → width 19,7148 → 143 px
const COL_TITRE = 1;          // colonne B : juste après la zone logo

const isExcludedCategory = (category) => {
  const value = String(category || "").trim().toLowerCase();
  return value.includes("produits de nettoyage") || value.includes("produit de nettoyage");
};

// Toutes les catégories de la base, y compris Produits de Nettoyage (le récap
// d'inventaire doit cumuler la base entière).
const getCategorySummaryList = (articles = []) => {
  const order = new Map();
  const ordered = sortArticles(articles || []).filter((a) => a && a.categorie);
  ordered.forEach((a, idx) => {
    if (!order.has(a.categorie)) order.set(a.categorie, idx);
  });
  return [...order.keys()];
};

// Palette de marque
const XC={brand:"D4531D",brandLt:"FFF3EE",dark:"374151",head:"1F2937",zebra:"F7F8FA",
  line:"E5E7EB",purple:"7C3AED",purpleLt:"F5F3FF",green:"059669",amber:"D97706",
  red:"DC2626",grayTxt:"6B7280",white:"FFFFFF"};
const XLINE={style:"thin",color:{rgb:XC.line}};
const xborder=(o={})=>({top:XLINE,bottom:XLINE,left:XLINE,right:XLINE,...o});
const xfont=(rgb,bold=false,sz=10,italic=false)=>({name:"Calibri",sz,bold,italic,color:{rgb}});
const xfill=(rgb)=>({patternType:"solid",fgColor:{rgb}});
const xal=(h="left",wrap=false)=>({horizontal:h,vertical:"center",wrapText:wrap});
// Formats numériques
const Zm="#,##0",Zm2="#,##0.00",Zpct="0.00%",Zn1="#,##0.0",Zn2="#,##0.00",Zn3="#,##0.000";
// Styles réutilisables
const ST={
  title:   {font:xfont(XC.white,true,15),fill:xfill(XC.brand),alignment:xal("left")},
  titleP:  {font:xfont(XC.white,true,15),fill:xfill(XC.purple),alignment:xal("left")},
  metaK:   {font:xfont(XC.grayTxt,true,10),alignment:xal("left")},
  metaV:   {font:xfont(XC.dark,false,10),alignment:xal("left")},
  section: {font:xfont(XC.white,true,11),fill:xfill(XC.head),alignment:xal("left"),border:xborder()},
  sectionR:{font:xfont(XC.white,true,11),fill:xfill(XC.head),alignment:xal("right"),border:xborder()},
  head:    {font:xfont(XC.white,true,10),fill:xfill(XC.brand),alignment:xal("left",true),border:xborder()},
  headR:   {font:xfont(XC.white,true,10),fill:xfill(XC.brand),alignment:xal("right",true),border:xborder()},
  headP:   {font:xfont(XC.white,true,10),fill:xfill(XC.purple),alignment:xal("left",true),border:xborder()},
  headPR:  {font:xfont(XC.white,true,10),fill:xfill(XC.purple),alignment:xal("right",true),border:xborder()},
  cell:    {font:xfont(XC.dark,false,10),alignment:xal("left"),border:xborder()},
  cellR:   {font:xfont(XC.dark,false,10),alignment:xal("right"),border:xborder()},
  cellMut: {font:xfont(XC.grayTxt,false,10),alignment:xal("left"),border:xborder()},
  strong:  {font:xfont(XC.brand,true,11),alignment:xal("left"),border:xborder()},
  strongR: {font:xfont(XC.brand,true,11),alignment:xal("right"),border:xborder()},
  totalK:  {font:xfont(XC.brand,true,11),fill:xfill(XC.brandLt),alignment:xal("left"),border:xborder({top:{style:"medium",color:{rgb:XC.brand}}})},
  totalV:  {font:xfont(XC.brand,true,11),fill:xfill(XC.brandLt),alignment:xal("right"),border:xborder({top:{style:"medium",color:{rgb:XC.brand}}})},
  totalKp: {font:xfont(XC.purple,true,11),fill:xfill(XC.purpleLt),alignment:xal("left"),border:xborder({top:{style:"medium",color:{rgb:XC.purple}}})},
  totalVp: {font:xfont(XC.purple,true,11),fill:xfill(XC.purpleLt),alignment:xal("right"),border:xborder({top:{style:"medium",color:{rgb:XC.purple}}})},
};
const zeb=(base,ev)=>ev?{...base,fill:xfill(XC.zebra)}:base;
const ecColor=(v)=>v<0?XC.red:v>0?XC.amber:XC.green;
// Constructeur de feuille à partir d'une matrice de cellules stylées
export function xmkSheet(matrix,{cols,merges,rows}={}){
  const ws={}; let maxR=0,maxC=0;
  matrix.forEach((row,r)=>{
    (row||[]).forEach((cell,c)=>{
      if(cell===null||cell===undefined) return;
      const o=(typeof cell==="object"&&!(cell instanceof Date))?cell:{v:cell};
      let t=o.t; if(!t) t=typeof o.v==="number"?"n":o.v instanceof Date?"d":"s";
      const cc={t};
      if(o.f!==undefined) cc.f=o.f;               // formule Excel (sans le "=")
      if(o.v!==undefined) cc.v=o.v;               // valeur (cache) éventuelle
      if(o.z) cc.z=o.z; if(o.s) cc.s=o.s;
      ws[XLSX.utils.encode_cell({r,c})]=cc;
      if(r>maxR)maxR=r; if(c>maxC)maxC=c;
    });
  });
  ws["!ref"]=XLSX.utils.encode_range({s:{r:0,c:0},e:{r:maxR,c:maxC}});
  if(cols) ws["!cols"]=cols;
  if(merges) ws["!merges"]=merges;
  if(rows) ws["!rows"]=rows;
  ws["!margins"]={left:0.4,right:0.4,top:0.5,bottom:0.5,header:0.3,footer:0.3};
  return ws;
}
// Raccourcis cellules
const C =(v,s=ST.cell)=>({v:v==null?"":v,s});
const CR=(v,s=ST.cellR)=>({v:v==null?"":v,s});
const Cn=(v,z=Zm,s=ST.cellR)=>({v:(v==null||isNaN(v))?0:v,t:"n",z,s});
const Cp=(v,s=ST.cellR)=>({v:(v==null||isNaN(v))?0:v,t:"n",z:Zpct,s});

export async function exportExcel(rapport){
  const wb=XLSX.utils.book_new();
  const {data,titre,status,history}=rapport;
  const calc=data.calc||{};
  wb.Props={Title:titre,Author:"SIA RESTAURATION RAPIDE COTE D'IVOIRE — BK Abidjan",Company:"Burger King Côte d'Ivoire",CreatedDate:new Date()};
  const mrg=(r,c1,c2)=>({s:{r,c:c1},e:{r,c:c2}});

  // ── Feuille Synthèse ──────────────────────────────────────────────────────
  {
    const eS=statEcart(calc.ecartMatiereP);
    const eCol=eS==="excellent"?XC.green:eS==="warning"?XC.amber:XC.red;
    const eK={...ST.strong,font:xfont(eCol,true,11)}, eV={...ST.strongR,font:xfont(eCol,true,11)};
    const cols=[{wch:WCH_ZONE_LOGO},{wch:20},{wch:26}];
    const m=[
      [],
      [C("Statut",ST.metaK),C(WORKFLOW[status]?.label||status,ST.metaV)],
      [C("Généré le",ST.metaK),C(new Date().toLocaleString("fr-FR"),ST.metaV)],
      [C("Version Ratios",ST.metaK),C(data.ratiosMeta?.label||"—",ST.metaV)],
      [],
      [{v:"FLUX DE STOCK (RG-03 v3.0)",s:ST.section},{v:"VALEUR (FCFA)",s:ST.sectionR}],
      [C("Stock initial"),Cn(calc.totalValIni)],
      [C("Stock final"),Cn(calc.totalValFin)],
      [C("Variation de stock (Ini − Fin)"),Cn(calc.variationStock)],
      [C("+ Transferts AGL → BK (entrées)"),Cn(calc.totalEntrees)],
      [{v:"= CONSOMMATION RÉELLE",s:ST.totalK},Cn(calc.consoReelle,Zm,ST.totalV)],
      [],
      [{v:"PERTES & PRÉLÈVEMENTS (hors flux stock)",s:ST.section},{v:"VALEUR (FCFA)",s:ST.sectionR}],
      [C("Pertes contrôlées valorisées"),Cn(calc.totalPertes)],
      [C("Prélèvements Douane"),Cn(calc.douaneTotal)],
      [C("Offerts / Repas"),Cn(calc.totalOfferts)],
      [],
      [{v:"ÉCART MATIÈRES (RG-06)",s:ST.section},{v:"FCFA",s:ST.sectionR},{v:"% Conso Théo",s:ST.sectionR}],
      [C("Consommation théorique"),Cn(calc.consoTheoTotal),C("",ST.cell)],
      [C("Consommation réelle"),Cn(calc.consoReelle),C("",ST.cell)],
      [{v:"Écart matières",s:eK},Cn(calc.ecartMatiere,Zm,eV),Cp(calc.ecartMatiereP,eV)],
      [C("Couverts vendus"),Cn(calc.couverts,Zm),C(`${data.ficheMatchees||0} PLU matchés${(calc.complementMatchees||0)>0?` + ${calc.complementMatchees} coût complémentaire`:""} / ${(calc.pmixTheo||[]).length} total`,ST.cellMut)],
    ];
    m[0][COL_TITRE]={v:titre,s:ST.title};
    XLSX.utils.book_append_sheet(wb,xmkSheet(m,{cols,merges:[mrg(0,COL_TITRE,2)],rows:[{hpt:HPT_LIGNE_TITRE}]}),"Synthèse");
  }

  // ── Feuille Écart par article ─────────────────────────────────────────────
  {
    const H=["Catégorie","Article","CDT","PU pièce (FCFA)","Ini (pcs)","Transferts (pcs)","Ventes théo (pcs)","Pertes (pcs)","Stock Théo","Stock Final","Écart (pcs)","Écart (FCFA)"];
    const cols=[{wch:WCH_ZONE_LOGO},{wch:38},{wch:8},{wch:15},{wch:11},{wch:15},{wch:15},{wch:12},{wch:12},{wch:12},{wch:12},{wch:15}];
    const m=[[], H.map((h,i)=>({v:h,s:i<2?ST.head:ST.headR}))];
    sortArticles(calc.articlesEcart||[]).forEach((a,i)=>{
      const ev=i%2===1;
      m.push([
        C(a.categorie||"",zeb(ST.cellMut,ev)),
        C(a.nom,zeb(ST.cell,ev)),
        Cn(a.qteCdt,Zm,zeb(ST.cellR,ev)),
        Cn(a.puPiece,Zm2,zeb(ST.cellR,ev)),
        Cn(a.iniPieces,Zn1,zeb(ST.cellR,ev)),
        Cn(a.entreesPieces,Zn1,zeb(ST.cellR,ev)),
        Cn(a.ventesPieces,Zn2,{...zeb(ST.cellR,ev),font:xfont(XC.purple,false,10)}),
        Cn(a.pertesPieces,Zn1,{...zeb(ST.cellR,ev),font:xfont(XC.red,false,10)}),
        Cn(a.stockTheo,Zn2,zeb(ST.cellR,ev)),
        Cn(a.finPieces,Zn1,zeb(ST.cellR,ev)),
        Cn(a.ecartPieces,Zn2,{...zeb(ST.cellR,ev),font:xfont(ecColor(a.ecartPieces||0),true,10)}),
        Cn(a.ecartVal,Zm,{...zeb(ST.cellR,ev),font:xfont(ecColor(a.ecartVal||0),true,10)}),
      ]);
    });
    m[0][COL_TITRE]={v:`ÉCART PAR ARTICLE — ${data.site||""}`,s:ST.title};
    XLSX.utils.book_append_sheet(wb,xmkSheet(m,{cols,merges:[mrg(0,COL_TITRE,H.length-1)],rows:[{hpt:HPT_LIGNE_TITRE},{hpt:32}]}),"Écart par article");
  }

  // ── Feuille Pertes ────────────────────────────────────────────────────────
  {
    const H=["Catégorie","Article","Qté pièces perdues","PU pièce (FCFA)","Valeur perte (FCFA)"];
    const cols=[{wch:WCH_ZONE_LOGO},{wch:38},{wch:18},{wch:16},{wch:18}];
    const m=[[], H.map((h,i)=>({v:h,s:i<2?ST.head:ST.headR}))];
    sortArticles(data.stockData?.pertes||[]).forEach((p,i)=>{const ev=i%2===1;
      m.push([C(p.categorie||"",zeb(ST.cellMut,ev)),C(p.nom,zeb(ST.cell,ev)),Cn(p.qtePieces,Zn1,zeb(ST.cellR,ev)),Cn(p.puPiece,Zm2,zeb(ST.cellR,ev)),Cn(p.valeur,Zm,zeb(ST.cellR,ev))]);});
    m.push([C("",ST.totalK),C("TOTAL",ST.totalK),C("",ST.totalV),C("",ST.totalV),Cn(calc.totalPertes,Zm,ST.totalV)]);
    m[0][COL_TITRE]={v:"PERTES CONTRÔLÉES",s:ST.title};
    XLSX.utils.book_append_sheet(wb,xmkSheet(m,{cols,merges:[mrg(0,COL_TITRE,4)],rows:[{hpt:HPT_LIGNE_TITRE},{hpt:22}]}),"Pertes");
  }

  // ── Feuille Conso théo ingrédients ────────────────────────────────────────
  {
    const H=["Ingrédient","PMP (FCFA/u)","Qté consommée","Valeur FCFA","% total"];
    const cols=[{wch:WCH_ZONE_LOGO},{wch:14},{wch:16},{wch:16},{wch:12}];
    const m=[[], H.map((h,i)=>({v:h,s:i<1?ST.head:ST.headR}))];
    (calc.consoParIng||[]).forEach((v,i)=>{const ev=i%2===1; const share=calc.consoTheoTotal?v.valeurTotal/calc.consoTheoTotal:0;
      m.push([C(v.nom,zeb(ST.cell,ev)),Cn(v.pmp,Zm2,zeb(ST.cellR,ev)),Cn(v.qteTotal,Zn3,zeb(ST.cellR,ev)),Cn(v.valeurTotal,Zm,zeb(ST.cellR,ev)),Cp(share,zeb(ST.cellR,ev))]);});
    m[0][COL_TITRE]={v:"CONSOMMATION THÉORIQUE PAR INGRÉDIENT",s:ST.title};
    XLSX.utils.book_append_sheet(wb,xmkSheet(m,{cols,merges:[mrg(0,COL_TITRE,4)],rows:[{hpt:HPT_LIGNE_TITRE},{hpt:22}]}),"Conso théo ingrédients");
  }

  // ── Feuille PMIX valorisé ─────────────────────────────────────────────────
  {
    const H=["PLU","Produit","Catégorie","Qté vendue","Prix unitaire","CA FCFA","Coût théo unit.","Coût théo total","Fiche / source"];
    const cols=[{wch:WCH_ZONE_LOGO},{wch:34},{wch:20},{wch:11},{wch:14},{wch:14},{wch:15},{wch:15},{wch:16}];
    const m=[[], H.map((h,i)=>({v:h,s:(i===1||i===2)?ST.head:ST.headR}))];
    (calc.pmixTheo||[]).forEach((p,i)=>{const ev=i%2===1;
      const lib=p.source==="complement"?"Coût complémentaire":(p.match?"Ratio":"Non");
      m.push([
        Cn(p.plu,Zm,zeb(ST.cellR,ev)),C(p.nom,zeb(ST.cell,ev)),C(p.categorie||"",zeb(ST.cellMut,ev)),
        Cn(p.qty,Zm,zeb(ST.cellR,ev)),Cn(p.price,Zm2,zeb(ST.cellR,ev)),Cn(p.amount,Zm,zeb(ST.cellR,ev)),Cn(p.coutUnit,Zm2,zeb(ST.cellR,ev)),Cn(p.coutTheo,Zm,zeb(ST.cellR,ev)),
        C(lib,{...zeb(ST.cellR,ev),font:xfont(p.source==="complement"?XC.amber:(p.match?XC.green:XC.red),true,10)}),
      ]);});
    m[0][COL_TITRE]={v:"PMIX VALORISÉ",s:ST.title};
    XLSX.utils.book_append_sheet(wb,xmkSheet(m,{cols,merges:[mrg(0,COL_TITRE,8)],rows:[{hpt:HPT_LIGNE_TITRE},{hpt:22}]}),"PMIX valorisé");
  }

  // ── Feuille Anomalies ─────────────────────────────────────────────────────
  {
    const H=["TYPE","PLU / Article","Nom","Qté","Note"];
    const cols=[{wch:WCH_ZONE_LOGO},{wch:14},{wch:40},{wch:8},{wch:42}];
    const m=[[], H.map((h,i)=>({v:h,s:i===3?ST.headR:ST.head}))];
    const an=[
      ...(calc.pluNonMatchés||[]).map(p=>["PLU sans fiche technique",p.plu,p.nom,p.qty,"Consommation théo non calculée"]),
      ...(calc.pluHorsMatiere||[]).map(p=>["Ligne hors matière",p.plu,p.nom,p.qty,"Aucune matière consommée — écartée du calcul, pas de fiche à créer"]),
      // A-02 / C-11 : catégories non-matière sorties de l'écart par le paramètre
      // CATEGORIES_HORS_ECART. Tracées ici pour le CDG, hors du décompte « Article PU = 0 ».
      ...(calc.articlesHorsEcart||[]).map(a=>["Hors écart (catégorie)","—",a.nom,a.qte,
        `${a.categorie||"—"} · exclu du calcul d'écart (paramètre CATEGORIES_HORS_ECART) — stock initial ${Math.round(a.iniValeur||0)} F · final ${Math.round(a.finValeur||0)} F`]),
      ...(calc.articlesEcart||[]).filter(a=>!a.puPiece||a.puPiece===0).map(a=>["Article PU = 0","—",a.nom,"—","Prix non résolu — vérifier référentiels"]),
      // C-09 / C-13 : PLU vendus dont le coût résolu est nul ou absent.
      ...(calc.pluCoutNul||[]).map(p=>["Coût nul",p.plu,p.nom,p.qty,
        `${p.qty} pièces · ${((Number(p.partVentes)||0)*100).toFixed(1).replace(".",",")} % des ventes · coût unitaire ${p.coutUnit==null?"absent":p.coutUnit} F`]),
      ...(calc.pmixDoublons||[]).map(d=>["PLU en doublon",d.plu,d.nom||"—",d.qty,`${d.lignes} lignes vendues pour ce PLU`]),
      ...(calc.ratioCoutNulCount>0?[["Référentiel : PLU à coût nul","—","Référentiel PMIX",calc.ratioCoutNulCount,
        `${calc.ratioCoutNulVendus||0} vendu(s) — distinct des PLU à 0 du PMIX`]]:[]),
      // C-10 / C-12 : le prix saisi dans le classeur et celui du référentiel ne sont jamais
      // arbitrés en silence — l'écart est signalé, le choix reste au CDG.
      ...(calc.ecartsPrix||[]).map(e=>["Prix saisi ≠ référentiel","—",e.nom,e.qte,
        `${e.origine} · ${e.sens} : ${Math.abs(e.montant).toLocaleString("fr-FR",{maximumFractionDigits:2})} F (${Math.abs(e.pct*100).toFixed(1).replace(".",",")} %) · saisi ${Number(e.puSaisi).toLocaleString("fr-FR",{maximumFractionDigits:2})} F vs référentiel ${Number(e.puRef).toLocaleString("fr-FR",{maximumFractionDigits:2})} F`]),
      ...(calc.valorisationsBloquees||[]).map(v=>["Valorisation bloquée","—",v.nom,v.qte,
        `${v.origine} · aucun prix (référentiel ni saisi) — la ligne ne peut pas valoir 0 F sans arbitrage`]),
      // Doublons : deux lignes ne fusionnent jamais en silence, le conflit est écrit noir sur blanc.
      ...(calc.doublonsInventaire||[]).map(d=>d.type==="designation"
        ? ["Doublon de désignation",d.nom||"—",d.nom||"—",d.lignes,`${d.lignes} lignes saisies pour la même désignation — conservées séparément`]
        : ["Code article partagé",d.code||"—",(d.noms||[]).join(" / "),d.lignes,`Code ${d.code} porté par ${d.lignes} désignations distinctes`]),
      // Intégrité des saisies d'inventaire.
      ...(calc.anomaliesIntegrite||[]).map(a=>[a.type,"—",a.nom,"—",a.detail||""]),
    ];
    if(an.length===0) an.push(["—","—","Aucune anomalie détectée","—","Tous les PLU matchés · tous les prix résolus"]);
    an.forEach((r,i)=>{const ev=i%2===1;
      m.push([
        C(r[0],{...zeb(ST.cell,ev),font:xfont(XC.amber,true,10)}),
        typeof r[1]==="number"?Cn(r[1],Zm,zeb(ST.cellR,ev)):C(r[1],zeb(ST.cellR,ev)),
        C(r[2],zeb(ST.cell,ev)),
        typeof r[3]==="number"?Cn(r[3],Zm,zeb(ST.cellR,ev)):C(r[3],zeb(ST.cellR,ev)),
        C(r[4],zeb(ST.cellMut,ev)),
      ]);});
    // Synthèse chiffrée de l'impact des PLU à coût nul sur le coût moyen par couvert.
    if((calc.pluCoutNul||[]).length){
      m.push([]);
      m.push([C("SYNTHÈSE COÛT NUL",ST.section)]);
      m.push([C("Coût moyen / couvert avec les PLU à coût nul"),C(""),Cn(calc.coutMoyenAvec,"#,##0.00")]);
      m.push([C("Coût moyen / couvert sans les PLU à coût nul"),C(""),Cn(calc.coutMoyenSans,"#,##0.00")]);
    }
    m[0][COL_TITRE]={v:"ANOMALIES",s:ST.title};
    XLSX.utils.book_append_sheet(wb,xmkSheet(m,{cols,merges:[mrg(0,COL_TITRE,4)],rows:[{hpt:HPT_LIGNE_TITRE},{hpt:22}]}),"Anomalies");
  }

  // ── Feuille Douane (thème violet) ─────────────────────────────────────────
  {
    const H=["Article","Catégorie","Date","Qté","Prix carton","CDT","Prix pièce","Valeur FCFA"];
    const cols=[{wch:WCH_ZONE_LOGO},{wch:14},{wch:20},{wch:9},{wch:14},{wch:8},{wch:14},{wch:16}];
    const m=[[], H.map((h,i)=>({v:h,s:i<3?ST.headP:ST.headPR}))];
    (data.stockData?.douane||[]).forEach((d,i)=>{const ev=i%2===1;
      m.push([
        C(d.article,zeb(ST.cell,ev)),C(d.categorie||"—",zeb(ST.cellMut,ev)),C(d.date?new Date(d.date).toLocaleDateString("fr-FR"):"—",zeb(ST.cellMut,ev)),
        Cn(d.qte,Zm,zeb(ST.cellR,ev)),Cn(d.pxCarton,Zm,zeb(ST.cellR,ev)),Cn(d.cdt,Zm,zeb(ST.cellR,ev)),Cn(d.pxPiece,Zm2,zeb(ST.cellR,ev)),
        Cn(d.valeur,Zm,{...zeb(ST.cellR,ev),font:xfont(XC.purple,false,10)}),
      ]);});
    m.push([C("TOTAL",ST.totalKp),C("",ST.totalKp),C("",ST.totalKp),C("",ST.totalVp),C("",ST.totalVp),C("",ST.totalVp),C("",ST.totalVp),Cn(data.stockData?.douaneTotal,Zm,ST.totalVp)]);
    m[0][COL_TITRE]={v:"PRÉLÈVEMENTS DOUANE",s:ST.titleP};
    XLSX.utils.book_append_sheet(wb,xmkSheet(m,{cols,merges:[mrg(0,COL_TITRE,7)],rows:[{hpt:HPT_LIGNE_TITRE},{hpt:22}]}),"Douane");
  }

  // ── Feuille Historique ────────────────────────────────────────────────────
  {
    const H=["Date","Acteur","Rôle","Statut","Commentaire"];
    const cols=[{wch:WCH_ZONE_LOGO},{wch:10},{wch:32},{wch:18},{wch:44}];
    const m=[[], H.map(h=>({v:h,s:ST.head}))];
    (history||[]).forEach((h,i)=>{const ev=i%2===1;
      m.push([C(fmtDate(h.at),zeb(ST.cellMut,ev)),C(ROLES[h.actor]?.short||h.actor,zeb(ST.cell,ev)),C(ROLES[h.actor]?.label||"",zeb(ST.cellMut,ev)),C(WORKFLOW[h.status]?.label||h.status,zeb(ST.cell,ev)),C(h.commentaire||"",zeb(ST.cell,ev))]);});
    m[0][COL_TITRE]={v:"HISTORIQUE DU RAPPORT",s:ST.title};
    XLSX.utils.book_append_sheet(wb,xmkSheet(m,{cols,merges:[mrg(0,COL_TITRE,4)],rows:[{hpt:HPT_LIGNE_TITRE},{hpt:22}]}),"Historique");
  }

  await telechargerXlsx(wb,`${titre.replace(/[^a-zA-Z0-9_-]/g,"_")}.xlsx`);
}

// E « Nb articles / inner » est vide sur 203 lignes du modèle sur 318 : la colonne I
// (F + IF(D>0;G*E/D;0) + IF(D>0;H/D;0)) annule alors le « Inner » saisi en G.
// Quand le colisage D existe (> 1), l'inner retenu est le carton : E = D. Un E déjà
// renseigné n'est jamais écrasé et D n'est jamais modifié.
// Garde-fou : le plus grand colisage légitime du fichier CDG est 1000 (sacs et dosettes
// par millier). Au-delà, D est une valeur aberrante (SACHET FRITES PETIT 4000 : 11 inners
// deviendraient 44 000 pièces) — la dérivation est bloquée et le signal est tracé.
export const SEUIL_COLISAGE_ABSURDE = 1000;
export function deriveInnerDepuisColisage(article){
  const inner = Number(article?.qteInner);
  if(Number.isFinite(inner) && inner > 0) return { qteInner: article.qteInner, source: null };
  const cdt = Number(article?.conditionnement);
  if(!Number.isFinite(cdt) || cdt <= 1) return { qteInner: article?.qteInner, source: "non_derive" };
  if(cdt > SEUIL_COLISAGE_ABSURDE) return { qteInner: article?.qteInner, source: "derive_E_bloque_D_absurde" };
  return { qteInner: cdt, source: "derive_E" };
}

export function buildModelesWb(articles, produits, site="", period="", dateInv="", destinataires=[], pmixComplement={}, baseComplete=[]){
  const wb=XLSX.utils.book_new();
  const pmixFromRatio = (produits||[]).filter((p)=>p&&p.nom);
  // Fusionner avec la liste de secours : les produits du ratio ont la priorité,
  // les PLU absents du ratio sont complétés par la base complémentaire PMIX (noms officiels)
  // puis par MISSING_PMIX, pour éviter "PLU ABSENT DU RATIO".
  // Le référentiel donne un COÛT UNITAIRE (validé par le CDG : Whopper = 1 187 F = Ratios!D5,
  // et non le PV TTC 5 500 F = Ratios!C5). Le coût de la base complémentaire PMIX y entre donc
  // directement — c'est la seule valorisation des PLU sans fiche Ratio (713, 715, 400265…).
  const ratioPluSet = new Set(pmixFromRatio.map(p => String(p.plu ?? '').trim()));
  const compPluSet = new Set(Object.keys(pmixComplement || {}));
  const pmixProducts = [
    ...pmixFromRatio,
    ...Object.entries(pmixComplement || {})
      .filter(([plu]) => !ratioPluSet.has(plu))
      .map(([plu, c]) => ({ plu, nom: String(c?.nom || plu).trim(), coutTheo: Number(c?.cout) > 0 ? Number(c.cout) : 0, pvTtc: null })),
    ...MISSING_PMIX.filter(p => {
      const k = String(p.plu ?? '').trim();
      return !ratioPluSet.has(k) && !compPluSet.has(k);
    }),
  ];
  const pmixPriceSheet="Référentiel PMIX";
  const artRefSheet="Référentiel Articles";
  const H =(t)=>({v:t,s:ST.head});
  const HR=(t)=>({v:t,s:ST.headR});
  const put=(arr,idx,cell)=>{ arr[idx]=cell; };

  // Prix de repli par CODE ARTICLE : le modèle d'inventaire et la base désignent parfois le même
  // article différemment (« BOUTEILLE COCA COLA 1.5L » côté CDG, « BTL-COCA 1.5L » ou
  // « BTL COCA 1 5L » côté base) mais partagent le code. Index normalisé (ponctuation et espaces
  // repliés) des seuls articles cotés : il sert quand la ligne générée n'a pas de prix, jamais à
  // écraser un prix existant.
  const cleCode=(s)=>String(s||"").trim().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]/gi,"").toUpperCase();
  const prixParCode=new Map();
  (articles||[]).forEach((a)=>{
    const k=a&&cleCode(a.code);
    if(k&&Number(a.pu_carton)>0&&!prixParCode.has(k)) prixParCode.set(k,Number(a.pu_carton));
  });
  const prixDuCode=(a)=>(a&&cleCode(a.code)?prixParCode.get(cleCode(a.code))||0:0);

  // Référentiel « Inventaire initial » du CDG (module src/utils/inventaireReferentielCdg.js, relevé
  // du 26/10/2026) : clé normalisée -> ligne du CDG. Partagé par les Inventaires et par le
  // Référentiel Articles, que lisent Transferts (colonne I) et P.Douane (colonne G).
  const cleRefInv = (s) => String(s || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
  const REF_INV = new Map();
  INVENTAIRE_REFERENTIEL_CDG.forEach((t) => { const k = cleRefInv(t.nom); if (!REF_INV.has(k)) REF_INV.set(k, t); });
  // Prix CARTON du CDG quand sa feuille Inventaire laisse la ligne à 0 : sa table des pertes cote
  // le même article à la même désignation (BOUTEILLE COCA COLA 1.5L, Cond. 6 : 3 686 F le pack),
  // là où la base ne connaît qu'un prix pièce (127,47 F, colisage 1). Le carton prime : ramené au
  // prix pièce de son colisage, puis recomposé sur le Cond. de la ligne publiée.
  const PERTES_CARTON = new Map();
  PERTES_REFERENTIEL_CDG.forEach((t) => {
    const k = cleRefInv(t.nom);
    if (Number(t.pu) > 0 && !PERTES_CARTON.has(k)) PERTES_CARTON.set(k, t);
  });
  const prixCartonCdg = (nom, cond) => {
    const t = PERTES_CARTON.get(cleRefInv(nom));
    if (!t) return 0;
    const condT = Number(t.cond) > 0 ? Number(t.cond) : 1;
    return (Number(t.pu) / condT) * (Number(cond) > 0 ? Number(cond) : 1);
  };

  // Inventaire (Initial & Final) — les données démarrent en colonne A (sous le logo),
  // dès la ligne 7. Colonnes (nouveau format, index 0-based) :
  //   A(0)=Catégorie  B(1)=Frns  C(2)=Désignation  D(3)=Colisage  E(4)=Qté/inner
  //   F(5)=Cartons  G(6)=Inner  H(7)=Unités  I(8)=Nombre  J(9)=Unité  K(10)=PU carton
  //   L(11)=Valeur  M(12)=spacer  N(13)=Code  O(14)=Pièces
  // Les anciens fichiers (données décalées d'une colonne vers la droite, catégorie en B,
  // désignation en D…) restent importables : parsers.js détecte l'offset automatiquement.
  const SAISIEFILL = xfill("E8F5E9"); // vert clair pour les colonnes de saisie
  const CALCFILL   = xfill("FFF3E0"); // orange clair pour les colonnes calculées
  const REFFILL    = xfill("E3F2FD"); // bleu clair pour les colonnes référentiel
  const headSaisie = (t)=>({v:t,s:{...ST.head,fill:xfill("2E7D32")}});  // vert foncé
  const headCalc   = (t)=>({v:t,s:{...ST.head,fill:xfill("E65100")}});  // orange foncé
  const headRef    = (t)=>({v:t,s:{...ST.head,fill:xfill("1565C0")}});  // bleu foncé
  const saisieCell = (v,ev)=>({ v:v==null?"":v, s:{...ST.cell, fill:ev?SAISIEFILL:{...SAISIEFILL,fill:xfill("C8E6C9")}, border:xborder()} });
  const saisieCellN= (ev)=>({ v:0, t:"n", z:"#,##0", s:{font:xfont("2E7D32",false,11), fill:ev?SAISIEFILL:{...SAISIEFILL,fill:xfill("C8E6C9")}, alignment:xal("right"), border:xborder({left:{style:"medium",color:{rgb:"2E7D32"}},right:{style:"medium",color:{rgb:"2E7D32"}}})} });
  const calcCellF  = (f,ev)=>({t:"n",f,z:"#,##0.00",s:{font:xfont("E65100",true,10),fill:ev?CALCFILL:{...CALCFILL,fill:xfill("FFE0B2")},alignment:xal("right"),border:xborder()}});
  const calcCellV  = (f,ev)=>({t:"n",f,z:"#,##0",s:{font:xfont("E65100",true,10),fill:ev?CALCFILL:{...CALCFILL,fill:xfill("FFE0B2")},alignment:xal("right"),border:xborder()}});
  const categoryFill=(category)=>{
    const value=String(category||"").trim().toLowerCase();
    if(value==="boissons") return xfill("F8CBAD");
    if(value==="nourriture - surgele" || value==="nourriture - surgelé" || value==="nourriture - frais" || value==="nourriture - sec") return xfill("DDEBF7");
    if(value==="packaging") return xfill("FCE4D6");
    if(value==="produits de nettoyage") return xfill("E2F0D9");
    if(value==="ifb" || value==="pmc") return xfill("B0BEC5");
    return xfill("F8FAFC");
  };

  const invSheet=(name)=>{
    const cols=[{wch:WCH_ZONE_LOGO},{wch:12},{wch:40},{wch:14},{wch:18},{wch:18},{wch:10},{wch:10},{wch:10},{wch:12},{wch:18},{wch:15},{wch:3},{wch:15},{wch:18}];
    const K=COL_TITRE;
    const rows=[];
    const headerFill=xfill("D9E0E5");
    const tableLine={style:"medium",color:{rgb:"607D8B"}};
    const tableBorder=()=>({top:tableLine,bottom:tableLine,left:tableLine,right:tableLine});
    const headerBorder={top:{style:"thick",color:{rgb:"263238"}},bottom:{style:"thick",color:{rgb:"263238"}},left:{style:"medium",color:{rgb:"263238"}},right:{style:"medium",color:{rgb:"263238"}}};
    const headerCell=(t)=>({v:t,s:{...ST.head,fill:headerFill,border:headerBorder}});
    rows[0]=[];
    put(rows[0],K,{v:`${name} — ${site||"BK ____"}${period?" · "+period:""}`,s:ST.title});
    rows[1]=[];
    put(rows[1],0,{v:"◀ RÉFÉRENTIEL",s:{font:xfont("1565C0",true,10),fill:xfill("BBDEFB"),alignment:xal("center"),border:xborder()}});
    put(rows[1],5,{v:"✏️ SAISIE INVENTAIRE",s:{font:xfont("2E7D32",true,10),fill:xfill("C8E6C9"),alignment:xal("center"),border:xborder()}});
    put(rows[1],8,{v:"= CALCUL AUTOMATIQUE",s:{font:xfont("E65100",true,10),fill:xfill("FFE0B2"),alignment:xal("center"),border:xborder()}});
    rows[2]=[];
    put(rows[2],1,C("Site",ST.metaK)); put(rows[2],2,C(site||"(renseigner ici)",ST.cell));
    put(rows[2],4,C("Date inventaire",ST.metaK));
    put(rows[2],5,dateInv?{v:dateInv,t:"d",z:"dd/mm/yyyy",s:ST.cell}:{v:"",s:ST.cell,z:"dd/mm/yyyy"});
    put(rows[2],8,C("Période",ST.metaK)); put(rows[2],9,C(period||"",ST.cell));
    rows[3]=[];
    put(rows[3],0,{v:"📌 Saisir uniquement les colonnes vertes : Carton, Inner et Unités.",s:{font:xfont("374151",false,10,true),fill:xfill("FFFDE7"),alignment:xal("left"),border:xborder()}});
    rows[4]=[];
    put(rows[4],0,headerCell("CATEGORIE")); put(rows[4],1,headerCell("Frns")); put(rows[4],2,headerCell("ARTICLE"));
    put(rows[4],3,headerCell("COLISAGE")); put(rows[4],4,headerCell(""));
    put(rows[4],5,headerCell("INVENTAIRE")); put(rows[4],6,headerCell("")); put(rows[4],7,headerCell(""));
    put(rows[4],8,headerCell("STOCK FINAL")); put(rows[4],9,headerCell("")); put(rows[4],10,headerCell("")); put(rows[4],11,headerCell(""));
    put(rows[4],13,headerCell("REPORT OMEGA")); put(rows[4],14,headerCell(""));
    rows[5]=[headerCell(""),headerCell(""),headerCell(""),headerCell("Nb articles / carton"),headerCell("Nb articles / inner"),headerCell("Carton"),headerCell("Inner"),headerCell("Unités"),headerCell("Nombre"),headerCell("Unité"),headerCell("Prix carton"),headerCell("Valeur stock"),undefined,headerCell("Code Article"),headerCell("Quantité (unité)")];
    
    // Fonction pour normaliser les noms d'articles. La ponctuation est repliée : le base
    // article écrit « BOUTEILLE PEPSI 1.5L », « Hamburger Patty Toledo » ou « BUN 4'' NOUGATINE »
    // là où la liste de référence écrit « 1,5L », « PATTY - Toledo » ou « 4’’ » — sans ce repli,
    // ces articles du CDG disparaissaient silencieusement des inventaires générés.
    const normalizeString = (str) => 
      String(str || "")
        .trim()
        .toUpperCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^A-Z0-9]/g, "");
    
    // Créer une map des articles de la liste personnalisée
    const customOrderMap = new Map();
    CUSTOM_ARTICLES_ORDER.forEach((name, index) => {
      const norm = normalizeString(name);
      customOrderMap.set(norm, index);
    });
    
    // Compter les articles de la liste personnalisée qui sont présents
    let customArticleCount = 0;
    articles.forEach((a) => {
      const norm = normalizeString(a.nom);
      if (customOrderMap.has(norm)) {
        customArticleCount++;
      }
    });
    
    // Trier et filtrer les articles en respectant strictement la liste et l'ordre personnalisé
    const sortedArticles = articles
      .filter((a) => customOrderMap.has(normalizeString(a.nom)))
      .sort((a, b) => customOrderMap.get(normalizeString(a.nom)) - customOrderMap.get(normalizeString(b.nom)));
    
    // La feuille publie le référentiel « Inventaire initial » du classeur du CDG (module
    // src/utils/inventaireReferentielCdg.js, relevé du 26/10/2026) : COLISAGE, « Nb articles /
    // inner », unité affichée et prix de valorisation de chaque article sont ceux de sa feuille,
    // ligne à ligne — le modèle d'inventaire transmis ne sert plus qu'aux articles que le CDG ne
    // liste pas, et la dérivation inner depuis le colisage (E-DERIVE) ne s'applique qu'à ceux-là.
    // REF_INV et prixCartonCdg vivent dans la zone d'aides partagée : le Référentiel Articles les
    // réutilise pour que Transferts et P.Douane publient le même prix carton.

    let actualRowIndex = 6; // Index réel dans le fichier (après les en-têtes)
    
    sortedArticles.forEach((a, sortedIndex) => {
      const r = []; 
      const ev = sortedIndex % 2 === 1; 
      const R = actualRowIndex + 1;
      
      const rowFill = categoryFill(a.categorie);
      const withoutBorder = (s) => { const { border, ...style } = s; return { ...style, fill: rowFill }; };
      const ref = (s) => withoutBorder(s);
      const saisie = (s) => withoutBorder(s);
      const calcule = (s) => withoutBorder(s);
      const refCdg = REF_INV.get(cleRefInv(a.nom));
      const inner = refCdg ? { qteInner: refCdg.inner, source: null } : deriveInnerDepuisColisage(a);
      if (inner.source) a.conditionnement_source = inner.source;
      if (inner.source === "derive_E_bloque_D_absurde" && name === "Inventaire Initial") {
        console.warn(`D=${a.conditionnement} > ${SEUIL_COLISAGE_ABSURDE} pour ${a.code || a.nom} — dérivation E bloquée, à corriger dans le fichier CDG`);
      }
      
      put(r, 0, C(a.categorie || "", ref(ST.cellMut))); 
      put(r, 1, C(a.fournisseur || "SIA", ref(ST.cellMut)));
      put(r, 2, C(a.nom || "", { ...ref(ST.cell), font: xfont("1F2937", true, 10) })); 
      // Cellule vide chez le CDG = pas de valeur publiée (24 lignes sans colisage : produits pesés).
      if (!refCdg || refCdg.cond !== undefined) put(r, 3, Cn(refCdg ? refCdg.cond : a.conditionnement, "#,##0.##", ref(ST.cellR)));
      if (!refCdg || refCdg.inner !== undefined) put(r, 4, Cn(refCdg ? refCdg.inner : inner.qteInner, "#,##0.##", ref(ST.cellR)));
      put(r, 5, saisie(saisieCellN(ev))); 
      put(r, 6, saisie(saisieCellN(ev))); 
      put(r, 7, saisie(saisieCellN(ev)));
      put(r, 8, calcule(calcCellF(`F${R}+IF(D${R}>0,G${R}*E${R}/D${R},0)+IF(D${R}>0,H${R}/D${R},0)`, ev)));
      put(r, 9, C(refCdg ? (refCdg.unite || "") : (a.unite || ""), ref(ST.cellMut))); 
      // Le prix du CDG fait foi quand il est renseigné ; son 0 est un trou (article qu'il ne cote
      // pas dans son Inventaire initial). Le prix CARTON prime alors sur le prix pièce de la base :
      // celui de sa table des pertes (BOUTEILLE COCA COLA 1.5L : 3 686 F le pack de 6, pas 127,47 F
      // la pièce), puis celui de la ligne, puis celui du même code article.
      const puRef = refCdg ? Number(refCdg.pu) : 0;
      const puCartonCdg = refCdg ? prixCartonCdg(refCdg.nom, refCdg.cond) : 0;
      const puInv = puRef > 0 ? puRef
        : (puCartonCdg > 0 ? puCartonCdg
        : (Number(a.pu_carton) > 0 ? Number(a.pu_carton) : prixDuCode(a)));
      put(r, 10, Cn(puInv, "#,##0.##", ref(ST.cellR)));
      put(r, 11, calcule(calcCellV(`I${R}*K${R}`, ev))); 
      put(r, 13, C(a.code || "", ref(ST.cellMut)));
      put(r, 14, { t: "n", f: `F${R}*D${R}+G${R}*E${R}+H${R}`, z: "#,##0.##", s: ref(ST.cellR) }); 
      
      rows[actualRowIndex] = r;
      actualRowIndex++;
      
    });
    
    const lastDataRow = actualRowIndex;
    const tot = [];
    put(tot, 1, { v: "TOTAL STOCK", s: { ...ST.totalK, border: headerBorder } }); 
    
    const sumFormula = `SUM(L7:L${lastDataRow})`;
    
    put(tot, 11, { t: "n", f: sumFormula, s: { ...ST.totalV, border: headerBorder }, z: "#,##0" }); rows.push(tot);

    // Récapitulatif par catégorie sous le tableau, reproduit cellule pour cellule du bloc du
    // fichier du CDG (exemple inventaire.xlsx, feuille inventaire, lignes 330-336) : libellé en
    // C (colonne ARTICLE, la seule assez large pour les 6 noms sur une ligne et centrés), montant
    // en D, sous-total « Nourriture » fusionné en E sur les 3 lignes, TOTAL sur jaune. Bordures :
    // medium sur tout le tour du bloc et autour de la fusion, thin entre les lignes, comme le
    // modèle. Le contrôle (TOTAL STOCK − TOTAL récap) reste en E de la ligne TOTAL, sans fond ni
    // bordure chez le CDG ; il n'affiche rien tant qu'il est nul, et la dérive apparaît dès qu'une
    // catégorie sort des 6 libellés — c'est lui qui remplace la ligne « AUTRES » retirée.
    const RECAP_LIBELLES = ["Boissons","Nourriture - Surgelé","Nourriture - Frais","Nourriture - Sec","Packaging","Produits de Nettoyage"];
    const RECAP_FONDS = { "Boissons":"F7CAAC", "Nourriture - Surgelé":"BED7EE", "Nourriture - Frais":"BED7EE", "Nourriture - Sec":"BED7EE", "Packaging":"FFD1D1", "Produits de Nettoyage":"E2EFD9", "TOTAL":"FFFF00" };
    const RECAP_Z = '_(* #,##0_);_(* (#,##0);_(* "-"??_);_(@_)';      // un montant nul s'affiche « - »
    const RECAP_Z_NUL = '_(* #,##0_);_(* (#,##0);_(* ""_);_(@_)';     // idem, mais 0 n'affiche rien
    const MD = { style:"medium", color:{rgb:"000000"} }, TH = { style:"thin", color:{rgb:"000000"} }, NS = { style:"none", color:{rgb:"000000"} };
    const totalRow = lastDataRow + 1;                                 // ligne Excel du TOTAL STOCK
    const bordLigne = (i) => ({ top: i===0?MD:TH, bottom: i===6?MD:TH });
    const recapLab = (lib, i, rgb = "1F2937") => ({ font: xfont(rgb, true, 12), fill: xfill(RECAP_FONDS[lib]), alignment: xal("center"), border: { left:MD, right:TH, ...bordLigne(i) } });
    const recapVal = (lib, i, rgb = "1F2937") => ({ font: xfont(rgb, true, 12), fill: xfill(RECAP_FONDS[lib]), alignment: xal("right"), border: { left:TH, right:MD, ...bordLigne(i) } });
    const recapBox = (i) => ({ font: xfont("1F2937", true, 12), fill: xfill("BED7EE"), alignment: xal("right"), border: { left:MD, right:MD, top: i===1?MD:NS, bottom: i===3?MD:NS } });
    rows.push([]);
    const debut = rows.length + 1;                                    // ligne Excel du premier libellé
    const idxRecap = (i) => debut - 1 + i;
    RECAP_LIBELLES.forEach((lib, i) => {
      const r = [];
      put(r, 2, { v: lib, s: recapLab(lib, i) });
      put(r, 3, { t: "n", f: `SUMIF($A$7:$A$${lastDataRow},C${debut + i},$L$7:$L$${lastDataRow})`, z: RECAP_Z, s: recapVal(lib, i) });
      rows.push(r);
    });
    // Le cadre d'une fusion ne se dessine que sur les cellules écrites : le sérialiseur saute une
    // cellule sans valeur, d'où le 0 masqué (RECAP_Z_NUL) sur les deux lignes basses.
    put(rows[idxRecap(1)], 4, { t: "n", f: `SUM(D${debut + 1}:D${debut + 3})`, z: RECAP_Z, s: recapBox(1) });
    [2, 3].forEach((i) => put(rows[idxRecap(i)], 4, { t: "n", v: 0, z: RECAP_Z_NUL, s: recapBox(i) }));
    const rTot = [];
    put(rTot, 2, { v: "TOTAL", s: recapLab("TOTAL", 6) });
    put(rTot, 3, { t: "n", f: `SUM(D${debut}:D${debut + 5})`, z: RECAP_Z, s: recapVal("TOTAL", 6, "FF0000") });
    put(rTot, 4, { t: "n", v: 0, f: `L${totalRow}-D${debut + 6}`, z: RECAP_Z_NUL, s: { font: xfont("1F2937", true, 12) } });
    rows.push(rTot);
    // 12 pt gras sur une seule ligne : hauteur fixe du bloc, comme les 15,75-16,5 pt du modèle.
    const specs = [{hpt:HPT_LIGNE_TITRE},{hpt:18},{hpt:20},{hpt:16},{hpt:28},{hpt:28}];
    while (specs.length < debut - 1) specs.push({});
    for (let i = 0; i < 7; i++) specs[debut - 1 + i] = { hpt: 16.5 };
    const merges=[{s:{r:0,c:K},e:{r:0,c:14}},{s:{r:1,c:0},e:{r:1,c:4}},{s:{r:1,c:5},e:{r:1,c:7}},{s:{r:1,c:8},e:{r:1,c:11}},{s:{r:3,c:0},e:{r:3,c:14}},{s:{r:4,c:0},e:{r:5,c:0}},{s:{r:4,c:1},e:{r:5,c:1}},{s:{r:4,c:2},e:{r:5,c:2}},{s:{r:4,c:3},e:{r:4,c:4}},{s:{r:4,c:5},e:{r:4,c:7}},{s:{r:4,c:8},e:{r:4,c:11}},{s:{r:4,c:13},e:{r:4,c:14}},{s:{r:debut,c:4},e:{r:debut+2,c:4}}];
    return xmkSheet(rows,{cols,merges,rows:specs});
  };
  XLSX.utils.book_append_sheet(wb,invSheet("Inventaire Initial"),"Inventaire Initial");
  XLSX.utils.book_append_sheet(wb,invSheet("Inventaire Final"),"Inventaire Final");

  // Transferts AGL → BK — format du fichier réel (Mouvements de sorties de stock).
  // Colonnes FIXES (compatibilité parsers.js) :
  //   0=Date(saisie)  1=BK(saisie)  2=Désignation  3=Catégorie  4=Code
  //   5=Unité  6=Conditionnement  7=Quantité(saisie)  8=Prix carton  9=Valeur  10=CTRL
  // La dernière ligne du Référentiel Articles est partagée avec P.Douane (même clé de VLOOKUP).
  let artRefLast=2;
  {
    // Référentiel articles : chaque article est indexé sur son Code Bolloré (à défaut sa
    // désignation), puis une seconde ligne indexe la désignation pour les articles codés.
    const refKey=(a)=>{
      const code=a&&a.code!=null?String(a.code).trim():"";
      return code || (a&&a.nom?String(a.nom).trim():"");
    };
    const normCle=(s)=>String(s||"").trim().toUpperCase().replace(/\s+/g," ");
    const seenKeys=new Set();
    const refLignes=[];
    // Une liste est indexée en deux passes : les clés codes d'abord, les désignations ensuite.
    // Ces lignes sont ajoutées APRÈS celles indexées sur le code, car VLOOKUP renvoie la première
    // correspondance ; en cas de désignations identiques c'est donc l'article le mieux classé
    // (ordre inventaire) qui répond.
    const indexerRef=(liste)=>{
      const codes=[], noms=[];
      (liste||[]).forEach((a)=>{
        const key=refKey(a), nk=normCle(key);
        if(!nk||seenKeys.has(nk)) return;
        seenKeys.add(nk); codes.push({a,cle:key});
      });
      (liste||[]).forEach((a)=>{
        const nom=a&&a.nom?String(a.nom).trim():"", nk=normCle(nom);
        if(!nk||seenKeys.has(nk)) return;
        seenKeys.add(nk); noms.push({a,cle:nom});
      });
      refLignes.push(...codes,...noms);
    };
    // Le modèle d'inventaire d'abord (il garde son ordre et sa priorité), puis la base active
    // entière : ses lignes hors modèle (packaging, entretien, fournitures) n'ont pas de ligne
    // d'inventaire mais circulent en transferts et en douane — sans elles, le VLOOKUP de ces deux
    // feuilles ne rendait rien sur leur code.
    indexerRef(articles);
    indexerRef(baseComplete);
    artRefLast=Math.max(2,refLignes.length+1);
    // Conditionnement publié par le référentiel = celui du classeur du CDG, et non celui de la
    // base locale : Transferts et P.Douane doivent afficher le même colisage que les feuilles
    // Inventaire et Pertes. Sur 3 lignes le classeur du CDG se contredit — son « Inventaire
    // initial » est resté à E=10/120/240 alors que sa base « Articles » (l.378/586/393) et son
    // journal « Sorties » (H) portent 100/10/4 ; c'est la base Articles qui fait foi, c'est elle
    // qui vit dans les transferts. Hors table du CDG, la base garde la main.
    const cleCond=(s)=>String(s||"").trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^A-Z0-9]/g,"");
    const COND_CDG=new Map();
    INVENTAIRE_REFERENTIEL_CDG.forEach((t)=>{
      const k=cleCond(t.nom);
      if(!COND_CDG.has(k)&&t.cond!==undefined) COND_CDG.set(k,t.cond);
    });
    const COND_MAITRE=new Map([["GANTSSACHETPACKDE100",100],["CHICKENCRUNCHYFILLER",10],["KAY5SANITIZER",4]]);
    const condRef=(a)=>{
      const k=cleCond(a&&a.nom);
      if(COND_MAITRE.has(k)) return COND_MAITRE.get(k);
      if(COND_CDG.has(k)) return COND_CDG.get(k);
      return a?a.conditionnement:undefined;
    };
    const NB_LIGNES_TRANSFERTS=20000;
    const codeKey=(R)=>`TRIM(E${R}&"")`;
    const vref=(R,col)=>`IF($E${R}="","",IFERROR(VLOOKUP(${codeKey(R)},'${artRefSheet}'!$A$2:$F$${artRefLast},${col},FALSE),""))`;

    const rows=[];
    rows[0]=[];
    put(rows[0],COL_TITRE,{v:`Transferts (AGL → BK) — ${site||"BK ____"}${period?" · "+period:""}`,s:ST.title});
    // Ligne 1 : Bandeau de zones
    rows[1]=[];
    const bandT=(txt,rgb,fill)=>({v:txt,s:{font:xfont(rgb,true,10),fill:xfill(fill),alignment:xal("center"),border:xborder()}});
    put(rows[1],0,bandT("✏️  SAISIE","2E7D32","C8E6C9"));
    put(rows[1],2,bandT("= AUTO (via code)","1565C0","BBDEFB"));
    put(rows[1],4,bandT("✏️  CODE / DÉSIGNATION","2E7D32","C8E6C9"));
    put(rows[1],5,bandT("= AUTO","1565C0","BBDEFB"));
    put(rows[1],7,bandT("✏️  QTÉ","2E7D32","C8E6C9"));
    put(rows[1],8,bandT("= AUTO","1565C0","BBDEFB"));
    put(rows[1],9,bandT("= CALCUL AUTO","E65100","FFE0B2"));
    // Ligne 2 : Note d'aide
    rows[2]=[];
    put(rows[2],0,{v:"📌 Saisir : Date (A), BK destinataire (B), Code article (E — ou la désignation exacte si l'article n'a pas de code), Quantité (H). Les infos produit s'affichent automatiquement via la clé. Un même article peut apparaître sur plusieurs lignes (transferts vers des restaurants différents).",
      s:{font:xfont("374151",false,10,true),fill:xfill("FFFDE7"),alignment:xal("left"),border:xborder()}});
    // Ligne 3 : En-têtes colorés par zone
    const headSaisieT=(t)=>({v:t,s:{...ST.head,fill:xfill("2E7D32")}});
    const headRefT=(t)=>({v:t,s:{...ST.head,fill:xfill("1565C0")}});
    const headCalcT=(t)=>({v:t,s:{...ST.head,fill:xfill("E65100")}});
    const head=[];
    put(head,0,headSaisieT("Date"));
    put(head,1,headSaisieT("BK"));
    put(head,2,headRefT("Désignation"));
    put(head,3,headRefT("Catégorie"));
    put(head,4,headSaisieT("Code / Désignation"));
    put(head,5,headRefT("Unité"));
    put(head,6,headRefT("Cond."));
    put(head,7,headSaisieT("Quantité"));
    put(head,8,headRefT("Prix carton"));
    put(head,9,headCalcT("Valeur sortie"));
    put(head,10,headCalcT("CTRL"));
    rows[3]=head;
    const TREFFILL=xfill("E3F2FD"), TSAISIEFILL=xfill("E8F5E9"), TCALCFILL=xfill("FFF3E0");
    for(let i=0;i<NB_LIGNES_TRANSFERTS;i++){ const r=[]; const ev=i%2===1; const R=5+i;
      const refS=(s)=>({...s,fill:ev?TREFFILL:xfill("EBF5FB"),border:xborder()});
      const saisS=(s)=>({...s,fill:ev?TSAISIEFILL:xfill("C8E6C9"),border:xborder({left:{style:"medium",color:{rgb:"2E7D32"}},right:{style:"medium",color:{rgb:"2E7D32"}}})});
      const calcS=(s)=>({...s,fill:ev?TCALCFILL:xfill("FFE0B2"),border:xborder()});
      put(r,0,{v:"",s:saisS(ST.cell)});    // Date à saisir
      put(r,1,{v:"",s:saisS(ST.cell)});    // BK destinataire à saisir
      put(r,2,{t:"s",f:vref(R,2),s:refS(ST.cellMut)});            // Désignation (auto via code)
      put(r,3,{t:"s",f:vref(R,3),s:refS(ST.cellMut)});            // Catégorie (auto)
      put(r,4,{v:"",s:saisS(ST.cell)});    // Code Bolloré à saisir (clé)
      put(r,5,{t:"s",f:vref(R,4),s:refS(ST.cellMut)});            // Unité (auto)
      put(r,6,{t:"n",f:vref(R,5),z:"#,##0.##",s:refS(ST.cellR)}); // Cond. (auto)
      put(r,7,{v:"",t:"s",z:"#,##0",s:saisS({...ST.cellR,font:xfont("2E7D32",false,11)})});  // Quantité à saisir
      put(r,8,{t:"n",f:vref(R,6),z:"#,##0.##",s:refS(ST.cellR)}); // Prix carton (auto)
      put(r,9,{t:"n",f:`IF(OR($E${R}="",$H${R}=""),"",$H${R}*$I${R})`,z:"#,##0",s:calcS({font:xfont("E65100",true,10),alignment:xal("right")})});  // Valeur
      put(r,10,{v:"",s:calcS(ST.cellMut)});  // CTRL — vide, saisie manuelle (plus de remplissage auto)
      rows.push(r);
    }
    const lastT=4+NB_LIGNES_TRANSFERTS;  // ligne Excel de la dernière ligne de saisie (données dès ligne 5)
    const cumT=[]; put(cumT,1,{v:"CUMUL TRANSFERTS PÉRIODE",s:ST.totalK}); put(cumT,9,{t:"n",f:`SUM(J5:J${lastT})`,s:ST.totalV,z:"#,##0"}); rows.push(cumT);
    const totT=[]; put(totT,1,{v:"TOTAL",s:ST.totalK}); put(totT,9,{t:"n",f:`SUM(J5:J${lastT})`,s:ST.totalV,z:"#,##0"}); rows.push(totT);

    // Récapitulatifs sous le TOTAL — valeur des transferts par catégorie, puis par
    // catégorie × BK destinataire (saisie tolérante : "BK1", "1" ou "BK 1").
    const rngVal=`$J$5:$J$${lastT}`, rngCat=`$D$5:$D$${lastT}`, rngBk=`$B$5:$B$${lastT}`;
    const lit=(s)=>`"${String(s).replace(/"/g,'""')}"`;
    const catsRecap=getCategorySummaryList(articles);
    const destsRecap=[...new Set((Array.isArray(destinataires)?destinataires:[destinataires]).map((d)=>String(d||"").trim()).filter(Boolean))];
    rows.push([]);
    const sec1=[]; put(sec1,0,{v:"RÉCAP PAR CATÉGORIE (valeur des transferts)",s:ST.section});
    put(sec1,9,{v:"Valeur (FCFA)",s:ST.sectionR}); rows.push(sec1);
    catsRecap.forEach((cat,i)=>{ const r=[]; const ev=i%2===1;
      put(r,0,C(cat,zeb(ST.cell,ev)));
      put(r,9,{t:"n",f:`SUMIF(${rngCat},${lit(cat)},${rngVal})`,z:"#,##0",s:zeb(ST.cellR,ev)});
      rows.push(r);
    });
    if(destsRecap.length){
      const sec2=[]; put(sec2,0,{v:"RÉCAP PAR CATÉGORIE × BK DESTINATAIRE (valeur des transferts)",s:ST.section});
      put(sec2,9,{v:"Valeur (FCFA)",s:ST.sectionR}); rows.push(sec2);
      let n=0;
      destsRecap.forEach((dest)=>{
        const num=matchBkNumber(dest);
        const variantes=[...new Set(num?[dest,num,"BK"+num,"BK "+num]:[dest])];
        catsRecap.forEach((cat)=>{ const r=[]; const ev=(n++)%2===1;
          put(r,0,C(cat,zeb(ST.cell,ev)));
          put(r,1,C(`→ ${dest}`,zeb(ST.cell,ev)));
          put(r,9,{t:"n",f:variantes.map((t)=>`SUMIFS(${rngVal},${rngCat},${lit(cat)},${rngBk},${lit(t)})`).join("+"),z:"#,##0",s:zeb(ST.cellR,ev)});
          rows.push(r);
        });
      });
    }
    // Récap de contrôle — en tête de feuille, à droite de la zone de saisie (colonnes N/O) :
    // il reste lisible sans dérouler les 2 000 lignes et ne gêne pas la zone A..K relue par
    // le parseur. La ligne « code sans prix trouvé » signale les saisies que le classeur
    // ne peut pas valoriser (elles sortaient du total du fichier sans jamais être vues).
    const RC=13, RV=14;
    const rLab=(rIdx,txt,s=ST.cell)=>{ const row=rows[rIdx]||(rows[rIdx]=[]); put(row,RC,{v:txt,s}); };
    const rVal=(rIdx,f,s=ST.cellR)=>{ const row=rows[rIdx]||(rows[rIdx]=[]); put(row,RV,{t:"n",f,z:"#,##0",s}); };
    put(rows[0],RC,{v:`RÉCAP TRANSFERTS — ${site||"BK ____"}`,s:ST.section});
    put(rows[0],RV,{v:"VALEUR (FCFA)",s:ST.sectionR});
    rLab(1,"Lignes saisies (code en E)");        rVal(1,`SUMPRODUCT(--($E$5:$E$${lastT}<>""))`);
    rLab(2,"dont code sans prix trouvé");        rVal(2,`SUMPRODUCT(--($E$5:$E$${lastT}<>""),--($I$5:$I$${lastT}=""))`);
    rLab(3,"TOTAL TRANSFERTS",ST.totalK);        rVal(3,`SUM($J$5:$J$${lastT})`,ST.totalV);
    rLab(5,"CATÉGORIE",ST.head);                 put(rows[5],RV,{v:"VALEUR (FCFA)",s:ST.headR});
    catsRecap.forEach((cat,i)=>{
      rLab(6+i,cat,zeb(ST.cell,i%2===1));
      rVal(6+i,`SUMIF(${rngCat},${lit(cat)},${rngVal})`,zeb(ST.cellR,i%2===1));
    });
    if(destsRecap.length){
      const h=6+catsRecap.length+1;
      rLab(h,"BK DESTINATAIRE",ST.head); put(rows[h],RV,{v:"VALEUR (FCFA)",s:ST.headR});
      destsRecap.forEach((dest,i)=>{
        const num=matchBkNumber(dest);
        const variantes=[...new Set(num?[dest,num,"BK"+num,"BK "+num]:[dest])];
        rLab(h+1+i,`→ ${dest}`,zeb(ST.cell,i%2===1));
        rVal(h+1+i,variantes.map((t)=>`SUMIF(${rngBk},${lit(t)},${rngVal})`).join("+"),zeb(ST.cellR,i%2===1));
      });
    }
    XLSX.utils.book_append_sheet(wb,xmkSheet(rows,{
      cols:[{wch:WCH_ZONE_LOGO},{wch:14},{wch:36},{wch:20},{wch:16},{wch:8},{wch:12},{wch:12},{wch:14},{wch:16},{wch:22},{wch:3},{wch:3},{wch:30},{wch:16}],
      merges:[
        {s:{r:0,c:COL_TITRE},e:{r:0,c:10}},   // Titre (décalé : logo en A1)
        {s:{r:1,c:0},e:{r:1,c:1}},        // Bandeau Saisie (gauche)
        {s:{r:1,c:2},e:{r:1,c:3}},        // Bandeau Auto
        {s:{r:1,c:5},e:{r:1,c:6}},        // Bandeau Auto (Unité/Cond.)
        {s:{r:2,c:0},e:{r:2,c:10}},       // Note d'aide
        {s:{r:0,c:RC},e:{r:0,c:RV}},      // Titre du récap (N1:O1)
      ],
      rows:[{hpt:HPT_LIGNE_TITRE},{hpt:16},{hpt:30},{hpt:32}]
    }),"Transferts");
    // Référentiel articles (masqué) — clé = Code Bolloré, à défaut Désignation
    XLSX.utils.book_append_sheet(wb,xmkSheet([
      [C("Code / Désignation (clé)",ST.headR),C("Désignation",ST.head),C("Catégorie",ST.head),C("Unité",ST.head),C("Cond.",ST.headR),C("Prix carton (FCFA)",ST.headR)],
      ...refLignes.map(({a,cle})=>{
        // Même règle qu'aux Inventaires : un 0 de l'Inventaire du CDG n'est pas un prix, c'est le
        // prix CARTON de sa table des pertes qui prime (COCA/FANTA/SPRITE 1,5L : 3 686 F le pack,
        // pas 127,47 F ni 525 F la pièce). Les lignes que le CDG cote gardent son prix de ligne,
        // puis la base : Transferts et P.Douane ne sont pas re-tarifés au-delà de ces trous.
        const refInv = REF_INV.get(cleRefInv(a.nom));
        const puBase = Number(a.pu_carton) > 0 ? Number(a.pu_carton) : prixDuCode(a);
        const puCarton = refInv && !(Number(refInv.pu) > 0) ? prixCartonCdg(refInv.nom, condRef(a)) : 0;
        return [
          C(cle,ST.cellR),
          C(a.nom||"",ST.cell),
          C(a.categorie||"",ST.cell),
          C(a.unite||"",ST.cell),
          Cn(condRef(a),"#,##0.##",ST.cellR),
          Cn(puCarton > 0 ? puCarton : puBase,"#,##0.##",ST.cellR),
        ];
      }),
    ],{cols:[{wch:16},{wch:40},{wch:20},{wch:10},{wch:10},{wch:18}]}),artRefSheet);
  }

  // Pertes — reproduit la table « Perte_Q1 2026 » du classeur de référence du CDG (module
  // src/utils/pertesReferentielCdg.js) :
  //   0=Catégorie 1=Nom Article 2=Cond. 3=Prix carton 4=Prix pièce (=prix carton÷cond, formule)
  //   5=Unité de perte (pièce / g / kg / litre, comme la référence) 6=Quantité perte (=SOMME des jours)
  //   7=Valeur (=px pièce×qté) 8=libellés du bloc d'indicateurs, 9..39 = quantités perdues par jour
  //   1→31 (J..AN, saisie), 40=total mois.
  // En tête (lignes 1-3, sur les colonnes jour) : CA HT du jour (saisie), valeur des pertes du jour
  //   (SOMMEPROD jours × prix pièce) et ratio perte/CA — comme dans le fichier de référence.
  // Les colonnes A..I sont décalées d une colonne par rapport au classeur du CDG (B..J) : le classeur
  // généré démarre ses tableaux en A, sous le logo, convention retenue pour toutes les feuilles.
  {
    const rows=[];
    rows[0]=[];
    put(rows[0],COL_TITRE,{v:`Pertes — ${site||"BK ____"}${period?" · "+period:""}`,s:ST.title});
    // Ligne 1 (Excel) : bandeau de zones + ligne « CA HT du jour » (cellules jours remplies après les données)
    rows[1]=[];
    put(rows[1],0,{v:"◀ RÉFÉRENTIEL (pré-rempli)",s:{font:xfont("1565C0",true,10),fill:xfill("BBDEFB"),alignment:xal("center"),border:xborder()}});
    put(rows[1],6,{v:"= CALCUL",s:{font:xfont("E65100",true,10),fill:xfill("FFE0B2"),alignment:xal("center"),border:xborder()}});
    put(rows[1],8,{v:"Valeur des pertes du jour",s:{font:xfont("E65100",true,10),fill:xfill("FFE0B2"),alignment:xal("left"),border:xborder()}});
    put(rows[1],9,{v:"✏️ QUANTITÉS PERDUES PAR JOUR — saisir les colonnes vertes (jour 1 → 31)",s:{font:xfont("2E7D32",true,10),fill:xfill("C8E6C9"),alignment:xal("center"),border:xborder()}});
    put(rows[1],40,{v:"Total du mois",s:{font:xfont("E65100",true,10),fill:xfill("FFE0B2"),alignment:xal("center"),border:xborder()}});
    // Ligne 2 : note d'aide + ligne « ratio perte / CA »
    rows[2]=[];
    put(rows[2],0,{v:"📌 Saisir les quantités perdues jour par jour (colonnes vertes J→AN) et le CA HT du jour en ligne 1 (colonne I). Quantité perte = somme des jours ; Valeur = Prix pièce × Quantité ; Prix pièce = Prix carton ÷ Cond. Liste, Cond. et prix repris du classeur de suivi du CDG ; les lignes sans Prix carton sont des articles que ce classeur ne cote pas : les renseigner.",
      s:{font:xfont("374151",false,10,true),fill:xfill("FFFDE7"),alignment:xal("left"),border:xborder()}});
    put(rows[2],8,{v:"Ratio perte / CA HT",s:{font:xfont("E65100",true,10),fill:xfill("FFE0B2"),alignment:xal("left"),border:xborder()}});
    // Ligne 3 (index 3) : en-têtes
    const headRefP=(t)=>({v:t,s:{...ST.head,fill:xfill("1565C0")}});
    const headSaisieP=(t)=>({v:t,s:{...ST.head,fill:xfill("2E7D32")}});
    const headCalcP=(t)=>({v:t,s:{...ST.head,fill:xfill("E65100")}});
    const head=[];
    put(head,0,headRefP("Catégorie"));
    put(head,1,headRefP("Nom Article"));
    put(head,2,headRefP("Cond."));
    put(head,3,headRefP("Prix carton"));
    put(head,4,headRefP("Prix pièce"));
    put(head,5,headRefP("Unité de perte"));
    put(head,6,headCalcP("Quantité perte (Σ jours)"));
    put(head,7,headCalcP("Valeur perte"));
    put(head,8,headCalcP("Indicateurs jour"));
    for(let j=0;j<31;j++) put(head,9+j,headSaisieP(String(j+1)));  // chaînes "1".."31" (le parseur additionne les cellules numériques)
    rows[3]=head;
    const PREFFILL=xfill("E3F2FD"), PSAISIEFILL=xfill("E8F5E9"), PCALCFILL=xfill("FFF3E0");
    const catFillP=(cat)=>({fill:categoryFill(cat),border:xborder()});

    // La feuille est pilotée par la table du CDG (src/utils/pertesReferentielCdg.js, extraite de
    // « Perte_Q1 2026 » du classeur de référence) : les 191 articles suivis en pertes, leur catégorie,
    // leur ordre, leur Cond. et leur Unité de perte sont ceux du classeur du CDG, et ne dépendent plus
    // du modèle d'inventaire ni de la liste transmise (demande du 26/10 : « je produis tout pareil …
    // conditionnement pareil et tout »). Les prix du CDG sont donc publiés tels quels ; ne restent à
    // résoudre que les 5 lignes où sa référence affiche 0 (XLOOKUP sans résultat).
    const normalize = (s) => String(s || "").trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    const nomsPublies=new Set(PERTES_REFERENTIEL_CDG.map((t)=>normalize(t.nom)));

    const SAISIE_DAILY=xfill("E8F5E9"), SAISIE_DAILY_LT=xfill("C8E6C9");
    let perteRow=0;   // données dès row index 4 (Excel ligne 5)
    const ecrirePerteRow=({categorie,nom,cond,puCarton,unite,sansPrix=false})=>{
      const r=[]; const ev=perteRow%2===1; const R=5+perteRow;
      const refP=(s)=>({...s,fill:ev?PREFFILL:xfill("EBF5FB"),border:xborder()});
      const calcP=(f,z)=>({t:"n",f,z,s:{font:xfont("E65100",true,10),fill:ev?PCALCFILL:xfill("FFE0B2"),alignment:xal("right"),border:xborder()}});
      put(r,0,C(categorie||"",catFillP(categorie)));
      put(r,1,C(nom,{...catFillP(categorie),font:xfont("1F2937",true,10)}));
      put(r,2,Cn(Number(cond),"#,##0.##",refP(ST.cellR)));
      // Le Cond. vient toujours de la table du CDG ; seule la colonne Prix peut rester vide, sur les
      // lignes où sa référence n a pas de prix et où aucune de nos sources n en donne. Le prix pièce
      // doit malgré tout rester numérique (les indicateurs jour SOMMEPROD la colonne E).
      put(r,3,sansPrix?C("",refP(ST.cellR)):Cn(puCarton,"#,##0.00",refP(ST.cellR)));
      put(r,4,calcP(sansPrix?`IF(AND(ISNUMBER(C${R}),C${R}>0),D${R}/C${R},0)`:`IF(C${R}>0,D${R}/C${R},D${R})`,"#,##0.00"));   // Prix pièce = Prix carton ÷ Cond
      put(r,5,C(unite,refP(ST.cellMut)));
      put(r,6,calcP(`SUM(J${R}:AN${R})`,"#,##0"));                  // Quantité perte = somme des 31 jours
      put(r,7,calcP(`E${R}*G${R}`,"#,##0"));                        // Valeur = Prix pièce × Qté
      for(let j=0;j<31;j++) put(r,9+j,{v:0,t:"n",z:"#,##0",s:{font:xfont("2E7D32",false,11),fill:ev?SAISIE_DAILY:SAISIE_DAILY_LT,alignment:xal("right"),border:xborder()}});
      rows.push(r);
      perteRow++;
    };
    // Résolution des seules lignes que la référence du CDG laisse à 0, sur trois sources :
    //   1) la base complète, par désignation exacte ;
    //   2) le référentiel PMIX (Ratio puis base complémentaire), par désignation exacte ou par
    //      troncature d'un seul mot (« SALADE POULET G » → « SALADE POULET GRILLE »), le coût du
    //      Ratio restant prioritaire quand les deux sources connaissent le même PLU (règle du 13/10) ;
    //   3) à défaut, la base complète par désignation approchante, quand un seul article est admissible.
    // Le prix résolu est un prix de l'unité de perte (celui de la source rapporté à son propre
    // conditionnement) ; il est recomposé sur le Cond. de la table pour que Prix carton ÷ Cond. donne
    // le prix pièce du CDG. Aucun prix n'est inventé : sans source, la colonne Prix reste vide.
    const codesPublies=new Map();   // code Bolloré → désignation déjà publiée sous ce code
    const pluPublies=new Set();
    const baseParNom=new Map();
    (baseComplete||[]).forEach((a)=>{ if(a&&a.nom){ const k=normalize(a.nom); if(!baseParNom.has(k)) baseParNom.set(k,a); } });
    const motsPmix=(s)=>String(s||"").trim().toLowerCase().replace(/[^a-z0-9]+/g," ").trim().split(" ").filter(Boolean);
    const prefixeStrict=(a,b)=>a!==b&&(a.startsWith(b)||b.startsWith(a));
    const candidatsPmix=(nom)=>{
      const cible=motsPmix(nom); const vusC=new Set(); const out=[];
      const collecter=(source,liste)=>{
        for(const item of liste){
          if(!item||!item.nom) continue;
          const c2=motsPmix(item.nom);
          if(c2.length!==cible.length) continue;
          const diffs=c2.map((w,i)=>(w===cible[i]?-1:i)).filter((i)=>i>=0);
          if(diffs.length>1) continue;
          if(diffs.length===1&&!prefixeStrict(c2[diffs[0]],cible[diffs[0]])) continue;
          const sig=`${source}|${normalize(item.nom)}|${normalize(item.plu)}`;
          if(vusC.has(sig)) continue;
          vusC.add(sig); out.push({source,item});
        }
      };
      collecter("ratio",produits||[]);
      collecter("complement",Object.entries(pmixComplement||{}).map(([plu,c])=>({plu,nom:c&&c.nom,cout:Number(c&&c.cout)})));
      return out;
    };
    // Un code partagé n'est un doublon que si les DEUX désignations sont des articles de la base :
    // le modèle d'inventaire prête son code à des désignations qui ne sont pas des articles. « BOUTEILLE
    // PEPSI 1,5L » (code BTL-PEPSI 1,5L) n'existe pas dans la base, qui connaît sous ce code « BOUTEILLE
    // PEPSI ZERO 1,5L » (Cond. 6, 3 150 F carton, 525 F pièce) — refuser cette ligne était une erreur.
    const depuisBase=(b,nomTransmis)=>{
      const cond=Number(b.conditionnement), puCarton=Number(b.pu_carton);
      if(!(cond>0)||!(puCarton>0)) return null;
      const code=normalize(b.code);
      if(code){ const publie=codesPublies.get(code); if(publie&&baseParNom.has(publie)) return null; }
      if(code&&!codesPublies.has(code)) codesPublies.set(code,normalize(nomTransmis));
      // Le prix d une unité de perte : la base le donne en pu_piece, à défaut en prix carton ÷ son
      // propre conditionnement. Il sera multiplié par le Cond. de la table du CDG, qui fait foi.
      const piece=Number(b.pu_piece)>0?Number(b.pu_piece):(cond>0?puCarton/cond:0);
      if(!(piece>0)) return null;
      return {piece};
    };
    const distanceEdition=(a,b)=>{
      if(Math.abs(a.length-b.length)>3) return 4;
      let prec=Array.from({length:b.length+1},(_,j)=>j);
      for(let i=1;i<=a.length;i++){
        const cur=[i];
        for(let j=1;j<=b.length;j++)
          cur[j]=Math.min(prec[j]+1, cur[j-1]+1, prec[j-1]+(a[i-1]===b[j-1]?0:1));
        prec=cur;
      }
      return prec[b.length];
    };
    const nombres=(s)=>(String(s).match(/\d+/g)||[]).map(Number);
    // La base écrit parfois le nom avec une faute de frappe ou un suffixe : « EAU KIRENE 50 CL 16 »
    // pour « EAU KIREN 50cl », « FROMAGE MEDHI NEW » pour « FROMAGE MEDHDI NEW », « MOZZARELLA
    // STICKS » pour « MOZZARELLA STICKS BIS ». Un appariement n'est admis que s il est seul :
    // distance d édition ≤ 3 sur les noms normalisés, ET chaque nombre du nom transmis retrouvé dans
    // le nom du candidat ou dans son conditionnement — c est ce qui écarte « EAU KIREN 50cl 12 » du 16.
    const candidatsBase=(nom)=>{
      const cible=normalize(nom), nums=nombres(nom);
      return (baseComplete||[]).filter((b)=>{
        if(!b||!b.nom) return false;
        const k=normalize(b.nom);
        if(nomsPublies.has(k)) return false;
        const cond=Number(b.conditionnement);
        if(!(cond>0)||!(Number(b.pu_carton)>0)) return false;
        if(distanceEdition(cible,k)>3) return false;
        const siens=new Set([...nombres(b.nom),cond]);
        return nums.every((n)=>siens.has(n));
      });
    };
    const resoudreTransmis=(nom)=>{
      const b=baseParNom.get(normalize(nom));
      if(b) return depuisBase(b,nom);
      const cands=candidatsPmix(nom);
      if(cands.length===1){
        const {source,item}=cands[0];
        const plu=normalize(item.plu);
        if(plu&&pluPublies.has(plu)) return null;
        const ratio=source==="ratio"?item:(produits||[]).find((p)=>p&&normalize(p.plu)===plu);
        const cout=Number(ratio?ratio.coutTheo:item.cout);
        if(!(cout>0)) return null;
        if(plu) pluPublies.add(plu);
        return {piece:cout};   // le coût du Ratio est déjà un coût à la pièce
      }
      const approchants=candidatsBase(nom);
      return approchants.length===1 ? depuisBase(approchants[0],nom) : null;
    };
    // Ordre, catégories, désignations, Cond. et Unité de perte : la table du CDG, ligne par ligne.
    // Les rares lignes que sa table des pertes laisse à 0 sont cotées par son Inventaire initial
    // (H2/H3/H4 Buns, même désignation et même colisage) : ce prix carton est ramené au prix pièce
    // de son propre colisage, puis recomposé sur le Cond. de Pertes — même convention que ci-dessus.
    const INV_CDG_PAR_NOM = new Map();
    INVENTAIRE_REFERENTIEL_CDG.forEach((t) => {
      const k = normalize(t.nom);
      if (!INV_CDG_PAR_NOM.has(k)) INV_CDG_PAR_NOM.set(k, t);
    });
    PERTES_REFERENTIEL_CDG.forEach((t)=>{
      const cond=Number(t.cond)>0?Number(t.cond):1;
      let puCarton=Number(t.pu)>0?Number(t.pu):null;
      if(puCarton===null){
        const inv=INV_CDG_PAR_NOM.get(normalize(t.nom));
        if(inv&&Number(inv.pu)>0){
          const condInv=Number(inv.cond)>0?Number(inv.cond):1;
          puCarton=(Number(inv.pu)/condInv)*cond;
        }
      }
      if(puCarton===null){
        const res=resoudreTransmis(t.nom);
        if(res) puCarton=res.piece*cond;   // le Cond. du CDG fait foi, le prix vient de nos sources
      }
      ecrirePerteRow({categorie:t.cat,nom:t.nom,cond,puCarton,unite:t.unite,sansPrix:!(puCarton>0)});
    });
    const lastP=4+perteRow;  // ligne Excel de la dernière ligne de données
    // Bloc d'indicateurs journaliers en tête (lignes 1-3, colonnes J→AN) — comme le fichier d'origine
    const dayCol=(j)=>XLSX.utils.encode_col(9+j);
    put(rows[0],8,{v:"CA HT du jour (saisie)",s:{font:xfont("2E7D32",true,10),fill:xfill("C8E6C9"),alignment:xal("left"),border:xborder()}});
    // Une cellule SheetJS sans valeur ni formule n'est pas publiée dans le XML : le CA HT du jour
    // est pré-rempli 0, comme les 31 colonnes de quantités perdues, pour que la saisie existe.
    for(let j=0;j<31;j++){
      const L=dayCol(j);
      put(rows[0],9+j,{v:0,t:"n",z:"#,##0",s:{font:xfont("2E7D32",false,11),fill:SAISIE_DAILY,alignment:xal("right"),border:xborder()}});   // CA HT (saisie)
      put(rows[1],9+j,{t:"n",f:`SUMPRODUCT(${L}$5:${L}$${lastP},$E$5:$E$${lastP})`,z:"#,##0",s:{font:xfont("E65100",false,10),fill:PCALCFILL,alignment:xal("right"),border:xborder()}});
      put(rows[2],9+j,{t:"n",f:`IF(${L}1=0,"",${L}2/${L}1)`,z:Zpct,s:{font:xfont("E65100",false,10),fill:PCALCFILL,alignment:xal("right"),border:xborder()}});
    }
    put(rows[0],40,{t:"n",f:"SUM(J1:AN1)",z:"#,##0",s:{...ST.totalVp,border:xborder()}});
    put(rows[1],40,{t:"n",f:"SUBTOTAL(9,$J$2:$AN$2)",z:"#,##0",s:{...ST.totalVp,border:xborder()}});
    put(rows[2],40,{t:"n",f:'IF(AO1=0,"",AO2/AO1)',z:Zpct,s:{font:xfont("E65100",true,10),fill:PCALCFILL,alignment:xal("right"),border:xborder()}});
    const tot=[]; put(tot,5,{v:"TOTAL PERTES",s:ST.totalKp}); put(tot,7,{t:"n",f:`SUM(H5:H${lastP})`,s:ST.totalKp,z:"#,##0"}); rows.push(tot);
    XLSX.utils.book_append_sheet(wb,xmkSheet(rows,{
      cols:[{wch:WCH_ZONE_LOGO},{wch:36},{wch:10},{wch:14},{wch:14},{wch:16},{wch:14},{wch:16},{wch:24},
        ...Array.from({length:31},()=>({wch:7})),{wch:14}],
      merges:[
        {s:{r:0,c:COL_TITRE},e:{r:0,c:7}},   // Titre (décalé : logo en A1)
        {s:{r:1,c:0},e:{r:1,c:5}},        // Bandeau Référentiel
        {s:{r:1,c:6},e:{r:1,c:7}},        // Bandeau Calcul
        {s:{r:1,c:9},e:{r:1,c:39}},       // Bandeau saisie journalière
        {s:{r:2,c:0},e:{r:2,c:7}},        // Note d'aide
      ],
      rows:[{hpt:HPT_LIGNE_TITRE},{hpt:16},{hpt:30},{hpt:32}]
    }),"Pertes");
  }

  // P.Douane — feuille volontairement vide (lignes de saisie libres), même géométrie que
  // Transferts. La clé saisie en D accepte le Code article OU la Désignation exacte : le
  // Référentiel Articles (feuille masquée) fournit Article, Catégorie, Cond. et Prix carton,
  // le Prix pièce est calculé (Px carton ÷ Cond.) et la Valeur = Qté × Px pièce.
  // Colonnes (index 0-based) : A(0)=Date  B(1)=Article  C(2)=Catégorie  D(3)=Code / Désignation
  //   E(4)=Cond.  F(5)=Qté  G(6)=Px carton  H(7)=Px pièce  I(8)=Valeur — données dès la ligne 5.
  {
    const NB_LIGNES_DOUANE=200;
    const dKey=(R)=>`TRIM(D${R}&"")`;
    const dvref=(R,col)=>`IF($D${R}="","",IFERROR(VLOOKUP(${dKey(R)},'${artRefSheet}'!$A$2:$F$${artRefLast},${col},FALSE),""))`;
    const rows=[];
    rows[0]=[];
    put(rows[0],COL_TITRE,{v:`Prélèvements Douane — ${site||"BK ____"}${period?" · "+period:""}`,s:ST.titleP});
    rows[1]=[];
    const bandD=(txt,rgb,fill)=>({v:txt,s:{font:xfont(rgb,true,10),fill:xfill(fill),alignment:xal("center"),border:xborder()}});
    put(rows[1],0,bandD("✏️ SAISIE","2E7D32","C8E6C9"));
    put(rows[1],1,bandD("= AUTO","1565C0","BBDEFB"));
    put(rows[1],3,bandD("✏️ CODE / DÉSIGNATION","2E7D32","C8E6C9"));
    put(rows[1],4,bandD("= AUTO","1565C0","BBDEFB"));
    put(rows[1],5,bandD("✏️ QTÉ","2E7D32","C8E6C9"));
    put(rows[1],6,bandD("= AUTO","1565C0","BBDEFB"));
    put(rows[1],7,bandD("= CALCUL","E65100","FFE0B2"));
    rows[2]=[];
    put(rows[2],0,{v:"📌 Saisir uniquement : Date (A), Code article (D — ou la Désignation exacte si l'article n'a pas de code) et Quantité (F). L'Article, la Catégorie, le Conditionnement, les prix et la Valeur se remplissent automatiquement. Une ligne par prélèvement.",
      s:{font:xfont("374151",false,10,true),fill:xfill("FFFDE7"),alignment:xal("left"),border:xborder()}});
    const head=[];
    put(head,0,headSaisie("Date"));
    put(head,1,headRef("Article"));
    put(head,2,headRef("Catégorie"));
    put(head,3,headSaisie("Code / Désignation"));
    put(head,4,headRef("Cond."));
    put(head,5,headSaisie("Quantité"));
    put(head,6,headRef("Prix carton"));
    put(head,7,headCalc("Prix pièce"));
    put(head,8,headCalc("Valeur (FCFA)"));
    rows[3]=head;
    const DREFFILL=xfill("E3F2FD"),DSAISIEFILL=xfill("E8F5E9"),DCALCFILL=xfill("FFF3E0");
    for(let i=0;i<NB_LIGNES_DOUANE;i++){ const r=[]; const ev=i%2===1; const R=5+i;
      const refS=(s)=>({...s,fill:ev?DREFFILL:xfill("EBF5FB"),border:xborder()});
      const saisS=(s)=>({...s,fill:ev?DSAISIEFILL:xfill("C8E6C9"),border:xborder({left:{style:"medium",color:{rgb:"2E7D32"}},right:{style:"medium",color:{rgb:"2E7D32"}}})});
      const calcS=(s)=>({...s,fill:ev?DCALCFILL:xfill("FFE0B2"),border:xborder()});
      put(r,0,{v:"",s:saisS(ST.cell)});   // Date à saisir
      put(r,1,{t:"s",f:dvref(R,2),s:refS(ST.cellMut)});              // Article (auto)
      put(r,2,{t:"s",f:dvref(R,3),s:refS(ST.cellMut)});              // Catégorie (auto)
      put(r,3,{v:"",s:saisS(ST.cell)});                              // Code / Désignation (clé)
      put(r,4,{t:"n",f:dvref(R,5),z:"#,##0.##",s:refS(ST.cellR)});   // Cond. (auto)
      put(r,5,{v:"",t:"s",z:"#,##0",s:saisS({...ST.cellR,font:xfont("2E7D32",false,11)})});  // Quantité à saisir
      put(r,6,{t:"n",f:dvref(R,6),z:"#,##0.##",s:refS(ST.cellR)});   // Px carton (auto)
      put(r,7,{t:"n",f:`IF($G${R}="","",IF($E${R}>0,$G${R}/$E${R},$G${R}))`,z:"#,##0.00",s:calcS({font:xfont("E65100",false,10),alignment:xal("right")})});  // Px pièce = Px carton ÷ Cond.
      put(r,8,{t:"n",f:`IF(OR($F${R}="",$H${R}=""),"",$F${R}*$H${R})`,z:"#,##0",s:calcS({font:xfont("E65100",true,10),alignment:xal("right")})});             // Valeur = Qté × Px pièce
      rows.push(r);
    }
    const lastD=4+NB_LIGNES_DOUANE;
    const tot=[]; put(tot,0,{v:"TOTAL",s:ST.totalKp}); put(tot,8,{t:"n",f:`SUM($I$5:$I$${lastD})`,s:ST.totalVp,z:"#,##0"}); rows.push(tot);
    XLSX.utils.book_append_sheet(wb,xmkSheet(rows,{
      cols:[{wch:WCH_ZONE_LOGO},{wch:36},{wch:20},{wch:16},{wch:10},{wch:12},{wch:14},{wch:14},{wch:16}],
      merges:[
        {s:{r:0,c:COL_TITRE},e:{r:0,c:8}},
        {s:{r:1,c:1},e:{r:1,c:2}},   // Bandeau auto (Article / Catégorie)
        {s:{r:1,c:7},e:{r:1,c:8}},   // Bandeau calcul (Px pièce / Valeur)
        {s:{r:2,c:0},e:{r:2,c:8}},   // Note d'aide
      ],
      rows:[{hpt:HPT_LIGNE_TITRE},{hpt:16},{hpt:30},{hpt:32}]
    }),"P.Douane");
  }

  // Offert — table de saisie dès la ligne 2 (non liée aux articles), TOTAL en dernière ligne,
  // comme la feuille Offert de la référence du CDG (B1:I13 : en-têtes ligne 2, une ligne par BK
  // dès la ligne 3, TOTAL ensuite). Le classeur généré ne couvre qu'un site : une ligne de saisie,
  // dont la colonne Total est calculée, puis la ligne TOTAL.
  {
    const rows=[]; rows[0]=[];
    put(rows[0],COL_TITRE,{v:`Offerts / Repas — ${site||"BK ____"}${period?" · "+period:""}`,s:ST.title});
    const head=[]; ["BK","Staff Meal","Manager Meal","GT","Offer","HO","Discount CJ","Total"].forEach((h,i)=>{ put(head,i,i===0?H(h):HR(h)); });
    rows[1]=head; rows[2]=[];
    put(rows[2],0,C(site||"BK ____",ST.cell));
    const OFILL=xfill("E8F5E9");
    for(let c=1;c<=6;c++) put(rows[2],c,{v:0,t:"n",z:"#,##0",s:{font:xfont("2E7D32",false,11),fill:OFILL,alignment:xal("right"),border:xborder({left:{style:"medium",color:{rgb:"2E7D32"}},right:{style:"medium",color:{rgb:"2E7D32"}}})}});
    put(rows[2],7,{t:"n",f:"SUM(B3:G3)",z:"#,##0",s:{font:xfont("E65100",true,10),fill:xfill("FFF3E0"),alignment:xal("right"),border:xborder()}});
    const totO=[]; put(totO,0,{v:"TOTAL",s:ST.totalK});
    for(let c=1;c<=7;c++){ const L=String.fromCharCode(65+c); put(totO,c,{t:"n",f:`SUM(${L}3:${L}3)`,z:"#,##0",s:ST.totalV}); }
    rows.push(totO);
    XLSX.utils.book_append_sheet(wb,xmkSheet(rows,{cols:[{wch:WCH_ZONE_LOGO},{wch:12},{wch:13},{wch:8},{wch:8},{wch:8},{wch:12},{wch:10}],merges:[{s:{r:0,c:COL_TITRE},e:{r:0,c:7}}],rows:[{hpt:HPT_LIGNE_TITRE}]}),"Offert");
  }

  // ── PMIX (Ventes du restaurant) ──────────────────────────────────────────────
  {
    const rows = [];
    rows[0] = [];
    put(rows[0], COL_TITRE, { v: `PMIX (Ventes) — ${site || "BK ____"}${period ? " · " + period : ""}`, s: ST.title });
    const head = [H("Item PLU"), H("Item Name"), HR("Qty Sold"), HR("Price"), HR("Amount"), H("Status")];
    rows[1] = head;

    const refLast = Math.max(2, pmixProducts.length + 1);
    const pluKey = (R) => `TRIM(A${R}&"")`;   // PLU saisi (nombre ou texte) normalisé en clé texte
    const rowCount = Math.max(1000, pmixProducts.length);
    for (let i = 0; i < rowCount; i++) {
      const r = [];
      const ev = i % 2 === 1;
      const R = 2 + i + 1; // ligne Excel (1-based)
      put(r, 0, { v: "", t: "s", s: zeb(ST.cellR, ev) }); // Item PLU à saisir (clé stable, les désignations changent)
      put(r, 1, {
        t: "s",
        f: `IF(A${R}="","",IFERROR(VLOOKUP(${pluKey(R)},'${pmixPriceSheet}'!$A$2:$C$${refLast},2,FALSE),""))`,
        s: zeb(ST.cell, ev),
      }); // Nom affiché depuis le PLU saisi
      put(r, 2, { v: "", t: "s", z: "#,##0", s: zeb(ST.cellR, ev) }); // Quantité vendue à saisir
      put(r, 3, {
        t: "n",
        f: `IF(A${R}="","",IFERROR(VLOOKUP(${pluKey(R)},'${pmixPriceSheet}'!$A$2:$C$${refLast},3,FALSE),""))`,
        z: "#,##0",
        s: zeb(ST.cellR, ev),
      }); // Prix affiché depuis le PLU saisi
      // Montant = Qty × Coût. Les DEUX opérandes doivent être numériques : une quantité saisie
      // en texte (« 1 200 ») rend C*D = #VALUE!, que le SUM() du récap propage en #VALUE!.
      put(r, 4, { t: "n", f: `IF(OR(A${R}="",C${R}=""),"",IF(AND(ISNUMBER(C${R}),ISNUMBER(D${R})),C${R}*D${R},""))`, s: zeb(ST.cellR, ev), z: "#,##0" });
      put(r, 5, {
        t: "s",
        // Un PLU coté 0 dans la fiche (ou absent) ne peut jamais passer « OK » : la ligne est
        // vendue mais ne pèse pas dans la consommation théorique (C-09).
        f: `IF(A${R}="","",IF(COUNTIF('${pmixPriceSheet}'!$A$2:$A$${refLast},${pluKey(R)})=0,"PLU ABSENT DU RATIO",IF(N(VLOOKUP(${pluKey(R)},'${pmixPriceSheet}'!$A$2:$D$${refLast},4,FALSE))<=0,"COÛT NUL","OK")))`,
        s: zeb(ST.cell, ev),
      }); // Signale les PLU absents du ratio courant ou vendus sans coût
      rows.push(r);
    }
    const tot = [];
    put(tot, 1, { v: "TOTAL", s: ST.totalK });
    put(tot, 2, { t: "n", f: `SUM(C3:C${2 + rowCount})`, s: ST.totalV, z: "#,##0" });
    put(tot, 4, { t: "n", f: `SUM(E3:E${2 + rowCount})`, s: ST.totalV, z: "#,##0" });
    rows.push(tot);

    // Récap de contrôle — à droite du tableau (colonnes H/I), comme Transferts : visible sans
    // dérouler les lignes de saisie et hors de la zone A..F relue par extractPmixFromWorkbook.
    const RC = 7, RV = 8;
    const lastPmix = 2 + rowCount;
    const rLab = (rIdx, txt, s = ST.cell) => { const row = rows[rIdx] || (rows[rIdx] = []); put(row, RC, { v: txt, s }); };
    const rVal = (rIdx, f, s = ST.cellR) => { const row = rows[rIdx] || (rows[rIdx] = []); put(row, RV, { t: "n", f, z: "#,##0", s }); };
    put(rows[0], RC, { v: `RÉCAP PMIX — ${site || "BK ____"}`, s: ST.section });
    rLab(1, "INDICATEUR", ST.head); put(rows[1], RV, { v: "VALEUR", s: ST.headR });
    rLab(2, "Lignes saisies (PLU en A)");        rVal(2, `SUMPRODUCT(--($A$3:$A$${lastPmix}<>""))`);
    rLab(3, "dont PLU absent du ratio");         rVal(3, `SUMPRODUCT(--($A$3:$A$${lastPmix}<>""),--($F$3:$F$${lastPmix}="PLU ABSENT DU RATIO"))`);
    rLab(8, "dont PLU à coût nul");              rVal(8, `SUMPRODUCT(--($A$3:$A$${lastPmix}<>""),--($F$3:$F$${lastPmix}="COÛT NUL"))`);
    rLab(4, "TOTAL COUVERTS");                   rVal(4, `SUM($C$3:$C$${lastPmix})`);
    rLab(5, "TOTAL COÛT MATIÈRE (FCFA)", ST.totalK); rVal(5, `SUM($E$3:$E$${lastPmix})`, ST.totalV);
    { const row = rows[6] || (rows[6] = []);
      put(row, RC, { v: "Coût moyen / article vendu", s: ST.cell });
      put(row, RV, { t: "n", f: `IFERROR(IF($I$5=0,"",$I$6/$I$5),"contrôle requis")`, z: "#,##0", s: ST.cellR }); }
    // Les quantités saisies en texte sont ignorées par SUM($C$..) : le total serait faux sans
    // signe. Cet indicateur les compte pour que le CDG voie d'où vient un écart au lieu d'un 0.
    { const row = rows[7] || (rows[7] = []);
      put(row, RC, { v: "dont quantités non chiffrables", s: ST.cell });
      put(row, RV, { t: "n", f: `SUMPRODUCT(--($A$3:$A$${lastPmix}<>""),--(ISNUMBER($C$3:$C$${lastPmix})=FALSE))`, z: "#,##0", s: ST.cellR }); }

    XLSX.utils.book_append_sheet(wb, xmkSheet([
      // Ligne d'en-tête obligatoire : les VLOOKUP du PMIX cherchent à partir de la ligne 2.
      // Sans elle, le premier produit tombait hors plage et était déclaré absent du ratio.
      [C("PLU", ST.headR), C("Produit", ST.head), C("Coût unitaire (FCFA)", ST.headR), C("Coût fiche (0 = inconnu)", ST.headR)],
      // Coût unitaire de la fiche Ratio (feuille « Ratios », colonne COÛT du bloc SANDWICH ONLY,
      // ex. Whopper 1 187 F en D5) ; le PV TTC (C5 = 5 500 F) n'est pas une valorisation matière.
      // Repli sur le PV TTC seulement pour les très rares PLU sans coût connu (ex. 705).
      // La colonne D conserve le coût brut de la fiche (0 si inconnu) : elle pilote le statut
      // « COÛT NUL » sans être masquée par le repli PV TTC de la colonne C.
      ...pmixProducts.map((p) => [
        C(p.plu == null ? "" : String(p.plu), ST.cellR),
        C(p.nom),
        Cn(Number(p.coutTheo) > 0 ? Number(p.coutTheo) : (Number(p.pvTtc) || 0), "#,##0", ST.cellR),
        Cn(Number(p.coutTheo) || 0, "#,##0", ST.cellR),
      ]),
    ], { cols: [{ wch: 14 }, { wch: 42 }, { wch: 18 }, { wch: 18 }] }), pmixPriceSheet);

    XLSX.utils.book_append_sheet(
      wb,
      xmkSheet(rows, {
        cols: [{ wch: WCH_ZONE_LOGO }, { wch: 38 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 28 }, { wch: 3 }, { wch: 30 }, { wch: 16 }],
        merges: [{ s: { r: 0, c: COL_TITRE }, e: { r: 0, c: 5 } }, { s: { r: 0, c: RC }, e: { r: 0, c: RV } }],
        rows: [{ hpt: HPT_LIGNE_TITRE }],
      }),
      "PMIX"
    );
    wb.Workbook = {
      Sheets: wb.SheetNames.map((name) => ({ name, Hidden: (name === pmixPriceSheet || name === artRefSheet) ? 1 : 0 })),
      CalcPr: { calcMode: "auto", fullCalcOnLoad: true, forceFullCalc: true },
    };
  }

  return wb;
}

// Téléchargement d'un modèle unique (bouton "modèle vierge")
export async function genererModelesSuivi(articles, produits, site="", period="", dateInv="", destinataires=[], pmixComplement={}, baseComplete=[]){
  const wb=buildModelesWb(articles, produits, site, period, dateInv, destinataires, pmixComplement, baseComplete);
  const suffix=[site,period].filter(Boolean).map(s=>s.replace(/[^a-zA-Z0-9]/g,"_")).join("_");
  await telechargerXlsx(wb,`Modeles_Suivi_Stock${suffix?"_"+suffix:""}.xlsx`);
}

