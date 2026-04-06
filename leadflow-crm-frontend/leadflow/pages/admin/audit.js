import { useState, useEffect } from 'react'
import Layout from '../../components/Layout'
import { 
  Search, 
  ShieldCheck, 
  Clock,
  RefreshCw,
  AlertCircle,
  LogIn,
  History,
  Globe,
  CheckCircle2,
  MapPin,
  Calendar
} from 'lucide-react'
import clsx from 'clsx'
import { fetchWithAuth } from '../../utils/api'
import { format, subDays } from 'date-fns'

export default function LoginActivity() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')

  // Date filter: 'today' | 'yesterday' | 'all' | '2026-04-05' (specific date)
  const [dateFilter, setDateFilter] = useState('today')

  useEffect(() => {
    fetchLogs()
  }, [dateFilter])

  const getDateParams = () => {
    const today = format(new Date(), 'yyyy-MM-dd')
    const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd')

    switch (dateFilter) {
      case 'today':
        return `&date_from=${today}&date_to=${today}`
      case 'yesterday':
        return `&date_from=${yesterday}&date_to=${yesterday}`
      case 'all':
        return ''
      default:
        // specific date string like '2026-04-05'
        return `&date_from=${dateFilter}&date_to=${dateFilter}`
    }
  }

  const getFilterLabel = () => {
    switch (dateFilter) {
      case 'today': return 'Today'
      case 'yesterday': return 'Yesterday'
      case 'all': return 'All Time'
      default: return format(new Date(dateFilter + 'T00:00:00'), 'MMM dd, yyyy')
    }
  }

  const fetchLogs = async (e) => {
    if (e) e.preventDefault()
    setLoading(true)
    setError(null)
    
    try {
      let url = '/audits/login-history/?ordering=-created_at'
      if (search) url += `&search=${encodeURIComponent(search)}`
      url += getDateParams()
      
      const data = await fetchWithAuth(url)
      setLogs(data.results || data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const openMap = (lat, lng) => {
    window.open(`https://www.google.com/maps?q=${lat},${lng}&z=15`, '_blank')
  }

  return (
    <Layout role="admin" pageTitle="Login Activity"
      actions={
        <button onClick={fetchLogs} disabled={loading} className="p-2 text-txt3 hover:text-primary transition-colors disabled:opacity-50">
          <RefreshCw size={14} className={clsx(loading && "animate-spin")} />
        </button>
      }
    >
      {/* Header Card */}
      <div className="flex items-center gap-3 mb-5 p-4 bg-card border border-border rounded-xl">
        <div className="p-2.5 bg-primary/10 rounded-lg border border-primary/20">
          <LogIn size={16} className="text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-txt">Employee Login History</div>
          <div className="text-xs text-txt3">Track login locations & activity across your organization</div>
        </div>
        
        <form onSubmit={fetchLogs} className="relative max-w-xs flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-txt3" />
          <input 
            type="text" 
            placeholder="Search by email…" 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-bg3 border border-border2 rounded-lg text-xs focus:ring-1 focus:ring-primary/20 outline-none"
          />
        </form>
      </div>

      {/* Date Filter Bar — Today | Yesterday | All Time | Calendar */}
      <div className="flex items-center gap-2 mb-4">
        {['today', 'yesterday', 'all'].map(f => (
          <button
            key={f}
            onClick={() => setDateFilter(f)}
            style={dateFilter === f 
              ? { backgroundColor: '#4338ca', color: '#ffffff', borderColor: '#4338ca' }
              : { backgroundColor: '#ffffff', color: '#374151', borderColor: '#e5e7eb' }
            }
            className="px-4 py-2 rounded-lg text-xs font-bold border transition-all hover:opacity-90"
          >
            {f === 'today' ? 'Today' : f === 'yesterday' ? 'Yesterday' : 'All Time'}
          </button>
        ))}

        {/* Simple Calendar Date Picker */}
        <div className="relative">
          <input
            type="date"
            value={!['today', 'yesterday', 'all'].includes(dateFilter) ? dateFilter : ''}
            onChange={(e) => {
              if (e.target.value) setDateFilter(e.target.value)
            }}
            style={!['today', 'yesterday', 'all'].includes(dateFilter)
              ? { backgroundColor: '#4338ca', color: '#ffffff', borderColor: '#4338ca', colorScheme: 'dark' }
              : { backgroundColor: '#ffffff', color: '#374151', borderColor: '#e5e7eb', colorScheme: 'light' }
            }
            className="pl-9 pr-3 py-2 rounded-lg text-xs font-bold border transition-all cursor-pointer w-[150px]"
          />
          <Calendar 
            size={14} 
            className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: !['today', 'yesterday', 'all'].includes(dateFilter) ? '#ffffff' : '#9ca3af' }}
          />
        </div>
      </div>

      {/* Login Table */}
      <div className="card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-bg2/50 border-b border-border">
                <th className="px-5 py-3.5 text-[11px] font-bold text-gray-500 uppercase tracking-wider">User</th>
                <th className="px-5 py-3.5 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-5 py-3.5 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Login Location</th>
                <th className="px-5 py-3.5 text-[11px] font-bold text-gray-500 uppercase tracking-wider text-right">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan="4" className="py-20 text-center">
                    <RefreshCw className="animate-spin text-primary mx-auto mb-2" size={24} />
                    <p className="text-sm text-gray-400">Loading login history…</p>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan="4" className="py-20 text-center text-danger bg-danger/5">
                    <AlertCircle className="mx-auto mb-2" size={24} />
                    <p className="text-sm font-bold">Failed to load logs</p>
                    <p className="text-xs opacity-70">{error}</p>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan="4" className="py-20 text-center">
                    <History className="text-gray-300 mx-auto mb-2" size={32} />
                    <p className="text-sm text-gray-400">
                      No login activity for {getFilterLabel()}
                    </p>
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-bg2/50 transition-colors group">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary text-sm font-bold">
                          {(log.user_email || '?')[0].toUpperCase()}
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-gray-800">{log.user_email || 'Unknown'}</div>
                          <div className="text-xs text-gray-400">{log.city ? `${log.city}, ${log.country}` : 'Location Unknown'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      {log.is_suspicious ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-50 text-red-600 border border-red-200 text-xs font-bold">
                          <AlertCircle size={11} />
                          Suspicious
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-green-50 text-green-600 border border-green-200 text-xs font-bold">
                          <CheckCircle2 size={11} />
                          Success
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      {log.latitude && log.longitude ? (
                        <button
                          onClick={() => openMap(log.latitude, log.longitude)}
                          className="flex items-center gap-2.5 text-sm hover:opacity-80 transition-opacity"
                          title={`Open in Google Maps (${log.latitude}, ${log.longitude})`}
                        >
                          <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center">
                            <MapPin size={14} className="text-blue-600" />
                          </div>
                          <div className="text-left">
                            <div className="text-xs font-semibold text-blue-600">View on Map</div>
                            <div className="text-[10px] text-gray-400 font-mono">{Number(log.latitude).toFixed(4)}, {Number(log.longitude).toFixed(4)}</div>
                          </div>
                        </button>
                      ) : (
                        <div className="flex items-center gap-2 text-xs text-gray-400">
                          <Globe size={13} />
                          {log.ip_address || '—'}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex flex-col items-end gap-0.5">
                        <span className="text-xs font-semibold text-gray-700">{format(new Date(log.created_at), 'MMM dd, yyyy')}</span>
                        <span className="text-[10px] text-gray-400 flex items-center gap-1"><Clock size={9}/> {format(new Date(log.created_at), 'hh:mm a')}</span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="px-5 py-3 border-t border-border bg-bg2/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
             <ShieldCheck size={13} className="text-green-500" />
             <span className="text-xs text-gray-500 font-semibold">
               {logs.length} login {logs.length === 1 ? 'entry' : 'entries'} • {getFilterLabel()}
             </span>
          </div>
        </div>
      </div>
    </Layout>
  )
}
