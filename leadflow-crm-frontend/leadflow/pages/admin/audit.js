import { useState, useEffect } from 'react'
import Layout from '../../components/Layout'
import { 
  Search, 
  Download, 
  ShieldCheck, 
  Clock,
  RefreshCw,
  AlertCircle,
  Laptop,
  LogIn,
  History,
  Globe,
  CheckCircle2
} from 'lucide-react'
import clsx from 'clsx'
import { fetchWithAuth } from '../../utils/api'
import { format } from 'date-fns'

export default function LoginActivity() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetchLogs()
  }, [])

  const fetchLogs = async (e) => {
    if (e) e.preventDefault()
    setLoading(true)
    setError(null)
    
    try {
      let url = '/audits/login-history/'
      if (search) url += `?search=${encodeURIComponent(search)}`
      
      const data = await fetchWithAuth(url)
      setLogs(data.results || data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Layout role="admin" pageTitle="Login Activity"
      actions={
        <button onClick={fetchLogs} disabled={loading} className="p-2 text-txt3 hover:text-primary transition-colors disabled:opacity-50">
          <RefreshCw size={14} className={clsx(loading && "animate-spin")} />
        </button>
      }
    >
      {/* Search */}
      <div className="flex items-center gap-3 mb-5 p-4 bg-card border border-border rounded-xl">
        <div className="p-2 bg-primary/10 rounded-lg border border-primary/20">
          <LogIn size={16} className="text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-bold text-txt">Employee Login History</div>
          <div className="text-[10px] text-txt3">Track all login attempts across your organization</div>
        </div>
        
        <form onSubmit={fetchLogs} className="relative max-w-xs flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-txt3" />
          <input 
            type="text" 
            placeholder="Search by email or IP…" 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-bg3 border border-border2 rounded-lg text-xs focus:ring-1 focus:ring-primary/20 outline-none"
          />
        </form>
      </div>

      {/* Login Table */}
      <div className="card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-bg2/50 border-b border-border">
                <th className="px-5 py-3.5 text-[10px] font-bold text-txt3 uppercase tracking-widest">User</th>
                <th className="px-5 py-3.5 text-[10px] font-bold text-txt3 uppercase tracking-widest">Status</th>
                <th className="px-5 py-3.5 text-[10px] font-bold text-txt3 uppercase tracking-widest">Location / IP Address</th>
                <th className="px-5 py-3.5 text-[10px] font-bold text-txt3 uppercase tracking-widest text-right">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan="4" className="py-20 text-center">
                    <RefreshCw className="animate-spin text-primary mx-auto mb-2" size={24} />
                    <p className="text-xs text-txt3">Loading login history…</p>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan="4" className="py-20 text-center text-danger bg-danger/5">
                    <AlertCircle className="mx-auto mb-2" size={24} />
                    <p className="text-xs font-bold">Failed to load logs</p>
                    <p className="text-[10px] opacity-70">{error}</p>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan="4" className="py-20 text-center">
                    <History className="text-txt3 mx-auto mb-2 opacity-20" size={32} />
                    <p className="text-xs text-txt3">No login activity recorded yet</p>
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-bg2/50 transition-colors group">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-success/10 border border-success/20 flex items-center justify-center text-success text-[10px] font-bold">
                          {(log.user_email || '?')[0].toUpperCase()}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-txt">{log.user_email || 'Unknown'}</div>
                          <div className="text-[10px] text-txt3">{log.city ? `${log.city}, ${log.country}` : 'Location Unknown'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      {log.is_suspicious ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-danger/10 text-danger border border-danger/20 text-[10px] font-bold uppercase">
                          <AlertCircle size={10} />
                          Suspicious
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-success/10 text-success border border-success/20 text-[10px] font-bold uppercase">
                          <CheckCircle2 size={10} />
                          Success
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2 text-xs text-txt2 font-mono">
                        <Globe size={12} className="text-txt3" />
                        {log.ip_address || '—'}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex flex-col items-end gap-0.5">
                        <span className="text-[11px] font-medium text-txt">{format(new Date(log.created_at), 'MMM dd, yyyy')}</span>
                        <span className="text-[9px] text-txt3 flex items-center gap-1"><Clock size={8}/> {format(new Date(log.created_at), 'hh:mm a')}</span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-3 border-t border-border bg-bg2/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
             <ShieldCheck size={12} className="text-success" />
             <span className="text-[10px] text-txt3 font-medium uppercase tracking-tight">
               {logs.length} login {logs.length === 1 ? 'entry' : 'entries'} recorded
             </span>
          </div>
        </div>
      </div>
    </Layout>
  )
}
