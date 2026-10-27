// VÉRIF-SUIVI — radiographie OOXML en lecture seule (parse direct du XML, pas de xlsx).
// Produit tmp_verif/xml_inventory.json + une console d'preuves par feuille.
// Exécution : node tests/tmp_verif_suivi_xml.mjs
import fs from "node:fs";

import JSZip from "jszip";

const V = new URL("../../tmp_verif/", import.meta.url);
const FICHIER = new URL("Suivi_BK1_Octobre_2026.xlsx", V);
const buf = fs.readFileSync(FICHIER);
const zip = await JSZip.loadAsync(buf);

const txt = async (p) => (zip.files[p] ? zip.files[p].async("string") : null);

// ── workbook : noms, état visible/cache, rId→chemin, calcPr ────────────────────
const wbXml = await txt("xl/workbook.xml");
const wbRels = await txt("xl/_rels/workbook.xml.rels");
const relParId = {};
for (const m of wbRels.matchAll(/<Relationship\b[^>]*\/>/g)) {
  const tag = m[0];
  relParId[tag.match(/Id="([^"]+)"/)[1]] = "xl/" + tag.match(/Target="([^"]+)"/)[1].replace(/^\/?(xl\/)?/, "");
}
const feuilles = [];
for (const m of wbXml.matchAll(/<sheet\b[^>]*\/>/g)) {
  const tag = m[0];
  const a = (n) => (tag.match(new RegExp(`${n}="([^"]*)"`)) || [])[1];
  feuilles.push({
    nom: a("name"),
    sheetId: a("sheetId"),
    etat: a("state") || "visible",
    chemin: relParId[a("id")],
  });
}
const calcPr = (wbXml.match(/<calcPr\b[^>]*\/>/) || [])[0] || null;

// ── styles : numFmt déclarés + format par xf ───────────────────────────────────
const stXml = await txt("xl/styles.xml");
const numFmtParId = {};
for (const m of (stXml.match(/<numFmts\b[\s\S]*?<\/numFmts>/) || [""])[0].matchAll(/<numFmt\b[^>]*\/>/g)) {
  numFmtParId[m[0].match(/numFmtId="(\d+)"/)[1]] = m[0].match(/formatCode="([^"]*)"/)[1];
}
const xfList = [];
const debutXfs = stXml.indexOf("<cellXfs");
const corpsXfs = stXml.slice(debutXfs, stXml.indexOf("</cellXfs>", debutXfs));
// Formats Excel prédéfinis (non déclarés dans <numFmts>) : sans cette table un numFmtId
// interne est lu comme un identifiant brut et le relevé des formats est faux.
const BUILTIN = { 0: "General", 1: "0", 2: "0.00", 3: "#,##0", 4: "#,##0.00", 9: "0%", 10: "0.00%", 14: "mm-dd-yy", 22: "m/d/yy h:mm", 44: '_($* #,##0.00_)' };
for (const m of corpsXfs.matchAll(/<xf\b[^>]*?(?:\/>|>[\s\S]*?<\/xf>)/g)) {
  const numFmtId = (m[0].match(/numFmtId="(\d+)"/) || [])[1];
  const fontId = (m[0].match(/fontId="(\d+)"/) || [])[1];
  const fillId = (m[0].match(/fillId="(\d+)"/) || [])[1];
  xfList.push({ numFmtId, formatCode: numFmtParId[numFmtId] || BUILTIN[numFmtId] || `numFmtId ${numFmtId}`, fontId, fillId });
}

// ── sharedStrings ──────────────────────────────────────────────────────────────
const ssXml = await txt("xl/sharedStrings.xml");
const shared = [];
if (ssXml) {
  for (const m of ssXml.matchAll(/<si>([\s\S]*?)<\/si>/g)) {
    shared.push([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join(""));
  }
}
const dec = (s) =>
  s == null
    ? s
    : s
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&apos;/g, "'")
        .replace(/&amp;/g, "&");

