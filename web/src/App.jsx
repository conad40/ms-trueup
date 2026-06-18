import React, { useState, useEffect, useCallback } from 'react';

const API = '/api';

// ════════════════════════════════════════════════════════════════
// Utility hooks & components
// ════════════════════════════════════════════════════════════════
function useFetch(url, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const reload = useCallback(() => {
    setLoading(true);
    fetch(`${API}${url}`).then(r => r.json()).then(d => { setData(d); setError(null); })
      .catch(e => setError(e.message)).finally(() => setLoading(false));
  }, [url, ...deps]);
  useEffect(reload, [reload]);
  return { data, loading, error, reload };
}

function Spinner() { return <div className="spinner">Loading</div>; }
function Badge({ color, children }) { return <span className={`badge badge-${color}`}>{children}</span>; }

// ════════════════════════════════════════════════════════════════
// Navigation
// ════════════════════════════════════════════════════════════════
const PAGES = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'hosts', label: 'Hosts', icon: '🖥️' },
  { id: 'compliance', label: 'Compliance', icon: '✅' },
  { id: 'entitlements', label: 'Entitlements', icon: '📜' },
  { id: 'scanners', label: 'Scanners', icon: '🔍' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
  { id: 'scripts', label: 'Scripts', icon: '📥' },
  { id: 'logs', label: 'Logs', icon: '📋' },
  { id: 'updates', label: 'System Update', icon: '🔄' },
];

function Nav({ current, onChange }) {
  return (
    <nav className="topnav">
      <div className="topnav-brand">
        <h2>MS True-Up</h2>
      </div>
      <div className="topnav-links">
        {PAGES.map(p => (
          <button key={p.id} className={`nav-btn ${current === p.id ? 'active' : ''}`}
            onClick={() => onChange(p.id)}>
            <span className="nav-icon">{p.icon}</span> {p.label}
          </button>
        ))}
      </div>
    </nav>
  );
}

