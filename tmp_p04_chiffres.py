# Lecture seule — P0-4 : chiffres finaux (colisage inner, écart par ligne, théo non rattachée).
import json, re, sqlite3, sys, unicodedata
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.path.insert(0, "scripts")
from audit_referentiel import read_sheet_rows

def norm(s):
    if s is None or s == "":
        return ""
    s = str(s).strip()
    s = unicodedata.normalize("NFD", s)
    s = re.sub("[\u0300-\u036f]", "", s)
    s = re.sub("[\u2019'\u2018]", "", s)
    s = re.sub("[^A-Z0-9\\s]", " ", s, flags=re.IGNORECASE)
    s = re.sub(r"\s+", " ", s)
    return s.upper()

PF = re.compile(r"PEPSI|FRIES|FRITE|COLA|SODA|SOFT", re.I)

# A) Colonne E (« Nb articles / inner ») du modèle : valeur écrite par excelExporter.js:393
rows = read_sheet_rows("frontend/public/exemple inventaire.xlsx", "inventaire")
ref = [(i + 1, r) for i, r in enumerate(rows[6:], start=6) if len(r) > 14 and r[3] and r[14]]
zeros_e = [x for x in ref if not (isinstance(x[1][5], (int, float)) and x[1][5] > 0)]
pf_e = [(x[0], x[1][3], x[1][14], x[1][4], x[1][5]) for x in ref if PF.search(str(x[1][3]) + " " + str(x[1][4] or ""))]
print("lignes whitelist:", len(ref), "| E (qteInner) <= 0 :", len(zeros_e), f"({len(zeros_e)/len(ref)*100:.1f} %)")
print("lignes Pepsi/frites : excel_row | nom | code | D=colisage | E=nb/inner")
for x in pf_e:
    print("  ", x)

con = sqlite3.connect("file:backend/data.db?mode=ro", uri=True)
RIDS = [("60198f93-f763-4bb9-b84c-05e63d01d639", "BK1 — 23/10/2026"),
        ("76b8d757-ebe4-4d46-a9e1-0aa3a79de44c", "BK COCODY — 22/10/2026")]
tot = {}
for rid, label in RIDS:
    d = json.loads(con.execute("select data from reports where id=?", (rid,)).fetchone()[0])
    calc, sd = d["calc"], d["stockData"]
    pt = [p for p in calc["pmixTheo"] if PF.search(str(p.get("nom") or ""))]
    pt_nofricesauce = [p for p in pt if str(p["plu"]).strip() != "660010"]
    ci = [c for c in calc["consoParIng"] if PF.search(str(c.get("nom") or ""))]
    ae = [a for a in calc["articlesEcart"] if PF.search(str(a.get("nom") or ""))]
    inv_pf = {k: v for k, v in sd["invIni"].items() if PF.search(str(v.get("nom") or ""))}
    tot[label] = {
        "nb_pmix_lignes": len(pt), "qty": sum(p["qty"] for p in pt), "cout": sum(p["coutTheo"] for p in pt),
        "qty_hors_660010": sum(p["qty"] for p in pt_nofricesauce), "cout_hors_660010": sum(p["coutTheo"] for p in pt_nofricesauce),
        "cout_complement_pf": sum(p["coutTheo"] for p in pt if p.get("source") == "complement"),
        "cout_ratio_pf": sum(p["coutTheo"] for p in pt if p.get("source") == "ratio"),
        "consoParIng_pf": [{"ing": c["nom"], "qte": c["qteTotal"], "val": c["valeurTotal"]} for c in ci],
        "consoParIng_pf_total": sum(c["valeurTotal"] for c in ci),
        "lignes": [{"nom": a["nom"], "ini": a["iniPieces"], "entrees": a["entreesPieces"], "pertes": a["pertesPieces"],
                    "fin": a["finPieces"], "ventes": a["ventesPieces"], "ecart": a["ecartPieces"],
                    "puPiece": a["puPiece"], "ecartVal": a["ecartVal"], "puSrc": a.get("puPieceSource")} for a in ae],
        "somme_ecartVal": sum(a["ecartVal"] for a in ae),
        "nb_lignes_pf": len(ae),
        "stock_pf": [{"nom": v["nom"], "cle": k, "cartons": v["nbCartons"], "inner": v["inner"], "unites": v["unites"],
                      "qteCdt": v["qteCdt"], "qtePieces": v["qtePieces"], "puCarton": v["puCarton"],
                      "valeur": v["valeur"], "prixSource": v["prixSource"]} for k, v in inv_pf.items()],
        "consoReelle": calc["consoReelle"], "consoTheoTotal": calc["consoTheoTotal"], "ecartMatiere": calc["ecartMatiere"],
        "totalValIni": calc["totalValIni"], "totalValFin": calc.get("totalValFin"),
    }
    print("\n==== ", label)
    print("  PMIX Pepsi/frites : lignes", tot[label]["nb_pmix_lignes"], "qty", tot[label]["qty"],
          "cout", round(tot[label]["cout"], 2), "| hors 660010 qty", tot[label]["qty_hors_660010"],
          "cout", round(tot[label]["cout_hors_660010"], 2),
          "| complement", round(tot[label]["cout_complement_pf"], 2), "| ratio", round(tot[label]["cout_ratio_pf"], 2))
    print("  consoParIng Pepsi/frites :", [(c["ing"], round(c["qte"], 3), round(c["val"], 2)) for c in tot[label]["consoParIng_pf"]],
          "=> total", round(tot[label]["consoParIng_pf_total"], 2))
    print("  lignes articlesEcart :", tot[label]["nb_lignes_pf"], "| somme ecartVal", round(tot[label]["somme_ecartVal"], 2),
          "| ecartMatiere total", round(tot[label]["ecartMatiere"], 2),
          f"({tot[label]['somme_ecartVal']/tot[label]['ecartMatiere']*100:.2f} %)")
    for a in tot[label]["lignes"]:
        print(f"    {a['nom']:32s} ini {a['ini']:>10.2f} ent {a['entrees']:>10.2f} pert {a['pertes']:>6.1f} fin {a['fin']:>9.2f} "
              f"VENTES_THEO {a['ventes']:>6.1f} ecart {a['ecart']:>11.2f} x {a['puPiece']:>10.2f} = {a['ecartVal']:>14.2f} [{a['puSrc']}]")
    for s in tot[label]["stock_pf"]:
        print(f"    STOCK {s['nom']:30s} cartons {s['cartons']:>8.3f} inner {s['inner']:>8.3f} unites {s['unites']:>6} "
              f"cdt {s['qteCdt']:>6} pieces {s['qtePieces']:>9.2f} puCarton {s['puCarton']:>12.2f} valeur {s['valeur']:>12.2f} [{s['prixSource']}]")
json.dump({"E_zeros": len(zeros_e), "nb_ref": len(ref), "pf_E": pf_e, "rapports": tot},
          open("tmp_p04_chiffres.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