// ── parse d'une feuille ────────────────────────────────────────────────────────
const parseFeuille = async (chemin) => {
  const xml = await txt(chemin);
  if (!xml) return null;
  const out = {
    chemin,
    dimension: (xml.match(/<dimension ref="([^"]+)"/) || [])[1] || null,
    pane: (xml.match(/<pane\b[^>]*\/>/) || [])[0] || null,
    selection: [...xml.matchAll(/<selection\b[^>]*\/>/g)].map((m) => m[0]).slice(0, 4),
    cols: [...xml.matchAll(/<col\b[^>]*\/>/g)].map((m) => {
      const a = (n) => (m[0].match(new RegExp(`${n}="([^"]*)"`)) || [])[1];
      return { min: a("min"), max: a("max"), width: a("width"), custom: a("custom"), hidden: a("hidden") };
    }),
    mergeCells: [...xml.matchAll(/<mergeCell ref="([^"]+)"/g)].map((m) => m[1]),
    lignes: {},
    nbRowsXml: (xml.match(/<row\b/g) || []).length,
    formules: {},
  };
  const body = (xml.match(/<sheetData>([\s\S]*)<\/sheetData>/) || [])[1] || "";
  for (const rm of body.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)) {
    const rowNum = Number((rm[1].match(/r="(\d+)"/) || [])[1]);
    const cellules = {};
    for (const cm of rm[2].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = cm[1];
      const inner = cm[2] || "";
      const ref = (attrs.match(/r="([A-Z]+\d+)"/) || [])[1];
      const t = (attrs.match(/t="([^"]+)"/) || [])[1];
      const s = (attrs.match(/s="(\d+)"/) || [])[1];
      const f = (inner.match(/<f[^>]*>([\s\S]*?)<\/f>/) || [])[1];
      const v = (inner.match(/<v[^>]*>([\s\S]*?)<\/v>/) || [])[1];
      let valeur = v;
      if (t === "s" && v != null) valeur = shared[Number(v)];
      if (t === "inlineStr") valeur = (inner.match(/<t[^>]*>([\s\S]*?)<\/t>/) || [])[1];
      cellules[ref.replace(/\d+/g, "")] = {
        r: ref,
        t: t || "n",
        v: dec(valeur),
        f: f ? dec(f) : null,
        s: s == null ? null : Number(s),
        z: s == null ? null : xfList[Number(s)]?.formatCode || `numFmtId ${xfList[Number(s)]?.numFmtId}`,
        fillId: s == null ? null : xfList[Number(s)]?.fillId ?? null,
        bold: s == null ? null : null,
      };
      const col = ref.replace(/\d+/g, "");
      if (f && !out.formules[col]) out.formules[col] = { ligne: rowNum, ref, f: dec(f) };
    }
    out.lignes[rowNum] = cellules;
  }
  return out;
};