// ════════════════════════════════════════════════════════════════
// Dashboard
// ════════════════════════════════════════════════════════════════
function DonutChart({ data, size = 180, thickness = 32 }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  return (
    <div style={{display:'flex',alignItems:'center',gap:'1.5rem',flexWrap:'wrap',justifyContent:'center'}}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {data.map((d, i) => {
          const pct = total > 0 ? d.value / total : 0;
          const dash = pct * circumference;
          const gap = circumference - dash;
          const rotation = (offset / total) * 360 - 90;
          offset += d.value;
          return (
            <circle key={i} cx={size/2} cy={size/2} r={radius}
              fill="none" stroke={d.color} strokeWidth={thickness}
              strokeDasharray={`${dash} ${gap}`}
              transform={`rotate(${rotation} ${size/2} ${size/2})`}
              style={{transition:'stroke-dasharray 0.4s ease'}} />
          );
        })}
        <text x={size/2} y={size/2-6} textAnchor="middle" style={{fontSize:'1.5rem',fontWeight:700,fill:'var(--text)'}}>{total.toLocaleString()}</text>
        <text x={size/2} y={size/2+14} textAnchor="middle" style={{fontSize:'0.7rem',fill:'var(--text-muted)',fontWeight:500}}>TOTAL</text>
      </svg>
      <div style={{display:'flex',flexDirection:'column',gap:'0.35rem'}}>
        {data.map((d, i) => (
          <div key={i} style={{display:'flex',alignItems:'center',gap:'0.45rem',fontSize:'0.8rem'}}>
            <span style={{width:10,height:10,borderRadius:2,background:d.color,flexShrink:0}} />
            <span style={{color:'var(--text-secondary)'}}>{d.label}</span>
            <span style={{fontWeight:600,marginLeft:'auto',paddingLeft:'0.5rem',fontVariantNumeric:'tabular-nums'}}>{d.value.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BarChart({ data, colorFn }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div style={{display:'flex',flexDirection:'column',gap:'0.45rem'}}>
      {data.map(d => (
        <div key={d.label} style={{display:'flex',alignItems:'center',gap:'0.6rem'}}>
          <span style={{width:'140px',fontSize:'0.8rem',textAlign:'right',flexShrink:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',color:'var(--text-secondary)',fontWeight:500}}>{d.label}</span>
          <div style={{flex:1,background:'var(--border-light)',borderRadius:'2px',height:'24px',overflow:'hidden'}}>
            <div style={{width:`${(d.value/max)*100}%`,background:colorFn?colorFn(d):d.color||'var(--primary)',borderRadius:'2px',height:'100%',minWidth: d.value > 0 ? '3px' : 0,transition:'width 0.4s ease'}} />
          </div>
          <span style={{width:'50px',fontSize:'0.82rem',fontWeight:700,color:'var(--text)',fontVariantNumeric:'tabular-nums'}}>{d.value.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}

function Dashboard() {
  const { data, loading } = useFetch('/dashboard');
  const comp = useFetch('/compliance');
  const scans = useFetch('/scans?limit=30');
  const [expandedComp, setExpandedComp] = useState(null);
  if (loading || !data) return <Spinner />;
  const cards = [
    { label: 'Physical Hosts', value: data.physical_hosts, color: '#0891b2' },
    { label: 'Virtual Hosts', value: data.virtual_hosts, color: '#6e56cf' },
    { label: 'Total Hosts', value: data.total_hosts, color: '#30a46c' },
    { label: 'SQL Instances', value: data.sql_instances, color: '#e5a000' },
  ];

  const compliance = comp.data?.compliance || [];
  const sourceData = Object.entries(data.sources || {}).map(([k,v]) => ({label:k, value:v}));
  const osData = Object.entries(data.os_breakdown || {}).map(([k,v]) => ({label:k, value:v}));
  const sourceColors = {vcenter:'#6e56cf',agent:'#0891b2',winrm:'#30a46c',sccm:'#e5a000',scvmm:'#e5484d'};
  const sourceDonut = sourceData.map(d => ({...d, color: sourceColors[d.label] || '#8b95a5'}));

  // Type donut
  const typeDonut = [
    { label: 'Physical', value: data.physical_hosts, color: '#0891b2' },
    { label: 'Virtual', value: data.virtual_hosts, color: '#6e56cf' },
  ];

  // OS donut - top 6 + other
  const osSorted = [...osData].sort((a,b) => b.value - a.value);
  const osColors = ['#0891b2','#6e56cf','#30a46c','#e5a000','#e5484d','#8b5cf6','#8b95a5'];
  const osTop = osSorted.slice(0,6).map((d,i) => ({...d, color: osColors[i]}));
  const osRest = osSorted.slice(6).reduce((s,d) => s + d.value, 0);
  if (osRest > 0) osTop.push({label:'Other', value: osRest, color: osColors[6]});

  // Scan history for bar chart
  const scanList = (scans.data?.scans || []).filter(s => s.hosts_scanned > 0).reverse().slice(-14);

  return (
    <div>
      <h1>Dashboard</h1>
      <div className="card-grid">
        {cards.map(c => (
          <div key={c.label} className="stat-card" style={{ borderLeftColor: c.color }}>
            <div className="stat-value">{c.value}</div>
            <div className="stat-label">{c.label}</div>
          </div>
        ))}
      </div>

      {data.last_scan && (
        <div className="info-box">
          Last scan: {new Date(data.last_scan.started_at).toLocaleString()} —
          {data.last_scan.hosts_scanned} scanned, {data.last_scan.hosts_failed} failed
          <Badge color={data.last_scan.status === 'completed' ? 'green' : 'yellow'}>{data.last_scan.status}</Badge>
        </div>
      )}

      {/* Compliance Summary */}
      {compliance.length > 0 && (
        <div style={{marginTop:'1.75rem'}}>
          <h2 style={{marginBottom:'1rem'}}>Compliance Status</h2>
          <div className="card-grid">
            {compliance.map(g => {
              const pct = g.entitled_cores > 0 ? Math.min(100, Math.round((g.entitled_cores / Math.max(g.required_cores,1)) * 100)) : 0;
              const color = g.compliant ? 'var(--success)' : 'var(--danger)';
              const isOpen = expandedComp === g.product;
              return (
                <div key={g.product} className="stat-card" style={{borderLeftColor: color, padding:'1.25rem', cursor:'pointer'}}
                  onClick={() => setExpandedComp(isOpen ? null : g.product)}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'0.65rem'}}>
                    <strong style={{fontSize:'0.95rem'}}>{g.product}</strong>
                    <Badge color={g.compliant ? 'green' : 'red'}>{g.compliant ? 'Compliant' : 'Gap'}</Badge>
                  </div>
                  <div style={{background:'var(--border-light)',borderRadius:'3px',height:'10px',marginBottom:'0.65rem',overflow:'hidden'}}>
                    <div style={{width:`${pct}%`,height:'100%',background:color,borderRadius:'3px',transition:'width 0.4s ease'}} />
                  </div>
                  <div style={{display:'flex',justifyContent:'space-between',fontSize:'0.8rem',color:'var(--text-muted)'}}>
                    <span>Entitled: <strong style={{color:'var(--text-secondary)'}}>{g.entitled_cores.toLocaleString()}</strong></span>
                    <span>Required: <strong style={{color:'var(--text-secondary)'}}>{g.required_cores.toLocaleString()}</strong></span>
                  </div>
                  {g.gap_cores > 0 && (
                    <div style={{fontSize:'0.82rem',color:'var(--danger)',fontWeight:600,marginTop:'0.4rem'}}>
                      Gap: {g.gap_cores.toLocaleString()} cores ({g.gap_2packs.toLocaleString()} two-core packs)
                    </div>
                  )}
                  <div style={{fontSize:'0.78rem',color:'var(--text-muted)',marginTop:'0.35rem'}}>
                    {g.physical_hosts} physical · {g.virtual_hosts} VMs
                    {g.note ? ` · ${g.note}` : ''}
                  </div>
                  <div style={{fontSize:'0.75rem',color:'var(--primary)',marginTop:'0.35rem'}}>
                    {isOpen ? '▾ Hide host details' : '▸ Click to see hosts'}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Host detail table for expanded compliance card */}
          {expandedComp && (() => {
            const g = compliance.find(c => c.product === expandedComp);
            if (!g || !g.host_details || g.host_details.length === 0) return null;
            const allDetails = [...g.host_details];
            const physicals = allDetails.filter(h => h.type === 'physical');
            const needsLicense = allDetails.filter(h => h.status === 'needs_license');
            const covered = allDetails.filter(h => h.status === 'covered');
            const hypSummary = g.hyp_summary || [];
            const isStandard = expandedComp.includes('Standard');

            // Group VMs by hypervisor for Standard view
            const vmsByHyp = {};
            allDetails.filter(h => h.type === 'vm').forEach(h => {
              const key = h.hypervisor_host || h.stacking_group || 'Unknown';
              (vmsByHyp[key] = vmsByHyp[key] || []).push(h);
            });

            return (
              <div className="card" style={{marginTop:'0.75rem',padding:'1rem'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'0.75rem'}}>
                  <div>
                    <h3 style={{margin:0,fontSize:'0.95rem'}}>{expandedComp} — Host Breakdown</h3>
                    <div style={{fontSize:'0.8rem',color:'var(--text-secondary)',marginTop:'0.25rem'}}>
                      <span style={{fontWeight:600}}>{physicals.length} physical</span>
                      {' · '}
                      <span style={{color:'var(--danger)',fontWeight:600}}>{needsLicense.length} need license</span>
                      {' · '}
                      <span style={{color:'var(--success)',fontWeight:600}}>{covered.length} covered</span>
                      {' · '}
                      {allDetails.length} total
                    </div>
                  </div>
                  <button className="btn-sm" onClick={() => setExpandedComp(null)}>Close</button>
                </div>

                {/* Stacking summary for Standard */}
                {isStandard && hypSummary.length > 0 && (
                  <div style={{marginBottom:'1rem'}}>
                    <h4 style={{fontSize:'0.85rem',margin:'0 0 0.5rem'}}>Stacking Summary by Hypervisor</h4>
                    <table className="data-table" style={{fontSize:'0.82rem'}}>
                      <thead>
                        <tr><th>Hypervisor Host</th><th>Win VMs</th><th>Total VMs</th><th>Licenses Needed</th><th>Base</th><th>Stacked</th><th>Extra Cores</th></tr>
                      </thead>
                      <tbody>
                        {hypSummary.sort((a,b) => b.vm_count - a.vm_count).map((hs, i) => (
                          <tr key={i} style={hs.extra_stacked > 0 ? {background:'#fffbeb'} : {}}>
                            <td><strong>{hs.hypervisor}</strong></td>
                            <td style={{fontWeight:600,color:'var(--primary)'}}>{hs.windows_vm_count || 0}</td>
                            <td style={{color:'var(--text-secondary)'}}>{hs.total_vm_count || 0}</td>
                            <td style={{fontWeight:600}}>{hs.licenses_needed}</td>
                            <td>1</td>
                            <td style={{fontWeight:600,color: hs.extra_stacked > 0 ? '#d97706' : 'var(--text-secondary)'}}>
                              {hs.extra_stacked > 0 ? `+${hs.extra_stacked}` : '0'}
                            </td>
                            <td>{hs.extra_cores > 0 ? `+${hs.extra_cores}` : '0'}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr style={{fontWeight:700,borderTop:'2px solid var(--border)'}}>
                          <td>Total</td>
                          <td>{hypSummary.reduce((s,h) => s + (h.windows_vm_count||0), 0)}</td>
                          <td>{hypSummary.reduce((s,h) => s + (h.total_vm_count||0), 0)}</td>
                          <td>{hypSummary.reduce((s,h) => s + h.licenses_needed, 0)}</td>
                          <td>{hypSummary.length}</td>
                          <td style={{color:'#d97706'}}>+{hypSummary.reduce((s,h) => s + h.extra_stacked, 0)}</td>
                          <td>+{hypSummary.reduce((s,h) => s + h.extra_cores, 0)}</td>
                        </tr>
                      </tfoot>
                    </table>
                    <div style={{fontSize:'0.78rem',color:'var(--text-secondary)',marginTop:'0.4rem',lineHeight:1.5}}>
                      Each Standard license covers 2 VMs on a host. Hosts with &gt;2 VMs need stacked licenses (each additional license = 2 more VMs = 16 cores).
                    </div>
                  </div>
                )}

                {/* Physical hosts */}
                {physicals.length > 0 && (
                  <div style={{marginBottom:'1rem'}}>
                    <h4 style={{fontSize:'0.85rem',margin:'0 0 0.5rem'}}>Physical Hosts ({physicals.length})</h4>
                    <div style={{maxHeight:'300px',overflow:'auto'}}>
                      <table className="data-table" style={{fontSize:'0.82rem'}}>
                        <thead><tr><th>Hostname</th><th>Sockets</th><th>Cores</th><th>Licensed Cores</th><th>2-Core Packs</th><th>Win VMs</th><th>Total VMs</th></tr></thead>
                        <tbody>
                          {physicals.sort((a,b) => b.licensed_cores - a.licensed_cores).map((h,i) => (
                            <tr key={i}>
                              <td><strong>{h.hostname}</strong></td>
                              <td>{h.sockets}</td>
                              <td>{h.physical_cores}</td>
                              <td style={{fontWeight:600}}>{h.licensed_cores}</td>
                              <td>{h.two_core_packs}</td>
                              <td style={{fontWeight:600,color: h.windows_vm_count > 0 ? 'var(--primary)' : 'var(--text-muted)'}}>{h.windows_vm_count || 0}</td>
                              <td style={{color:'var(--text-secondary)'}}>{h.total_vm_count || 0}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr style={{fontWeight:700,borderTop:'2px solid var(--border)'}}>
                            <td>Total</td><td></td>
                            <td>{physicals.reduce((s,h) => s + h.physical_cores, 0)}</td>
                            <td>{physicals.reduce((s,h) => s + h.licensed_cores, 0)}</td>
                            <td>{physicals.reduce((s,h) => s + h.two_core_packs, 0)}</td>
                            <td>{physicals.reduce((s,h) => s + (h.windows_vm_count||0), 0)}</td>
                            <td>{physicals.reduce((s,h) => s + (h.total_vm_count||0), 0)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}

                {/* VMs grouped by hypervisor for Standard, flat list otherwise */}
                {isStandard && Object.keys(vmsByHyp).length > 0 ? (
                  <div>
                    <h4 style={{fontSize:'0.85rem',margin:'0 0 0.5rem'}}>VMs by Hypervisor</h4>
                    {Object.entries(vmsByHyp).sort((a,b) => b[1].length - a[1].length).map(([hyp, vms]) => {
                      const licCount = Math.ceil(vms.length / 2);
                      const needsStack = licCount > 1;
                      return (
                        <div key={hyp} style={{marginBottom:'0.75rem',border:'1px solid var(--border)',borderRadius:'var(--radius)'}}>
                          <div style={{padding:'0.5rem 0.75rem',background: needsStack ? '#fffbeb' : '#f0fdf4',
                            display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:'0.82rem',borderBottom:'1px solid var(--border)'}}>
                            <span><strong>{hyp}</strong> — {vms.length} VMs</span>
                            <span style={{fontWeight:600,color: needsStack ? '#d97706' : 'var(--success)'}}>
                              {licCount} license{licCount > 1 ? 's' : ''} needed
                              {needsStack ? ` (1 base + ${licCount-1} stacked)` : ' (base only)'}
                            </span>
                          </div>
                          <table className="data-table" style={{fontSize:'0.8rem',margin:0,borderRadius:0}}>
                            <tbody>
                              {vms.map((h,i) => {
                                const licNum = h.license_num || Math.ceil((i+1)/2);
                                return (
                                  <tr key={i} style={{background: h.status === 'covered' ? '' : '#fef2f2'}}>
                                    <td style={{width:'40%'}}>{h.hostname}</td>
                                    <td>
                                      <Badge color={h.status === 'covered' ? 'green' : 'yellow'}>
                                        {h.status === 'covered' ? 'covered' : 'stacked'}
                                      </Badge>
                                    </td>
                                    <td style={{fontSize:'0.78rem',color:'var(--text-secondary)'}}>
                                      License {licNum}{licNum === 1 ? ' (base)' : ` (stack #${licNum-1})`}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* Non-standard: flat needs/covered lists */
                  <>
                    {needsLicense.filter(h => h.type === 'vm').length > 0 && (
                      <div style={{marginBottom:'1rem'}}>
                        <h4 style={{fontSize:'0.85rem',color:'var(--danger)',margin:'0 0 0.5rem'}}>
                          VMs Needing License ({needsLicense.filter(h => h.type === 'vm').length})
                        </h4>
                        <div style={{maxHeight:'300px',overflow:'auto'}}>
                          <table className="data-table" style={{fontSize:'0.82rem'}}>
                            <thead><tr><th>Hostname</th><th>Hypervisor</th><th>Cores</th><th>Reason</th></tr></thead>
                            <tbody>
                              {needsLicense.filter(h => h.type === 'vm').map((h,i) => (
                                <tr key={i} style={{background:'#fef2f2'}}>
                                  <td><strong>{h.hostname}</strong></td>
                                  <td style={{fontSize:'0.78rem'}}>{h.hypervisor_host || '—'}</td>
                                  <td>{h.physical_cores}</td>
                                  <td style={{fontSize:'0.78rem',color:'var(--text-secondary)'}}>{h.reason}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                    {covered.length > 0 && (
                      <div>
                        <h4 style={{fontSize:'0.85rem',color:'var(--success)',margin:'0 0 0.5rem'}}>
                          Covered VMs ({covered.length})
                        </h4>
                        <div style={{maxHeight:'250px',overflow:'auto'}}>
                          <table className="data-table" style={{fontSize:'0.82rem'}}>
                            <thead><tr><th>Hostname</th><th>Hypervisor</th><th>Cores</th><th>Covered By</th></tr></thead>
                            <tbody>
                              {covered.sort((a,b) => (a.hostname||'').localeCompare(b.hostname||'')).map((h,i) => (
                                <tr key={i}>
                                  <td>{h.hostname}</td>
                                  <td style={{fontSize:'0.78rem'}}>{h.hypervisor_host || '—'}</td>
                                  <td>{h.physical_cores}</td>
                                  <td style={{fontSize:'0.78rem',color:'var(--success)'}}>{h.reason}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* Donut Charts Row */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(3, 1fr)',gap:'1rem',marginTop:'1.5rem'}}>
        <div className="chart-card">
          <h3>Computer Types</h3>
          <DonutChart data={typeDonut} />
        </div>
        {sourceDonut.length > 0 && (
          <div className="chart-card">
            <h3>Discovery Sources</h3>
            <DonutChart data={sourceDonut} />
          </div>
        )}
        {osTop.length > 0 && (
          <div className="chart-card">
            <h3>Operating Systems</h3>
            <DonutChart data={osTop} size={180} thickness={28} />
          </div>
        )}
      </div>

      {/* Scan History */}
      {scanList.length > 0 && (
        <div className="chart-card" style={{marginTop:'1rem'}}>
          <h3>Scan History</h3>
          <div style={{display:'flex',alignItems:'flex-end',gap:'4px',height:'120px',marginTop:'0.5rem'}}>
            {scanList.map((s, i) => {
              const maxVal = Math.max(...scanList.map(x => x.hosts_scanned), 1);
              const h = Math.max((s.hosts_scanned / maxVal) * 100, 2);
              const date = new Date(s.started_at);
              const label = `${date.getMonth()+1}/${date.getDate()}`;
              return (
                <div key={i} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:'2px'}}>
                  <span style={{fontSize:'0.65rem',color:'var(--text-muted)',fontVariantNumeric:'tabular-nums'}}>{s.hosts_scanned > 0 ? s.hosts_scanned.toLocaleString() : ''}</span>
                  <div title={`${date.toLocaleString()}: ${s.hosts_scanned} scanned`}
                    style={{width:'100%',maxWidth:'40px',height:`${h}%`,background: s.status==='completed'?'var(--primary)':s.status==='error'?'var(--danger)':'var(--warning)',
                      borderRadius:'2px 2px 0 0',transition:'height 0.3s ease',cursor:'pointer',opacity:0.85}} />
                  <span style={{fontSize:'0.6rem',color:'var(--text-muted)',whiteSpace:'nowrap'}}>{label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// Hosts
// ════════════════════════════════════════════════════════════════
function Hosts() {
  const [page, setPage] = useState(1);
  const [showInactive, setShowInactive] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [search, setSearch] = useState('');
  const [filterSource, setFilterSource] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterOS, setFilterOS] = useState('');
  const [sortCol, setSortCol] = useState('hostname');
  const [sortDir, setSortDir] = useState('asc');
  const [showSummary, setShowSummary] = useState(true);
  const [sumSearch, setSumSearch] = useState('');
  const [sumEd, setSumEd] = useState('');
  const [sumOs, setSumOs] = useState('');
  const [sumSortCol, setSumSortCol] = useState('lc');
  const [sumSortDir, setSumSortDir] = useState('desc');
  const { data, loading, reload } = useFetch(`/hosts?page=1&per_page=10000`);
  const inactiveRes = useFetch('/hosts/inactive');

  const setLicense = async (hostId, field, value) => {
    const endpoint = field === 'sql_license_override' ? 'sql-license' : 'license';
    await fetch(`${API}/hosts/${hostId}/${endpoint}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value || null })
    });
    reload();
  };

  const bulkAction = async (action, body) => {
    const ids = [...selected];
    if (!ids.length) return;
    await fetch(`${API}/hosts/${action}`, {
      method: action.includes('delete') ? 'DELETE' : 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ host_ids: ids, ...body })
    });
    setSelected(new Set());
    reload();
  };

  const exportExcel = () => { window.open(`${API}/export/trueup`); };

  if (loading || !data) return <Spinner />;
  const hosts = data.hosts || [];
  const filtered = hosts.filter(h => {
    if (search) {
      const s = search.toLowerCase();
      if (!(h.hostname||'').toLowerCase().includes(s) && !(h.ip_address||'').toLowerCase().includes(s) && !(h.os_name||'').toLowerCase().includes(s)) return false;
    }
    if (filterSource && h.scan_source !== filterSource) return false;
    if (filterType === 'physical' && h.is_virtual) return false;
    if (filterType === 'virtual' && !h.is_virtual) return false;
    if (filterOS) {
      const os = (h.os_name||'').toLowerCase();
      const f = filterOS;
      if (f === 'VMware ESXi' && !os.includes('esxi')) return false;
      else if (f === 'Windows Server 2022' && !os.includes('windows server 2022')) return false;
      else if (f === 'Windows Server 2019' && !os.includes('windows server 2019')) return false;
      else if (f === 'Windows Server 2016' && !os.includes('windows server 2016')) return false;
      else if (f === 'Windows Server 2012' && !os.includes('windows server 2012')) return false;
      else if (f === 'Windows Server (Other)' && (!os.includes('windows server') || os.includes('2022') || os.includes('2019') || os.includes('2016') || os.includes('2012'))) return false;
      else if (f === 'Windows Desktop' && !(/windows 1|windows 11/.test(os))) return false;
      else if (f === 'Red Hat Linux' && !os.includes('red hat') && !os.includes('rhel')) return false;
      else if (f === 'Ubuntu Linux' && !os.includes('ubuntu')) return false;
      else if (f === 'SUSE Linux' && !os.includes('suse')) return false;
      else if (f === 'CentOS' && !os.includes('centos')) return false;
      else if (f === 'Linux (Other)' && (!os.includes('linux') || os.includes('red hat') || os.includes('rhel') || os.includes('ubuntu') || os.includes('suse') || os.includes('centos'))) return false;
      else if (f === 'Unknown' && os) return false;
    }
    return true;
  });
  // Build unique OS categories from data
  const osCategories = [...new Set(hosts.map(h => {
    const os = (h.os_name||'').toLowerCase();
    if (os.includes('esxi')) return 'VMware ESXi';
    if (os.includes('windows server 2022')) return 'Windows Server 2022';
    if (os.includes('windows server 2019')) return 'Windows Server 2019';
    if (os.includes('windows server 2016')) return 'Windows Server 2016';
    if (os.includes('windows server 2012')) return 'Windows Server 2012';
    if (os.includes('windows server')) return 'Windows Server (Other)';
    if (os.includes('windows 1') || os.includes('windows 11')) return 'Windows Desktop';
    if (os.includes('red hat') || os.includes('rhel')) return 'Red Hat Linux';
    if (os.includes('ubuntu')) return 'Ubuntu Linux';
    if (os.includes('suse')) return 'SUSE Linux';
    if (os.includes('centos')) return 'CentOS';
    if (os.includes('linux')) return 'Linux (Other)';
    if (!os) return 'Unknown';
    return 'Other';
  }))].sort();
  const sorted = [...filtered].sort((a, b) => {
    let av, bv;
    switch (sortCol) {
      case 'hostname': av = (a.hostname||'').toLowerCase(); bv = (b.hostname||'').toLowerCase(); break;
      case 'ip_address': av = (a.ip_address||'').split('.').map(n=>n.padStart(3,'0')).join('.'); bv = (b.ip_address||'').split('.').map(n=>n.padStart(3,'0')).join('.'); break;
      case 'os_name': av = (a.os_name||'').toLowerCase(); bv = (b.os_name||'').toLowerCase(); break;
      case 'type': av = a.is_virtual ? 1 : 0; bv = b.is_virtual ? 1 : 0; break;
      case 'cpu_sockets': av = a.cpu_sockets||0; bv = b.cpu_sockets||0; break;
      case 'cpu_cores': av = a.cpu_cores||0; bv = b.cpu_cores||0; break;
      case 'cpu_model': av = a.is_virtual ? 'Virtual' : (a.cpu_model||'').toLowerCase(); bv = b.is_virtual ? 'Virtual' : (b.cpu_model||'').toLowerCase(); break;
      case 'scan_source': av = (a.scan_source||''); bv = (b.scan_source||''); break;
      case 'last_scan': av = a.last_scan||''; bv = b.last_scan||''; break;
      default: av = ''; bv = '';
    }
    if (av < bv) return sortDir === 'asc' ? -1 : 1;
    if (av > bv) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });
  const toggleSort = (col) => { if (sortCol === col) { setSortDir(d => d === 'asc' ? 'desc' : 'asc'); } else { setSortCol(col); setSortDir('asc'); } setPage(1); };
  const SortIcon = ({ col }) => sortCol === col ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ' ⇅';
  const pageSize = 50;
  const totalPages = Math.ceil(sorted.length / pageSize);
  const pagedHosts = sorted.slice((page - 1) * pageSize, page * pageSize);

  // ── Physical-server license summary (all physical hosts, independent of table filters) ──
  const physKey = (name) => (name || '').toUpperCase().split('.')[0];
  const isWinServer = (os) => /server/i.test(os || '') && !/esxi/i.test(os || '');
  // Count VMs per hypervisor (each VM once, keyed by hypervisor short name)
  const vmByHost = {};
  hosts.forEach(h => {
    if (h.is_virtual && h.hypervisor_host) {
      const k = physKey(h.hypervisor_host);
      const e = vmByHost[k] || (vmByHost[k] = { total: 0, win: 0 });
      e.total++;
      if (isWinServer(h.os_name)) e.win++;
    }
  });
  const edLabel = (h) => {
    if (h.license_override) return h.license_override;
    const a = h.license_assignment || '';
    if (a.startsWith('Datacenter')) return 'Datacenter';
    if (a.startsWith('Standard')) return 'Standard';
    if (a.startsWith('No License')) return 'None';
    if (a.startsWith('Vendor')) return 'Vendor';
    return '—';
  };
  const physicalRows = hosts
    .filter(h => !h.is_virtual && (
      isWinServer(h.os_name) ||
      (h.license_override && !['', 'None', 'Vendor'].includes(h.license_override)) ||
      (vmByHost[physKey(h.hostname)]?.total > 0)
    ))
    .map(h => {
      const vc = vmByHost[physKey(h.hostname)] || { total: 0, win: 0 };
      const lc = h.licensed_cores || 0;
      return { ...h, _lc: lc, _packs: Math.ceil(lc / 2), _winVms: vc.win, _totVms: vc.total };
    })
    .sort((a, b) => (b._lc - a._lc) || (b._totVms - a._totVms) || (a.hostname || '').localeCompare(b.hostname || ''));
  const osCat = (os) => {
    const o = (os || '').toLowerCase();
    if (o.includes('esxi')) return 'VMware ESXi';
    if (o.includes('windows server 2022')) return 'Windows Server 2022';
    if (o.includes('windows server 2019')) return 'Windows Server 2019';
    if (o.includes('windows server 2016')) return 'Windows Server 2016';
    if (o.includes('windows server 2012')) return 'Windows Server 2012';
    if (o.includes('windows server')) return 'Windows Server (Other)';
    if (o.includes('red hat') || o.includes('rhel')) return 'Red Hat Linux';
    if (o.includes('ubuntu')) return 'Ubuntu Linux';
    if (o.includes('suse')) return 'SUSE Linux';
    if (o.includes('centos')) return 'CentOS';
    if (o.includes('linux')) return 'Linux (Other)';
    if (!o) return 'Unknown';
    return 'Other';
  };
  const sumOsCategories = [...new Set(physicalRows.map(h => osCat(h.os_name)))].sort();
  const sumEditions = [...new Set(physicalRows.map(edLabel))].sort();
  // Apply summary-specific filters
  const displayRows = physicalRows.filter(h => {
    if (sumSearch) {
      const s = sumSearch.toLowerCase();
      if (!(h.hostname || '').toLowerCase().includes(s) && !(h.os_name || '').toLowerCase().includes(s)) return false;
    }
    if (sumEd && edLabel(h) !== sumEd) return false;
    if (sumOs && osCat(h.os_name) !== sumOs) return false;
    return true;
  }).sort((a, b) => {
    let av, bv;
    switch (sumSortCol) {
      case 'hostname': av = (a.hostname || '').toLowerCase(); bv = (b.hostname || '').toLowerCase(); break;
      case 'os_name': av = (a.os_name || '').toLowerCase(); bv = (b.os_name || '').toLowerCase(); break;
      case 'sockets': av = a.cpu_sockets || 0; bv = b.cpu_sockets || 0; break;
      case 'cores': av = a.cpu_cores || 0; bv = b.cpu_cores || 0; break;
      case 'packs': av = a._packs; bv = b._packs; break;
      case 'win': av = a._winVms; bv = b._winVms; break;
      case 'tot': av = a._totVms; bv = b._totVms; break;
      case 'edition': av = edLabel(a); bv = edLabel(b); break;
      case 'lc': default: av = a._lc; bv = b._lc; break;
    }
    if (av < bv) return sumSortDir === 'asc' ? -1 : 1;
    if (av > bv) return sumSortDir === 'asc' ? 1 : -1;
    return (a.hostname || '').localeCompare(b.hostname || '');
  });
  const sumToggleSort = (col) => {
    if (sumSortCol === col) { setSumSortDir(d => d === 'asc' ? 'desc' : 'asc'); }
    else { setSumSortCol(col); setSumSortDir(['hostname', 'os_name', 'edition'].includes(col) ? 'asc' : 'desc'); }
  };
  const SumTh = ({ col, label }) => (
    <th style={{cursor:'pointer',whiteSpace:'nowrap'}} onClick={() => sumToggleSort(col)}>
      {label}{sumSortCol === col ? (sumSortDir === 'asc' ? ' ▲' : ' ▼') : ' ⇅'}
    </th>
  );
  // Totals + edition rollup reflect the filtered view
  const coresByEd = {};
  displayRows.forEach(h => { const e = edLabel(h); coresByEd[e] = (coresByEd[e] || 0) + h._lc; });
  const edSummary = Object.entries(coresByEd)
    .filter(([k, c]) => c > 0 && k !== '—' && k !== 'None' && k !== 'Vendor')
    .sort((a, b) => b[1] - a[1])
    .map(([k, c]) => `${k}: ${c}c (${Math.ceil(c / 2)} packs)`).join('   ·   ');
  const physTotals = displayRows.reduce((t, h) => ({
    cores: t.cores + (h.cpu_cores || 0), lc: t.lc + h._lc, packs: t.packs + h._packs,
    win: t.win + h._winVms, tot: t.tot + h._totVms,
  }), { cores: 0, lc: 0, packs: 0, win: 0, tot: 0 });

  return (
    <div>
      <div className="page-header">
        <h1>Hosts ({sorted.length}{sorted.length !== data.total ? ` / ${data.total}` : ''})</h1>
        <div className="header-actions">
          <button onClick={exportExcel} className="btn btn-secondary">Export Excel</button>
          <button onClick={() => setShowInactive(!showInactive)} className="btn btn-secondary">
            {showInactive ? 'Show Active' : 'Show Inactive'}
          </button>
          {selected.size > 0 && (
            <>
              <select onChange={e => { if (e.target.value) bulkAction('bulk-license', { license_override: e.target.value === 'clear' ? null : e.target.value }); e.target.value = ''; }}>
                <option value="">Bulk WS License...</option>
                <option value="Datacenter">Datacenter</option>
                <option value="Standard">Standard</option>
                <option value="None">None</option>
                <option value="Vendor">Vendor</option>
                <option value="clear">Clear Override</option>
              </select>
              <select onChange={e => { if (e.target.value) bulkAction('bulk-sql-license', { sql_license_override: e.target.value === 'clear' ? null : e.target.value }); e.target.value = ''; }}>
                <option value="">Bulk SQL License...</option>
                <option value="Enterprise">Enterprise</option>
                <option value="Standard">Standard</option>
                <option value="None">None</option>
                <option value="Vendor">Vendor</option>
                <option value="clear">Clear Override</option>
              </select>
              <button onClick={() => { if (confirm('Delete selected?')) bulkAction('bulk-delete', {}); }} className="btn btn-danger">Delete Selected</button>
            </>
          )}
        </div>
      </div>

      {showInactive ? (
        <InactiveHosts data={inactiveRes.data} reload={() => { inactiveRes.reload(); reload(); }} />
      ) : (
        <>
          {/* Physical Server License Summary — sortable by cores, edition editable inline */}
          <div className="card" style={{marginBottom:'1rem',padding:'1rem'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',cursor:'pointer'}} onClick={() => setShowSummary(s => !s)}>
              <h3 style={{margin:0,fontSize:'0.95rem'}}>Physical Server License Summary ({displayRows.length}{displayRows.length !== physicalRows.length ? ` / ${physicalRows.length}` : ''})</h3>
              <span style={{fontSize:'0.8rem',color:'var(--primary)'}}>{showSummary ? '▾ Hide' : '▸ Show'}</span>
            </div>
            {showSummary && (
              <>
                {edSummary && (
                  <div style={{fontSize:'0.82rem',color:'var(--text-secondary)',margin:'0.5rem 0 0.75rem',fontWeight:600}}>{edSummary}</div>
                )}
                <div className="filter-bar" style={{marginBottom:'0.5rem'}}>
                  <input type="text" placeholder="Search server or OS..." value={sumSearch} onChange={e => setSumSearch(e.target.value)} />
                  <select value={sumEd} onChange={e => setSumEd(e.target.value)}>
                    <option value="">All Editions</option>
                    {sumEditions.map(ed => <option key={ed} value={ed}>{ed === '—' ? 'Unassigned' : ed}</option>)}
                  </select>
                  <select value={sumOs} onChange={e => setSumOs(e.target.value)}>
                    <option value="">All OS</option>
                    {sumOsCategories.map(os => <option key={os} value={os}>{os}</option>)}
                  </select>
                  {(sumSearch || sumEd || sumOs) && (
                    <button className="btn-sm" onClick={() => { setSumSearch(''); setSumEd(''); setSumOs(''); }}>Clear</button>
                  )}
                </div>
                <div style={{maxHeight:'440px',overflow:'auto'}}>
                  <table className="data-table" style={{fontSize:'0.82rem'}}>
                    <thead>
                      <tr>
                        <SumTh col="hostname" label="Server" />
                        <SumTh col="os_name" label="OS" />
                        <SumTh col="sockets" label="Sockets" />
                        <SumTh col="cores" label="Cores" />
                        <SumTh col="lc" label="Licensed Cores" />
                        <SumTh col="packs" label="2-Core Packs" />
                        <SumTh col="win" label="Win VMs" />
                        <SumTh col="tot" label="Total VMs" />
                        <SumTh col="edition" label="WS License" />
                      </tr>
                    </thead>
                    <tbody>
                      {displayRows.map(h => (
                        <tr key={h.id} className={h.license_override ? 'row-override' : ''}>
                          <td><strong>{h.hostname}</strong></td>
                          <td title={h.os_name} style={{fontSize:'0.78rem',maxWidth:'200px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{h.os_name || '—'}</td>
                          <td>{h.cpu_sockets}</td>
                          <td>{h.cpu_cores}</td>
                          <td style={{fontWeight:600}}>{h._lc}</td>
                          <td>{h._packs}</td>
                          <td style={{fontWeight:600,color: h._winVms > 0 ? 'var(--primary)' : 'var(--text-muted)'}}>{h._winVms}</td>
                          <td style={{color:'var(--text-secondary)'}}>{h._totVms}</td>
                          <td>
                            <select value={h.license_override || ''} onChange={e => setLicense(h.id, 'license_override', e.target.value)}>
                              <option value="">Auto ({h.license_assignment})</option>
                              <option value="Datacenter">Datacenter</option>
                              <option value="Standard">Standard</option>
                              <option value="None">None</option>
                              <option value="Vendor">Vendor</option>
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{fontWeight:700,borderTop:'2px solid var(--border)'}}>
                        <td>Total ({displayRows.length})</td>
                        <td></td>
                        <td></td>
                        <td>{physTotals.cores}</td>
                        <td>{physTotals.lc}</td>
                        <td>{physTotals.packs}</td>
                        <td>{physTotals.win}</td>
                        <td>{physTotals.tot}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <div style={{fontSize:'0.78rem',color:'var(--text-secondary)',marginTop:'0.4rem',lineHeight:1.5}}>
                  Each physical server licenses all cores once (min 16, 8 per socket). Change a server's WS License to move Datacenter/Standard licenses around — licensed cores and totals recompute on save.
                </div>
              </>
            )}
          </div>

          <div className="filter-bar">
            <input type="text" placeholder="Search hostname, IP, OS..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
            <select value={filterSource} onChange={e => { setFilterSource(e.target.value); setPage(1); }}>
              <option value="">All Sources</option>
              <option value="vcenter">vCenter</option>
              <option value="agent">Agent</option>
              <option value="winrm">WinRM</option>
              <option value="sccm">SCCM</option>
              <option value="scvmm">SCVMM</option>
            </select>
            <select value={filterType} onChange={e => { setFilterType(e.target.value); setPage(1); }}>
              <option value="">All Types</option>
              <option value="physical">Physical</option>
              <option value="virtual">VM</option>
            </select>
            <select value={filterOS} onChange={e => { setFilterOS(e.target.value); setPage(1); }}>
              <option value="">All OS</option>
              {osCategories.map(os => <option key={os} value={os}>{os}</option>)}
            </select>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th><input type="checkbox" onChange={e => setSelected(e.target.checked ? new Set(filtered.map(h=>h.id)) : new Set())} /></th>
                <th style={{cursor:'pointer'}} onClick={() => toggleSort('hostname')}>Hostname<SortIcon col="hostname" /></th>
                <th style={{cursor:'pointer'}} onClick={() => toggleSort('ip_address')}>IP<SortIcon col="ip_address" /></th>
                <th style={{cursor:'pointer'}} onClick={() => toggleSort('os_name')}>OS<SortIcon col="os_name" /></th>
                <th style={{cursor:'pointer'}} onClick={() => toggleSort('type')}>Type<SortIcon col="type" /></th>
                <th style={{cursor:'pointer'}} onClick={() => toggleSort('cpu_sockets')}>Sockets<SortIcon col="cpu_sockets" /></th>
                <th style={{cursor:'pointer'}} onClick={() => toggleSort('cpu_cores')}>Cores<SortIcon col="cpu_cores" /></th>
                <th style={{cursor:'pointer'}} onClick={() => toggleSort('cpu_model')}>Processor<SortIcon col="cpu_model" /></th>
                <th style={{cursor:'pointer'}} onClick={() => toggleSort('scan_source')}>Source<SortIcon col="scan_source" /></th>
                <th>WS License</th><th>SQL License</th>
                <th style={{cursor:'pointer'}} onClick={() => toggleSort('last_scan')}>Last Scan<SortIcon col="last_scan" /></th>
              </tr>
            </thead>
            <tbody>
              {pagedHosts.map(h => (
                <tr key={h.id} className={h.license_override ? 'row-override' : ''}>
                  <td><input type="checkbox" checked={selected.has(h.id)} onChange={e => { const s = new Set(selected); e.target.checked ? s.add(h.id) : s.delete(h.id); setSelected(s); }} /></td>
                  <td><strong>{h.hostname}</strong></td>
                  <td>{h.ip_address}</td>
                  <td title={h.os_name}>{(h.os_name||'').substring(0,30)}</td>
                  <td><Badge color={h.is_virtual ? 'blue' : 'gray'}>{h.is_virtual ? 'VM' : 'Physical'}</Badge></td>
                  <td>{h.cpu_sockets}</td>
                  <td>{h.cpu_cores}</td>
                  <td style={{fontSize:'0.78rem',maxWidth:'180px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}} title={h.cpu_model||''}>{h.is_virtual ? 'Virtual' : (h.cpu_model || '—')}</td>
                  <td><Badge color="purple">{h.scan_source}</Badge></td>
                  <td>
                    <select value={h.license_override || ''} onChange={e => setLicense(h.id, 'license_override', e.target.value)}>
                      <option value="">Auto ({h.license_assignment})</option>
                      <option value="Datacenter">Datacenter</option>
                      <option value="Standard">Standard</option>
                      <option value="None">None</option>
                      <option value="Vendor">Vendor</option>
                    </select>
                  </td>
                  <td>
                    <select value={h.sql_license_override || ''} onChange={e => setLicense(h.id, 'sql_license_override', e.target.value)}>
                      <option value="">Auto ({h.sql_license_assignment || '—'})</option>
                      <option value="Enterprise">Enterprise</option>
                      <option value="Standard">Standard</option>
                      <option value="None">None</option>
                      <option value="Vendor">Vendor</option>
                    </select>
                  </td>
                  <td>{h.last_scan ? new Date(h.last_scan).toLocaleDateString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="pagination">
            <button disabled={page <= 1} onClick={() => setPage(p => p-1)}>← Prev</button>
            <span>Page {page} of {totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => setPage(p => p+1)}>Next →</button>
          </div>
        </>
      )}
    </div>
  );
}

function InactiveHosts({ data, reload }) {
  const [selected, setSelected] = useState(new Set());
  if (!data) return <Spinner />;
  const hosts = data.hosts || [];
  const reactivate = async () => {
    await fetch(`${API}/hosts/reactivate`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ host_ids: [...selected] }) });
    setSelected(new Set());
    reload();
  };
  return (
    <div>
      <h3>Inactive Hosts ({hosts.length})</h3>
      {selected.size > 0 && <button onClick={reactivate} className="btn btn-primary">Reactivate Selected</button>}
      <table className="data-table">
        <thead><tr><th><input type="checkbox" onChange={e => setSelected(e.target.checked ? new Set(hosts.map(h=>h.id)) : new Set())} /></th><th>Hostname</th><th>IP</th><th>OS</th><th>Source</th><th>Last Scan</th></tr></thead>
        <tbody>{hosts.map(h => (
          <tr key={h.id}><td><input type="checkbox" checked={selected.has(h.id)} onChange={e => { const s = new Set(selected); e.target.checked ? s.add(h.id) : s.delete(h.id); setSelected(s); }} /></td>
          <td>{h.hostname}</td><td>{h.ip_address}</td><td>{h.os_name}</td><td>{h.scan_source}</td><td>{h.last_scan ? new Date(h.last_scan).toLocaleDateString() : '—'}</td></tr>
        ))}</tbody>
      </table>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// Compliance
// ════════════════════════════════════════════════════════════════
function Compliance() {
  const { data, loading } = useFetch('/compliance');
  if (loading || !data) return <Spinner />;
  const items = data.compliance || [];
  return (
    <div>
      <h1>Compliance Report</h1>
      {items.map((item, i) => (
        <div key={i} className={`compliance-card ${item.compliant ? 'compliant' : 'non-compliant'}`}>
          <div className="compliance-header">
            <h3>{item.product}</h3>
            <Badge color={item.compliant ? 'green' : 'red'}>{item.compliant ? 'Compliant' : 'Gap'}</Badge>
          </div>
          <div className="compliance-grid">
            <div><label>Required</label><span>{item.required_cores} cores ({item.required_2packs} 2-packs)</span></div>
            <div><label>Entitled</label><span>{item.entitled_cores} cores ({item.entitled_2packs} 2-packs)</span></div>
            {!item.compliant && <div className="gap"><label>Gap</label><span className="text-red">{item.gap_cores} cores ({item.gap_2packs} 2-packs)</span></div>}
            <div><label>Physical</label><span>{item.physical_hosts}</span></div>
            <div><label>Virtual</label><span>{item.virtual_hosts}</span></div>
          </div>
          {item.note && <div className="compliance-note">{item.note}</div>}
          {item.host_details && item.host_details.length > 0 && (
            <details><summary>Host Details ({item.host_details.length})</summary>
              <table className="data-table compact">
                <thead><tr><th>Host</th><th>Type</th><th>Sockets</th><th>Cores</th><th>Licensed</th><th>2-Packs</th></tr></thead>
                <tbody>{item.host_details.map((d,j) => (
                  <tr key={j}><td>{d.hostname}</td><td>{d.type}</td><td>{d.sockets}</td><td>{d.physical_cores}</td><td>{d.licensed_cores}</td><td>{d.two_core_packs}</td></tr>
                ))}</tbody>
              </table>
            </details>
          )}
        </div>
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// Entitlements
// ════════════════════════════════════════════════════════════════
// Standard MS EA part numbers — the stuff that shows up on every EA true-up
const MS_PARTS = [
  { part: '9GS-00495', desc: 'CIS Suite Datacenter Core ALng LSA 2L', family: 'WindowsServer', edition: 'Datacenter', type: 'core_2pack' },
  { part: '9GA-00006', desc: 'CIS Suite Standard Core ALng LSA 2L', family: 'WindowsServer', edition: 'Standard', type: 'core_2pack' },
  { part: '7JQ-00341', desc: 'SQL Server Enterprise Core ALng LSA 2L', family: 'SQLServer', edition: 'Enterprise', type: 'core_2pack' },
  { part: '7NQ-00302', desc: 'SQL Server Standard Core ALng LSA 2L', family: 'SQLServer', edition: 'Standard', type: 'core_2pack' },
  { part: 'R39-00374', desc: 'Win Server External Connector ALng LSA', family: 'WindowsServer', edition: 'ExternalConnector', type: 'core' },
  { part: '6ZH-00477', desc: 'System Center Standard Core ALng LSA 2L', family: 'SystemCenter', edition: 'Standard', type: 'core_2pack' },
  { part: '9EP-00352', desc: 'System Center Datacenter Core ALng LSA 2L', family: 'SystemCenter', edition: 'Datacenter', type: 'core_2pack' },
  { part: '228-04437', desc: 'SQL Server CAL ALng LSA Device', family: 'SQLServer', edition: 'Standard', type: 'cal_device' },
  { part: '6VC-01251', desc: 'Win Server CAL ALng LSA Device', family: 'WindowsServer', edition: 'Standard', type: 'cal_device' },
  { part: '6VC-01252', desc: 'Win Server CAL ALng LSA User', family: 'WindowsServer', edition: 'Standard', type: 'cal_user' },
  { part: 'R18-03499', desc: 'Win Server RDS CAL ALng LSA Device', family: 'WindowsServer', edition: 'RDS', type: 'cal_device' },
  { part: 'R18-03500', desc: 'Win Server RDS CAL ALng LSA User', family: 'WindowsServer', edition: 'RDS', type: 'cal_user' },
];

function Entitlements() {
  const { data, loading, reload } = useFetch('/entitlements');
  const { data: agrData, loading: agrLoading, reload: agrReload } = useFetch('/agreements');
  const [editing, setEditing] = useState({});   // keyed by `agrId|family|edition|type`
  const [saving, setSaving] = useState(false);
  const [customForm, setCustomForm] = useState(null);
  const [agrForm, setAgrForm] = useState(null);
  const [expanded, setExpanded] = useState({});  // which agreement cards are expanded

  const agreements = agrData?.agreements || [];
  const ents = data?.entitlements || [];

  const isExpired = (d) => d && new Date(d) < new Date();
  const daysUntil = (d) => d ? Math.ceil((new Date(d) - new Date()) / 86400000) : null;

  const saveAgreement = async () => {
    try {
      const method = agrForm.id ? 'PUT' : 'POST';
      const url = agrForm.id ? `${API}/agreements/${agrForm.id}` : `${API}/agreements`;
      const res = await fetch(url, { method, headers: {'Content-Type':'application/json'}, body: JSON.stringify(agrForm) });
      if (!res.ok) { const err = await res.text(); alert('Save failed: ' + err); return; }
      const result = await res.json();
      if (!agrForm.id && result.id) setExpanded(prev => ({...prev, [result.id]: true}));
      if (agrForm.id) setExpanded(prev => ({...prev, [agrForm.id]: true}));
      setAgrForm(null); agrReload(); reload();
    } catch (e) { alert('Save failed: ' + e.message); }
  };

  const deleteAgreement = async (id) => {
    if (!confirm('Delete this agreement? Entitlements linked to it will be unlinked.')) return;
    await fetch(`${API}/agreements/${id}`, { method: 'DELETE' }); agrReload(); reload();
  };

  const toggle = (id) => setExpanded(prev => ({...prev, [id]: !prev[id]}));

  // Build entitlement lookup per agreement: agrId → { "family|edition|type" → entitlement }
  const entsByAgr = {};
  ents.forEach(e => {
    const aid = e.agreement_id || 0;
    if (!entsByAgr[aid]) entsByAgr[aid] = {};
    const key = `${e.product_family}|${e.edition}|${e.license_type}`;
    entsByAgr[aid][key] = e;
  });

  const eKey = (agrId, part) => `${agrId}|${part.family}|${part.edition}|${part.type}`;

  const getQty = (agrId, part) => {
    const k = eKey(agrId, part);
    if (editing[k] !== undefined) return editing[k];
    const map = entsByAgr[agrId] || {};
    const existing = map[`${part.family}|${part.edition}|${part.type}`];
    return existing ? existing.quantity : 0;
  };

  const setQty = (agrId, part, val) => {
    setEditing(prev => ({...prev, [eKey(agrId, part)]: parseInt(val) || 0}));
  };

  const saveAll = async () => {
    setSaving(true);
    for (const [k, qty] of Object.entries(editing)) {
      const [agrIdStr, family, edition, type] = k.split('|');
      const agrId = parseInt(agrIdStr);
      const map = entsByAgr[agrId] || {};
      const existing = map[`${family}|${edition}|${type}`];
      const partInfo = MS_PARTS.find(p => p.family === family && p.edition === edition && p.type === type);
      const productName = partInfo ? partInfo.desc : `${family} ${edition}`;
      const partNumber = partInfo ? partInfo.part : '';
      const body = {
        product_name: productName, product_family: family, edition, license_type: type,
        quantity: qty, agreement_id: agrId || null, part_number: partNumber,
        ...(existing ? { agreement_number: existing.agreement_number, agreement_type: existing.agreement_type,
          effective_date: existing.effective_date, expiry_date: existing.expiry_date,
          sa_included: existing.sa_included, notes: existing.notes } : {})
      };
      if (existing) {
        if (qty === 0) {
          await fetch(`${API}/entitlements/${existing.id}`, { method: 'DELETE' });
        } else {
          await fetch(`${API}/entitlements/${existing.id}`, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) });
        }
      } else if (qty > 0) {
        await fetch(`${API}/entitlements`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) });
      }
    }
    setEditing({}); setSaving(false); reload();
  };

  const saveCustom = async () => {
    const method = customForm.id ? 'PUT' : 'POST';
    const url = customForm.id ? `${API}/entitlements/${customForm.id}` : `${API}/entitlements`;
    await fetch(url, { method, headers: {'Content-Type':'application/json'}, body: JSON.stringify(customForm) });
    setCustomForm(null); reload();
  };

  const del = async (id) => {
    if (!confirm('Delete this entitlement?')) return;
    await fetch(`${API}/entitlements/${id}`, { method: 'DELETE' }); reload();
  };

  if (loading || agrLoading || !data || !agrData) return <Spinner />;

  const standardKeys = new Set(MS_PARTS.map(p => `${p.family}|${p.edition}|${p.type}`));
  const customEnts = ents.filter(e => !standardKeys.has(`${e.product_family}|${e.edition}|${e.license_type}`));
  const hasChanges = Object.keys(editing).length > 0;

  // Render the part number table for a given agreement ID
  const renderPartsTable = (agrId) => {
    const map = entsByAgr[agrId] || {};
    return (
      <table className="data-table" style={{marginTop:'0.5rem',fontSize:'0.85rem'}}>
        <thead>
          <tr><th>Part #</th><th>Description</th><th>Product</th><th>Edition</th><th>Type</th><th style={{width:'80px'}}>Qty</th></tr>
        </thead>
        <tbody>
          {MS_PARTS.map(p => {
            const pkey = `${p.family}|${p.edition}|${p.type}`;
            const existing = map[pkey];
            const qty = getQty(agrId, p);
            const changed = editing[eKey(agrId, p)] !== undefined && editing[eKey(agrId, p)] !== (existing?.quantity || 0);
            return (
              <tr key={p.part} style={changed ? {background:'#ecfeff'} : qty > 0 ? {background:'#f8fafc'} : {}}>
                <td><code style={{fontSize:'0.8rem'}}>{p.part}</code></td>
                <td style={{fontSize:'0.78rem',color:'var(--text-secondary)'}}>{p.desc}</td>
                <td>{p.family === 'WindowsServer' ? 'Win Server' : p.family === 'SQLServer' ? 'SQL Server' : p.family}</td>
                <td>{p.edition}</td>
                <td>{p.type === 'core_2pack' ? '2-Pack' : p.type === 'cal_device' ? 'CAL Dev' : p.type === 'cal_user' ? 'CAL Usr' : p.type}</td>
                <td>
                  <input type="number" min="0" value={qty} onChange={e => setQty(agrId, p, e.target.value)}
                    style={{width:'70px',padding:'0.3rem 0.4rem',textAlign:'center',fontWeight:qty > 0 ? 600 : 400,fontSize:'0.85rem'}} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  };

  return (
    <div>
      <div className="page-header">
        <h1>Entitlements</h1>
        <div className="header-actions">
          {hasChanges && <button className="btn btn-primary" onClick={saveAll} disabled={saving}>{saving ? 'Saving...' : 'Save All Changes'}</button>}
          <button className="btn btn-secondary" onClick={() => setAgrForm({ name:'', agreement_number:'', agreement_type:'EA', start_date:'', expiry_date:'', notes:'' })}>+ Add Agreement</button>
        </div>
      </div>

      {agreements.length === 0 ? (
        <div className="card" style={{textAlign:'center',padding:'2.5rem',color:'var(--text-secondary)'}}>
          <div style={{fontSize:'1.1rem',marginBottom:'0.5rem'}}>No Enterprise Agreements</div>
          <div style={{fontSize:'0.85rem'}}>Add an agreement to start tracking license counts and expiry dates.</div>
        </div>
      ) : (
        <div style={{display:'grid',gap:'0.75rem'}}>
          {agreements.map(a => {
            const expired = isExpired(a.expiry_date);
            const days = daysUntil(a.expiry_date);
            const expiring = days !== null && days > 0 && days <= 90;
            const isOpen = expanded[a.id];
            const linkedEnts = ents.filter(e => e.agreement_id === a.id);
            const totalLicenses = linkedEnts.reduce((s, e) => s + (e.quantity || 0), 0);
            return (
              <div key={a.id} className="card" style={{
                border: expired ? '1px solid #ef4444' : expiring ? '1px solid #f59e0b' : '1px solid var(--border)',
                padding: 0, overflow: 'hidden'
              }}>
                {/* Agreement header — click to expand */}
                <div style={{padding:'0.75rem 1rem',cursor:'pointer',display:'flex',justifyContent:'space-between',alignItems:'center',
                  background: expired ? '#fef2f2' : expiring ? '#fffbeb' : 'var(--bg-card)'}}
                  onClick={() => toggle(a.id)}>
                  <div style={{flex:1}}>
                    <div style={{display:'flex',alignItems:'center',gap:'0.5rem',marginBottom:'0.2rem'}}>
                      <span style={{fontSize:'0.85rem',color:'var(--text-secondary)',transition:'transform 0.15s',transform:isOpen?'rotate(90deg)':'rotate(0)'}}>&#9654;</span>
                      <strong style={{fontSize:'1rem'}}>{a.name}</strong>
                      <span className="badge" style={{background: expired ? '#fef2f2' : expiring ? '#fffbeb' : '#f0fdf4', color: expired ? '#dc2626' : expiring ? '#d97706' : '#16a34a', fontSize:'0.7rem'}}>
                        {expired ? 'EXPIRED' : expiring ? `${days}d left` : days !== null ? 'Active' : 'No expiry'}
                      </span>
                      {totalLicenses > 0 && <span className="badge" style={{background:'#eff6ff',color:'#2563eb',fontSize:'0.7rem'}}>{totalLicenses} licenses</span>}
                    </div>
                    <div style={{fontSize:'0.8rem',color:'var(--text-secondary)',display:'flex',gap:'1.25rem',flexWrap:'wrap',marginLeft:'1.2rem'}}>
                      {a.agreement_number && <span>Enrollment: <strong>{a.agreement_number}</strong></span>}
                      <span>Type: {a.agreement_type || 'EA'}</span>
                      {a.start_date && <span>Start: {a.start_date}</span>}
                      {a.expiry_date && <span>Expiry: <strong style={{color: expired ? '#dc2626' : expiring ? '#d97706' : 'inherit'}}>{a.expiry_date}</strong></span>}
                    </div>
                  </div>
                  <div style={{display:'flex',gap:'0.5rem'}} onClick={e => e.stopPropagation()}>
                    <button className="btn-sm" onClick={() => setAgrForm({...a})}>Edit</button>
                    <button className="btn-sm btn-danger" onClick={() => deleteAgreement(a.id)}>Delete</button>
                  </div>
                </div>

                {/* Expanded: license count table */}
                {isOpen && (
                  <div style={{padding:'0 1rem 1rem',borderTop:'1px solid var(--border)'}}>
                    {a.notes && <div style={{fontSize:'0.8rem',color:'var(--text-tertiary)',padding:'0.5rem 0'}}>{a.notes}</div>}
                    {renderPartsTable(a.id)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Unlinked / custom entitlements */}
      {customEnts.length > 0 && (
        <div style={{marginTop:'1.5rem'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'0.5rem'}}>
            <h2 style={{fontSize:'1rem'}}>Custom Entitlements (not linked to an agreement)</h2>
            <button className="btn btn-secondary" onClick={() => setCustomForm({ product_name: '', product_family: 'WindowsServer', edition: 'Standard', license_type: 'core_2pack', quantity: 1, agreement_id: '' })}>+ Add Custom</button>
          </div>
          <table className="data-table">
            <thead><tr><th>Product</th><th>Family</th><th>Edition</th><th>Type</th><th>Qty</th><th>Actions</th></tr></thead>
            <tbody>{customEnts.map(e => (
              <tr key={e.id}><td>{e.product_name}</td><td>{e.product_family}</td><td>{e.edition}</td><td>{e.license_type}</td><td>{e.quantity}</td>
              <td><button className="btn-sm" onClick={() => setCustomForm({...e})}>Edit</button> <button className="btn-sm btn-danger" onClick={() => del(e.id)}>Delete</button></td></tr>
            ))}</tbody>
          </table>
        </div>
      )}

      {/* Agreement modal */}
      {agrForm && (
        <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) setAgrForm(null); }}>
          <div className="modal">
            <h3>{agrForm.id ? 'Edit' : 'Add'} Enterprise Agreement</h3>
            <div className="form-grid">
              <label>Agreement Name<input value={agrForm.name} onChange={e => setAgrForm({...agrForm, name: e.target.value})} placeholder="e.g. Gundersen EA 2024-2027" /></label>
              <label>Enrollment Number<input value={agrForm.agreement_number||''} onChange={e => setAgrForm({...agrForm, agreement_number: e.target.value})} placeholder="e.g. 12345678" /></label>
              <label>Type<select value={agrForm.agreement_type||'EA'} onChange={e => setAgrForm({...agrForm, agreement_type: e.target.value})}>
                <option value="EA">Enterprise Agreement (EA)</option><option value="EAS">EA Subscription</option><option value="SCE">Server & Cloud Enrollment</option><option value="CSP">Cloud Solution Provider</option><option value="MPSA">MPSA</option>
              </select></label>
              <label>Start Date<input type="date" value={agrForm.start_date||''} onChange={e => setAgrForm({...agrForm, start_date: e.target.value})} /></label>
              <label>Expiry Date<input type="date" value={agrForm.expiry_date||''} onChange={e => setAgrForm({...agrForm, expiry_date: e.target.value})} /></label>
              <label style={{gridColumn:'1/-1'}}>Notes<textarea value={agrForm.notes||''} onChange={e => setAgrForm({...agrForm, notes: e.target.value})} rows={2} /></label>
            </div>
            <div className="modal-actions"><button className="btn btn-primary" onClick={saveAgreement}>Save</button><button className="btn btn-secondary" onClick={() => setAgrForm(null)}>Cancel</button></div>
          </div>
        </div>
      )}

      {/* Custom entitlement modal */}
      {customForm && (
        <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) setCustomForm(null); }}>
          <div className="modal">
            <h3>{customForm.id ? 'Edit' : 'Add'} Custom Entitlement</h3>
            <div className="form-grid">
              <label>Product Name<input value={customForm.product_name} onChange={e => setCustomForm({...customForm, product_name: e.target.value})} /></label>
              <label>Family<select value={customForm.product_family||''} onChange={e => setCustomForm({...customForm, product_family: e.target.value})}>
                <option value="WindowsServer">Windows Server</option><option value="SQLServer">SQL Server</option><option value="SystemCenter">System Center</option><option value="Office">Office</option><option value="Other">Other</option>
              </select></label>
              <label>Edition<input value={customForm.edition||''} onChange={e => setCustomForm({...customForm, edition: e.target.value})} /></label>
              <label>License Type<select value={customForm.license_type||''} onChange={e => setCustomForm({...customForm, license_type: e.target.value})}>
                <option value="core_2pack">Core 2-Pack</option><option value="core">Core</option><option value="cal_device">CAL (Device)</option><option value="cal_user">CAL (User)</option>
              </select></label>
              <label>Quantity<input type="number" value={customForm.quantity} onChange={e => setCustomForm({...customForm, quantity: parseInt(e.target.value)||0})} /></label>
              <label>Agreement<select value={customForm.agreement_id||''} onChange={e => setCustomForm({...customForm, agreement_id: e.target.value ? parseInt(e.target.value) : null})}>
                <option value="">— None —</option>
                {agreements.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select></label>
              <label>Notes<input value={customForm.notes||''} onChange={e => setCustomForm({...customForm, notes: e.target.value})} /></label>
            </div>
            <div className="modal-actions"><button className="btn btn-primary" onClick={saveCustom}>Save</button><button className="btn btn-secondary" onClick={() => setCustomForm(null)}>Cancel</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// Scanners (targets, credentials, vCenter, scan history)
// ════════════════════════════════════════════════════════════════
function Scanners() {
  const [tab, setTab] = useState('targets');
  return (
    <div>
      <h1>Scanners</h1>
      <div className="tab-bar">
        {['targets','credentials','vcenter','sccm','history'].map(t => (
          <button key={t} className={`tab ${tab===t?'active':''}`} onClick={() => setTab(t)}>{t.charAt(0).toUpperCase()+t.slice(1)}</button>
        ))}
        <button className="btn btn-primary" style={{marginLeft:'auto'}} onClick={async () => { await fetch(`${API}/scans/trigger`, {method:'POST', headers:{'Content-Type':'application/json'}, body:'{}'}); alert('Scan triggered'); }}>
          Run Scan Now
        </button>
      </div>
      {tab === 'targets' && <TargetsTab />}
      {tab === 'credentials' && <CredentialsTab />}
      {tab === 'vcenter' && <VCenterTab />}
      {tab === 'sccm' && <SCCMTab />}
      {tab === 'history' && <ScanHistory />}
    </div>
  );
}

function TargetsTab() {
  const { data, loading, reload } = useFetch('/targets');
  const [newHost, setNewHost] = useState('');
  const [scanType, setScanType] = useState('winrm');

  const add = async () => {
    if (!newHost.trim()) return;
    // Support multi-line paste
    const lines = newHost.split(/[\n,;]+/).map(l => l.trim()).filter(Boolean);
    if (lines.length > 1) {
      await fetch(`${API}/targets/bulk`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hostnames: lines, scan_type: scanType }) });
    } else {
      await fetch(`${API}/targets`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hostname: lines[0], scan_type: scanType }) });
    }
    setNewHost(''); reload();
  };

  const del = async (id) => { await fetch(`${API}/targets/${id}`, { method: 'DELETE' }); reload(); };
  if (loading || !data) return <Spinner />;
  const targets = data.targets || [];

  return (
    <div>
      <div className="input-row">
        <textarea value={newHost} onChange={e => setNewHost(e.target.value)} placeholder="Hostname, IP, or subnet (one per line)" rows={2} />
        <select value={scanType} onChange={e => setScanType(e.target.value)}><option value="winrm">WinRM</option><option value="snmp">SNMP</option></select>
        <button className="btn btn-primary" onClick={add}>Add</button>
      </div>
      <table className="data-table">
        <thead><tr><th>Hostname</th><th>Type</th><th>Subnet</th><th>Enabled</th><th>Actions</th></tr></thead>
        <tbody>{targets.map(t => (
          <tr key={t.id}><td>{t.hostname}</td><td>{t.scan_type}</td><td>{t.is_subnet ? 'Yes' : ''}</td><td>{t.enabled ? '✓' : '✗'}</td>
          <td><button className="btn-sm btn-danger" onClick={() => del(t.id)}>Delete</button></td></tr>
        ))}</tbody>
      </table>
    </div>
  );
}

function CredentialsTab() {
  const { data, loading, reload } = useFetch('/credentials');
  const [form, setForm] = useState(null);

  const save = async () => {
    const method = form.id ? 'PUT' : 'POST';
    const url = form.id ? `${API}/credentials/${form.id}` : `${API}/credentials`;
    await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    setForm(null); reload();
  };

  if (loading || !data) return <Spinner />;
  return (
    <div>
      <button className="btn btn-primary" onClick={() => setForm({ name: '', cred_type: 'winrm', username: '', password: '', domain: '', transport: 'ntlm' })}>+ Add Credential</button>
      <table className="data-table">
        <thead><tr><th>Name</th><th>Type</th><th>Username</th><th>Domain</th><th>Actions</th></tr></thead>
        <tbody>{(data.credentials||[]).map(c => (
          <tr key={c.id}><td>{c.name}</td><td>{c.cred_type}</td><td>{c.username}</td><td>{c.domain}</td>
          <td><button className="btn-sm" onClick={async () => { const raw = await fetch(`${API}/credentials/${c.id}/raw`).then(r=>r.json()); setForm(raw); }}>Edit</button></td></tr>
        ))}</tbody>
      </table>
      {form && (
        <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) setForm(null); }}>
          <div className="modal">
            <h3>{form.id ? 'Edit' : 'Add'} Credential</h3>
            <div className="form-grid">
              <label>Name<input value={form.name} onChange={e => setForm({...form, name: e.target.value})} /></label>
              <label>Type<select value={form.cred_type} onChange={e => setForm({...form, cred_type: e.target.value})}><option value="winrm">WinRM</option><option value="vcenter">vCenter</option><option value="sccm">SCCM</option><option value="snmp">SNMP</option></select></label>
              <label>Username<input value={form.username||''} onChange={e => setForm({...form, username: e.target.value})} /></label>
              <label>Password<input type="password" value={form.password||''} onChange={e => setForm({...form, password: e.target.value})} /></label>
              <label>Domain<input value={form.domain||''} onChange={e => setForm({...form, domain: e.target.value})}
                disabled={/[@\\]/.test(form.username||'')} placeholder={/[@\\]/.test(form.username||'')?'Domain included in username':''} /></label>
            </div>
            <div className="modal-actions"><button className="btn btn-primary" onClick={save}>Save</button><button className="btn btn-secondary" onClick={() => setForm(null)}>Cancel</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

function VCenterTab() {
  const { data, loading, reload } = useFetch('/vcenter-instances');
  const creds = useFetch('/credentials');
  const [form, setForm] = useState(null);

  const save = async () => {
    const method = form.id ? 'PUT' : 'POST';
    const url = form.id ? `${API}/vcenter-instances/${form.id}` : `${API}/vcenter-instances`;
    await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    setForm(null); reload();
  };

  const del = async (id) => { await fetch(`${API}/vcenter-instances/${id}`, { method: 'DELETE' }); reload(); };

  if (loading || !data) return <Spinner />;
  const vcCreds = (creds.data?.credentials || []).filter(c => c.cred_type === 'vcenter');
  return (
    <div>
      <button className="btn btn-primary" onClick={() => setForm({ name: '', hostname: '', credential_id: null, enabled: true })}>+ Add vCenter</button>
      <table className="data-table">
        <thead><tr><th>Name</th><th>Hostname</th><th>Credential</th><th>Enabled</th><th>Last Scan</th><th>Hosts</th><th>VMs</th><th>Actions</th></tr></thead>
        <tbody>{(data.instances||[]).map(v => (
          <tr key={v.id}><td>{v.name}</td><td>{v.hostname}</td><td>{v.credential_name||'—'}</td><td>{v.enabled?'✓':'✗'}</td>
          <td>{v.last_scan ? new Date(v.last_scan).toLocaleDateString() : '—'}</td><td>{v.hosts_found}</td><td>{v.vms_found}</td>
          <td><button className="btn-sm" onClick={() => setForm({...v})}>Edit</button> <button className="btn-sm btn-danger" onClick={() => del(v.id)}>Delete</button></td></tr>
        ))}</tbody>
      </table>
      {form && (
        <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) setForm(null); }}>
          <div className="modal">
            <h3>{form.id ? 'Edit' : 'Add'} vCenter</h3>
            <div className="form-grid">
              <label>Name<input value={form.name} onChange={e => setForm({...form, name: e.target.value})} /></label>
              <label>Hostname<input value={form.hostname} onChange={e => setForm({...form, hostname: e.target.value})} /></label>
              <label>Credential<select value={form.credential_id||''} onChange={e => setForm({...form, credential_id: parseInt(e.target.value)||null})}>
                <option value="">Use global settings</option>
                {vcCreds.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select></label>
              <label className="checkbox-label"><input type="checkbox" checked={form.enabled} onChange={e => setForm({...form, enabled: e.target.checked})} /> Enabled</label>
            </div>
            <div className="modal-actions"><button className="btn btn-primary" onClick={save}>Save</button><button className="btn btn-secondary" onClick={() => setForm(null)}>Cancel</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

function SCCMTab() {
  const { data, loading, reload } = useFetch('/sccm-instances');
  const creds = useFetch('/credentials');
  const [form, setForm] = useState(null);

  const save = async () => {
    const method = form.id ? 'PUT' : 'POST';
    const url = form.id ? `${API}/sccm-instances/${form.id}` : `${API}/sccm-instances`;
    await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    setForm(null); reload();
  };

  const del = async (id) => { await fetch(`${API}/sccm-instances/${id}`, { method: 'DELETE' }); reload(); };

  if (loading || !data) return <Spinner />;
  const sccmCreds = (creds.data?.credentials || []).filter(c => c.cred_type === 'sccm');
  return (
    <div>
      <button className="btn btn-primary" onClick={() => setForm({ name: '', server_url: '', credential_id: null, verify_ssl: true, enabled: true, notes: '' })}>+ Add SCCM</button>
      <table className="data-table">
        <thead><tr><th>Name</th><th>Server URL</th><th>Credential</th><th>Enabled</th><th>Last Scan</th><th>Hosts Found</th><th>Actions</th></tr></thead>
        <tbody>{(data.instances||[]).map(v => (
          <tr key={v.id}><td>{v.name}</td><td>{v.server_url}</td><td>{v.credential_name||'—'}</td><td>{v.enabled?'✓':'✗'}</td>
          <td>{v.last_scan ? new Date(v.last_scan).toLocaleDateString() : '—'}</td><td>{v.hosts_found}</td>
          <td><button className="btn-sm" onClick={() => setForm({...v})}>Edit</button> <button className="btn-sm btn-danger" onClick={() => del(v.id)}>Delete</button></td></tr>
        ))}</tbody>
      </table>
      {form && (
        <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) setForm(null); }}>
          <div className="modal">
            <h3>{form.id ? 'Edit' : 'Add'} SCCM Instance</h3>
            <div className="form-grid">
              <label>Name<input value={form.name} onChange={e => setForm({...form, name: e.target.value})} /></label>
              <label>Server URL<input value={form.server_url} onChange={e => setForm({...form, server_url: e.target.value})} /></label>
              <label>Credential<select value={form.credential_id||''} onChange={e => setForm({...form, credential_id: parseInt(e.target.value)||null})}>
                <option value="">Use global settings</option>
                {sccmCreds.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select></label>
              <label className="checkbox-label"><input type="checkbox" checked={form.verify_ssl} onChange={e => setForm({...form, verify_ssl: e.target.checked})} /> Verify SSL</label>
              <label className="checkbox-label"><input type="checkbox" checked={form.enabled} onChange={e => setForm({...form, enabled: e.target.checked})} /> Enabled</label>
              <label>Notes<input value={form.notes||''} onChange={e => setForm({...form, notes: e.target.value})} /></label>
            </div>
            <div className="modal-actions"><button className="btn btn-primary" onClick={save}>Save</button><button className="btn btn-secondary" onClick={() => setForm(null)}>Cancel</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

function ScanHistory() {
  const { data, loading } = useFetch('/scans');
  if (loading || !data) return <Spinner />;
  return (
    <table className="data-table">
      <thead><tr><th>ID</th><th>Type</th><th>Started</th><th>Completed</th><th>Scanned</th><th>Failed</th><th>Status</th></tr></thead>
      <tbody>{(data.scans||[]).map(s => (
        <tr key={s.id}><td>{s.id}</td><td>{s.scan_type}</td><td>{new Date(s.started_at).toLocaleString()}</td>
        <td>{s.completed_at ? new Date(s.completed_at).toLocaleString() : '—'}</td><td>{s.hosts_scanned}</td><td>{s.hosts_failed}</td>
        <td><Badge color={s.status==='completed'?'green':s.status==='error'?'red':'yellow'}>{s.status}</Badge></td></tr>
      ))}</tbody>
    </table>
  );
}

// ════════════════════════════════════════════════════════════════
// Settings
// ════════════════════════════════════════════════════════════════
function Settings() {
  const { data, loading, reload } = useFetch('/settings');
  const [edits, setEdits] = useState({});

  const save = async () => {
    await fetch(`${API}/settings`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ settings: edits }) });
    setEdits({}); reload();
  };

  if (loading || !data) return <Spinner />;
  const settings = data.settings || [];
  const categories = [...new Set(settings.map(s => s.category))];

  return (
    <div>
      <div className="page-header">
        <h1>Settings</h1>
        <button className="btn btn-primary" onClick={save} disabled={!Object.keys(edits).length}>Save Changes</button>
      </div>
      {categories.map(cat => (
        <div key={cat} className="settings-section">
          <h3>{cat.charAt(0).toUpperCase() + cat.slice(1)}</h3>
          {settings.filter(s => s.category === cat).map(s => {
            const val = edits[s.key] !== undefined ? edits[s.key] : s.value;
            const isToggle = s.key.endsWith('_enabled') || s.key === 'sccm_verify_ssl';
            return (
              <div key={s.key} className="setting-row">
                <label>{s.description || s.key}</label>
                {isToggle ? (
                  <button
                    className={`toggle-btn ${val === 'true' ? 'toggle-on' : 'toggle-off'}`}
                    style={{
                      padding: '0.4rem 1.2rem', borderRadius: '3px', border: 'none', cursor: 'pointer', fontWeight: 600,
                      background: val === 'true' ? '#22c55e' : '#e5e7eb', color: val === 'true' ? '#fff' : '#374151',
                      transition: 'all 0.2s'
                    }}
                    onClick={() => setEdits({...edits, [s.key]: val === 'true' ? 'false' : 'true'})}
                  >{val === 'true' ? 'Enabled' : 'Disabled'}</button>
                ) : (
                  <input type={s.sensitive ? 'password' : 'text'} value={val}
                    onChange={e => setEdits({...edits, [s.key]: e.target.value})} />
                )}
              </div>
            );
          })}
        </div>
      ))}
      <ApiKeysSection />
    </div>
  );
}

function ApiKeysSection() {
  const { data, loading, reload } = useFetch('/api-keys');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', expires_at: '' });
  const [newKey, setNewKey] = useState(null);

  const create = async () => {
    const res = await fetch(`${API}/api-keys`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: form.name, description: form.description, expires_at: form.expires_at || null }) });
    const d = await res.json();
    if (d.key) { setNewKey(d.key); setShowCreate(false); setForm({ name: '', description: '', expires_at: '' }); reload(); }
  };

  const expire = async (id) => {
    if (!confirm('Expire this key? Scripts using it will stop working.')) return;
    await fetch(`${API}/api-keys/${id}/expire`, { method: 'POST' }); reload();
  };

  const remove = async (id) => {
    if (!confirm('Permanently delete this key?')) return;
    await fetch(`${API}/api-keys/${id}`, { method: 'DELETE' }); reload();
  };

  const [copied, setCopied] = useState(false);
  const copyKey = () => {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(newKey).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
    } else {
      const ta = document.createElement('textarea');
      ta.value = newKey; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select(); document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) return null;
  const keys = data?.api_keys || [];

  return (
    <div className="settings-section">
      <h3>API Keys</h3>
      <p style={{color:'var(--text-secondary,#666)',marginBottom:'0.75rem'}}>Manage keys for agent and SCVMM collection scripts.</p>

      {newKey && (
        <div className="info-box" style={{marginBottom:'1rem',background:'#e8f5e9',border:'1px solid #4caf50'}}>
          <strong>New key created — copy now, it won't be shown again:</strong><br />
          <code style={{wordBreak:'break-all'}}>{newKey}</code><br />
          <button className="btn btn-secondary" onClick={copyKey} style={{marginTop:'0.5rem'}}>{copied ? '✓ Copied!' : 'Copy to Clipboard'}</button>
          <button className="btn btn-secondary" onClick={() => setNewKey(null)} style={{marginTop:'0.5rem',marginLeft:'0.5rem'}}>Dismiss</button>
        </div>
      )}

      <button className="btn btn-primary" onClick={() => setShowCreate(!showCreate)} style={{marginBottom:'1rem'}}>+ Create API Key</button>

      {showCreate && (
        <div className="card" style={{padding:'1rem',marginBottom:'1rem'}}>
          <div className="form-grid">
            <label>Name *<input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g. Production Agents" /></label>
            <label>Description<input value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="e.g. Used by GPO-deployed agents" /></label>
            <label>Expires (optional)<input type="date" value={form.expires_at} onChange={e => setForm({...form, expires_at: e.target.value})} /></label>
          </div>
          <div style={{marginTop:'0.75rem'}}>
            <button className="btn btn-primary" onClick={create} disabled={!form.name.trim()}>Create Key</button>
            <button className="btn btn-secondary" onClick={() => setShowCreate(false)} style={{marginLeft:'0.5rem'}}>Cancel</button>
          </div>
        </div>
      )}

      {keys.length > 0 ? (
        <table className="data-table">
          <thead><tr><th>Name</th><th>Description</th><th>Key Prefix</th><th>Status</th><th>Last Used</th><th>Uses</th><th>Expires</th><th>Actions</th></tr></thead>
          <tbody>{keys.map(k => (
            <tr key={k.id} style={k.status !== 'active' ? {opacity:0.5} : {}}>
              <td><strong>{k.name}</strong></td>
              <td>{k.description || '—'}</td>
              <td><code>{k.key_prefix}...</code></td>
              <td><span className={`badge badge-${k.status === 'active' ? 'green' : 'red'}`}>{k.status}</span></td>
              <td>{k.last_used_at ? new Date(k.last_used_at).toLocaleDateString() : 'Never'}</td>
              <td>{k.use_count}</td>
              <td>{k.expires_at ? new Date(k.expires_at).toLocaleDateString() : 'Never'}</td>
              <td>
                {k.status === 'active' && <button className="btn-sm" onClick={() => expire(k.id)}>Expire</button>}
                <button className="btn-sm" onClick={() => remove(k.id)} style={{marginLeft:'0.25rem',color:'#e53935'}}>Delete</button>
              </td>
            </tr>
          ))}</tbody>
        </table>
      ) : <p style={{color:'#999'}}>No API keys yet. Create one to use with collection scripts.</p>}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// Scripts (download collection scripts)
// ════════════════════════════════════════════════════════════════
function ScriptsPage() {
  const { data, loading } = useFetch('/scripts');
  const [selectedKey, setSelectedKey] = useState('');

  if (loading || !data) return <Spinner />;

  const download = (scriptId) => {
    const params = selectedKey ? `?key=${encodeURIComponent(selectedKey)}` : '';
    window.open(`${API}/scripts/${scriptId}/download${params}`);
  };

  return (
    <div>
      <div className="page-header">
        <h1>Collection Scripts</h1>
      </div>
      <p style={{marginBottom:'1rem',color:'var(--text-secondary,#666)'}}>Download pre-configured PowerShell scripts for inventory collection. Scripts are automatically configured with your server URL and the API key you select below.</p>

      <div className="card" style={{padding:'1rem',marginBottom:'1.5rem'}}>
        <label style={{display:'flex',alignItems:'center',gap:'0.75rem',flexWrap:'wrap'}}>
          <strong>Embed API Key:</strong>
          <input type="text" value={selectedKey} onChange={e => setSelectedKey(e.target.value)}
            placeholder="Paste your API key here (from Settings → API Keys)" style={{flex:1,minWidth:'300px',maxWidth:'500px'}} />
        </label>
        {!selectedKey && <p style={{margin:'0.5rem 0 0',fontSize:'0.85rem',color:'#e65100'}}>No key entered — downloaded scripts will need the key pasted manually.</p>}
      </div>

      <div style={{display:'grid',gap:'1rem'}}>
        {(data.scripts||[]).map(s => (
          <div key={s.id} className="card" style={{padding:'1.25rem'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
              <div>
                <h3 style={{margin:0}}>{s.name}</h3>
                <p style={{margin:'0.5rem 0',color:'var(--text-secondary,#666)'}}>{s.description}</p>
                <div style={{fontSize:'0.85rem',color:'var(--text-secondary,#888)'}}>
                  <strong>Install:</strong> {s.install}
                </div>
              </div>
              <button className="btn btn-primary" disabled={!s.available}
                onClick={() => download(s.id)}
                style={{whiteSpace:'nowrap',marginLeft:'1rem'}}>
                {s.available ? '⬇ Download' : 'Unavailable'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// Logs
// ════════════════════════════════════════════════════════════════
function LogsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [scanErrors, setScanErrors] = useState(null);
  const scans = useFetch('/scans');

  const fetchLogs = useCallback(async () => {
    const params = filter ? `?level=${filter}` : '';
    const res = await fetch(`${API}/logs${params}`);
    const d = await res.json();
    setLogs(d.logs || []);
    setLoading(false);
  }, [filter]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(fetchLogs, 5000);
    return () => clearInterval(id);
  }, [autoRefresh, fetchLogs]);

  const loadScanErrors = async (scanId) => {
    const res = await fetch(`${API}/scans/${scanId}/errors`);
    const d = await res.json();
    setScanErrors({ scanId, errors: d.errors || [] });
  };

  return (
    <div>
      <div className="page-header">
        <h1>Logs</h1>
        <div style={{display:'flex',gap:'0.5rem',alignItems:'center'}}>
          <select value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="">All Levels</option>
            <option value="ERROR">Errors</option>
            <option value="WARNING">Warnings</option>
            <option value="INFO">Info</option>
          </select>
          <label style={{display:'flex',alignItems:'center',gap:'0.25rem',fontSize:'0.9rem'}}>
            <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} /> Auto-refresh
          </label>
          <button className="btn btn-secondary" onClick={fetchLogs}>Refresh</button>
        </div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'1.5rem'}}>
        <div>
          <h3>Application Log</h3>
          {loading ? <Spinner /> : (
            <div style={{background:'#1e1e1e',color:'#d4d4d4',padding:'1rem',borderRadius:'3px',
              fontFamily:'monospace',fontSize:'0.8rem',maxHeight:'500px',overflowY:'auto',whiteSpace:'pre-wrap'}}>
              {logs.length === 0 ? <span style={{color:'#888'}}>No log entries</span> :
                logs.map((l, i) => (
                  <div key={i} style={{color: l.includes('[ERROR]') ? '#f44336' : l.includes('[WARNING]') ? '#ff9800' : '#d4d4d4',
                    borderBottom:'1px solid #333',padding:'2px 0'}}>{l}</div>
                ))
              }
            </div>
          )}
        </div>

        <div>
          <h3>Scan History</h3>
          {scans.loading ? <Spinner /> : (
            <table className="data-table" style={{fontSize:'0.85rem'}}>
              <thead><tr><th>ID</th><th>Type</th><th>Started</th><th>Status</th><th>OK/Fail</th><th></th></tr></thead>
              <tbody>{(scans.data?.scans||[]).map(s => (
                <tr key={s.id}>
                  <td>{s.id}</td>
                  <td>{s.scan_type}</td>
                  <td>{new Date(s.started_at).toLocaleString()}</td>
                  <td><Badge color={s.status==='completed'?'green':s.status==='error'?'red':'yellow'}>{s.status}</Badge></td>
                  <td>{s.hosts_scanned}/{s.hosts_failed}</td>
                  <td>{s.hosts_failed > 0 && <button className="btn-sm" onClick={() => loadScanErrors(s.id)}>Errors</button>}</td>
                </tr>
              ))}</tbody>
            </table>
          )}

          {scanErrors && (
            <div style={{marginTop:'1rem'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <h4>Scan #{scanErrors.scanId} Errors</h4>
                <button className="btn-sm" onClick={() => setScanErrors(null)}>Close</button>
              </div>
              {scanErrors.errors.length === 0 ? <p style={{color:'#888'}}>No error details recorded.</p> : (
                <table className="data-table" style={{fontSize:'0.85rem'}}>
                  <thead><tr><th>Host</th><th>Type</th><th>Message</th></tr></thead>
                  <tbody>{scanErrors.errors.map(e => (
                    <tr key={e.id}><td>{e.hostname}</td><td>{e.error_type}</td><td style={{maxWidth:'300px',overflow:'hidden',textOverflow:'ellipsis'}}>{e.error_message}</td></tr>
                  ))}</tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// System Update
// ════════════════════════════════════════════════════════════════
function SystemUpdate() {
  const { data: version, loading: vLoading, reload: reloadVersion } = useFetch('/system/version');
  const [updateInfo, setUpdateInfo] = useState(null);
  const [checking, setChecking] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [updateResult, setUpdateResult] = useState(null);
  const { data: history } = useFetch('/system/update-history');

  const checkUpdates = async () => {
    setChecking(true);
    try {
      const res = await fetch(`${API}/system/check-updates`);
      setUpdateInfo(await res.json());
    } finally { setChecking(false); }
  };

  const applyUpdate = async () => {
    if (!confirm('Pull latest changes and rebuild?')) return;
    setUpdating(true);
    try {
      const res = await fetch(`${API}/system/update`, { method: 'POST' });
      const result = await res.json();
      setUpdateResult(result);
      reloadVersion();
    } finally { setUpdating(false); }
  };

  if (vLoading) return <Spinner />;
  return (
    <div>
      <h1>System Update</h1>

      <div className="update-card">
        <h3>Current Version</h3>
        <div className="version-info">
          <div><label>Branch</label><span>{version?.branch}</span></div>
          <div><label>Commit</label><span><code>{version?.current_hash}</code></span></div>
          <div><label>Message</label><span>{version?.last_commit}</span></div>
          <div><label>Remote</label><span>{version?.remote}</span></div>
        </div>
      </div>

      <div className="update-card">
        <h3>Check for Updates</h3>
        <button className="btn btn-primary" onClick={checkUpdates} disabled={checking}>
          {checking ? 'Checking...' : 'Check for Updates'}
        </button>
        {updateInfo && (
          <div className="update-result">
            {updateInfo.available ? (
              <>
                <Badge color="yellow">Update Available</Badge>
                <p>Current: <code>{updateInfo.current}</code> → Latest: <code>{updateInfo.latest}</code></p>
                {updateInfo.changes?.length > 0 && (
                  <div className="change-list">
                    <strong>Changes:</strong>
                    <ul>{updateInfo.changes.map((c,i) => <li key={i}>{c}</li>)}</ul>
                  </div>
                )}
                <button className="btn btn-primary" onClick={applyUpdate} disabled={updating}>
                  {updating ? 'Updating...' : 'Apply Update'}
                </button>
              </>
            ) : (
              <><Badge color="green">Up to Date</Badge><p>{updateInfo.message || updateInfo.error}</p></>
            )}
          </div>
        )}
        {updateResult && (
          <div className={`update-result ${updateResult.status === 'updated' ? 'success' : 'error'}`}>
            <strong>{updateResult.status === 'updated' ? 'Update applied!' : 'Update failed'}</strong>
            <pre>{updateResult.output || updateResult.message}</pre>
            {updateResult.restart_required && (
              <div className="info-box">
                <strong>Restart required.</strong> Run on the server:
                <code>{updateResult.restart_command}</code>
              </div>
            )}
          </div>
        )}
      </div>

      {history?.history?.length > 0 && (
        <div className="update-card">
          <h3>Update History</h3>
          <table className="data-table">
            <thead><tr><th>Hash</th><th>Branch</th><th>Date</th><th>Status</th></tr></thead>
            <tbody>{history.history.map(h => (
              <tr key={h.id}><td><code>{h.git_hash}</code></td><td>{h.git_branch}</td><td>{new Date(h.updated_at).toLocaleString()}</td><td>{h.status}</td></tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// App Shell
// ════════════════════════════════════════════════════════════════
export default function App() {
  const [page, setPage] = useState('dashboard');
  const pages = { dashboard: Dashboard, hosts: Hosts, compliance: Compliance, entitlements: Entitlements, scanners: Scanners, settings: Settings, scripts: ScriptsPage, logs: LogsPage, updates: SystemUpdate };
  const Page = pages[page] || Dashboard;
  return (
    <div className="app-layout">
      <Nav current={page} onChange={setPage} />
      <main className="main-content"><Page /></main>
    </div>
  );
}
