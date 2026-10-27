// SONDE — géométrie du bloc récap du fichier de référence du CDG (exemple inventaire.xlsx,
// feuille « inventaire »), lecture seule, ligne par ligne et style par style.
// But : avoir la source exacte de la capture « je veux le recap identique ».
// Exécution : node tests/tmp_ref_cdg.mjs [premiere_ligne] [derniere_ligne]
import fs from "node:fs";
import XLSX from "xlsx-js-style";

const JSZip = (await import("jszip")).default;
const DEBUT = Number(process.argv[2] || 318);
const FIN = Number(process.argv[3] || 342);

const wb = XLSX.read(fs.readFileSync(new URL("../public/exemple inventaire.xlsx", import.meta.url)), { type: "buffer" });
const zip = await JSZip.loadAsync(fs.readFileSync(new URL("../public/exemple inventaire.xlsx", import.meta.url)));

const wbXml = await zip.file("xl/workbook.xml").async("string");
const rels = await zip.file("xl/_rels/workbook.xml.rels").async("string");
const sheetRef = /<sheet[^>]*name="inventaire"[^>]*r:id="(rId\d+)"/.exec(wbXml);
const target = new RegExp(`Id="${sheetRef[1]}"[^>]*Target="([^"]+)"`).exec(rels)[1];
const sheetXml = await zip.file("xl/" + target.replace(/^\.?\//, "")).async("string");
const stylesXml = await zip.file("xl/styles.xml").async("string");

// sharedStrings en texte brut (les <si> peuvent contenir des <r> riches)
const sstXml = await zip.file("xl/sharedStrings.xml").async("string");
const SST = [...sstXml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => [...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join(""));

const elements = (xml, balise) =>
  [...xml.matchAll(new RegExp(`<${balise}\\b[^>]*?(?:/>|>[\\s\\S]*?<\\/${balise}>)`, "g"))].map((m) => m[0]);
const bloc = (xml, balise) => new RegExp(`<${balise}\\b[^>]*>([\\s\\S]*?)</${balise}>`).exec(xml)?.[1] || "";

const borders = elements(bloc(stylesXml, "borders"), "border");
const fills = elements(bloc(stylesXml, "fills"), "fill");
const fonts = elements(bloc(stylesXml, "fonts"), "font");
const xfs = elements(bloc(stylesXml, "cellXfs"), "xf");
const numfmts = [...stylesXml.matchAll(/<numFmt numFmtId="(\d+)" formatCode="([^"]*)"/g)];
const NF = Object.fromEntries(numfmts.map((m) => [m[1], m[2]]));

const decode = (s) => s.replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

const describe = (i) => {
  const xf = xfs[i] || "";
  const borderId = Number(/borderId="(\d+)"/.exec(xf)?.[1] ?? 0);
  const fillId = Number(/fillId="(\d+)"/.exec(xf)?.[1] ?? 0);
  const fontId = Number(/fontId="(\d+)"/.exec(xf)?.[1] ?? 0);
  const nfId = /numFmtId="(\d+)"/.exec(xf)?.[1];
  const b = borders[borderId] || "";
  const edges = ["left", "right", "top", "bottom"].filter((e) => new RegExp(`<${e}\\b[^>]*style="([^"]+)"`).exec(b)?.[1]);
  const ep = ["left", "right", "top", "bottom"].map((e) => `${e.slice(0, 2)}:${new RegExp(`<${e}\\b[^>]*?(?:style="([^"]+)")?[^>]*?/>`).exec(b)?.[1] || "-"}`).join(" ");
  const fill = fills[fillId] || "";
  const rgb = /rgb="([0-9A-Fa-f]{8})"/.exec(fill)?.[1] || (/patternType="(\w+)"/.exec(fill)?.[1] ?? "aucune");
  const f = fonts[fontId] || "";
  const al = /<alignment\b[^>]*\/>/.exec(xf)?.[0] || "";
  return {
    bord: `b${borderId}[${edges.join("/") || "aucun"}] ${ep}`,
    fill: `f${fillId} ${rgb} ${/patternType="(\w+)"/.exec(fill)?.[1] || ""}`,
    police: `${/sz val="([\d.]+)"/.exec(f)?.[1] || "?"}pt ${/<b\/>|<b val="(1|true)"/.test(f) ? "gras " : ""}${/color rgb="([0-9A-Fa-f]{8})"/.exec(f)?.[1] || /color theme="(\d+)"/.exec(f)?.[1] || ""}`,
    align: `h=${/horizontal="(\w+)"/.exec(al)?.[1] || "g"} v=${/vertical="(\w+)"/.exec(al)?.[1] || "g"} wrap=${/wrapText="1|wrapText val="1/.test(al) ? "oui" : "non"}`,
    z: NF[nfId] || `#${nfId}`,
  };
};

// fusions
const merges = [...sheetXml.matchAll(/<mergeCell ref="([A-Z]+\d+:[A-Z]+\d+)"/g)].map((m) => m[1]);
const colXml = /<cols>([\s\S]*?)<\/cols>/.exec(sheetXml)?.[1] || "";
const cols = [...colXml.matchAll(/<col min="(\d+)" max="(\d+)" width="([\d.]+)"/g)].map((m) => `${m[1]}-${m[2]}:${m[3]}`);

console.log("fusions de la feuille :", merges.join(" "));
console.log("largeurs colonnes :", cols.join(" "));

const ligne = (r) => new RegExp(`<row r="${r}"[^>]*?(?:/>|>[\\s\\S]*?</row>)`).exec(sheetXml)?.[0];

for (let r = DEBUT; r <= FIN; r++) {
  const lr = ligne(r);
  if (!lr) { console.log(`ligne ${r} : absente`); continue; }
  const ht = /ht="([\d.]+)"/.exec(lr)?.[1];
  const custom = /customHeight="1"/.test(lr) ? "custom" : "auto";
  const cellules = [...lr.matchAll(/<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)];
  if (cellules.length === 0) { console.log(`ligne ${r} : <row ht="${ht}" ${custom}> aucune cellule`); continue; }
  console.log(`\n── ligne ${r}  ht=${ht ?? "—"}/${custom}`);
  for (const [, ref, attrs, inner = ""] of cellules) {
    const s = Number(/s="(\d+)"/.exec(attrs)?.[1] ?? -1);
    const t = /t="(\w+)"/.exec(attrs)?.[1] || "n";
    const v = /<v>([\s\S]*?)<\/v>/.exec(inner)?.[1];
    const fml = /<f>([\s\S]*?)<\/f>/.exec(inner)?.[1];
    const texte = t === "s" ? `«${decode(SST[Number(v)] ?? "?")}»` : v != null ? `v=${decode(v)}` : "vide";
    const d = s >= 0 ? describe(s) : null;
    console.log(
      `  ${ref.padEnd(5)} t=${t} ${texte}${fml ? ` f=${decode(fml)}` : ""}` +
        (d ? `\n        ${d.z}\n        ${d.fill} | ${d.police} | ${d.align}\n        ${d.bord}` : "\n        sans style")
    );
  }
  const dansPlage = merges.filter((m) => {
    const [, c1, r1, c2, r2] = /([A-Z]+)(\d+):([A-Z]+)(\d+)/.exec(m);
    return Number(r1) <= r && Number(r2) >= r;
  });
  if (dansPlage.length) console.log(`  fusions couvrant la ligne ${r} : ${dansPlage.join(" ")}`);
}
