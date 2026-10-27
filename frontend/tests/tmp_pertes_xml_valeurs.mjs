// Sonde lecture seule : valeurs exactes écrites dans le XML de la feuille « Pertes » du classeur livré.
// Exécution : node tests/tmp_pertes_xml_valeurs.mjs 163 156 159 190
import fs from "node:fs";
import JSZip from "jszip";
const zip = await JSZip.loadAsync(fs.readFileSync(new URL("../../tmp_verif/Suivi_BK1_Octobre_2026.xlsx", import.meta.url)));
const s = await zip.file("xl/worksheets/sheet5.xml").async("string");
const de = (t) => t.replace(/&apos;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
const ligne = (n) => (s.match(new RegExp(`<row[^>]*r="${n}"[^>]*>([\\s\\S]*?)</row>`)) || [])[1] || "";
const cell = (n, col) => {
  const m = ligne(n).match(new RegExp(`<c r="${col}${n}"[^>]*>([\\s\\S]*?)</c>`));
  if (!m) return null;
  const v = m[1].match(/<v[^>]*>([\s\S]*?)<\/v>/);
  const f = m[1].match(/<f[^>]*>([\s\S]*?)<\/f>/);
  return { v: v ? de(v[1]) : null, f: f ? de(f[1]) : null };
};
for (const n of process.argv.slice(2)) {
  const a = cell(n, "A"), b = cell(n, "B"), c = cell(n, "C"), d = cell(n, "D"), e = cell(n, "E");
  console.log(`l${n} · A=${JSON.stringify(a?.v)} · B=${JSON.stringify(b?.v)} · C=${JSON.stringify(c?.v)} · D=${JSON.stringify(d?.v)} · E=${JSON.stringify(e?.f)}`);
}
