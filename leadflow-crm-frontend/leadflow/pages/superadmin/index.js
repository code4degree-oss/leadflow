import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Layout from '../../components/Layout'
import { StatCard, MiniBarChart, DonutChart, SectionHeader, StatusBadge, ProgressBar } from '../../components/UI'
import { Building2, Database, CreditCard, Users, TrendingUp, AlertTriangle, Download, ShieldCheck, Plus, Eye, Ban, RefreshCw, Bell, CheckCircle2, XCircle } from 'lucide-react'
import { fetchWithAuth, API_BASE } from '../../utils/api'
import clsx from 'clsx'
import toast from 'react-hot-toast'

export default function SuperAdminDashboard() {
  const router = useRouter()
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchClients()
  }, [])

  const fetchClients = async () => {
    setLoading(true)
    try {
      const data = await fetchWithAuth('/superadmin/clients/clients/')
      setClients(data.results || data || [])
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Compute real adoption chart data from client created_at dates
  const getAdoptionData = () => {
    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    const counts = {}
    monthNames.forEach(m => counts[m] = 0)
    
    clients.forEach(c => {
      if (c.created_at) {
        const d = new Date(c.created_at)
        const monthIdx = d.getMonth()
        counts[monthNames[monthIdx]] = (counts[monthNames[monthIdx]] || 0) + 1
      }
    })
    
    return monthNames.map(m => ({ name: m, v: counts[m] }))
  }

  const handleToggleActive = async (client) => {
    const action = client.is_active ? 'suspend' : 'reactivate'
    if (!confirm(`Are you sure you want to ${action} "${client.name}"?`)) return
    try {
      await fetchWithAuth(`/superadmin/clients/clients/${client.id}/`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: !client.is_active })
      })
      toast.success(`${client.name} has been ${client.is_active ? 'suspended' : 'reactivated'}.`)
      fetchClients()
    } catch (err) {
      toast.error('Failed: ' + err.message)
    }
  }

  const handleExport = async (client) => {
    try {
      const url = `${API_BASE}/superadmin/clients/clients/${client.id}/export-data/?type=full`
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` }
      })
      if (!response.ok) throw new Error('Export failed')
      const blob = await response.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = downloadUrl
      const safeName = client.name.replace(/[^a-zA-Z0-9 _-]/g, '').replace(/ /g, '_').toLowerCase()
      a.download = `${safeName}_full_export.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(downloadUrl)
      toast.success(`Exported data for ${client.name}`)
    } catch (err) {
      toast.error('Export failed: ' + err.message)
    }
  }

  const totalStorage = clients.reduce((acc, c) => acc + (c.storage_quota_mb || 0), 0)
  const totalEmployees = clients.reduce((acc, c) => acc + (c.user_count || 0), 0)
  const activeClients = clients.filter(c => c.is_active)
  const expiringSoon = clients.filter(c => c.subscription_status === 'expiring_soon')
  const expired = clients.filter(c => c.subscription_status === 'expired')

  return (
    <Layout role="superadmin" pageTitle="Platform Overview"
      actions={
        <div className="flex gap-2 text-txt3">
           <button className="p-2 hover:bg-card2 rounded-xl transition-all"><Bell size={14} /></button>
           <button onClick={fetchClients} className="p-2 hover:bg-card2 rounded-xl transition-all"><RefreshCw size={14} className={loading ? "animate-spin" : ""} /></button>
        </div>
      }>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
        <StatCard label="Total Clients" value={clients.length} sub={`${activeClients.length} active`} color="accent" icon={Building2} />
        <StatCard label="Total Users" value={totalEmployees} sub="Platform-wide" color="amber" icon={Users} />
        <StatCard label="Allocated Storage" value={`${(totalStorage / 1024).toFixed(1)} GB`} sub="platform quota" color="purple" icon={Database} />
        {expiringSoon.length > 0 || expired.length > 0 ? (
          <StatCard label="Attention Needed" value={expiringSoon.length + expired.length} sub={`${expiringSoon.length} expiring · ${expired.length} expired`} color="danger" icon={AlertTriangle} />
        ) : (
          <StatCard label="Subscription Health" value="All Good" sub="no expirations pending" color="accent2" icon={CheckCircle2} />
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        {/* Adoption chart — real data from client created_at */}
        <div className="card p-5 lg:col-span-2 shadow-xl border-border/40">
          <SectionHeader title="Client Onboarding" sub="New organizations registered by month" />
          <div className="py-2">
            <MiniBarChart
              data={getAdoptionData()}
              color="#4F8EF7" height={120}
            />
          </div>
        </div>
        {/* Tenant distribution — real data */}
        <div className="card p-5 shadow-xl border-border/40">
          <SectionHeader title="Tenant Distribution" />
          <div className="flex justify-center py-2">
             <DonutChart data={[
               { name: 'Active', value: activeClients.length },
               { name: 'Suspended', value: clients.filter(c => !c.is_active).length },
             ]} height={120} />
          </div>
          <div className="space-y-2 mt-4 font-bold uppercase tracking-widest text-[9px] text-txt3">
             <div className="flex justify-between items-center bg-bg2/50 p-2 rounded-lg">
                <span>Active tenants</span>
                <span className="text-success">{activeClients.length}</span>
             </div>
             <div className="flex justify-between items-center bg-bg2/50 p-2 rounded-lg text-danger">
                <span>Suspended</span>
                <span>{clients.filter(c => !c.is_active).length}</span>
             </div>
             {expiringSoon.length > 0 && (
               <div className="flex justify-between items-center bg-amber-500/10 p-2 rounded-lg text-amber-500">
                  <span>Expiring Soon</span>
                  <span>{expiringSoon.length}</span>
               </div>
             )}
          </div>
        </div>
      </div>

      {/* Client List */}
      <div className="card overflow-hidden shadow-lg border border-border/60">
        <div className="p-6 border-b border-border bg-bg2/20 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-txt">Infrastructure Management</h2>
            <p className="text-[10px] text-txt3 font-bold uppercase tracking-widest mt-0.5">Global Client Instances</p>
          </div>
          <button onClick={() => router.push('/superadmin/clients/new')} className="btn-primary text-xs"><Plus size={13}/>Add Organization</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-bg2/50 border-b border-border">
                {['Organization','Subdomain','Status','Users','Storage Quota','Created','Actions'].map(h => (
                  <th key={h} className="px-5 py-4 text-[10px] font-bold text-txt3 uppercase tracking-widest">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading && clients.length === 0 ? (
                 <tr><td colSpan="7" className="py-20 text-center"><RefreshCw size={24} className="animate-spin mx-auto text-primary" /></td></tr>
              ) : clients.length === 0 ? (
                 <tr><td colSpan="7" className="py-20 text-center text-txt3 uppercase tracking-tighter text-xs">No client accounts found</td></tr>
              ) : clients.map((c) => (
                <tr key={c.id} className="table-row group hover:bg-bg2/40 transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-4">
                       <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold shadow-sm border border-primary/20 group-hover:bg-primary group-hover:text-white transition-all">
                         {c.name[0]}
                       </div>
                       <span className="font-bold text-sm text-txt group-hover:text-primary transition-colors">{c.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-xs font-mono text-txt3">{c.subdomain || 'default'}</td>
                  <td className="px-5 py-4"><StatusBadge status={c.is_active ? 'active' : 'inactive'} /></td>
                  <td className="px-5 py-4">
                     <div className="flex flex-col">
                        <span className="text-xs font-bold text-txt">{c.user_count}</span>
                        <span className="text-[9px] text-txt3 font-bold uppercase tracking-tighter">max: {c.max_users}</span>
                     </div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex flex-col justify-center gap-1.5">
                      <span className="text-[10px] font-mono text-txt3 font-bold">{c.storage_quota_mb} MB</span>
                      <ProgressBar value={c.storage_used_mb || 0} max={c.storage_quota_mb || 1} color="#4F8EF7" height={4} />
                    </div>
                  </td>
                  <td className="px-5 py-4 text-[10px] font-mono text-txt3">{new Date(c.created_at).toLocaleDateString()}</td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-1 opacity-40 group-hover:opacity-100 transition-all">
                      <button onClick={() => router.push(`/superadmin/clients/view/${c.id}`)} className="p-2 hover:bg-bg3 rounded-xl text-txt3 hover:text-primary transition-all" title="View Details"><Eye size={14}/></button>
                      <button onClick={() => handleToggleActive(c)} className={clsx("p-2 rounded-xl transition-all", c.is_active ? "hover:bg-danger/5 text-txt3 hover:text-danger" : "hover:bg-success/5 text-txt3 hover:text-success")} title={c.is_active ? 'Suspend' : 'Reactivate'}>{c.is_active ? <Ban size={14}/> : <CheckCircle2 size={14}/>}</button>
                      <button onClick={() => handleExport(c)} className="p-2 hover:bg-bg3 rounded-xl text-txt3 hover:text-primary transition-all" title="Export Data"><Download size={14}/></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  )
}
