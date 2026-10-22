import React, { useState } from 'react';
import { fmt, pct, fmtDate, statEcart } from '../utils/formatters.js';
import { ROLES } from '../constants.js';
import { exportExcel } from '../utils/excelExporter.js';
import { WBdg, KCard, Bdg, TH, TD } from '../components/UI.jsx';
import { WFPanel } from '../components/WFPanel.jsx';
import { RapportMultiRestaurants } from './RapportMultiRestaurants.jsx';
import { ComparaisonTab } from './ComparaisonTab.jsx';
import { EcartProduitsTab } from './EcartProduitsTab.jsx';

export function RapportView({rapport,role,rapports,onAction,onBack}){
  const [tab,setTab]=useState("synthese");
  const [ficheSearch,setFicheSearch]=useState(""); const [fichePlu,setFichePlu]=useState(null);
  const {data}=rapport; const calc=data.calc||{};

  const TB=({id,label})=>(
    <button onClick={()=>setTab(id)} style={{padding:"7px 13px",border:"none",background:"none",cursor:"pointer",
      fontWeight:tab===id?700:400,color:tab===id?"#D4531D":"#6B7280",
      borderBottom:tab===id?"2px solid #D4531D":"2px solid transparent",fontSize:13,marginBottom:-2,whiteSpace:"nowrap"}}>{label}</button>
  );

  const arts=calc.articlesEcart||[];
  const cats=[...new Set(arts.map(a=>a.categorie).filter(Boolean))];

  // Fiche technique sélectionnée
  const ficheAff=fichePlu!=null?(data.ratiosMeta?.allProducts||[]).find(p=>p.plu===fichePlu):null;

  const seM=statEcart(calc.ecartMatiereP);

  return(
    <div>
      {/* Header */}
      <div style={{background:"#fff",border:"1px solid #E5E7EB",borderRadius:12,padding:"13px 17px",marginBottom:10}}>
        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
          <div>
            <button onClick={onBack} style={{background:"none",border:"none",cursor:"pointer",color:"#6B7280",fontSize:12,marginBottom:2,padding:0}}>← Retour</button>
            <div style={{fontWeight:700,fontSize:15}}>{rapport.titre}</div>
            <div style={{fontSize:11,color:"#9CA3AF",marginTop:1}}>{fmtDate(rapport.createdAt)} · {ROLES[rapport.createdBy]?.short} · {data.site}</div>
          </div>
          <div style={{display:"flex",gap:7,alignItems:"center",flexWrap:"wrap"}}>
            <WBdg status={rapport.status}/>
            <button onClick={()=>{exportExcel(rapport).catch(e=>alert("Export impossible : "+e.message));}} style={{padding:"7px 12px",border:"none",borderRadius:7,background:"#059669",color:"#fff",cursor:"pointer",fontSize:11,fontWeight:600}}>📥 Excel</button>
          </div>
        </div>
      </div>
      <WFPanel rapport={rapport} role={role} onAction={onAction}/>
      {/* Tabs */}
      <div style={{borderBottom:"2px solid #F3F4F6",marginBottom:14,display:"flex",gap:2,overflowX:"auto"}}>
        <TB id="synthese" label={data.isMulti?"🏬 Réseau":"📊 Synthèse"}/>
        {!data.isMulti&&<TB id="ecart_mat" label="🎯 Écart matières"/>}
        {!data.isMulti&&<TB id="articles" label="📦 Écart produits"/>}
        {!data.isMulti&&<TB id="fiches" label="📋 Fiches techniques"/>}
        {((calc.pluNonMatchés?.length||0)+(calc.articlesEcart?.filter(a=>!a.puPiece||a.puPiece===0).length||0))>0&&(
          <TB id="anomalies" label={`⚠️ Anomalies (${(calc.pluNonMatchés?.length||0)+(calc.articlesEcart?.filter(a=>!a.puPiece||a.puPiece===0).length||0)+(data.stockData?.transfertsExclus||0)})`}/>
        )}
        {!data.isMulti&&(data.stockData?.douane||[]).length>0&&<TB id="douane" label="🛃 Douane"/>}
        {!data.isMulti&&Object.keys(data.stockData?.offerts||{}).length>0&&<TB id="offerts" label="🎁 Offerts"/>}
        <TB id="comparaison" label="📈 Comparaison N vs N-1"/>
      </div>

      {/* ── SYNTHESE ── */}
      {tab==="synthese"&&(data.isMulti
        ? <RapportMultiRestaurants calc={calc}/>
        : <div>
          {/* Flux de stock RG-03 v3.0 */}
          <div style={{fontSize:11,fontWeight:700,color:"#9CA3AF",textTransform:"uppercase",marginBottom:8}}>
            Flux de stock — RG-03 v3.0
          </div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:8}}>
            <KCard label="Stock initial" value={fmt(calc.totalValIni)+" FCFA"}/>
            <KCard label="− Stock final" value={fmt(calc.totalValFin)+" FCFA"}/>
            <KCard label="= Variation de stock" value={fmt(calc.variationStock)+" FCFA"}/>
            <KCard label="+ Transferts AGL → BK" value={fmt(calc.totalEntrees)+" FCFA"}/>
          </div>
          <div style={{background:"#FFF7F5",border:"2px solid #D4531D",borderRadius:10,padding:"10px 16px",marginBottom:14,display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
            <div style={{fontSize:11,color:"#D4531D",fontWeight:700,textTransform:"uppercase"}}>Consommation réelle</div>
            <div style={{fontSize:22,fontWeight:800,color:"#D4531D"}}>{fmt(calc.consoReelle)} FCFA</div>
            <div style={{fontSize:11,color:"#9CA3AF",fontStyle:"italic"}}>= Variation de stock + Transferts · Les pertes sont hors flux stock</div>
          </div>

          {/* Pertes bloc séparé */}
          <div style={{fontSize:11,fontWeight:700,color:"#9CA3AF",textTransform:"uppercase",marginBottom:8}}>
            Pertes et prélèvements (bloc séparé — hors flux stock)
          </div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:14}}>
            <KCard label="Pertes contrôlées (à la pièce)" value={fmt(calc.totalPertes)+" FCFA"} s={calc.totalPertes>0?"warning":null}/>
            <KCard label="🛃 Prélèvements douane" value={fmt(calc.douaneTotal)+" FCFA"} s={calc.douaneTotal>0?"warning":null}/>
            <KCard label="🎁 Offerts / Repas" value={fmt(calc.totalOfferts)+" FCFA"}/>
          </div>

          {/* Résumé articles */}
          <div style={{fontSize:11,fontWeight:700,color:"#9CA3AF",textTransform:"uppercase",marginBottom:8}}>Résumé écarts articles</div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:14}}>
            <KCard label="Total articles" value={arts.length}/>
            <KCard label="Écart +" value={arts.filter(a=>a.ecartPieces>0).length} s={arts.filter(a=>a.ecartPieces>0).length>0?"warning":null}/>
            <KCard label="Écart −" value={arts.filter(a=>a.ecartPieces<0).length} s={arts.filter(a=>a.ecartPieces<0).length>0?"danger":null}/>
            <KCard label="Équilibre" value={arts.filter(a=>a.ecartPieces===0).length} s="excellent"/>
          </div>

          {/* Top 10 */}
          {arts.filter(a=>a.ecartPieces!==0).length>0&&(
            <div>
              <div style={{fontSize:11,fontWeight:700,color:"#9CA3AF",textTransform:"uppercase",marginBottom:6}}>Top 10 — écarts les plus significatifs</div>
              <div style={{background:"#fff",border:"1px solid #E5E7EB",borderRadius:10,overflow:"hidden"}}>
                <table style={{width:"100%",borderCollapse:"collapse"}}>
                  <thead><tr>
                    {["Cat.","Article","Ini","Transferts","Ventes théo","Pertes","Stock Théo","Réel","Écart (pcs)","Écart FCFA"].map(h=>(
                      <th key={h} style={{...TH,textAlign:["Ini","Transferts","Ventes théo","Pertes","Stock Théo","Réel","Écart (pcs)","Écart FCFA"].includes(h)?"right":"left"}}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {arts.filter(a=>a.ecartPieces!==0)
                      .sort((a,b)=>Math.abs(b.ecartVal)-Math.abs(a.ecartVal))
                      .slice(0,10).map((a,i)=>(
                        <tr key={i}>
                          <td style={{...TD,fontSize:10,color:"#9CA3AF"}}>{a.categorie?.split(" - ")[1]||a.categorie}</td>
                          <td style={{...TD,fontWeight:600}}>{a.nom}</td>
                          <td style={{...TD,textAlign:"right",fontSize:11}}>{fmt(a.iniPieces,1)}</td>
                          <td style={{...TD,textAlign:"right",fontSize:11}}>{fmt(a.entreesPieces,1)}</td>
                          <td style={{...TD,textAlign:"right",fontSize:11,color:"#7C3AED"}}>{fmt(a.ventesPieces,2)}</td>
                          <td style={{...TD,textAlign:"right",fontSize:11,color:"#DC2626"}}>{fmt(a.pertesPieces,1)}</td>
                          <td style={{...TD,textAlign:"right",fontWeight:600}}>{fmt(a.stockTheo,2)}</td>
                          <td style={{...TD,textAlign:"right",fontSize:11}}>{fmt(a.finPieces,1)}</td>
                          <td style={{...TD,textAlign:"right",fontWeight:700,color:a.ecartPieces<0?"#DC2626":a.ecartPieces>0?"#D97706":"#059669"}}>{fmt(a.ecartPieces,2)}</td>
                          <td style={{...TD,textAlign:"right",fontWeight:700,color:a.ecartVal<0?"#DC2626":a.ecartVal>0?"#D97706":"#059669"}}>{fmt(a.ecartVal,0)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── ÉCART MATIÈRES ── */}
      {tab==="ecart_mat"&&(
        <div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:14}}>
            <KCard label="CA réalisé (PMIX)" value={fmt(calc.ca)+" FCFA"}/>
            <KCard label="Couverts vendus" value={fmt(calc.couverts)} sub={`${data.ficheMatchees||0} PLU matchés${(calc.complementMatchees||0)>0?` + ${calc.complementMatchees} coût complémentaire`:""} / ${(calc.pmixTheo||[]).length} total`}/>
            <KCard label="Conso. théorique" value={fmt(calc.consoTheoTotal)+" FCFA"} sub="PMIX × Fiches techniques"/>
            <KCard label="Conso. réelle" value={fmt(calc.consoReelle)+" FCFA"} sub="Variation stock + Transferts (RG-03 v3.0)"/>
            <KCard label="Écart matières" value={fmt(calc.ecartMatiere)+" FCFA"} sub={pct(calc.ecartMatiereP)} s={seM}/>
          </div>
          {"destructionControlee" in calc&&(
            <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:14}}>
              <KCard label="Coût matière vendue" value={fmt(calc.coutMatiereVendue)+" FCFA"} sub="Conso. théorique − staff meal − produits offerts"/>
              <KCard label="Repas du personnel" value={fmt(calc.staffMealTotal)+" FCFA"} sub="Feuille Offerts (staff meal)"/>
              <KCard label="Produits offerts" value={fmt(calc.offertsProduitsTotal)+" FCFA"} sub="Feuille Offerts (offerts)"/>
              <KCard label="Destruction contrôlée" value={fmt(calc.destructionControlee)+" FCFA"} sub="Total feuille Pertes"/>
              <KCard label="Pertes non contrôlées" value={fmt(calc.pertesNonControlees)+" FCFA"} sub="Conso. réelle − Conso. théorique − Destruction contrôlée"/>
            </div>
          )}
          {"destructionControlee" in calc&&(
            <div style={{background:"#F9FAFB",border:"1px solid #E5E7EB",borderRadius:9,padding:"10px 16px",marginBottom:14,fontSize:12,color:"#374151"}}>
              <strong>Écart matières BK</strong> = Destruction contrôlée + Pertes non contrôlées =
              {" "}{fmt((calc.destructionControlee||0)+(calc.pertesNonControlees||0))+" FCFA"} · Coût matière réel − Coût matière théorique.
              Hypothèses : destruction contrôlée = feuille Pertes ; repas du personnel et offerts déduits du coût matière théorique.
            </div>
          )}
          <div style={{background:seM==="excellent"?"#ECFDF5":seM==="warning"?"#FFFBEB":"#FEF2F2",border:`1px solid ${seM==="excellent"?"#A7F3D0":seM==="warning"?"#FDE68A":"#FECACA"}`,borderRadius:9,padding:"12px 16px",marginBottom:14}}>
            <div style={{fontWeight:700,fontSize:14,color:seM==="excellent"?"#059669":seM==="warning"?"#D97706":"#DC2626",marginBottom:4}}>
              {seM==="excellent"?"✅ Excellent — Écart < 1,25 %":seM==="warning"?"⚠️ À améliorer — Écart entre 1,25 % et 2 %":(calc.ecartMatiereP<0?"🔴 Anomalie — Écart négatif (réel < théorique : flux non tracés)":"🔴 Objectif non atteint — Écart > 2 %")}
            </div>
            <div style={{fontSize:12,color:"#374151"}}>
              Seuils BK : <strong>Excellent &lt; 1,25 %</strong> · À améliorer 1,25–2 % · Non atteint &gt; 2 % ou &lt; 0 %
            </div>
          </div>
          {calc.pluNonMatchés?.length>0&&(
            <div style={{background:"#FFFBEB",border:"1px solid #FDE68A",borderRadius:8,padding:"9px 13px",marginBottom:14,fontSize:11,color:"#92400E"}}>
              ⚠️ <strong>{calc.pluNonMatchés.length} PLU sans fiche technique</strong> — leur consommation théorique n'est pas calculée. Voir feuille Anomalies dans l'export Excel.
            </div>
          )}
          {calc.consoParIng?.length>0&&(
            <div>
              <div style={{fontSize:11,fontWeight:700,color:"#9CA3AF",textTransform:"uppercase",marginBottom:6}}>Consommation théorique par ingrédient</div>
              <div style={{background:"#fff",border:"1px solid #E5E7EB",borderRadius:10,overflow:"hidden",maxHeight:360,overflowY:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse"}}>
                  <thead><tr>
                    <th style={TH}>Ingrédient</th>
                    <th style={{...TH,textAlign:"right"}}>PMP (FCFA/u)</th>
                    <th style={{...TH,textAlign:"right"}}>Qté consommée</th>
                    <th style={{...TH,textAlign:"right"}}>Valeur FCFA</th>
                    <th style={{...TH,textAlign:"right"}}>% total</th>
                  </tr></thead>
                  <tbody>
                    {calc.consoParIng.map((v,i)=>(
                      <tr key={i}>
                        <td style={{...TD,fontWeight:500}}>{v.nom}</td>
                        <td style={{...TD,textAlign:"right",fontSize:11}}>{fmt(v.pmp,2)}</td>
                        <td style={{...TD,textAlign:"right"}}>{fmt(v.qteTotal,3)}</td>
                        <td style={{...TD,textAlign:"right",fontWeight:600}}>{fmt(v.valeurTotal,0)}</td>
                        <td style={{...TD,textAlign:"right",fontSize:11,color:"#9CA3AF"}}>
                          {calc.consoTheoTotal?((v.valeurTotal/calc.consoTheoTotal)*100).toFixed(1)+" %":"—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── ÉCART PRODUITS (R-03 v3.0 : tous articles, sans badge, FCFA optionnel) ── */}
      {tab==="articles"&&(
        <EcartProduitsTab arts={arts} cats={cats}/>
      )}

      {/* ── COMPARAISON N vs N-1 ── */}
      {tab==="comparaison"&&(
        <ComparaisonTab rapport={rapport} rapports={rapports}/>
      )}

      {/* ── FICHES TECHNIQUES ── */}
      {tab==="fiches"&&(
        <div>
          <div style={{display:"flex",gap:10,marginBottom:12,alignItems:"center",flexWrap:"wrap"}}>
            <input value={ficheSearch} onChange={e=>setFicheSearch(e.target.value)} placeholder="🔍 Rechercher un produit..."
              style={{flex:"1 1 200px",padding:"6px 10px",border:"1px solid #D1D5DB",borderRadius:7,fontSize:12,outline:"none"}}/>
            {fichePlu&&<button onClick={()=>setFichePlu(null)} style={{padding:"6px 12px",border:"1px solid #D1D5DB",borderRadius:7,fontSize:12,background:"#fff",cursor:"pointer"}}>← Tous les produits</button>}
          </div>

          {ficheAff ? (
            /* ── Détail fiche technique d'un produit ── */
            <div>
              <div style={{background:"#D4531D",color:"#fff",borderRadius:10,padding:"14px 18px",marginBottom:14}}>
                <div style={{fontWeight:800,fontSize:16}}>{ficheAff.nom}</div>
                <div style={{fontSize:12,opacity:.85,marginTop:2}}>{ficheAff.categorie} · PLU {ficheAff.plu}</div>
              </div>
              <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:14}}>
                <KCard label="Coût théorique unitaire" value={fmt(ficheAff.coutTheo,2)+" FCFA"}/>
                <KCard label="Nb ingrédients" value={ficheAff.coutParIng.length}/>
                {(()=>{const pmixItem=(calc.pmixTheo||[]).find(p=>p.plu===ficheAff.plu);return pmixItem?(
                  <><KCard label="Qté vendue (période)" value={fmt(pmixItem.qty)}/><KCard label="CA période" value={fmt(pmixItem.amount,0)+" FCFA"}/><KCard label="Conso théo totale" value={fmt(ficheAff.coutTheo*pmixItem.qty,0)+" FCFA"}/></>
                ):null;})()}
              </div>
              <div style={{background:"#fff",border:"1px solid #E5E7EB",borderRadius:10,overflow:"hidden"}}>
                <table style={{width:"100%",borderCollapse:"collapse"}}>
                  <thead><tr>
                    <th style={TH}>Ingrédient</th>
                    <th style={{...TH,textAlign:"right"}}>Qté / portion</th>
                    <th style={{...TH,textAlign:"right"}}>Unité</th>
                    <th style={{...TH,textAlign:"right"}}>PMP (FCFA/u)</th>
                    <th style={{...TH,textAlign:"right"}}>Valeur FCFA</th>
                    <th style={{...TH,textAlign:"right"}}>% recette</th>
                  </tr></thead>
                  <tbody>
                    {ficheAff.coutParIng.sort((a,b)=>b.valeur-a.valeur).map((c,i)=>(
                      <tr key={i}>
                        <td style={{...TD,fontWeight:500}}>{c.ing}</td>
                        <td style={{...TD,textAlign:"right",fontWeight:600}}>{c.qty}</td>
                        <td style={{...TD,textAlign:"right",fontSize:11,color:"#9CA3AF"}}>{c.ing.includes("(kg)")?"kg":c.ing.includes("(pc)")?"pc":"u"}</td>
                        <td style={{...TD,textAlign:"right"}}>{fmt(c.pmp,2)}</td>
                        <td style={{...TD,textAlign:"right",fontWeight:700,color:"#D4531D"}}>{fmt(c.valeur,2)}</td>
                        <td style={{...TD,textAlign:"right",fontSize:11,color:"#9CA3AF"}}>{ficheAff.coutTheo?((c.valeur/ficheAff.coutTheo)*100).toFixed(1)+" %":"—"}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot><tr style={{background:"#FFF7F5"}}>
                    <td colSpan={3} style={{...TD,fontWeight:700}}>TOTAL COÛT UNITAIRE</td>
                    <td style={TD}></td>
                    <td style={{...TD,textAlign:"right",fontWeight:800,color:"#D4531D",fontSize:14}}>{fmt(ficheAff.coutTheo,2)} FCFA</td>
                    <td style={{...TD,textAlign:"right",fontSize:11}}>100 %</td>
                  </tr></tfoot>
                </table>
              </div>
            </div>
          ) : (
            /* ── Liste des produits ── */
            <div>
              <div style={{fontSize:11,color:"#6B7280",marginBottom:8}}>
                {(data.ratiosMeta?.allProducts||[]).length} fiches techniques · Cliquer sur un produit pour voir le détail
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))",gap:8}}>
                {(data.ratiosMeta?.allProducts||[])
                  .filter(p=>!ficheSearch||p.nom.toUpperCase().includes(ficheSearch.toUpperCase()))
                  .map((p,i)=>{
                    const pmixItem=(calc.pmixTheo||[]).find(x=>x.plu===p.plu);
                    return(
                      <div key={i} onClick={()=>setFichePlu(p.plu)}
                        style={{background:"#fff",border:"1px solid #E5E7EB",borderRadius:9,padding:"11px 13px",cursor:"pointer",transition:"box-shadow .15s"}}
                        onMouseEnter={e=>e.currentTarget.style.boxShadow="0 2px 12px rgba(0,0,0,.1)"}
                        onMouseLeave={e=>e.currentTarget.style.boxShadow="none"}>
                        <div style={{fontWeight:600,fontSize:13,color:"#111",marginBottom:3}}>{p.nom}</div>
                        <div style={{fontSize:11,color:"#9CA3AF",marginBottom:6}}>{p.categorie} · PLU {p.plu}</div>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                          <span style={{fontSize:12,fontWeight:700,color:"#D4531D"}}>{fmt(p.coutTheo,2)} FCFA/u</span>
                          {pmixItem&&<Bdg s="excellent" sm>Vendu : {fmt(pmixItem.qty)}</Bdg>}
                          {!pmixItem&&<Bdg s="warning" sm>Non dans PMIX</Bdg>}
                        </div>
                        <div style={{marginTop:6,fontSize:10,color:"#9CA3AF"}}>{p.coutParIng.length} ingrédients</div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── ANOMALIES ── */}
      {tab==="anomalies"&&(
        <div>
          {/* Transferts vers un autre BK, exclus des entrées */}
          {(data.stockData?.transfertsExclus||0)>0&&(
            <div style={{marginBottom:16}}>
              <div style={{fontSize:11,fontWeight:700,color:"#9CA3AF",textTransform:"uppercase",marginBottom:6}}>
                Transferts hors site — {data.stockData.transfertsExclus} ligne(s) ignorée(s)
              </div>
              <div style={{background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:8,padding:"8px 12px",fontSize:11,color:"#991B1B"}}>
                ⚠️ {data.stockData.transfertsExclus} ligne(s) de l'onglet Transferts indiquent un BK destinataire différent du site du classeur ({data.stockData.site||"—"}) : elles ne sont pas comptées en entrée de stock (seuls les transferts AGL → BK du site le sont).
              </div>
            </div>
          )}

          {/* PLU sans fiche technique */}
          {(calc.pluNonMatchés||[]).length>0&&(
            <div style={{marginBottom:16}}>
              <div style={{fontSize:11,fontWeight:700,color:"#9CA3AF",textTransform:"uppercase",marginBottom:6}}>
                PLU sans fiche technique — {calc.pluNonMatchés.length} PLU · consommation théorique non calculée
              </div>
              <div style={{background:"#FFFBEB",border:"1px solid #FDE68A",borderRadius:8,padding:"8px 12px",marginBottom:8,fontSize:11,color:"#92400E"}}>
                ⚠️ Ces PLU du PMIX n'ont pas de fiche technique dans le fichier Ratios. Leur consommation matière n'est pas prise en compte dans le calcul théorique. Pour corriger : demander à la Direction Financière d'ajouter ces fiches dans le fichier Ratios.
              </div>
              <div style={{background:"#fff",border:"1px solid #E5E7EB",borderRadius:10,overflow:"hidden"}}>
                <table style={{width:"100%",borderCollapse:"collapse"}}>
                  <thead><tr>
                    <th style={TH}>PLU</th>
                    <th style={TH}>Nom produit</th>
                    <th style={{...TH,textAlign:"right"}}>Qté vendue</th>
                    <th style={{...TH,textAlign:"right"}}>Coût théorique (F)</th>
                    <th style={TH}>Action à faire</th>
                  </tr></thead>
                  <tbody>
                    {calc.pluNonMatchés.sort((a,b)=>b.qty-a.qty).map((p,i)=>(
                      <tr key={i} style={{background:i%2===0?"#FFFFFF":"#FFFBEB"}}>
                        <td style={{...TD,fontWeight:700,color:"#D97706"}}>{p.plu}</td>
                        <td style={{...TD,fontWeight:500}}>{p.nom}</td>
                        <td style={{...TD,textAlign:"right"}}>{fmt(p.qty,0)}</td>
                        <td style={{...TD,textAlign:"right"}}>{p.amount>0?fmt(p.amount,0):"—"}</td>
                        <td style={{...TD,fontSize:10,color:"#9CA3AF"}}>Créer fiche technique dans Ratios</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Lignes hors matière : aucune fiche n'a lieu d'exister */}
          {(calc.pluHorsMatiere||[]).length>0&&(
            <div style={{marginBottom:16}}>
              <div style={{fontSize:11,fontWeight:700,color:"#9CA3AF",textTransform:"uppercase",marginBottom:6}}>
                Lignes hors matière — {calc.pluHorsMatiere.length} PLU · {calc.pluHorsMatiere.reduce((s,p)=>s+(p.qty||0),0)} unités
              </div>
              <div style={{background:"#F3F4F6",border:"1px solid #E5E7EB",borderRadius:8,padding:"8px 12px",fontSize:11,color:"#374151"}}>
                Ces lignes du PMIX ne consomment pas de matière (plateforme de livraison, jouet offert, modificateur « sans sauce ») : elles sont écartées du calcul théorique et ne sont pas comptées comme anomalies.
                <div style={{marginTop:6,display:"flex",flexWrap:"wrap",gap:6}}>
                  {calc.pluHorsMatiere.map(p=>(
                    <span key={p.plu} style={{background:"#fff",border:"1px solid #E5E7EB",borderRadius:6,padding:"3px 8px",fontSize:10}}>
                      <strong>{p.plu}</strong> {p.nom} · {fmt(p.qty,0)} u
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Articles PU = 0 */}
          {(calc.articlesEcart||[]).filter(a=>!a.puPiece||a.puPiece===0).length>0&&(
            <div style={{marginBottom:16}}>
              <div style={{fontSize:11,fontWeight:700,color:"#9CA3AF",textTransform:"uppercase",marginBottom:6}}>
                Articles non valorisés (PU = 0) — {(calc.articlesEcart||[]).filter(a=>!a.puPiece||a.puPiece===0).length} article(s)
              </div>
              <div style={{background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:8,padding:"8px 12px",marginBottom:8,fontSize:11,color:"#DC2626"}}>
                ✕ Ces articles sont présents dans le stock mais leur prix unitaire n'a pas pu être résolu. Leur valeur est comptée à 0 FCFA, ce qui fausse les totaux. Pour corriger : ajouter ces articles dans le fichier BASE ARTICLE SIA ou Correspondance NOM.
              </div>
              <div style={{background:"#fff",border:"1px solid #E5E7EB",borderRadius:10,overflow:"hidden"}}>
                <table style={{width:"100%",borderCollapse:"collapse"}}>
                  <thead><tr>
                    <th style={TH}>Catégorie</th>
                    <th style={TH}>Article</th>
                    <th style={{...TH,textAlign:"right"}}>CDT</th>
                    <th style={{...TH,textAlign:"right"}}>Stock ini (pcs)</th>
                    <th style={{...TH,textAlign:"right"}}>Écart (pcs)</th>
                    <th style={TH}>Action à faire</th>
                  </tr></thead>
                  <tbody>
                    {(calc.articlesEcart||[]).filter(a=>!a.puPiece||a.puPiece===0)
                      .sort((a,b)=>a.nom.localeCompare(b.nom)).map((a,i)=>(
                        <tr key={i} style={{background:i%2===0?"#FFFFFF":"#FEF9F9"}}>
                          <td style={{...TD,fontSize:10,color:"#9CA3AF"}}>{a.categorie?.split(" - ")[1]||a.categorie||"—"}</td>
                          <td style={{...TD,fontWeight:600,color:"#DC2626"}}>{a.nom}</td>
                          <td style={{...TD,textAlign:"right",fontSize:11}}>{a.qteCdt||"—"}</td>
                          <td style={{...TD,textAlign:"right"}}>{fmt(a.iniPieces,1)}</td>
                          <td style={{...TD,textAlign:"right",fontWeight:700,color:a.ecartPieces<0?"#DC2626":a.ecartPieces>0?"#D97706":"#059669"}}>{fmt(a.ecartPieces,1)}</td>
                          <td style={{...TD,fontSize:10,color:"#9CA3AF"}}>Ajouter dans BASE ARTICLE ou Correspondance NOM</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Aucune anomalie */}
          {(calc.pluNonMatchés||[]).length===0&&(calc.articlesEcart||[]).filter(a=>!a.puPiece||a.puPiece===0).length===0&&(
            <div style={{background:"#ECFDF5",border:"1px solid #A7F3D0",borderRadius:12,padding:32,textAlign:"center"}}>
              <div style={{fontSize:28,marginBottom:8}}>✅</div>
              <div style={{fontWeight:700,fontSize:14,color:"#059669"}}>Aucune anomalie détectée</div>
              <div style={{fontSize:12,color:"#6B7280",marginTop:4}}>Tous les PLU ont une fiche technique · Tous les articles ont un prix résolu</div>
            </div>
          )}
        </div>
      )}

      {/* ── DOUANE ── */}
      {tab==="douane"&&(
        <div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12}}>
            <KCard label="Total douane" value={fmt(calc.douaneTotal)+" FCFA"} s="warning"/>
            <KCard label="Lignes" value={(data.stockData?.douane||[]).length}/>
          </div>
          <div style={{background:"#fff",border:"1px solid #EDE9FE",borderRadius:10,overflow:"hidden"}}>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead><tr style={{background:"#F5F3FF"}}>
                {["Article","Catégorie","Date","Qté","Prix carton","CDT","Prix pièce","Valeur FCFA"].map(h=>(
                  <th key={h} style={{...TH,background:"#F5F3FF",color:"#7C3AED",textAlign:["Qté","Prix carton","CDT","Prix pièce","Valeur FCFA"].includes(h)?"right":"left"}}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {(data.stockData?.douane||[]).map((d,i)=>(
                  <tr key={i}><td style={{...TD,fontWeight:600}}>{d.article}</td>
                    <td style={TD}>{d.categorie||"—"}</td>
                    <td style={TD}>{d.date?new Date(d.date).toLocaleDateString("fr-FR"):"—"}</td>
                    <td style={{...TD,textAlign:"right"}}>{fmt(d.qte)}</td><td style={{...TD,textAlign:"right"}}>{fmt(d.pxCarton)}</td>
                    <td style={{...TD,textAlign:"right"}}>{fmt(d.cdt)}</td><td style={{...TD,textAlign:"right"}}>{fmt(d.pxPiece)}</td>
                    <td style={{...TD,textAlign:"right",fontWeight:700,color:"#7C3AED"}}>{fmt(d.valeur)}</td></tr>
                ))}
              </tbody>
              <tfoot><tr style={{background:"#F5F3FF"}}>
                <td colSpan={7} style={{...TD,fontWeight:700,color:"#7C3AED"}}>TOTAL</td>
                <td style={{...TD,textAlign:"right",fontWeight:700,color:"#7C3AED"}}>{fmt(data.stockData?.douaneTotal)}</td>
              </tr></tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ── OFFERTS ── */}
      {tab==="offerts"&&(
        <div style={{background:"#fff",border:"1px solid #E5E7EB",borderRadius:10,overflow:"hidden"}}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead><tr>{["BK","Staff Meals","Mngr Meals","Guest Track","Offerts","H.O","Discount CJ","TOTAL"].map(h=>(
              <th key={h} style={{...TH,textAlign:h!=="BK"?"right":"left"}}>{h}</th>
            ))}</tr></thead>
            <tbody>
              {Object.values(data.stockData?.offerts||{}).map((o,i)=>(
                <tr key={i}><td style={{...TD,fontWeight:600}}>{o.bk}</td>
                  {[o.staffM,o.mngrM,o.gt,o.offer,o.ho,o.discountCJ,o.total].map((v,j)=>(
                    <td key={j} style={{...TD,textAlign:"right",fontWeight:j===6?700:400,color:j===6?"#D4531D":"inherit"}}>{fmt(v)}</td>
                  ))}</tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

