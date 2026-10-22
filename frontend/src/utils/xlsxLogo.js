import XLSX from "xlsx-js-style";
import JSZip from "jszip";
import { LOGO_BK_SERVAIR_B64, LOGO_BK_SERVAIR_W, LOGO_BK_SERVAIR_H } from "./logoBkServair.js";

const EMU_PAR_PX = 9525;          // 1 px = 9525 EMU (OOXML)
const MARGE_PX = 2;               // marge autour du logo dans la cellule
const RATIO_LARGEUR_LOGO = 0.75;  // largeur affichée = 75 % de la largeur native du PNG
const LOGO_MEDIA = "xl/media/logo_bk_servair.png";
const LOGO_RID = "rIdLogoBK";     // relation feuille → drawing
const RID_IMAGE = "rId1";         // relation drawing → image
const MIME_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const REL_TYPE_DRAWING = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing";
const REL_TYPE_IMAGE = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image";
const NS_REL = "http://schemas.openxmlformats.org/package/2006/relationships";
const ENTETE_XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n';

const attr = (tag, name) => new RegExp(`${name}="([^"]+)"`).exec(tag)?.[1];

// Feuilles visibles du classeur : [{chemin du sheetN.xml, hidden}] dans l'ordre du ZIP.
function feuillesDuClasseur(wbXml, relsXml) {
  const cibleParRid = {};
  for (const m of relsXml.matchAll(/<Relationship\b[^>]*\/>/g)) {
    const tag = m[0];
    const type = attr(tag, "Type") || "";
    const id = attr(tag, "Id");
    const target = attr(tag, "Target");
    if (id && target && type.endsWith("/worksheet")) {
      cibleParRid[id] = "xl/" + target.replace(/^\/?(xl\/)?/, "");
    }
  }
  const feuilles = [];
  for (const m of wbXml.matchAll(/<sheet\b[^>]*\/>/g)) {
    const tag = m[0];
    const path = cibleParRid[attr(tag, "r:id") || ""];
    if (path) feuilles.push({ path, name: attr(tag, "name") || "", hidden: /state="(hidden|veryHidden)"/.test(tag) });
  }
  return feuilles;
}

// Volets figés (xSplit/ySplit en demi-colonnes/lignes : xSplit=3 ⇒ A→C restent visibles,
// le défilement commence en D). ySplit = nombre de lignes d'en-tête de la feuille.
const PANNEAUX_FIGES = {
  "Inventaire Initial": { xSplit: 3, ySplit: 6 },   // A→C : Catégorie, Frns, ARTICLE — données ligne 7
  "Inventaire Final": { xSplit: 3, ySplit: 6 },
  Transferts: { xSplit: 3, ySplit: 4 },             // A→C : Date, BK, Désignation — données ligne 5
  Pertes: { xSplit: 9, ySplit: 4 },                 // A→I : libellés et prix — 31 jours à partir de J
};

function figerVolets(xmlFeuille, nom) {
  const cfg = PANNEAUX_FIGES[nom];
  if (!cfg || /<pane\b/.test(xmlFeuille)) return xmlFeuille;
  const coin = `${XLSX.utils.encode_col(cfg.xSplit)}${cfg.ySplit + 1}`;
  const volet = `<pane xSplit="${cfg.xSplit}" ySplit="${cfg.ySplit}" topLeftCell="${coin}" activePane="bottomRight" state="frozen"/>`
    + `<selection pane="bottomRight" activeCell="${coin}" sqref="${coin}"/>`;
  return xmlFeuille.replace(/<sheetView\b([^>]*?)\s*\/>/, (m, attrs) => `<sheetView${attrs}>${volet}</sheetView>`);
}

// Le drawing est lié depuis chaque feuille visible ET chaque relation doit référencer le même
// fichier image. L'ancre est « une cellule » : ligne 1, colonne A, taille native du logo.
function xmlDrawing(cx, cy) {
  return `${ENTETE_XML}<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><xdr:oneCellAnchor><xdr:from><xdr:col>0</xdr:col><xdr:colOff>${MARGE_PX * EMU_PAR_PX}</xdr:colOff><xdr:row>0</xdr:row><xdr:rowOff>${MARGE_PX * EMU_PAR_PX}</xdr:rowOff></xdr:from><xdr:ext cx="${cx}" cy="${cy}"/><xdr:pic><xdr:nvPicPr><xdr:cNvPr id="1" name="Logo BK Servair"/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr><xdr:blipFill><a:blip r:embed="${RID_IMAGE}"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill><xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic><xdr:clientData/></xdr:oneCellAnchor></xdr:wsDr>`;
}

