import XLSX from 'xlsx-js-style';
import { fmtDate, statEcart, matchBkNumber } from './formatters.js';
import { ROLES, WORKFLOW } from '../constants.js';
import { sortArticles } from './articleSorter.js';
import { sortArticlesByCustomOrder, CUSTOM_ARTICLES_ORDER } from './customArticleOrder.js';
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
      [C("Couverts vendus"),Cn(calc.couverts,Zm),C(`${data.ficheMatchees||0} PLU matchés / ${(calc.pmixTheo||[]).length} total`,ST.cellMut)],
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
    const H=["PLU","Produit","Catégorie","Qté vendue","Prix unitaire","CA FCFA","Coût théo unit.","Coût théo total","Fiche"];
    const cols=[{wch:WCH_ZONE_LOGO},{wch:34},{wch:20},{wch:11},{wch:14},{wch:14},{wch:15},{wch:15},{wch:8}];
    const m=[[], H.map((h,i)=>({v:h,s:(i===1||i===2)?ST.head:ST.headR}))];
    (calc.pmixTheo||[]).forEach((p,i)=>{const ev=i%2===1;
      m.push([
        Cn(p.plu,Zm,zeb(ST.cellR,ev)),C(p.nom,zeb(ST.cell,ev)),C(p.categorie||"",zeb(ST.cellMut,ev)),
        Cn(p.qty,Zm,zeb(ST.cellR,ev)),Cn(p.price,Zm2,zeb(ST.cellR,ev)),Cn(p.amount,Zm,zeb(ST.cellR,ev)),Cn(p.coutUnit,Zm2,zeb(ST.cellR,ev)),Cn(p.coutTheo,Zm,zeb(ST.cellR,ev)),
        C(p.match?"Oui":"Non",{...zeb(ST.cellR,ev),font:xfont(p.match?XC.green:XC.red,true,10)}),
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
      ...(calc.articlesEcart||[]).filter(a=>!a.puPiece||a.puPiece===0).map(a=>["Article PU = 0","—",a.nom,"—","Prix non résolu — vérifier référentiels"]),
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
    m[0][COL_TITRE]={v:"ANOMALIES",s:ST.title};
    XLSX.utils.book_append_sheet(wb,xmkSheet(m,{cols,merges:[mrg(0,COL_TITRE,4)],rows:[{hpt:HPT_LIGNE_TITRE},{hpt:22}]}),"Anomalies");
  }

  // ── Feuille Douane (thème violet) ─────────────────────────────────────────
  {
    const H=["Article","Date","Qté","Prix carton","CDT","Prix pièce","Valeur FCFA"];
    const cols=[{wch:WCH_ZONE_LOGO},{wch:14},{wch:9},{wch:14},{wch:8},{wch:14},{wch:16}];
    const m=[[], H.map((h,i)=>({v:h,s:i<2?ST.headP:ST.headPR}))];
    (data.stockData?.douane||[]).forEach((d,i)=>{const ev=i%2===1;
      m.push([
        C(d.article,zeb(ST.cell,ev)),C(d.date?new Date(d.date).toLocaleDateString("fr-FR"):"—",zeb(ST.cellMut,ev)),
        Cn(d.qte,Zm,zeb(ST.cellR,ev)),Cn(d.pxCarton,Zm,zeb(ST.cellR,ev)),Cn(d.cdt,Zm,zeb(ST.cellR,ev)),Cn(d.pxPiece,Zm2,zeb(ST.cellR,ev)),
        Cn(d.valeur,Zm,{...zeb(ST.cellR,ev),font:xfont(XC.purple,false,10)}),
      ]);});
    m.push([C("TOTAL",ST.totalKp),C("",ST.totalKp),C("",ST.totalVp),C("",ST.totalVp),C("",ST.totalVp),C("",ST.totalVp),Cn(data.stockData?.douaneTotal,Zm,ST.totalVp)]);
    m[0][COL_TITRE]={v:"PRÉLÈVEMENTS DOUANE",s:ST.titleP};
    XLSX.utils.book_append_sheet(wb,xmkSheet(m,{cols,merges:[mrg(0,COL_TITRE,6)],rows:[{hpt:HPT_LIGNE_TITRE},{hpt:22}]}),"Douane");
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

export function buildModelesWb(articles, produits, site="", period="", dateInv="", destinataires=[]){
  const wb=XLSX.utils.book_new();
  const pmixProducts=(produits||[]).filter((p)=>p&&p.nom);
  const pmixPriceSheet="Référentiel PMIX";
  const artRefSheet="Référentiel Articles";
  const H =(t)=>({v:t,s:ST.head});
  const HR=(t)=>({v:t,s:ST.headR});
  const put=(arr,idx,cell)=>{ arr[idx]=cell; };

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
    rows[5]=[headerCell(""),headerCell(""),headerCell(""),headerCell("Nb articles / carton"),headerCell("Nb articles / inner"),headerCell("Carton"),headerCell("Inner"),headerCell("Unités"),headerCell("Nombre"),headerCell("Unité"),headerCell("Prix Unitaire"),headerCell("Valeur stock"),undefined,headerCell("Code Article"),headerCell("Quantité (unité)")];
    
    // Fonction pour normaliser les noms d'articles
    const normalizeString = (str) => 
      String(str || "")
        .trim()
        .toUpperCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
    
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
    
    // Trier les articles en respectant l'ordre personnalisé
    const sortedArticles = articles;
    
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
      
      put(r, 0, C(a.categorie || "", ref(ST.cellMut))); 
      put(r, 1, C(a.fournisseur || "SIA", ref(ST.cellMut)));
      put(r, 2, C(a.nom || "", { ...ref(ST.cell), font: xfont("1F2937", true, 10) })); 
      put(r, 3, Cn(a.conditionnement, "#,##0.##", ref(ST.cellR)));
      put(r, 4, Cn(a.qteInner, "#,##0.##", ref(ST.cellR)));
      put(r, 5, saisie(saisieCellN(ev))); 
      put(r, 6, saisie(saisieCellN(ev))); 
      put(r, 7, saisie(saisieCellN(ev)));
      put(r, 8, calcule(calcCellF(`F${R}+IF(D${R}>0,G${R}*E${R}/D${R},0)+IF(D${R}>0,H${R}/D${R},0)`, ev)));
      put(r, 9, C(a.unite || "", ref(ST.cellMut))); 
      put(r, 10, Cn(a.pu_carton, "#,##0.##", ref(ST.cellR)));
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
    const summaryStart=rows.length+1;
    const summaryCategories = getCategorySummaryList(articles);
    rows.push([]);
    summaryCategories.forEach((category,index)=>{
      const summaryRow=[];
      const fill=categoryFill(category);
      const summaryStyle={font:xfont("1F2937",true,10),fill,border:headerBorder,alignment:xal("left")};
      const valueStyle={font:xfont("1F2937",false,10),fill,border:headerBorder,alignment:xal("right")};
      const rowIndex = rows.length + 1;
      put(summaryRow,0,{v:category,s:summaryStyle});
      put(summaryRow,1,{t:"n",f:`SUMIF($A$7:$A$${lastDataRow},"${category}",$L$7:$L$${lastDataRow})`,z:"#,##0",s:valueStyle});
      rows.push(summaryRow);
    });
    const summaryTotal=[];
    put(summaryTotal,0,{v:"TOTAL",s:{...ST.totalK,fill:xfill("FFF200"),border:headerBorder}});
    put(summaryTotal,1,{t:"n",f:`SUM(B${rows.length - summaryCategories.length + 1}:B${rows.length})`,z:"#,##0",s:{...ST.totalV,fill:xfill("FFF200"),border:headerBorder}});
    rows.push(summaryTotal);
    const merges=[{s:{r:0,c:K},e:{r:0,c:14}},{s:{r:1,c:0},e:{r:1,c:4}},{s:{r:1,c:5},e:{r:1,c:7}},{s:{r:1,c:8},e:{r:1,c:11}},{s:{r:3,c:0},e:{r:3,c:14}},{s:{r:4,c:0},e:{r:5,c:0}},{s:{r:4,c:1},e:{r:5,c:1}},{s:{r:4,c:2},e:{r:5,c:2}},{s:{r:4,c:3},e:{r:4,c:4}},{s:{r:4,c:5},e:{r:4,c:7}},{s:{r:4,c:8},e:{r:4,c:11}},{s:{r:4,c:13},e:{r:4,c:14}}];
    return xmkSheet(rows,{cols,merges,rows:[{hpt:HPT_LIGNE_TITRE},{hpt:18},{hpt:20},{hpt:16},{hpt:28},{hpt:28}]});
  };
  XLSX.utils.book_append_sheet(wb,invSheet("Inventaire Initial"),"Inventaire Initial");
  XLSX.utils.book_append_sheet(wb,invSheet("Inventaire Final"),"Inventaire Final");

  // Transferts AGL → BK — format du fichier réel (Mouvements de sorties de stock).
  // Colonnes FIXES (compatibilité parsers.js) :
  //   0=Date(saisie)  1=BK(saisie)  2=Désignation  3=Catégorie  4=Code
  //   5=Unité  6=Conditionnement  7=Quantité(saisie)  8=Prix unitaire  9=Valeur  10=CTRL
  {
    // Référentiel articles dédupliqué par clé de recherche : Code Bolloré si présent,
    // sinon Désignation (les articles sans code restent recherchables par leur nom exact).
    const refKey=(a)=>{
      const code=a&&a.code!=null?String(a.code).trim():"";
      return code || (a&&a.nom?String(a.nom).trim():"");
    };
    const seenKeys=new Set();
    const refArticles=(articles||[]).filter((a)=>{
      const key=refKey(a);
      if(!key||seenKeys.has(key)) return false;
      seenKeys.add(key); return true;
    });
    const artRefLast=Math.max(2,refArticles.length+1);
    const NB_LIGNES_TRANSFERTS=500;
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
    put(head,8,headRefT("Prix unitaire"));
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
      put(r,8,{t:"n",f:vref(R,6),z:"#,##0.##",s:refS(ST.cellR)}); // Prix unitaire (auto)
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
    XLSX.utils.book_append_sheet(wb,xmkSheet(rows,{
      cols:[{wch:WCH_ZONE_LOGO},{wch:14},{wch:36},{wch:20},{wch:16},{wch:8},{wch:12},{wch:12},{wch:14},{wch:16},{wch:22}],
      merges:[
        {s:{r:0,c:COL_TITRE},e:{r:0,c:10}},   // Titre (décalé : logo en A1)
        {s:{r:1,c:0},e:{r:1,c:1}},        // Bandeau Saisie (gauche)
        {s:{r:1,c:2},e:{r:1,c:3}},        // Bandeau Auto
        {s:{r:1,c:5},e:{r:1,c:6}},        // Bandeau Auto (Unité/Cond.)
        {s:{r:2,c:0},e:{r:2,c:10}},       // Note d'aide
      ],
      rows:[{hpt:HPT_LIGNE_TITRE},{hpt:16},{hpt:30},{hpt:32}]
    }),"Transferts");
    // Référentiel articles (masqué) — clé = Code Bolloré, à défaut Désignation
    XLSX.utils.book_append_sheet(wb,xmkSheet([
      [C("Code / Désignation (clé)",ST.headR),C("Désignation",ST.head),C("Catégorie",ST.head),C("Unité",ST.head),C("Cond.",ST.headR),C("Prix unitaire (FCFA)",ST.headR)],
      ...refArticles.map((a)=>[
        C(refKey(a),ST.cellR),
        C(a.nom||"",ST.cell),
        C(a.categorie||"",ST.cell),
        C(a.unite||"",ST.cell),
        Cn(a.conditionnement,"#,##0.##",ST.cellR),
        Cn(a.pu_carton,"#,##0.##",ST.cellR),
      ]),
    ],{cols:[{wch:16},{wch:40},{wch:20},{wch:10},{wch:10},{wch:18}]}),artRefSheet);
  }

  // Pertes — reproduit la structure du fichier d'origine « Perte_Q1 2026 » (table Pertes4) :
  //   0=Catégorie 1=Nom Article 2=Cond. 3=Prix carton 4=Prix pièce (=prix carton÷cond, formule)
  //   5=Unité de perte (libellé colisage) 6=Quantité perte (=SOMME des jours) 7=Valeur (=px pièce×qté)
  //   8=libellés du bloc d'indicateurs, 9..39 = quantités perdues par jour 1→31 (J..AN, saisie), 40=total mois.
  // En tête (lignes 1-3, sur les colonnes jour) : CA HT du jour (saisie), valeur des pertes du jour
  //   (SOMMEPROD jours × prix pièce) et ratio perte/CA — comme dans le fichier de référence.
  // Sont exclus de cette feuille : Produits de Nettoyage et PACKAGING.
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
    put(rows[2],0,{v:"📌 Saisir les quantités perdues jour par jour (colonnes vertes J→AN) et le CA HT du jour en ligne 1 (colonne I). Quantité perte = somme des jours ; Valeur = Prix pièce × Quantité ; Prix pièce = Prix carton ÷ Cond.",
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
    const isPackaging=(cat)=>/packaging/i.test(String(cat||""));
    const filteredPertes = (articles || []).filter((a) => a && !isExcludedCategory(a.categorie) && !isPackaging(a.categorie));
    const SAISIE_DAILY=xfill("E8F5E9"), SAISIE_DAILY_LT=xfill("C8E6C9");
    let perteRow=0;   // données dès row index 4 (Excel ligne 5)
    const pushPerteRow=({categorie,nom,cond,puCarton,unite})=>{
      const r=[]; const ev=perteRow%2===1; const R=5+perteRow;
      const refP=(s)=>({...s,fill:ev?PREFFILL:xfill("EBF5FB"),border:xborder()});
      const calcP=(f,z)=>({t:"n",f,z,s:{font:xfont("E65100",true,10),fill:ev?PCALCFILL:xfill("FFE0B2"),alignment:xal("right"),border:xborder()}});
      const condVal=(Number(cond)>0)?Number(cond):1;   // règle documentée : repli conditionnement à 1 si absent
      put(r,0,C(categorie||"",catFillP(categorie)));
      put(r,1,C(nom,{...catFillP(categorie),font:xfont("1F2937",true,10)}));
      put(r,2,Cn(condVal,"#,##0.##",refP(ST.cellR)));
      put(r,3,Cn(puCarton,"#,##0",refP(ST.cellR)));
      put(r,4,calcP(`IF(C${R}>0,D${R}/C${R},D${R})`,"#,##0.00"));   // Prix pièce = Prix carton ÷ Cond
      put(r,5,C(unite||"pièce",refP(ST.cellMut)));
      put(r,6,calcP(`SUM(J${R}:AN${R})`,"#,##0"));                  // Quantité perte = somme des 31 jours
      put(r,7,calcP(`E${R}*G${R}`,"#,##0"));                        // Valeur = Prix pièce × Qté
      for(let j=0;j<31;j++) put(r,9+j,{v:0,t:"n",z:"#,##0",s:{font:xfont("2E7D32",false,11),fill:ev?SAISIE_DAILY:SAISIE_DAILY_LT,alignment:xal("right"),border:xborder()}});
      rows.push(r);
      perteRow++;
    };
    // Libellé de l'unité de perte : « Carton de N » quand le colisage est en pièces, sinon l'unité de base
    const perteUnite=(a,cond)=>{
      const u=String(a.unite||"").trim();
      if(u && !/^pi[èe]ces?$/i.test(u)) return u;
      return cond>1?`Carton de ${cond}`:"pièce";
    };
    filteredPertes.forEach((a)=>{
      const cond=(Number(a.conditionnement)>0)?Number(a.conditionnement):1;
      pushPerteRow({categorie:a.categorie,nom:a.nom,cond,puCarton:a.pu_carton,unite:perteUnite(a,cond)});
    });
    // Produits finis (recettes du Ratio) : valorisés au coût théorique, à la pièce
    if(pmixProducts.length){
      const sep=[];
      put(sep,0,{v:"PRODUITS FINIS — valorisation au coût théorique",s:{font:xfont(XC.white,true,10),fill:xfill(XC.purple),alignment:xal("left"),border:xborder()}});
      [1,2,3,5,6,7].forEach((c)=>put(sep,c,{v:"",s:{fill:xfill(XC.purple),border:xborder()}}));  // jamais de texte en colonne E (prix pièce) : SOMMEPROD la parcourt
      rows.push(sep);
      perteRow++;   // le bandeau occupe une ligne Excel
    }
    pmixProducts.forEach((p)=>pushPerteRow({categorie:p.categorie||"Produits finis",nom:p.nom,cond:1,puCarton:p.coutTheo,unite:"pièce"}));
    const lastP=4+perteRow;  // ligne Excel de la dernière ligne de données (bandeau inclus, ignoré par SUM)
    // Bloc d'indicateurs journaliers en tête (lignes 1-3, colonnes J→AN) — comme le fichier d'origine
    const dayCol=(j)=>XLSX.utils.encode_col(9+j);
    put(rows[0],8,{v:"CA HT du jour (saisie)",s:{font:xfont("2E7D32",true,10),fill:xfill("C8E6C9"),alignment:xal("left"),border:xborder()}});
    for(let j=0;j<31;j++){
      const L=dayCol(j);
      put(rows[0],9+j,{t:"n",z:"#,##0",s:{font:xfont("2E7D32",false,11),fill:SAISIE_DAILY,alignment:xal("right"),border:xborder()}});   // CA HT vide (saisie)
      put(rows[1],9+j,{t:"n",f:`SUMPRODUCT(${L}$5:${L}$${lastP},$E$5:$E$${lastP})`,z:"#,##0",s:{font:xfont("E65100",false,10),fill:PCALCFILL,alignment:xal("right"),border:xborder()}});
      put(rows[2],9+j,{t:"n",f:`IF(${L}1=0,"",${L}2/${L}1)`,z:Zpct,s:{font:xfont("E65100",false,10),fill:PCALCFILL,alignment:xal("right"),border:xborder()}});
    }
    put(rows[1],40,{t:"n",f:"SUBTOTAL(9,$J$2:$AN$2)",z:"#,##0",s:{...ST.totalVp,border:xborder()}});
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

  // P.Douane — Valeur calculée automatiquement (= Qté × Px pièce) + TOTAL. Données dès la ligne 3.
  {
    const rows=[]; rows[0]=[];
    put(rows[0],COL_TITRE,{v:`Prélèvements Douane — ${site||"BK ____"}`,s:ST.titleP});
    const head=[]; put(head,0,H("Article")); put(head,1,H("Date")); put(head,2,HR("Qté")); put(head,3,HR("Px carton"));
    put(head,4,HR("CDT")); put(head,5,HR("Px pièce")); put(head,6,HR("Valeur"));
    rows[1]=head;
    sortArticles(articles).forEach((a,i)=>{ const r=[]; const ev=i%2===1; const R=2+i+1;
      put(r,0,C(a.nom,zeb(ST.cell,ev))); put(r,3,Cn(a.pu_carton,"#,##0",zeb(ST.cellR,ev)));
      put(r,4,Cn(a.conditionnement,"#,##0.##",zeb(ST.cellR,ev))); put(r,5,Cn(a.pu_piece,"#,##0.00",zeb(ST.cellR,ev)));
      put(r,6,{t:"n",f:`C${R}*F${R}`,s:zeb(ST.cellR,ev),z:"#,##0"});    // Valeur = Qté × Prix pièce
      rows.push(r);                                            // 1 Date, 2 Qté à saisir
    });
    const tot=[]; put(tot,0,{v:"TOTAL",s:ST.totalKp}); put(tot,6,{t:"n",f:`SUM(G3:G${2+articles.length})`,s:ST.totalKp,z:"#,##0"}); rows.push(tot);
    XLSX.utils.book_append_sheet(wb,xmkSheet(rows,{cols:[{wch:WCH_ZONE_LOGO},{wch:12},{wch:9},{wch:12},{wch:8},{wch:12},{wch:14}],merges:[{s:{r:0,c:COL_TITRE},e:{r:0,c:6}}],rows:[{hpt:HPT_LIGNE_TITRE}]}),"P.Douane");
  }

  // Offert — données dès la ligne 2 (non lié aux articles)
  {
    const rows=[]; rows[0]=[];
    put(rows[0],COL_TITRE,{v:"Offerts / Repas",s:ST.title});
    const head=[]; ["BK","Staff Meal","Manager Meal","GT","Offer","HO","Discount CJ","Total"].forEach((h,i)=>{ put(head,i,i===0?H(h):HR(h)); });
    rows[1]=head; rows[2]=[]; put(rows[2],0,C(site||"BK ____",ST.cell));
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
    const rowCount = Math.max(1, pmixProducts.length);
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
      put(r, 4, { t: "n", f: `IF(OR(A${R}="",C${R}=""),"",C${R}*D${R})`, s: zeb(ST.cellR, ev), z: "#,##0" }); // Montant = Qty × Price
      put(r, 5, {
        t: "s",
        f: `IF(A${R}="","",IF(COUNTIF('${pmixPriceSheet}'!$A$2:$A$${refLast},${pluKey(R)})=0,"PLU ABSENT DU RATIO","OK"))`,
        s: zeb(ST.cell, ev),
      }); // Signale les PLU absents du ratio courant
      rows.push(r);
    }
    const tot = [];
    put(tot, 1, { v: "TOTAL", s: ST.totalK });
    put(tot, 2, { t: "n", f: `SUM(C3:C${2 + rowCount})`, s: ST.totalV, z: "#,##0" });
    put(tot, 4, { t: "n", f: `SUM(E3:E${2 + rowCount})`, s: ST.totalV, z: "#,##0" });
    rows.push(tot);

    XLSX.utils.book_append_sheet(wb, xmkSheet([
      [C("PLU", ST.headR), C("Produit", ST.head), C("Prix de vente (FCFA)", ST.headR)],
      // Price = PRIX DE VENTE du ratio (feuille « Ratios », PV TTC SANDWICH ONLY) ;
      // repli sur le coût théorique si le produit n'y figure pas.
      ...pmixProducts.map((p) => [C(p.plu == null ? "" : String(p.plu), ST.cellR), C(p.nom), Cn(Number(p.pvTtc) > 0 ? Number(p.pvTtc) : (Number(p.coutTheo) || 0), "#,##0", ST.cellR)]),
    ], { cols: [{ wch: 14 }, { wch: 42 }, { wch: 18 }] }), pmixPriceSheet);

    XLSX.utils.book_append_sheet(
      wb,
      xmkSheet(rows, {
        cols: [{ wch: WCH_ZONE_LOGO }, { wch: 38 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 28 }],
        merges: [{ s: { r: 0, c: COL_TITRE }, e: { r: 0, c: 5 } }],
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
export async function genererModelesSuivi(articles, produits, site="", period="", dateInv="", destinataires=[]){
  const wb=buildModelesWb(articles, produits, site, period, dateInv, destinataires);
  const suffix=[site,period].filter(Boolean).map(s=>s.replace(/[^a-zA-Z0-9]/g,"_")).join("_");
  await telechargerXlsx(wb,`Modeles_Suivi_Stock${suffix?"_"+suffix:""}.xlsx`);
}

