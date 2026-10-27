# Lecture seule — P0-4 : écart restreint aux 11 lignes Pepsi/frites + Correspondance.
import json, re, sqlite3, sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

WHITELIST = ["BOUTEILLE PEPSI ZERO 30CL", "BOUTEILLE PEPSI 30CL", "BOUTEILLE PEPSI 1,5L",
             "CAN PEPSI 250 ml", "CANETTE PEPSI ZERO 25 CL", "FRITES",
             "SACHET FRITES GRAND", "SACHET FRITES MOYEN", "SACHET FRITES PETIT",
             "SACHET FRITES PETIT 4000", "SACHET FRITES - SIKO"]
HORS = ["DIP FRITE SAUCE - 25GR", "DOSETTE FRITE SAUCE PORTION - 10GR",
        "DOSETTE FRITE SAUCE AMERIGO - 10GR", "BOUTEILLE PEPSI ZERO 1,5L"]
ING_PF = ["FRIES (kg)", "SMALL FRIES BAG", "MEDIUM FRIES BAG", "LARGE FRIES BAG",
          "CAN SOFT MEDIUM", "PEPSI SMALL", "PEPSI MEDIUM", "PEPSI LARGE",
          "PEPSI ZERO LIGHT SMALL", "PEPSI DIET ZERO LIGHT MEDIUM", "FRITE SAUCE SACHET"]

con = sqlite3.connect("file:backend/data.db?mode=ro", uri=True)
kv = {}
for k, v in con.execute("select k, v from kv"):
    try:
        kv[k] = json.loads(v)
    except Exception:
        kv[k] = None
corr = kv["bk_sia_correspondance_map_v1"]

out = {"correspondance_pepsi_frites": [], "rapports": []}
for key, src in (("map", "map"), ("byCode", "byCode")):
    for k, e in (corr.get(key) or {}).items():
        blob = json.dumps(e, ensure_ascii=False) if isinstance(e, dict) else str(e)
        if re.search(r"PEPSI|FRIES|FRITE", k + " " + blob, re.I):
            out["correspondance_pepsi_frites"].append({"index": key, "cle": k, **({} if not isinstance(e, dict) else e)})

for rid, label in [("60198f93-f763-4bb9-b84c-05e63d01d639", "BK1 — 23/10/2026"),
                   ("76b8d757-ebe4-4d46-a9e1-0aa3a79de44c", "BK COCODY — 22/10/2026")]:
    d = json.loads(con.execute("select data from reports where id=?", (rid,)).fetchone()[0])
    calc, sd = d["calc"], d["stockData"]
    ae = {a["nom"]: a for a in calc["articlesEcart"]}
    rows = []
    for nom in WHITELIST + HORS:
        a = ae.get(nom)
        s = sd["invIni"].get(nom) or {}
        f = sd["invFin"].get(nom) or {}
        rows.append({"nom": nom, "dans_articlesEcart": bool(a),
                     "ini_pieces": (a or {}).get("iniPieces"), "entrees": (a or {}).get("entreesPieces"),
                     "pertes": (a or {}).get("pertesPieces"), "fin_pieces": (a or {}).get("finPieces"),
                     "ventes_theo": (a or {}).get("ventesPieces"), "ecart_pieces": (a or {}).get("ecartPieces"),
                     "pu_piece": (a or {}).get("puPiece"), "pu_src": (a or {}).get("puPieceSource"),
                     "ecart_val": (a or {}).get("ecartVal"),
                     "invIni": {"cartons": s.get("nbCartons"), "inner": s.get("inner"), "unites": s.get("unites"),
                                "qteCdt": s.get("qteCdt"), "puCarton": s.get("puCarton"), "valeur": s.get("valeur"),
                                "prixSource": s.get("prixSource")},
                     "invFin": {"cartons": f.get("nbCartons"), "inner": f.get("inner"), "unites": f.get("unites"),
                                "qteCdt": f.get("qteCdt"), "puCarton": f.get("puCarton"), "valeur": f.get("valeur"),
                                "prixSource": f.get("prixSource")}})
    ci = [c for c in calc["consoParIng"] if c["nom"] in ING_PF]
    pt = [p for p in calc["pmixTheo"] if re.search(r"PEPSI|FRITES", str(p.get("nom") or ""), re.I)]
    out["rapports"].append({
        "label": label, "lignes": rows,
        "somme_ecart_val_lignes": sum((r["ecart_val"] or 0) for r in rows if r["dans_articlesEcart"]),
        "consoParIng_pf": [{"ing": c["nom"], "qte": c["qteTotal"], "val": c["valeurTotal"], "pmp": c.get("pmp")} for c in ci],
        "total_consoParIng_pf": sum(c["valeurTotal"] for c in ci),
        "pmix_pf": [{"plu": p["plu"], "nom": p["nom"], "qty": p["qty"], "coutUnit": p.get("coutUnit"),
                     "coutTheo": p.get("coutTheo"), "source": p.get("source")} for p in pt],
        "total_pmix_pf": sum(p["coutTheo"] for p in pt),
        "qty_pmix_pf": sum(p["qty"] for p in pt),
        "ecartMatiere": calc["ecartMatiere"], "consoReelle": calc["consoReelle"], "consoTheoTotal": calc["consoTheoTotal"],
    })

json.dump(out, open("tmp_p04_final.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("Correspondance Pepsi/frites :", len(out["correspondance_pepsi_frites"]))
for c in out["correspondance_pepsi_frites"]:
    print("  ", json.dumps(c, ensure_ascii=False))
for r in out["rapports"]:
    print("\n###", r["label"], "| somme écart des lignes Pepsi/frites :", round(r["somme_ecart_val_lignes"], 2),
          "| écart matière rapport :", round(r["ecartMatiere"], 2))
    for x in r["lignes"]:
        print(f"  {x['nom']:34s} {'OK ' if x['dans_articlesEcart'] else 'ABSENT'} ini {x['ini_pieces']} ent {x['entrees']} "
              f"fin {x['fin_pieces']} VENTES {x['ventes_theo']} ecartP {x['ecart_pieces']} puPiece {x['pu_piece']} "
              f"[{x['pu_src']}] ecartVal {None if x['ecart_val'] is None else round(x['ecart_val'],2)} | "
              f"Ini cart {x['invIni']['cartons']} inner {x['invIni']['inner']} un {x['invIni']['unites']} cdt {x['invIni']['qteCdt']} "
              f"puCart {x['invIni']['puCarton']} val {None if x['invIni']['valeur'] is None else round(x['invIni']['valeur'],2)} [{x['invIni']['prixSource']}] | "
              f"Fin cart {x['invFin']['cartons']} inner {x['invFin']['inner']} un {x['invFin']['unites']} val {None if x['invFin']['valeur'] is None else round(x['invFin']['valeur'],2)}")
    print("  PMIX Pepsi/frites :", r["qty_pmix_pf"], "pcs /", round(r["total_pmix_pf"], 2), "F |",
          [(p["plu"], p["nom"], p["qty"], round(p["coutUnit"], 2), p["source"]) for p in r["pmix_pf"]])
    print("  consoParIng rattachable :", [(c["ing"], round(c["qte"], 3), round(c["val"], 2)) for c in r["consoParIng_pf"]],
          "total", round(r["total_consoParIng_pf"], 2))
