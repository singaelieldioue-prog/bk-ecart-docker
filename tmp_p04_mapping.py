# Lecture seule — P0-4 : chaînon manquant PMIX → ligne d'inventaire (consoParIng → articlesEcart).
import json, re, sqlite3, sys, unicodedata
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

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

con = sqlite3.connect("file:backend/data.db?mode=ro", uri=True)
con.row_factory = sqlite3.Row
def _load(v):
    try:
        return json.loads(v)
    except Exception:
        return None
kv = {k: _load(v) for (k, v) in con.execute("select k, v from kv")}
ratios = kv["bk_sia_ratios_parsed_v1"]
base_article = kv["bk_sia_base_article_map_v1"]
local = kv["bk_sia_local_articles_v1"]

PAT = re.compile(r"FRIES|PEPSI|FRITE|COLA|SODA|LARGE|MEDIUM|SMALL", re.I)

# 1) Tous les ingrédients Pepsi/frites issus des fiches Ratio, tels que consoParIng les reçoit.
lignes = []
for rid, label in [("60198f93-f763-4bb9-b84c-05e63d01d639", "BK1 23/10"),
                   ("76b8d757-ebe4-4d46-a9e1-0aa3a79de44c", "BK COCODY 22/10")]:
    d = json.loads(con.execute("select data from reports where id=?", (rid,)).fetchone()[0])
    calc = d["calc"]
    stock_keys = {norm(a["nom"]) for a in d["stockData"]["invIni"].values()} | {norm(a["nom"]) for a in d["stockData"]["invFin"].values()}
    ratio_to_stock = {}
    for sk, e in base_article.items():
        cr = (e or {}).get("corresponRatio")
        if cr:
            ratio_to_stock.setdefault(norm(cr), sk)
    rows = []
    for c in calc["consoParIng"]:
        if not PAT.search(str(c.get("nom") or "")):
            continue
        k = norm(c["nom"])
        direct = k in stock_keys
        via = None if direct else ratio_to_stock.get(k)
        rows.append({"rapport": label, "ingredient": c["nom"], "cle_norm": k,
                     "qteTotal": c["qteTotal"], "valeurTotal": c["valeurTotal"], "pmp": c.get("pmp"),
                     "match_direct": direct, "via_corresponRatio": via,
                     "nom_stock_cible": next((a["nom"] for a in d["stockData"]["invIni"].values() if norm(a["nom"]) == (k if direct else via)), None) if (direct or via) else None})
    lignes += rows

# 2) Lignes d'inventaire Pepsi/frites : leurs ventes théoriques reçues et la source du prix.
pf = [a for a in json.loads(con.execute("select data from reports where id='76b8d757-ebe4-4d46-a9e1-0aa3a79de44c'").fetchone()[0])["calc"]["articlesEcart"]
      if re.search(r"FRIES|PEPSI|FRITE", str(a.get("nom") or ""), re.I)]

# 3) CE QUE DIT LA BASE ARTICLE pour les articles stock Pepsi/frites : corresponRatio / codeBollore.
base_pf = []
for sk, e in base_article.items():
    if re.search(r"PEPSI|FRITE", sk + " " + str((e or {}).get("designation") or ""), re.I):
        base_pf.append({"ref": sk, "designation": e.get("designation"), "corresponRatio": e.get("corresponRatio"),
                        "codeBollore": e.get("codeBollore"), "cdt": e.get("cdt"), "categorie": e.get("categorie")})
correspon = sorted({norm(e.get("corresponRatio")) for e in base_article.values() if e.get("corresponRatio")})
pf_correspon = [c for c in correspon if re.search(r"PEPSI|FRIES|FRITE", c, re.I)]

# 4) Noms Ratio (waLandedCost / pmpByIng) Pepsi/frites, et existent-ils comme nom d'article stock ?
wa_pf = sorted(k for k in ratios["waLandedCost"] if re.search(r"PEPSI|FRIES|FRITE", k, re.I))
ing_pf = sorted(k for k in ratios["pmpByIng"] if re.search(r"PEPSI|FRIES|FRITE", k, re.I))
names_wa = {norm(v.get("designation")) for v in ratios["waLandedCost"].values()}
out = {"consoParIng_vers_lignes": lignes,
       "articlesEcart_pepsi_frites_COCODY": pf,
       "BASE_article_entrees_pepsi_frites": base_pf,
       "nb_corresponRatio_distincts": len(correspon),
       "corresponRatio_pepsi_frites": pf_correspon,
       "waLandedCost_pepsi_frites": [{"cle": k, **{f: ratios["waLandedCost"][k].get(f) for f in ("designation", "corresp", "statut", "qteCdt", "pmpCarton", "puPiece")}} for k in wa_pf],
       "pmpByIng_pepsi_frites": {k: ratios["pmpByIng"][k] for k in ing_pf},
       "wa_designation_vide_ou_pct": sum(1 for v in ratios["waLandedCost"].values() if not (v.get("designation") or "").strip()),
       }
json.dump(out, open("tmp_p04_mapping.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(json.dumps(out, ensure_ascii=False, indent=1)[:9000])
