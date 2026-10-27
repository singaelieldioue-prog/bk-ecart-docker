// SONDE lecture seule — géométrie des feuilles du classeur de référence du CDG
// (exact/suivis stock BK 1.xlsx). Lit le XML des feuilles en streaming (head only) :
// sheet4.xml (Pmix) pèse 457 Mo une fois décompressé, lecture intégrale interdite.
// Exécution : node tests/tmp_exact_ref_feuilles.mjs [nbLignes]
import fs from "node:fs";
import JSZip from "jszip";

const REF = "C:/Users/arnaud.nzue/Downloads/files (12)/exact/suivis stock BK 1.xlsx";
const MAX_ROWS = Number(process.argv[2] || 9);
const SHEETS = {
  "Inventaire 31 Dec 25 (hidden)": "xl/worksheets/sheet1.xml",
  "Inventaire initial": "xl/worksheets/sheet2.xml",
  Sorties: "xl/worksheets/sheet3.xml",
  Pmix: "xl/worksheets/sheet4.xml",
  "Perte_Q1 2026": "xl/worksheets/sheet5.xml",
  "P.Douane": "xl/worksheets/sheet6.xml",
  Offert: "xl/worksheets/sheet7.xml",
  "Inventaire Final": "xl/worksheets/sheet8.xml",
  "Feuil2 (hidden)": "xl/worksheets/sheet9.xml",
  Articles: "xl/worksheets/sheet10.xml",
  "Feuil1 (hidden)": "xl/worksheets/sheet11.xml",
};

const z = await JSZip.loadAsync(fs.readFileSync(REF));
const ss = [];
{
  const s = await z.file("xl/sharedStrings.xml").async("string");
  s.replace(/<si>([\s\S]*?)<\/si>/g, (_m, body) => {
    ss.push([...body.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((x) => x[1]).join(""));
    return "";
  });
}
const dec = (t) => t.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");

// Lit les premiers octets (décompressés) d'une entrée sans matérer le fichier entier.
function readHead(entry, stopAfterRows) {
  return new Promise((resolve, reject) => {
    let buf = "";
    let rows = 0;
    let done = false;
    const st = entry.nodeStream();
    st.on("data", (chunk) => {
      if (done) return;
      buf += chunk.toString("utf8");
      rows = (buf.match(/<row /g) || []).length;
      const closed = buf.lastIndexOf("</sheetData>");
      if (rows > stopAfterRows || closed >= 0 || buf.length > 40_000_000) {
        done = true;
        buf = buf.slice(0, closed >= 0 ? closed + 12 : buf.length);
        st.destroy();
        resolve(buf);
      }
    });
    st.on("end", () => { if (!done) { done = true; resolve(buf); } });
    st.on("error", (e) => { if (!done) { done = true; reject(e); } });
  });
}

for (const [nom, chemin] of Object.entries(SHEETS)) {
  const entry = z.file(chemin);
  if (!entry) { console.log(`=== ${nom} : introuvable`); continue; }
  const head = await readHead(entry, MAX_ROWS);
  const dim = (head.match(/<dimension ref="([^"]+)"/) || [])[1] || "?";
  const pane = (head.match(/<pane[^>]*>/) || [""])[0];
  const cols = (head.match(/<cols>[\s\S]*?<\/cols>/) || [""])[0].replace(/\s+/g, " ").slice(0, 400);
  console.log(`\n=== ${nom}  dimension=${dim}`);
  if (cols) console.log(`   cols: ${cols}`);
  if (pane) console.log(`   pane: ${pane}`);
  const tbl = [...head.matchAll(/<row r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)];
  for (const [, rn, body] of tbl.slice(0, MAX_ROWS)) {
    const cells = [...body.matchAll(/<c r="([A-Z]+\d+)"([^>]*)>([\s\S]*?)<\/c>/g)].map(([, addr, attrs, inner]) => {
      const t = (attrs.match(/ t="([^"]+)"/) || [])[1] || "n";
      const v = (inner.match(/<v>([\s\S]*?)<\/v>/) || [])[1];
      const f = (inner.match(/<f[^>]*>([\s\S]*?)<\/f>/) || [])[1];
      let val = v === undefined ? "" : t === "s" ? dec(ss[Number(v)] ?? "") : dec(v);
      if (val.length > 26) val = val.slice(0, 26);
      if (f && f.length > 30) val = `=${f.slice(0, 30)}…`;
      else if (f) val = `=${f}`;
      return `${addr}:${val}`;
    });
    console.log(`   L${rn} | ${cells.join(" | ")}`.slice(0, 1500));
  }
}
