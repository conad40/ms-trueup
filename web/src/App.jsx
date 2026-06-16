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

function Spinner() { return <div className="spinner">Loading...</div>; }
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
    <nav className="sidebar">
      <div className="sidebar-header">
        <h2>MS True-Up</h2>
        <small>License Management</small>
      </div>
      {PAGES.map(p => (
        <button key={p.id} className={`nav-btn ${current === p.id ? 'active' : ''}`}
          onClick={() => onChange(p.id)}>
          <span className="nav-icon">{p.icon}</span> {p.label}
        </button>
      ))}
    </nav>
  );
}

// ════════════════════════════════════════════════════════════════
// Dashboard
// ════════════════════════════════════════════════════════════════
function BarChart({ data, colorFn }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div style={{display:'flex',flexDirection:'column',gap:'0.4rem'}}>
      {data.map(d => (
        <div key={d.label} style={{display:'flex',alignItems:'center',gap:'0.5rem'}}>
          <span style={{width:'140px',fontSize:'0.85rem',textAlign:'right',flexShrink:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{d.label}</span>
          <div style={{flex:1,background:'#e5e7eb',borderRadius:'4px',height:'22px',position:'relative'}}>
            <div style={{width:`${(d.value/max)*100}%`,background:colorFn?colorFn(d):d.color||'#6366f1',borderRadius:'4px',height:'100%',minWidth: d.value > 0 ? '2px' : 0,transition:'width 0.3s'}} />
          </div>
          <span style={{width:'50px',fontSize:'0.85rem',fontWeight:600}}>{d.value}</span>
        </div>
      ))}
    </div>
  );
}

function Dashboard() {
  const { data, loading } = useFetch('/dashboard');
  const comp = useFetch('/compliance');
  if (loading || !data) return <Spinner />;
  const cards = [
    { label: 'Physical Hosts', value: data.physical_hosts, color: '#2563eb' },
    { label: 'Virtual Hosts', value: data.virtual_hosts, color: '#7c3aed' },
    { label: 'Total Hosts', value: data.total_hosts, color: '#059669' },
    { label: 'SQL Instances', value: data.sql_instances, color: '#d97706' },
  ];

  const compliance = comp.data?.compliance || [];
  const sourceData = Object.entries(data.sources || {}).map(([k,v]) => ({label:k, value:v}));
  const osData = Object.entries(data.os_breakdown || {}).map(([k,v]) => ({label:k, value:v}));
  const sourceColors = {vcenter:'#7c3aed',agent:'#2563eb',winrm:'#059669',sccm:'#d97706',scvmm:'#dc2626'};

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
        <div style={{marginTop:'1.5rem'}}>
          <h2 style={{marginBottom:'1rem'}}>Compliance Status</h2>
          <div className="card-grid">
            {compliance.map(g => {
              const pct = g.entitled_cores > 0 ? Math.min(100, Math.round((g.entitled_cores / Math.max(g.required_cores,1)) * 100)) : 0;
              const color = g.compliant ? '#22c55e' : g.gap_cores > 0 ? '#ef4444' : '#f59e0b';
              return (
                <div key={g.product} className="stat-card" style={{borderLeftColor: color, padding:'1rem'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'0.5rem'}}>
                    <strong>{g.product}</strong>
                    <Badge color={g.compliant ? 'green' : 'red'}>{g.compliant ? 'Compliant' : 'Gap'}</Badge>
                  </div>
                  <div style={{background:'#e5e7eb',borderRadius:'6px',height:'12px',marginBottom:'0.5rem',overflow:'hidden'}}>
                    <div style={{width:`${pct}%`,height:'100%',background:color,borderRadius:'6px',transition:'width 0.3s'}} />
                  </div>
                  <div style={{display:'flex',justifyContent:'space-between',fontSize:'0.85rem',color:'#6b7280'}}>
                    <span>Entitled: {g.entitled_cores} cores</span>
                    <span>Required: {g.required_cores} cores</span>
                  </div>
                  {g.gap_cores > 0 && (
                    <div style={{fontSize:'0.85rem',color:'#ef4444',fontWeight:600,marginTop:'0.25rem'}}>
                      Gap: {g.gap_cores} cores ({g.gap_2packs} two-core packs)
                    </div>
                  )}
                  <div style={{fontSize:'0.8rem',color:'#9ca3af',marginTop:'0.25rem'}}>
                    {g.physical_hosts} physical · {g.virtual_hosts} VMs
                    {g.note ? ` · ${g.note}` : ''}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Source & OS Breakdown */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'1.5rem',marginTop:'1.5rem'}}>
        {sourceData.length > 0 && (
          <div className="stat-card" style={{padding:'1rem'}}>
            <h3 style={{marginBottom:'0.75rem'}}>Hosts by Source</h3>
            <BarChart data={sourceData} colorFn={d => sourceColors[d.label] || '#6366f1'} />
          </div>
        )}
        {osData.length > 0 && (
          <div className="stat-card" style={{padding:'1rem'}}>
            <h3 style={{marginBottom:'0.75rem'}}>Hosts by OS</h3>
            <BarChart data={osData} colorFn={() => '#6366f1'} />
          </div>
        )}
      </div>
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
          <div className="filter-bar" style={{display:'flex',gap:'0.5rem',marginBottom:'1rem',alignItems:'center'}}>
            <input type="text" placeholder="Search hostname, IP, OS..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} style={{flex:1,padding:'0.5rem',borderRadius:'4px',border:'1px solid #ddd'}} />
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
function Entitlements() {
  const { data, loading, reload } = useFetch('/entitlements');
  const [form, setForm] = useState(null);

  const save = async () => {
    const method = form.id ? 'PUT' : 'POST';
    const url = form.id ? `${API}/entitlements/${form.id}` : `${API}/entitlements`;
    await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    setForm(null); reload();
  };

  const del = async (id) => {
    if (!confirm('Delete?')) return;
    await fetch(`${API}/entitlements/${id}`, { method: 'DELETE' });
    reload();
  };

  if (loading || !data) return <Spinner />;
  const ents = data.entitlements || [];

  return (
    <div>
      <div className="page-header">
        <h1>Entitlements</h1>
        <button className="btn btn-primary" onClick={() => setForm({ product_name: '', product_family: 'WindowsServer', edition: 'Standard', license_type: 'core_2pack', quantity: 1 })}>+ Add</button>
      </div>
      <table className="data-table">
        <thead><tr><th>Product</th><th>Family</th><th>Edition</th><th>Type</th><th>Qty</th><th>Agreement</th><th>Expiry</th><th>Actions</th></tr></thead>
        <tbody>{ents.map(e => (
          <tr key={e.id}><td>{e.product_name}</td><td>{e.product_family}</td><td>{e.edition}</td><td>{e.license_type}</td><td>{e.quantity}</td>
          <td>{e.agreement_number}</td><td>{e.expiry_date || '—'}</td>
          <td><button className="btn-sm" onClick={() => setForm({...e})}>Edit</button> <button className="btn-sm btn-danger" onClick={() => del(e.id)}>Delete</button></td></tr>
        ))}</tbody>
      </table>
      {form && (
        <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) setForm(null); }}>
          <div className="modal">
            <h3>{form.id ? 'Edit' : 'Add'} Entitlement</h3>
            <div className="form-grid">
              <label>Product<input value={form.product_name} onChange={e => setForm({...form, product_name: e.target.value})} /></label>
              <label>Family<select value={form.product_family||''} onChange={e => setForm({...form, product_family: e.target.value})}>
                <option value="WindowsServer">Windows Server</option><option value="SQLServer">SQL Server</option><option value="Office">Office</option><option value="Other">Other</option>
              </select></label>
              <label>Edition<input value={form.edition||''} onChange={e => setForm({...form, edition: e.target.value})} /></label>
              <label>License Type<select value={form.license_type||''} onChange={e => setForm({...form, license_type: e.target.value})}>
                <option value="core_2pack">Core 2-Pack</option><option value="core">Core</option><option value="cal_device">CAL (Device)</option><option value="cal_user">CAL (User)</option>
              </select></label>
              <label>Quantity<input type="number" value={form.quantity} onChange={e => setForm({...form, quantity: parseInt(e.target.value)||0})} /></label>
              <label>Agreement #<input value={form.agreement_number||''} onChange={e => setForm({...form, agreement_number: e.target.value})} /></label>
              <label>Expiry<input type="date" value={form.expiry_date||''} onChange={e => setForm({...form, expiry_date: e.target.value})} /></label>
              <label className="checkbox-label"><input type="checkbox" checked={form.sa_included||false} onChange={e => setForm({...form, sa_included: e.target.checked})} /> SA Included</label>
            </div>
            <div className="modal-actions"><button className="btn btn-primary" onClick={save}>Save</button><button className="btn btn-secondary" onClick={() => setForm(null)}>Cancel</button></div>
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
                      padding: '0.4rem 1.2rem', borderRadius: '20px', border: 'none', cursor: 'pointer', fontWeight: 600,
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
            <div style={{background:'#1e1e1e',color:'#d4d4d4',padding:'1rem',borderRadius:'6px',
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
