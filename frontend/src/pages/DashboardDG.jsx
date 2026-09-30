import React, { useMemo } from 'react';

// Formatteurs simples
const fmtCFA = (val) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(val || 0);
const fmtPct = (ratio) => new Intl.NumberFormat('fr-FR', { style: 'percent', minimumFractionDigits: 2 }).format(ratio || 0);

export function DashboardDG({ rapports }) {
  // Filtre : uniquement les rapports validés ou soumis (hors brouillons/rejetés).
  // On exclut aussi les rapports multi-restaurants et on ne garde qu'un rapport par site
  // pour éviter les doublons si le même restaurant est exporté plusieurs fois.
  const validReports = useMemo(() => {
    const latestBySite = new Map();

    rapports.forEach((r) => {
      if (
        r.data?.isMulti ||
        !['submitted_to_daf', 'daf_approved', 'submitted_to_dg', 'dg_approved'].includes(r.status) ||
        !r.data?.calc
      ) {
        return;
      }

      const site = r.site || r.data.site || "BK Inconnu";
      const current = latestBySite.get(site);
      const currentDate = current ? new Date(current.updatedAt || current.createdAt || 0).getTime() : 0;
      const nextDate = new Date(r.updatedAt || r.createdAt || 0).getTime();

      if (!current || nextDate > currentDate) {
        latestBySite.set(site, r);
      }
    });

    return Array.from(latestBySite.values());
  }, [rapports]);

  const stats = useMemo(() => {
    let totalCA = 0;
    let totalTheo = 0;
    let totalReel = 0;
    let ecartVal = 0;
    const restaurantsMap = {};

    validReports.forEach(r => {
      const c = r.data.calc;
      totalCA += c.ca || 0;
      totalTheo += c.consoTheoTotal || 0;
      totalReel += c.consoReelle || 0;
      ecartVal += c.ecartMatiere || 0;

      const site = r.site || r.data.site || "BK Inconnu";
      if (!restaurantsMap[site]) {
        restaurantsMap[site] = { site, ca: 0, ecart: 0, count: 0 };
      }
      restaurantsMap[site].ca += c.ca || 0;
      restaurantsMap[site].ecart += c.ecartMatiere || 0;
      restaurantsMap[site].count += 1;
    });

    const ecartPctGlobal = totalTheo > 0 ? ecartVal / totalTheo : 0;

    // Top 5 flops : les plus gros écarts positifs (surconsommation / pertes)
    const topFlops = Object.values(restaurantsMap)
      .filter(x => x.ecart > 0)
      .sort((a, b) => b.ecart - a.ecart)
      .slice(0, 5);

    return { totalCA, totalTheo, totalReel, ecartVal, ecartPctGlobal, topFlops };
  }, [validReports]);

  if (validReports.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#6B7280' }}>
        <div style={{ fontSize: 48, marginBottom: 10 }}>📊</div>
        <h2>Aucune donnée consolidée disponible</h2>
        <p>Il n'y a pas encore de rapports validés ou soumis à analyser.</p>
      </div>
    );
  }

  const { totalCA, ecartVal, ecartPctGlobal, topFlops } = stats;
  const isGlobalWarning = ecartPctGlobal < -0.02; // Seuil d'alerte global (−2 %)

  return (
    <div style={{ padding: '10px 20px 40px', fontFamily: 'system-ui, sans-serif' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ margin: 0, color: '#1F2937', fontSize: 22 }}>Synthèse Réseau BK (Top-Down)</h2>
        <span style={{ fontSize: 12, color: '#6B7280', background: '#F3F4F6', padding: '4px 10px', borderRadius: 20 }}>
          Basé sur les {validReports.length} derniers rapports consolidés
        </span>
      </div>

      {/* Cartes KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 15, marginBottom: 30 }}>
        <div style={{ background: '#fff', padding: 20, borderRadius: 12, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', border: '1px solid #E5E7EB' }}>
          <div style={{ fontSize: 13, color: '#6B7280', fontWeight: 600, textTransform: 'uppercase', marginBottom: 5 }}>Chiffre d'Affaires Cumulé</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#111827' }}>{fmtCFA(totalCA)}</div>
        </div>

        <div style={{ background: '#fff', padding: 20, borderRadius: 12, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', border: '1px solid #E5E7EB' }}>
          <div style={{ fontSize: 13, color: '#6B7280', fontWeight: 600, textTransform: 'uppercase', marginBottom: 5 }}>Écart Global (Valeur)</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: ecartVal > 0 ? '#DC2626' : '#059669' }}>
            {ecartVal > 0 ? '+' : ''}{fmtCFA(ecartVal)}
          </div>
        </div>

        <div style={{ background: isGlobalWarning ? '#FEF2F2' : '#F0FDF4', padding: 20, borderRadius: 12, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', border: isGlobalWarning ? '1px solid #FCA5A5' : '1px solid #86EFAC' }}>
          <div style={{ fontSize: 13, color: isGlobalWarning ? '#991B1B' : '#065F46', fontWeight: 600, textTransform: 'uppercase', marginBottom: 5 }}>% Écart Réseau</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: isGlobalWarning ? '#DC2626' : '#059669', display: 'flex', alignItems: 'center', gap: 8 }}>
            {fmtPct(ecartPctGlobal)}
            {isGlobalWarning ? '📉' : '📈'}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 20 }}>
        
        {/* Top 5 Flops : restaurants avec les plus gros écarts positifs (surconsommation) */}
        <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', border: '1px solid #E5E7EB', overflow: 'hidden' }}>
          <div style={{ padding: '15px 20px', borderBottom: '1px solid #E5E7EB', background: '#F9FAFB', fontWeight: 700, color: '#374151' }}>
            🚨 Top 5 Restaurants (Plus gros écarts positifs)
          </div>
          <div style={{ padding: 20 }}>
            {topFlops.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#10B981', padding: 20, fontWeight: 600 }}>Aucun écart positif majeur détecté ! 🎉</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
                {topFlops.map((f, i) => {
                  const maxFlop = Math.abs(topFlops[0].ecart);
                  const pctWidth = Math.max(5, (Math.abs(f.ecart) / maxFlop) * 100);
                  
                  return (
                    <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600, color: '#4B5563' }}>
                        <span>{i + 1}. {f.site} <span style={{fontWeight:400, color:'#9CA3AF'}}>({f.count} rapport{f.count>1?'s':''})</span></span>
                        <span style={{ color: '#DC2626' }}>{fmtCFA(f.ecart)}</span>
                      </div>
                      <div style={{ height: 8, background: '#FEE2E2', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pctWidth}%`, background: '#EF4444', borderRadius: 4 }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