function xmlRelsFeuille(n) {
  return `${ENTETE_XML}<Relationships xmlns="${NS_REL}"><Relationship Id="${LOGO_RID}" Type="${REL_TYPE_DRAWING}" Target="../drawings/drawing${n}.xml"/></Relationships>`;
}

function xmlRelsDrawing() {
  return `${ENTETE_XML}<Relationships xmlns="${NS_REL}"><Relationship Id="${RID_IMAGE}" Type="${REL_TYPE_IMAGE}" Target="../media/logo_bk_servair.png"/></Relationships>`;
}

// Injecte le logo BK/Servair en haut à gauche (colonne A, ligne 1) de chaque feuille visible.
// xlsx-js-style n'écrit pas d'images : on complète le ZIP OOXML après génération.
// Les feuilles masquées (référentiels) sont ignorées. Renvoie un ArrayBuffer.
export async function injecterLogoXlsx(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const fWb = zip.file("xl/workbook.xml");
  const fRels = zip.file("xl/_rels/workbook.xml.rels");
  const fCt = zip.file("[Content_Types].xml");
  if (!fWb || !fRels || !fCt) return buffer;

  const xmlWb = await fWb.async("string");
  const feuilles = feuillesDuClasseur(xmlWb, await fRels.async("string"))
    .filter((f) => !f.hidden);

  const cx = Math.round(LOGO_BK_SERVAIR_W * RATIO_LARGEUR_LOGO) * EMU_PAR_PX;
  const cy = LOGO_BK_SERVAIR_H * EMU_PAR_PX;
  let overrides = "";
  let n = 0;
  for (const f of feuilles) {
    let xmlFeuille = await zip.file(f.path).async("string");
    const avecVolet = figerVolets(xmlFeuille, f.name);
    if (avecVolet !== xmlFeuille) { zip.file(f.path, avecVolet); xmlFeuille = avecVolet; }
    if (/<drawing\b/.test(xmlFeuille)) continue;   // déjà un dessin : on n'écrase pas
    n++;
    const drawing = `xl/drawings/drawing${n}.xml`;
    zip.file(f.path, xmlFeuille.replace("</worksheet>", `<drawing r:id="${LOGO_RID}"/></worksheet>`));
    zip.file(`xl/worksheets/_rels/${f.path.split("/").pop()}.rels`, xmlRelsFeuille(n));
    zip.file(drawing, xmlDrawing(cx, cy));
    zip.file(`xl/drawings/_rels/drawing${n}.xml.rels`, xmlRelsDrawing());
    overrides += `<Override PartName="/${drawing}" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>`;
  }
  if (!n) return buffer;

  zip.file(LOGO_MEDIA, LOGO_BK_SERVAIR_B64, { base64: true });
  const ct = await fCt.async("string");
  zip.file(
    "[Content_Types].xml",
    ct.includes('Extension="png"') ? ct.replace("</Types>", overrides + "</Types>")
      : ct.replace("</Types>", `<Default Extension="png" ContentType="image/png"/>` + overrides + "</Types>")
  );
  // xlsx-js-style n'écrit pas wb.Workbook.CalcPr : sans ce élément, les colonnes calculées
  // (formules sans valeur en cache) restent vides à l'ouverture de certains tableurs.
  if (!/<calcPr\b/.test(xmlWb)) {
    zip.file("xl/workbook.xml",
      xmlWb.replace("</sheets>", '</sheets><calcPr calcId="191029" calcMode="auto" fullCalcOnLoad="1" forceFullCalc="1"/>'));
  }
  return zip.generateAsync({ type: "arraybuffer" });
}

// Écrit le classeur (avec logo) et déclenche le téléchargement navigateur.
export async function telechargerXlsx(wb, nomFichier) {
  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const out = await injecterLogoXlsx(buf);
  const blob = new Blob([out], { type: MIME_XLSX });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomFichier;
  a.click();
  URL.revokeObjectURL(url);
}
