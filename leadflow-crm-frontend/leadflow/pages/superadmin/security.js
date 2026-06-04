import { useState, useEffect } from 'react'
import Layout from '../../components/Layout'
import { 
  ShieldCheck, AlertTriangle, LogIn, XCircle, MapPin, 
  RefreshCw, Globe, Clock, Users, ShieldAlert, CheckCircle2,
  AlertCircle
} from 'lucide-react'
import clsx from 'clsx'
import { fetchWithAuth } from '../../utils/api'
import { format } from 'date-fns'

export default function Security() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('logins') // 'logins' | 'suspicious' | 'failures'

  const fetchSecurityData = async () => {
    setLoading(true)
    try {
      const result = await fetchWithAuth('/superadmin/clients/security-dashboard/')
      setData(result)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSecurityData()
    // Auto-refresh every 60 seconds
    const interval = setInterval(fetchSecurityData, 60000)
    return () => clearInterval(interval)
  }, [])

  const openMap = (lat, lng) => {
    window.open(`https://www.google.com/maps?q=${lat},${lng}&z=15`, '_blank')
  }

  if (loading && !data) {
    return (
      <Layout role="superadmin" pageTitle="Security & Compliance">
        <div className="flex items-center justify-center py-32">
          <RefreshCw className="animate-spin text-primary" size={32} />
        </div>
      </Layout>
    )
  }

  if (error && !data) {
    return (
      <Layout role="superadmin" pageTitle="Security & Compliance">
        <div className="card p-12 text-center">
          <ShieldAlert size={40} className="mx-auto text-danger mb-4" />
          <p className="text-sm text-danger font-bold">{error}</p>
          <button onClick={fetchSecurityData} className="btn-primary mt-4">Retry</button>
        </div>
      </Layout>
    )
  }

  const threatLevel = (data?.threats || 0) === 0 ? 'clean' : (data?.threats || 0) <= 5 ? 'low' : 'high'

  return (
    <Layout role="superadmin" pageTitle="Security & Compliance"
      actions={
        <button onClick={fetchSecurityData} disabled={loading} className="btn-ghost px-4 text-xs font-bold uppercase tracking-wider flex items-center gap-2">
          <RefreshCw size={14} className={clsx(loading && "animate-spin")} />
          Refresh
        </button>
      }>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className={clsx('card p-5 border transition-all', 
          threatLevel === 'clean' ? 'border-success/20' : threatLevel === 'low' ? 'border-amber-500/20 bg-amber-500/[0.02]' : 'border-danger/20 bg-danger/[0.02]'
        )}>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={15} className={threatLevel === 'clean' ? 'text-success' : threatLevel === 'low' ? 'text-amber-500' : 'text-danger'} />
            <span className="text-[10px] font-bold text-txt3 uppercase tracking-widest">Threats (7d)</span>
          </div>
          <div className={clsx('font-display font-bold text-3xl', 
            threatLevel === 'clean' ? 'text-success' : threatLevel === 'low' ? 'text-amber-500' : 'text-danger'
          )}>
            {data?.threats || 0}
          </div>
          <div className="text-[10px] text-txt3 mt-1 font-medium">
            {data?.suspicious_logins_7d || 0} suspicious logins · {data?.failed_attempts_24h || 0} failed attempts
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-2 mb-3">
            <LogIn size={15} className="text-accent" />
            <span className="text-[10px] font-bold text-txt3 uppercase tracking-widest">Sessions Today</span>
          </div>
          <div className="font-display font-bold text-3xl text-txt">{data?.active_sessions_today || 0}</div>
          <div className="text-[10px] text-txt3 mt-1 font-medium">unique users logged in</div>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-2 mb-3">
            <Users size={15} className="text-primary" />
            <span className="text-[10px] font-bold text-txt3 uppercase tracking-widest">Active Users</span>
          </div>
          <div className="font-display font-bold text-3xl text-txt">{data?.total_active_users || 0}</div>
          <div className="text-[10px] text-txt3 mt-1 font-medium">across all tenants</div>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck size={15} className="text-accent2" />
            <span className="text-[10px] font-bold text-txt3 uppercase tracking-widest">Last Audit</span>
          </div>
          <div className={clsx('font-display font-bold text-2xl', threatLevel === 'clean' ? 'text-success' : 'text-amber-500')}>
            {threatLevel === 'clean' ? 'Clean' : 'Review'}
          </div>
          <div className="text-[10px] text-txt3 mt-1 font-medium">
            {threatLevel === 'clean' ? 'no threats detected' : `${data?.threats} issues need attention`}
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-2 mb-4">
        {[
          { id: 'logins', label: `Recent Logins (${data?.recent_logins?.length || 0})`, icon: LogIn },
          { id: 'suspicious', label: `Suspicious (${data?.recent_suspicious?.length || 0})`, icon: AlertTriangle },
          { id: 'failures', label: `Failed Attempts (${data?.recent_failures?.length || 0})`, icon: XCircle },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={clsx(
              'flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all',
              activeTab === tab.id
                ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20'
                : 'bg-card text-txt3 border-border hover:border-primary/30 hover:text-primary'
            )}
          >
            <tab.icon size={13} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Security Log Table */}
      <div className="card overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-bg2/50 border-b border-border">
                {activeTab === 'failures' ? (
                  <>
                    <th className="px-5 py-4 text-[10px] font-bold text-txt3 uppercase tracking-widest">Email</th>
                    <th className="px-5 py-4 text-[10px] font-bold text-txt3 uppercase tracking-widest">IP Address</th>
                    <th className="px-5 py-4 text-[10px] font-bold text-txt3 uppercase tracking-widest">Status</th>
                    <th className="px-5 py-4 text-[10px] font-bold text-txt3 uppercase tracking-widest text-right">Time</th>
                  </>
                ) : (
                  <>
                    <th className="px-5 py-4 text-[10px] font-bold text-txt3 uppercase tracking-widest">User</th>
                    <th className="px-5 py-4 text-[10px] font-bold text-txt3 uppercase tracking-widest">Organization</th>
                    <th className="px-5 py-4 text-[10px] font-bold text-txt3 uppercase tracking-widest">Status</th>
                    <th className="px-5 py-4 text-[10px] font-bold text-txt3 uppercase tracking-widest">Location</th>
                    <th className="px-5 py-4 text-[10px] font-bold text-txt3 uppercase tracking-widest text-right">Time</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {/* Recent Logins Tab */}
              {activeTab === 'logins' && (data?.recent_logins || []).map((log) => (
                <tr key={log.id} className="hover:bg-bg2/40 transition-colors group">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className={clsx(
                        "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border",
                        log.is_suspicious 
                          ? "bg-danger/10 text-danger border-danger/20"
                          : "bg-primary/10 text-primary border-primary/20"
                      )}>
                        {(log.user_email || '?')[0].toUpperCase()}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-txt">{log.user_email}</div>
                        <div className="text-[10px] text-txt3 font-mono">{log.ip_address}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-xs text-txt2 font-medium">{log.client_name}</td>
                  <td className="px-5 py-4">
                    {log.is_suspicious ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-danger/10 text-danger border border-danger/20 text-[10px] font-bold uppercase">
                        <AlertCircle size={10} /> Suspicious
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-success/10 text-success border border-success/20 text-[10px] font-bold uppercase">
                        <CheckCircle2 size={10} /> Normal
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-1.5 text-xs text-txt2">
                      <Globe size={11} className="text-txt3" />
                      {log.city ? `${log.city}, ${log.country}` : log.ip_address}
                    </div>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <div className="flex flex-col items-end gap-0.5">
                      <span className="text-xs font-semibold text-txt">{format(new Date(log.created_at), 'MMM dd, yyyy')}</span>
                      <span className="text-[10px] text-txt3 flex items-center gap-1"><Clock size={9} /> {format(new Date(log.created_at), 'hh:mm a')}</span>
                    </div>
                  </td>
                </tr>
              ))}

              {/* Suspicious Tab */}
              {activeTab === 'suspicious' && (data?.recent_suspicious || []).map((log) => (
                <tr key={log.id} className="hover:bg-danger/[0.02] transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-danger/10 text-danger border border-danger/20 flex items-center justify-center text-xs font-bold">
                        {(log.user_email || '?')[0].toUpperCase()}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-txt">{log.user_email}</div>
                        <div className="text-[10px] text-txt3 font-mono">{log.ip_address}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-xs text-txt2 font-medium">{log.client_name}</td>
                  <td className="px-5 py-4">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-danger/10 text-danger border border-danger/20 text-[10px] font-bold uppercase">
                      <AlertTriangle size={10} /> {log.reason || 'Suspicious Activity'}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    {log.latitude && log.longitude ? (
                      <button onClick={() => openMap(log.latitude, log.longitude)} className="flex items-center gap-2 text-sm hover:opacity-80 transition-opacity">
                        <div className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center">
                          <MapPin size={12} className="text-blue-600" />
                        </div>
                        <span className="text-[10px] text-blue-600 font-bold">View Map</span>
                      </button>
                    ) : (
                      <span className="text-xs text-txt3">—</span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <div className="flex flex-col items-end gap-0.5">
                      <span className="text-xs font-semibold text-txt">{format(new Date(log.created_at), 'MMM dd, yyyy')}</span>
                      <span className="text-[10px] text-txt3 flex items-center gap-1"><Clock size={9} /> {format(new Date(log.created_at), 'hh:mm a')}</span>
                    </div>
                  </td>
                </tr>
              ))}

              {/* Failed Attempts Tab */}
              {activeTab === 'failures' && (data?.recent_failures || []).map((attempt, i) => (
                <tr key={i} className="hover:bg-danger/[0.02] transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-danger/10 text-danger border border-danger/20 flex items-center justify-center">
                        <XCircle size={14} />
                      </div>
                      <span className="text-sm font-semibold text-txt">{attempt.email}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-xs font-mono text-txt3">{attempt.ip_address}</td>
                  <td className="px-5 py-4">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-danger/10 text-danger border border-danger/20 text-[10px] font-bold uppercase">
                      <XCircle size={10} /> Failed
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <div className="flex flex-col items-end gap-0.5">
                      <span className="text-xs font-semibold text-txt">{format(new Date(attempt.attempted_at), 'MMM dd, yyyy')}</span>
                      <span className="text-[10px] text-txt3 flex items-center gap-1"><Clock size={9} /> {format(new Date(attempt.attempted_at), 'hh:mm a')}</span>
                    </div>
                  </td>
                </tr>
              ))}

              {/* Empty states */}
              {activeTab === 'logins' && (data?.recent_logins || []).length === 0 && (
                <tr><td colSpan="5" className="py-16 text-center text-txt3">
                  <LogIn size={28} className="mx-auto mb-2 opacity-30" />
                  <p className="text-xs font-medium">No login activity in the last 24 hours.</p>
                </td></tr>
              )}
              {activeTab === 'suspicious' && (data?.recent_suspicious || []).length === 0 && (
                <tr><td colSpan="5" className="py-16 text-center text-success">
                  <ShieldCheck size={28} className="mx-auto mb-2" />
                  <p className="text-xs font-bold">All Clear</p>
                  <p className="text-[10px] text-txt3 mt-1">No suspicious logins detected in the last 7 days.</p>
                </td></tr>
              )}
              {activeTab === 'failures' && (data?.recent_failures || []).length === 0 && (
                <tr><td colSpan="4" className="py-16 text-center text-success">
                  <CheckCircle2 size={28} className="mx-auto mb-2" />
                  <p className="text-xs font-bold">No Failed Attempts</p>
                  <p className="text-[10px] text-txt3 mt-1">No failed login attempts in the last 24 hours.</p>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 border-t border-border bg-bg2/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck size={13} className="text-success" />
            <span className="text-[10px] text-txt3 font-bold uppercase tracking-wider">
              {activeTab === 'logins' && `${data?.recent_logins?.length || 0} logins • last 24h`}
              {activeTab === 'suspicious' && `${data?.recent_suspicious?.length || 0} suspicious • last 7d`}
              {activeTab === 'failures' && `${data?.recent_failures?.length || 0} failures • last 24h`}
            </span>
          </div>
          <span className="text-[10px] text-txt3 font-mono">Auto-refresh: 60s</span>
        </div>
      </div>
    </Layout>
  )
}
