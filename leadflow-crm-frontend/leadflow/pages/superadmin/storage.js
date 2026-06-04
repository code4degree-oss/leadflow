import { useState, useEffect } from 'react'
import Layout from '../../components/Layout'
import { ProgressBar } from '../../components/UI'
import { Database, AlertTriangle, TrendingUp } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import clsx from 'clsx'
import { fetchWithAuth } from '../../utils/api'

const TOOLTIP_STYLE = {
  contentStyle: { background:'#141926', border:'1px solid #1E2640', borderRadius:8, fontSize:12 },
  itemStyle: { color:'#E4E8F5' }, labelStyle: { color:'#8B92A8' },
}

const formatStorage = (mbValue) => {
  if (!mbValue) return '0 KB';
  if (mbValue < 1) return `${(mbValue * 1024).toFixed(1)} KB`;
  if (mbValue < 1024) return `${mbValue.toFixed(1)} MB`;
  return `${(mbValue / 1024).toFixed(1)} GB`;
}

export default function StorageQuotas() {
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchWithAuth('/superadmin/clients/clients/')
      .then(data => {
        const list = data.results || data || []
        setClients(list.map(c => ({
          name: c.name,
          used: c.storage_used_mb || 0,
          limit: c.storage_quota_mb || 1024,
          plan: c.plan || 'basic'
        })))
      })
      .finally(() => setLoading(false))
  }, [])

  const total_used  = clients.reduce((s,c)=>s+c.used,0)
  const total_limit = clients.reduce((s,c)=>s+c.limit,0) || 1
  const nearQuotaClients = clients.filter(c => (c.used / c.limit) >= 0.85)
  const avgUsagePct = clients.length > 0 ? Math.round((total_used / total_limit) * 100) : 0

  return (
    <Layout role="superadmin" pageTitle="Storage & Quotas">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-3">
            <Database size={15} className="text-accent" />
            <span className="text-xs text-txt2 font-medium uppercase tracking-wider">Platform Total</span>
          </div>
          <div className="font-display font-bold text-2xl text-txt mb-2">{formatStorage(total_used)} <span className="text-txt3 text-base font-normal">/ {formatStorage(total_limit)}</span></div>
          <ProgressBar value={total_used} max={total_limit} color="#4F8EF7" height={6} />
          <div className="text-xs text-txt3 mt-2">{Math.round(total_used/total_limit*100)}% allocated storage used</div>
        </div>
        <div className="card p-5 border-amber/20 bg-amber/5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={15} className="text-amber" />
            <span className="text-xs text-amber font-medium uppercase tracking-wider">Near Quota</span>
          </div>
          <div className="font-display font-bold text-2xl text-amber">{nearQuotaClients.length}</div>
          <div className="text-xs text-txt2 mt-1">clients above 85% usage</div>
          {nearQuotaClients.length > 0 && (
            <div className="text-xs text-txt3 mt-1">{nearQuotaClients.map(c => c.name).join(' · ')}</div>
          )}
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={15} className="text-accent2" />
            <span className="text-xs text-txt2 font-medium uppercase tracking-wider">Avg Usage</span>
          </div>
          <div className="font-display font-bold text-2xl text-accent2">{avgUsagePct}%</div>
          <div className="text-xs text-txt2 mt-1">average storage utilization</div>
        </div>
      </div>

      {/* Bar chart */}
      <div className="card p-5 mb-6">
        <h2 className="font-display font-bold text-sm text-txt mb-4">Storage Per Client</h2>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={clients.map(c=>({ name:c.name.split(' ')[0], used:c.used, limit:c.limit }))}
            margin={{ top:0, right:10, bottom:0, left:-20 }} barSize={28}>
            <XAxis dataKey="name" tick={{ fontSize:11, fill:'#545B72' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize:10, fill:'#545B72' }} axisLine={false} tickLine={false} />
            <Tooltip {...TOOLTIP_STYLE} formatter={(v)=>[formatStorage(v)]} />
            <Bar dataKey="used" radius={[4,4,0,0]}>
              {clients.map((c,i) => (
                <Cell key={i} fill={c.used/c.limit > 0.85 ? '#F5A623' : c.used/c.limit > 0.7 ? '#4F8EF7' : '#1E2640'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Detailed table */}
      <div className="card overflow-hidden">
        <div className="p-4 border-b border-border">
          <h2 className="font-display font-bold text-sm text-txt">Per-Client Storage Detail</h2>
        </div>
        <table className="w-full">
          <thead className="border-b border-border bg-bg2/50">
            <tr>{['Client','Plan','Used','Limit','Usage','Status','Action'].map(h=><th key={h} className="th">{h}</th>)}</tr>
          </thead>
          <tbody>
            {clients.map((c,i) => {
              const pct = Math.round(c.used/c.limit*100)
              const warn = pct >= 100 ? 'text-danger' : pct >= 85 ? 'text-amber' : 'text-accent2'
              return (
                <tr key={i} className="table-row">
                  <td className="td font-medium text-txt">{c.name}</td>
                  <td className="td"><span className={clsx('badge capitalize',
                    c.plan==='enterprise'?'badge-purple':c.plan==='pro'?'badge-blue':'badge-gray')}>{c.plan}</span></td>
                  <td className="td font-mono text-txt2 text-xs">{formatStorage(c.used)}</td>
                  <td className="td font-mono text-txt2 text-xs">{formatStorage(c.limit)}</td>
                  <td className="td">
                    <div className="w-32">
                      <div className="flex justify-between text-xs mb-1">
                        <span className={warn}>{pct}%</span>
                      </div>
                      <ProgressBar value={c.used} max={c.limit}
                        color={pct>=100?'#FF5A5A':pct>=85?'#F5A623':'#4F8EF7'} height={4} />
                    </div>
                  </td>
                  <td className="td">
                    {pct >= 100 ? <span className="badge badge-red">Blocked</span>
                    : pct >= 85 ? <span className="badge badge-amber">Warning</span>
                    : <span className="badge badge-green">OK</span>}
                  </td>
                  <td className="td">
                    <button className="btn-ghost text-xs py-1">Upgrade Quota</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Layout>
  )
}
