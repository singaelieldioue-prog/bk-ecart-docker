// Sonde lecture seule : formats de nombre de la feuille Perte_Q1 2026 du classeur de référence,
// lus dans le XML (styles.xml + la feuille), pour reproduire l affichage du CDG.
// Exécution : node tests/tmp_exact_formats.mjs
import fs from "node:fs";
import JSZip from "jszip";

const REF = "C:/Users/arnaud.nzue/Downloads/files (12)/exact/suivis stock BK 1.xlsx";
const zip = await JSZip.loadAsync(fs.readFileSync(REF));
const wbXml = await zip.file("xl/workbook.xml").async("string");
const sheets = [...wbXml.matchAll(/<sheet[^>]*name="([^"]+)"[^>]*r:id="(rId\d+)"/g)];
const rels = await zip.file("xl/_rels/workbook.xml.rels").async("string");
const relMap = new Map([...rels.matchAll(/Id="(rId\d+)"[^>]*Target="([^"]+)"/g)].map((m) => [m[1], m[2]]));
const cible = sheets.find((s) => /Perte/.test(s[1]));
const target = relMap.get(cible[2]);
console.log(`feuille « ${cible[1]} » → ${target}`);
const styles = await zip.file("xl/styles.xml").async("string");
const custom = new Map([...styles.matchAll(/<numFmt numFmtId="(\d+)" formatCode="([^"]*)"/g)].map((m) => [m[1], m[2]]));
const xfs = (styles.match(/<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/) || [])[1] || "";
const xfList = [...xfs.matchAll(/<xf\b([^>]*|\/>)/g)].map((m) => ((m[1].match(/numFmtId="(\d+)"/) || [])[1] ?? "0"));
const xml = await zip.file("xl/" + target.replace(/^\//, "")).async("string");
const want = ["D5", "E5", "F5", "G5", "H5", "I5", "J5", "AN5", "AO2", "E7", "E8", "E44", "E46", "J1", "J2", "J3", "C5", "B5", "H197", "I197", "E24"];
for (const m of xml.matchAll(/<c r="([A-Z]+\d+)"[^>]*?s="(\d+)"/g)) {
  if (!want.includes(m[1])) continue;
  const id = xfList[Number(m[2])] ?? "?";
  console.log(`${m[1]} styleIdx=${m[2]} xf#=${id} numFmt=${JSON.stringify(custom.get(id) || "builtin " + id)}`);
}