// ── drawings : image par feuille ───────────────────────────────────────────────
const drawingParFeuille = {};
for (const f of feuilles) {
  const base = f.chemin.split("/").pop();
  const rels = await txt(`xl/worksheets/_rels/${base}.rels`);
  if (!rels) {
    drawingParFeuille[f.nom] = { drawing: null, images: [] };
    continue;
  }
  const dM = rels.match(/Type="[^"]*\/drawing"\s+Target="([^"]+)"/);
  const resolve = (cible) => {
    const parts = ["xl", "worksheets"];
    for (const seg of cible.split("/")) {
      if (seg === "." || seg === "") continue;
      if (seg === "..") parts.pop();
      else parts.push(seg);
    }
    return parts.join("/");
  };
  const dPath = dM ? resolve(dM[1]) : null;
  const dXml = dPath ? await txt(dPath) : null;
  let images = [];
  if (dXml) {
    const dRels = await txt(dPath.replace("/drawings/", "/drawings/_rels/") + ".rels");
    const idParRid = {};
    if (dRels) {
      for (const m of dRels.matchAll(/<Relationship\b[^>]*\/>/g)) {
        idParRid[m[0].match(/Id="([^"]+)"/)[1]] = m[0].match(/Target="([^"]+)"/)[1];
      }
    }
    images = [...dXml.matchAll(/<xdr:oneCellAnchor\b[\s\S]*?<\/xdr:oneCellAnchor>|<xdr:twoCellAnchor\b[\s\S]*?<\/xdr:twoCellAnchor>/g)].map((m) => {
      const blk = m[0];
      const from = (blk.match(/<xdr:from>([\s\S]*?)<\/xdr:from>/) || [])[1];
      const fr = (n) => Number(((from || "").match(new RegExp(`<xdr:${n}>(\\d+)<`)) || [])[1]);
      const ext = (blk.match(/<xdr:ext cx="(\d+)" cy="(\d+)"/) || []);
      const rid = ((blk.match(/r:embed="([^"]+)"/) || [])[1] || "").replace(/^\//, "");
      return {
        colonne: fr("col"),
        ligne: fr("row"),
        colOffPx: Math.round(Number(((from || "").match(/<xdr:colOff>(\d+)</) || [])[1]) / 9525),
        rowOffPx: Math.round(Number(((from || "").match(/<xdr:rowOff>(\d+)</) || [])[1]) / 9525),
        colTo: (() => {
          const t = (blk.match(/<xdr:to>([\s\S]*?)<\/xdr:to>/) || [])[1];
          return Number(((t || "").match(/<xdr:col>(\d+)</) || [])[1]);
        })(),
        rowTo: (() => {
          const t = (blk.match(/<xdr:to>([\s\S]*?)<\/xdr:to>/) || [])[1];
          return Number(((t || "").match(/<xdr:row>(\d+)</) || [])[1]);
        })(),
        cx: Number(ext[1]),
        cy: Number(ext[2]),
        px: Math.round(Number(ext[1]) / 9525),
        media: (() => {
          const t = idParRid[rid];
          if (!t) return null;
          const cleaned = t.replace(/^\.\.\//, "").replace(/^\//, "");
          return cleaned.startsWith("xl/") ? cleaned : "xl/" + cleaned;
        })(),
        rid,
      };
    });
  }
  drawingParFeuille[f.nom] = { drawing: dPath, images, xmlExiste: !!dXml };
}

const mediaList = [];
for (const p of Object.keys(zip.files)) {
  if (/^xl\/media\/.+/.test(p)) mediaList.push({ chemin: p, octets: (await zip.files[p].async("uint8array")).length });
}

const data = { fichier: "tmp_verif/Suivi_BK1_Octobre_2026.xlsx", taille: buf.length, calcPr, feuilles: {}, media: mediaList };
for (const f of feuilles) {
  const parsed = await parseFeuille(f.chemin);
  data.feuilles[f.nom] = { ...f, ...parsed, dessin: drawingParFeuille[f.nom] };
}
fs.writeFileSync(new URL("xml_inventory.json", V), JSON.stringify(data, null, 1));

console.log("calcPr :", data.calcPr);
console.log("media  :", JSON.stringify(mediaList));
for (const f of feuilles) {
  const p = data.feuilles[f.nom];
  console.log("═".repeat(78));
  console.log(`${f.nom} · ${f.etat} · dimension ${p.dimension} · rows(xml) ${p.nbRowsXml} · merges ${p.mergeCells.length}`);
  console.log(`  pane   : ${p.pane}`);
  console.log(`  cols   : ${p.cols.map((c) => `${c.min}-${c.max}=w${c.width}${c.custom ? "(custom)" : ""}`).join(" ")}`);
  console.log(`  formules: ${Object.entries(p.formules).map(([c, x]) => `${c}${x.ligne}`).join(",")}`);
  const imgs = p.dessin.images;
  console.log(`  images : ${imgs.length ? imgs.map((i) => `${i.colonne},${i.ligne}→${i.colTo},${i.rowTo} ${i.cx}x${i.cy}EMU(${i.px}px) ${i.rid}`).join(" | ") : "aucune"}`);
}
