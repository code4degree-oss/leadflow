import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Layout from '../../components/Layout'
import { ProgressBar } from '../../components/UI'
import { RefreshCw, AlertCircle, Cpu, HardDrive, Server, Activity, Terminal } from 'lucide-react'
import { fetchWithAuth } from '../../utils/api'
import clsx from 'clsx'

const formatBytes = (bytes, decimals = 2) => {
  if (!+bytes) return '0 Bytes'
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`
}

export default function SystemConfig() {
  const router = useRouter()
  const [metrics, setMetrics] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)

  const fetchMetrics = async () => {
    setLoading(true)
    try {
      const data = await fetchWithAuth('/superadmin/system/')
      setMetrics(data)
      setLastUpdated(new Date())
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMetrics()
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
        fetchMetrics()
    }, 30000)
    return () => clearInterval(interval)
  }, [])

  if (loading && !metrics) {
    return (
      <Layout role="superadmin" pageTitle="System Configuration">
        <div className="flex items-center justify-center py-32">
          <RefreshCw className="animate-spin text-primary" size={32} />
        </div>
      </Layout>
    )
  }

  if (error && !metrics) {
    return (
      <Layout role="superadmin" pageTitle="Error">
         <div className="p-8 text-center text-danger flex flex-col items-center">
            <AlertCircle className="mb-4" size={48} />
            <h2 className="text-xl font-bold font-display">System Unreachable</h2>
            <p className="text-sm mt-2">{error}</p>
            <button onClick={fetchMetrics} className="btn-primary mt-6">Retry Connection</button>
         </div>
      </Layout>
    )
  }

  return (
    <Layout role="superadmin" pageTitle="System Configuration"
      actions={
        <button onClick={fetchMetrics} disabled={loading} className="btn-ghost px-4 text-xs font-bold uppercase tracking-wider flex items-center gap-2">
          <RefreshCw size={14} className={clsx(loading && "animate-spin")} />
          Refresh Stats
        </button>
      }
    >
      <div className="flex flex-col gap-6 max-w-5xl">
        
        {/* Host Info Header */}
        <div className="card p-6 border-l-4 border-l-primary flex items-start justify-between bg-bg2/40 shadow-sm relative overflow-hidden">
           <div className="absolute -right-4 -bottom-4 opacity-5 text-primary pointer-events-none">
              <Server size={180} />
           </div>
           <div>
              <h2 className="text-lg font-bold font-display text-txt flex items-center gap-2">
                  <Server size={18} className="text-primary"/> Host Environment
              </h2>
              <div className="flex gap-6 mt-3 text-sm">
                  <div>
                      <span className="text-[10px] text-txt3 font-bold uppercase tracking-widest block mb-0.5">Operating System</span>
                      <span className="font-mono text-txt font-bold">{metrics.system?.os || 'Unknown OS'}</span>
                  </div>
                  <div>
                      <span className="text-[10px] text-txt3 font-bold uppercase tracking-widest block mb-0.5">Runtime Environment</span>
                      <span className="font-mono text-txt font-bold">Python {metrics.system?.python_version || 'Unknown'}</span>
                  </div>
                  <div>
                      <span className="text-[10px] text-txt3 font-bold uppercase tracking-widest block mb-0.5">Service Status</span>
                      <span className="flex items-center gap-1.5 text-success font-bold text-xs uppercase bg-success/10 px-2 py-0.5 rounded-md mt-0.5">
                          <Activity size={12}/> {metrics.status}
                      </span>
                  </div>
              </div>
           </div>
           
           <div className="text-right">
              <span className="text-[10px] text-txt3 font-bold uppercase tracking-widest block mb-1">Last Sync</span>
              <span className="text-xs text-txt2 font-mono">{lastUpdated?.toLocaleTimeString()}</span>
           </div>
        </div>

        {/* Live Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* CPU Usage */}
            <div className="card p-6 shadow-xl border-t-2 border-t-accent hover:shadow-2xl transition-shadow group">
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-3">
                       <div className="p-2.5 bg-accent/10 text-accent rounded-xl group-hover:bg-accent group-hover:text-white transition-colors">
                           <Cpu size={20} />
                       </div>
                       <h3 className="font-bold text-sm uppercase tracking-widest text-txt3">CPU Processing</h3>
                    </div>
                </div>
                
                <div className="flex items-end gap-2 mb-2">
                    <span className="text-4xl font-display font-bold text-txt">{metrics.cpu?.percent.toFixed(1)}%</span>
                    <span className="text-xs text-txt3 mb-1.5 uppercase font-bold tracking-widest">Load</span>
                </div>
                
                <ProgressBar 
                    value={metrics.cpu?.percent} 
                    max={100} 
                    color={metrics.cpu?.percent > 85 ? '#EF4444' : '#A374F9'} 
                    height={8} 
                />
                
                <div className="mt-4 flex justify-between text-[11px] font-bold text-txt3 uppercase tracking-wider">
                    <span>Cores Configured</span>
                    <span className="text-txt font-mono text-xs">{metrics.cpu?.cores} vCPU</span>
                </div>
            </div>

            {/* Memory Usage */}
            <div className="card p-6 shadow-xl border-t-2 border-t-primary hover:shadow-2xl transition-shadow group">
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-3">
                       <div className="p-2.5 bg-primary/10 text-primary rounded-xl group-hover:bg-primary group-hover:text-white transition-colors">
                           <Activity size={20} />
                       </div>
                       <h3 className="font-bold text-sm uppercase tracking-widest text-txt3">Active Memory</h3>
                    </div>
                </div>
                
                <div className="flex items-end gap-2 mb-2">
                    <span className="text-4xl font-display font-bold text-txt">{metrics.memory?.percent.toFixed(1)}%</span>
                    <span className="text-xs text-txt3 mb-1.5 uppercase font-bold tracking-widest">Utilized</span>
                </div>
                
                <ProgressBar 
                    value={metrics.memory?.percent} 
                    max={100} 
                    color={metrics.memory?.percent > 90 ? '#EF4444' : '#4F8EF7'} 
                    height={8} 
                />
                
                <div className="mt-4 flex justify-between text-[11px] font-bold text-txt3 uppercase tracking-wider">
                    <span>{formatBytes(metrics.memory?.used)} / {formatBytes(metrics.memory?.total)}</span>
                </div>
            </div>

            {/* Storage Usage */}
            <div className="card p-6 shadow-xl border-t-2 border-t-success hover:shadow-2xl transition-shadow group">
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-3">
                       <div className="p-2.5 bg-success/10 text-success rounded-xl group-hover:bg-success group-hover:text-white transition-colors">
                           <HardDrive size={20} />
                       </div>
                       <h3 className="font-bold text-sm uppercase tracking-widest text-txt3">Host Storage</h3>
                    </div>
                </div>
                
                <div className="flex items-end gap-2 mb-2">
                    <span className="text-4xl font-display font-bold text-txt">{metrics.disk?.percent.toFixed(1)}%</span>
                    <span className="text-xs text-txt3 mb-1.5 uppercase font-bold tracking-widest">Filled</span>
                </div>
                
                <ProgressBar 
                    value={metrics.disk?.percent} 
                    max={100} 
                    color={metrics.disk?.percent > 85 ? '#EF4444' : '#10B981'} 
                    height={8} 
                />
                
                <div className="mt-4 flex justify-between text-[11px] font-bold text-txt3 uppercase tracking-wider">
                    <span>{formatBytes(metrics.disk?.used)} / {formatBytes(metrics.disk?.total)}</span>
                </div>
            </div>
            
        </div>

        {/* Warning Indicator */}
        {(metrics.cpu?.percent > 90 || metrics.memory?.percent > 90 || metrics.disk?.percent > 90) && (
            <div className="p-4 bg-danger/10 border border-danger/30 rounded-2xl flex items-center gap-3 text-danger">
                <AlertCircle size={20} className="shrink-0"/>
                <p className="text-sm font-medium">One or more host metrics are critically high. System performance may be severely degraded. Consider provisioning more resources immediately.</p>
            </div>
        )}

      </div>
    </Layout>
  )
}
