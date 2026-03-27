import { useState, useEffect } from 'react'
import Layout from '../../components/Layout'
import { StatusBadge } from '../../components/UI'
import { Download, FileText, Clock, Shield, Plus, Filter } from 'lucide-react'
import clsx from 'clsx'
import { fetchWithAuth, API_BASE } from '../../utils/api'

export default function DataExports() {
  const [showModal, setShowModal] = useState(false)
  const [exportType, setExportType] = useState('full')
  const [clients, setClients] = useState([])
  const [selectedClient, setSelectedClient] = useState('')
  const [exportsList, setExportsList] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchWithAuth('/superadmin/clients/clients/')
      .then(res => {
        const list = res.results || res || []
        setClients(list)
        if (list.length > 0) setSelectedClient(list[0].id)
      })
      .catch(console.error)
  }, [])

  const handleExport = async () => {
    if (!selectedClient) return
    setLoading(true)
    try {
      const url = `${API_BASE}/superadmin/clients/clients/${selectedClient}/export-data/?type=${exportType}`
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` }
      })
      
      if (!response.ok) throw new Error("Export failed")
      
      const blob = await response.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = downloadUrl
      
      let filename = 'data_export.csv'
      const disposition = response.headers.get('content-disposition')
      if (disposition && disposition.indexOf('filename=') !== -1) {
        filename = disposition.split('filename="')[1].split('"')[0]
      }
      a.download = filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(downloadUrl)
      
      const clientName = clients.find(c => c.id === selectedClient)?.name || 'Unknown'
      setExportsList([{
        client: clientName,
        requested: new Date().toLocaleTimeString(),
        filters: exportType,
        size: (blob.size / 1024).toFixed(1) + ' KB',
        status: 'ready',
        expires: 'Tomorrow'
      }, ...exportsList])
      
      setShowModal(false)
    } catch (err) {
      alert("Error starting export: " + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Layout role="superadmin" pageTitle="Data Exports"
      actions={<button className="btn-primary" onClick={()=>setShowModal(true)}><Plus size={14}/>New Export</button>}>

      {/* Info banner */}
      <div className="card p-4 mb-6 border-accent/20 bg-accent/5 flex items-start gap-3">
        <Shield size={16} className="text-accent mt-0.5 flex-shrink-0" />
        <div>
          <div className="text-sm font-semibold text-accent">Data Access Policy</div>
          <div className="text-xs text-txt2 mt-1">All data exports are logged permanently. Export links expire after 24 hours. Files are password-protected ZIP archives. This access is disclosed in client Terms of Service (DPDP Act compliant).</div>
        </div>
      </div>

      {/* Export history */}
      <div className="card overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="font-display font-bold text-sm text-txt">Export History</h2>
          <button className="btn-ghost text-xs"><Filter size={12}/>Filter</button>
        </div>
        <table className="w-full">
          <thead className="border-b border-border bg-bg2/50">
            <tr>
              {['Client','Requested At','Filters Applied','File Size','Status','Expires','Action'].map(h=>(
                <th key={h} className="th">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {exportsList.length === 0 ? (
              <tr><td colSpan="7" className="py-10 text-center text-xs text-txt3">No exports generated in this session.</td></tr>
            ) : exportsList.map((e,i) => (
              <tr key={i} className="table-row">
                <td className="td font-medium text-txt">{e.client}</td>
                <td className="td text-txt3 text-xs font-mono">{e.requested}</td>
                <td className="td text-txt2 text-xs">{e.filters}</td>
                <td className="td text-txt2 font-mono text-xs">{e.size}</td>
                <td className="td"><StatusBadge status={e.status} /></td>
                <td className="td text-xs font-mono text-txt3">{e.expires}</td>
                <td className="td">
                  {e.status === 'ready' ? (
                    <button className="flex items-center gap-1.5 text-accent2 text-xs hover:underline">
                      <Download size={12}/>Download
                    </button>
                  ) : e.status === 'processing' ? (
                    <span className="text-xs text-amber font-mono flex items-center gap-1">
                      <Clock size={11} className="pulse-dot"/>Processing…
                    </span>
                  ) : (
                    <span className="text-xs text-txt3">Expired</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-4 py-3 border-t border-border bg-bg2/50">
          <span className="text-xs text-txt3">All exports are immutably logged. Download links expire after 24 hours.</span>
        </div>
      </div>

      {/* New Export Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={()=>setShowModal(false)}>
          <div className="card2 w-full max-w-md p-6 fade-up" onClick={e=>e.stopPropagation()}>
            <h3 className="font-display font-bold text-base text-txt mb-1">Export Client Data</h3>
            <p className="text-xs text-txt2 mb-5">Generate a password-protected ZIP export for any client account</p>
            <div className="space-y-4">
              <div>
                <label className="label block mb-1">Select Client</label>
                <select className="input" value={selectedClient} onChange={e => setSelectedClient(e.target.value)}>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label block mb-2">Export Type</label>
                <div className="space-y-2">
                  {[
                    { id:'full',    label:'Full Export',      desc:'All leads, employees, audit logs, site visits, performance' },
                    { id:'leads',   label:'Leads Only',       desc:'All leads with status, assignee, project, and notes' },
                    { id:'audit',   label:'Audit Log Only',   desc:'Complete immutable audit trail' },
                    { id:'custom',  label:'Custom Range',     desc:'Filter by date range, batch, or status' },
                  ].map(t => (
                    <div key={t.id} onClick={()=>setExportType(t.id)}
                      className={clsx('p-3 rounded-lg border cursor-pointer transition-all',
                        exportType===t.id?'border-accent bg-accent/8':'border-border2 hover:border-border bg-bg3')}>
                      <div className="flex items-center gap-2">
                        <div className={clsx('w-3 h-3 rounded-full border-2 transition-all',
                          exportType===t.id?'border-accent bg-accent':'border-border2')} />
                        <span className="text-sm font-medium text-txt">{t.label}</span>
                      </div>
                      <p className="text-xs text-txt3 pl-5 mt-0.5">{t.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
              {exportType === 'custom' && (
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="label block mb-1">From Date</label><input type="date" className="input text-sm"/></div>
                  <div><label className="label block mb-1">To Date</label><input type="date" className="input text-sm"/></div>
                </div>
              )}
              <div className="bg-amber/8 border border-amber/20 rounded-lg p-3 flex items-start gap-2">
                <Shield size={13} className="text-amber mt-0.5 flex-shrink-0" />
                <p className="text-xs text-amber">Export will be emailed as a password-protected ZIP. Link expires in 24h. This action is permanently logged.</p>
              </div>
              <div className="flex gap-2">
                <button 
                  className="btn-primary flex-1 justify-center" 
                  onClick={handleExport} 
                  disabled={loading}
                >
                  {loading ? <Clock size={14} className="animate-spin" /> : <Download size={14}/>}
                  {loading ? 'Generating...' : 'Generate Export'}
                </button>
                <button onClick={()=>setShowModal(false)} className="btn-ghost flex-1 justify-center" disabled={loading}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
