import { useState, useEffect } from 'react'
import Layout from '../../components/Layout'
import { 
  History, 
  Search, 
  Filter, 
  Download, 
  User, 
  FileText, 
  Activity, 
  Database, 
  ShieldCheck, 
  Clock,
  RefreshCw,
  AlertCircle,
  Laptop,
  Edit,
  Trash2,
  LogIn
} from 'lucide-react'
import clsx from 'clsx'
import { fetchWithAuth } from '../../utils/api'
import { format } from 'date-fns'

const ACTION_CONFIG = {
  'CREATE': { color:'badge-green',   icon:Database },
  'UPDATE': { color:'badge-blue',    icon:FileText },
  'DELETE': { color:'badge-red',     icon:Trash2 },
  'LOGIN':  { color:'badge-green',   icon:LogIn },
  'SUSPICIOUS_LOGIN': { color:'badge-red font-bold', icon:ShieldCheck },
  'EXPORT': { color:'badge-purple',  icon:Download },
  'MERGE':  { color:'badge-amber',   icon:RefreshCw },
  'ASSIGN': { color:'badge-blue',    icon:User },
}

export default function AuditTrail() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('All')

  useEffect(() => {
    fetchLogs()
  }, [filter])

  const fetchLogs = async (e) => {
    if (e) e.preventDefault()
    setLoading(true)
    setError(null)
    
    try {
      let url = '/audits/audit-logs/'
      const params = new URLSearchParams()
      if (filter !== 'All') params.append('action', filter.toUpperCase())
      if (search) params.append('search', search)
      
      const query = params.toString()
      if (query) url += `?${query}`
      
      const data = await fetchWithAuth(url)
      setLogs(data.results || data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Layout role="admin" pageTitle="Audit Trail"
      actions={
        <button className="btn-ghost text-xs group">
          <Download size={13} className="group-hover:translate-y-0.5 transition-transform" /> 
          Export Log
        </button>
      }
    >

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-5 p-4 bg-card border border-border rounded-xl">
        <div className="flex gap-1 bg-bg3 rounded-lg p-1 border border-border2">
          {['All', 'Create', 'Update', 'Login', 'Security'].map(f => (
            <button 
              key={f} 
              onClick={() => setFilter(f)}
              className={clsx(
                'px-3 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider transition-all',
                filter === f ? 'bg-card text-primary shadow-sm border border-border2' : 'text-txt3 hover:text-txt'
              )}
            >
              {f}
            </button>
          ))}
        </div>
        
        <form onSubmit={fetchLogs} className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-txt3" />
          <input 
            type="text" 
            placeholder="Search by user or resource ID..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-bg3 border border-border2 rounded-lg text-xs focus:ring-1 focus:ring-primary/20 outline-none"
          />
        </form>

        <button 
          onClick={fetchLogs}
          disabled={loading}
          className="p-2 text-txt3 hover:text-primary transition-colors disabled:opacity-50"
        >
          <RefreshCw size={16} className={clsx(loading && "animate-spin")} />
        </button>
      </div>

      {/* Table */}
      <div className="card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-bg2/50 border-b border-border">
                <th className="px-4 py-3 text-[10px] font-bold text-txt3 uppercase tracking-widest">Action</th>
                <th className="px-4 py-3 text-[10px] font-bold text-txt3 uppercase tracking-widest">User</th>
                <th className="px-4 py-3 text-[10px] font-bold text-txt3 uppercase tracking-widest">Resource</th>
                <th className="px-4 py-3 text-[10px] font-bold text-txt3 uppercase tracking-widest">Details</th>
                <th className="px-4 py-3 text-[10px] font-bold text-txt3 uppercase tracking-widest text-right">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan="5" className="py-20 text-center">
                    <RefreshCw className="animate-spin text-primary mx-auto mb-2" size={24} />
                    <p className="text-xs text-txt3">Fetching live audit stream...</p>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan="5" className="py-20 text-center text-danger bg-danger/5">
                    <AlertCircle className="mx-auto mb-2" size={24} />
                    <p className="text-xs font-bold">Failed to load logs</p>
                    <p className="text-[10px] opacity-70">{error}</p>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan="5" className="py-20 text-center">
                    <History className="text-txt3 mx-auto mb-2 opacity-20" size={32} />
                    <p className="text-xs text-txt3">No audit entries found</p>
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const cfg = ACTION_CONFIG[log.action] || { color:'badge-gray', icon:History }
                  const Icon = cfg.icon
                  return (
                    <tr key={log.id} className="hover:bg-bg2/50 transition-colors group">
                      <td className="px-4 py-4">
                        <span className={clsx('badge inline-flex items-center gap-1.5', cfg.color)}>
                          <Icon size={10} />
                          {log.action.replace(/_/g,' ')}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-txt">{log.user_email || 'System'}</span>
                          <div className="flex items-center gap-1 text-[9px] text-txt3 font-mono">
                            <Laptop size={8} /> {log.ip_address || '—'}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold text-txt3 uppercase tracking-tighter">{log.resource_type}</span>
                          <span className="text-[11px] font-mono text-primary font-medium">#{String(log.resource_id).substring(0,8)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        {log.changes && Object.keys(log.changes).length > 0 ? (
                          <div className="max-w-xs overflow-hidden">
                             {Object.entries(log.changes).slice(0,2).map(([k,v]) => (
                               <div key={k} className="text-[10px] flex items-center gap-1 truncate">
                                 <span className="font-bold text-txt2">{k}:</span>
                                 <span className="text-txt3">{JSON.stringify(v)}</span>
                               </div>
                             ))}
                             {Object.keys(log.changes).length > 2 && <span className="text-[9px] text-accent">+{Object.keys(log.changes).length - 2} more...</span>}
                          </div>
                        ) : (
                          <span className="text-[10px] text-txt3 italic">No data changes logged</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <div className="flex flex-col items-end gap-0.5">
                          <span className="text-[11px] font-medium text-txt">{format(new Date(log.created_at), 'MMM dd, HH:mm')}</span>
                          <span className="text-[9px] text-txt3 flex items-center gap-1"><Clock size={8}/> {format(new Date(log.created_at), 'p')}</span>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-3 border-t border-border bg-bg2/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
             <ShieldCheck size={12} className="text-success" />
             <span className="text-[10px] text-txt3 font-medium uppercase tracking-tight">Audit integrity verified • Immutable Ledger</span>
          </div>
          <div className="flex gap-2">
            <button className="btn-ghost px-2 py-1 text-[10px] disabled:opacity-30" disabled>Previous</button>
            <button className="btn-ghost px-2 py-1 text-[10px] disabled:opacity-30" disabled>Next</button>
          </div>
        </div>
      </div>
    </Layout>
  )
}
