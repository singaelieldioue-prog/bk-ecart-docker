// Contrôle XML du classeur réellement produit (chaîne de l'application, logo injecté) :
// bornes du bloc récap, bordures par côté, teintes, hauteurs de lignes, fusions.
// Exécution : node tests/tmp_xml_reel.mjs   (après node tests/tmp_verif_suivi_gen.mjs)
import fs from "node:fs";
import JSZip from "jszip";

const buf = fs.readFileSync(new URL("../../tmp_verif/Suivi_BK1_Octobre_2026.xlsx", import.meta.url));
const zip = await JSZip.loadAsync(buf);
const wbXml = await zip.file("xl/workbook.xml").async("string");
const rels = await zip.file("xl/_rels/workbook.xml.rels").async("string");

const els = (x, b) => [...x.matchAll(new RegExp(`<${b}\\b[^>]*?(?:/>|>[\\s\\S]*?<\\/${b}>)`, "g"))].map((m) => m[0]);
const bloc = (x, b) => new RegExp(`<${b}\\b[^>]*>([\\s\\S]*?)</${b}>`).exec(x)?.[1] || "";

const stylesXml = await zip.file("xl/styles.xml").async("string");
const borders = els(bloc(stylesXml, "borders"), "border");
const fills = els(bloc(stylesXml, "fills"), "fill");
const xfs = els(bloc(stylesXml, "cellXfs"), "xf");
const sstF = zip.file("xl/sharedStrings.xml");
const sst = sstF ? await sstF.async("string") : "";
const SST = [...sst.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => [...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join(""));

for (const nom of ["Inventaire Initial", "Inventaire Final"]) {
  const sh = new RegExp(`<sheet[^>]*name="${nom}"[^>]*r:id="(rId\\d+)"`).exec(wbXml);
  const tgt = new RegExp(`Id="${sh[1]}"[^>]*Target="([^"]+)"`).exec(rels)[1];
  const sx = await zip.file("xl/" + tgt.replace(/^\.?\//, "")).async("string");
  console.log(`\n═══ ${nom} (${tgt}) ═══`);
  for (let r = 325; r <= 334; r++) {
    const Lu = [];
    for (const col of ["C", "D", "E", "F"]) {
      const c = new RegExp(`<c r="${col}${r}"([^>]*?)(?:/>|>([\\s\\S]*?)</c>)`).exec(sx);
      if (!c) { Lu.push(`${col}${r}=absente`); continue; }
      const s = Number(/ s="(\d+)"/.exec(c[1])?.[1]);
      const xf = xfs[s] || "";
      const bid = Number(/borderId="(\d+)"/.exec(xf)?.[1] ?? 0);
      const b = borders[bid] || "";
      const traits = ["left", "right", "top", "bottom"].map((e) => `${e[0]}${new RegExp(`<${e}\\b[^>]*style="(\\w+)"`).exec(b)?.[1]?.slice(0, 3) || "-"}`).join("");
      const fid = Number(/fillId="(\d+)"/.exec(xf)?.[1] ?? 0);
      const rgb = /rgb="FF([0-9A-F]{6})"/.exec(fills[fid] || "")?.[1] || "—";
      const v = /<v>([^<]*)/.exec(c[2] || "")?.[1];
      const t = /t="(\w+)"/.exec(c[1])?.[1];
      const txt = t === "s" ? SST[Number(v)] ?? "?" : v ?? "";
      Lu.push(`${col}${r} b${bid}[${traits}] ${rgb}${/wrapText="(1|true)"/.test(xf) ? " wrap" : ""}${txt ? ` «${txt}»` : ""}`);
    }
    const ligne = new RegExp(`<row r="${r}"[^>]*>`).exec(sx)?.[0] || "ligne absente";
    console.log(Lu.join(" | "));
    console.log(`   ${ligne}`);
  }
  console.log("fusions bas de feuille :", (sx.match(/<mergeCell ref="[C-F]3\d+:[C-F]3\d+"/g) || []).join(" | ") || "aucune");
  console.log("hauteur ligne 7 :", /<row r="7"[^>]*>/.exec(sx)?.[0]);
}
