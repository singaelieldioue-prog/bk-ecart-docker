# Lecture seule — P0-4 : transferts (chemin par CODE) + lookup invIni/invFin par norm().
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

NOMS = ["BOUTEILLE PEPSI ZERO 30CL", "BOUTEILLE PEPSI 30CL", "BOUTEILLE PEPSI 1,5L",
        "CAN PEPSI 250 ml", "CANETTE PEPSI ZERO 25 CL", "FRITES", "SACHET FRITES GRAND",
        "SACHET FRITES MOYEN", "SACHET FRITES PETIT", "SACHET FRITES PETIT 4000",
        "SACHET FRITES - SIKO", "BOUTEILLE PEPSI ZERO 1,5L", "DIP FRITE SAUCE - 25GR",
        "DOSETTE FRITE SAUCE PORTION - 10GR", "DOSETTE FRITE SAUCE AMERIGO - 10GR"]
out = []
con = sqlite3.connect("file:backend/data.db?mode=ro", uri=True)
for rid, label in [("60198f93-f763-4bb9-b84c-05e63d01d639", "BK1 — 23/10/2026"),
                   ("76b8d757-ebe4-4d46-a9e1-0aa3a79de44c", "BK COCODY — 22/10/2026")]:
    d = json.loads(con.execute("select data from reports where id=?", (rid,)).fetchone()[0])
    sd = d["stockData"]
    print("###", label)
    for nom in NOMS:
        k = norm(nom)
        ini, fin = sd["invIni"].get(k), sd["invFin"].get(k)
        tr = [s for s in sd["sorties"] if norm(s.get("designation") or "") == k]
        pe = [p for p in sd["pertes"] if norm(p.get("nom") or "") == k]
        fmt = lambda a: ("absente" if a is None else
                         f"cart {a.get('nbCartons')} inner {a.get('inner')} un {a.get('unites')} cdt {a.get('qteCdt')} "
                         f"puCart {a.get('puCarton')} pieces {a.get('qtePieces')} val {a.get('valeur')} [{a.get('prixSource')}]")
        print(f"  {nom:34s} INI {fmt(ini)}")
        print(f"  {'':34s} FIN {fmt(fin)}")
        for t in tr:
            print(f"  {'':34s} TRANSFERT {json.dumps({kk: t.get(kk) for kk in ('designation','code','qte','qtePieces','puPiece','puCarton','valeur','source','categorie')}, ensure_ascii=False)}")
        for p in pe:
            print(f"  {'':34s} PERTE {json.dumps({kk: p.get(kk) for kk in ('nom','qte','qtePieces','puPiece','valeur','source')}, ensure_ascii=False)}")
        out.append({"rapport": label, "nom": nom, "ini": ini, "fin": fin, "transferts": tr, "pertes": pe})
json.dump(out, open("tmp_p04_transferts.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
