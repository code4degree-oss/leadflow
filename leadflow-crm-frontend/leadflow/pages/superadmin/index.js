import { useState, useEffect } from 'react'
import Layout from '../../components/Layout'
import { StatCard, MiniAreaChart, MiniBarChart, DonutChart, SectionHeader, StatusBadge, ProgressBar } from '../../components/UI'
import { Building2, Database, CreditCard, Users, TrendingUp, AlertTriangle, Download, ShieldCheck, Plus, MoreHorizontal, Eye, Ban, Trash2, RefreshCw, Bell } from 'lucide-react'
import { fetchWithAuth } from '../../utils/api'
import clsx from 'clsx'

export default function SuperAdminDashboard() {
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

  const fetchDashboard = () => {
    fetchClients();
  }
  const totalStorage = clients.reduce((acc, c) => acc + (c.storage_quota_mb || 0), 0)
  const totalEmployees = clients.reduce((acc, c) => acc + (c.user_count || 0), 0)

  return (
    <Layout role="superadmin" pageTitle="Platform Overview"
      actions={
        <div className="flex gap-2 text-txt3">
           <button className="p-2 hover:bg-card2 rounded-xl transition-all"><Bell size={14} /></button>
           <button onClick={fetchClients} className="p-2 hover:bg-card2 rounded-xl transition-all"><RefreshCw size={14} className={loading ? "animate-spin" : ""} /></button>
        </div>
      }>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <StatCard label="Total Clients" value={clients.length} sub={`${clients.filter(c => c.is_active).length} active`} color="accent" icon={Building2} />
        <StatCard label="Allocated Storage" value={`${(totalStorage / 1024).toFixed(1)} GB`} sub="platform quota" color="purple" icon={Database} />
        <StatCard label="Total Users" value={totalEmployees} sub="across all tenants" color="amber" icon={Users} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Growth chart (Placeholder for now) */}
        <div className="card p-5 lg:col-span-2 shadow-xl border-border/40">
          <SectionHeader title="Platform Adoption" sub="New client onboarding trend" />
          <div className="py-2">
            <MiniBarChart
              data={['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((m,i) => ({ name: m, v: 5 + Math.floor(Math.sin(i)*3 + i*0.8) }))}
              color="#4F8EF7" height={120}
            />
          </div>
        </div>
        {/* Plan distribution */}
        <div className="card p-5 shadow-xl border-border/40">
          <SectionHeader title="Tenant Distribution" />
          <div className="flex justify-center py-2">
             <DonutChart data={[
               { name: 'Active', value: clients.filter(c => c.is_active).length },
               { name: 'Suspended', value: clients.filter(c => !c.is_active).length },
             ]} height={120} />
          </div>
          <div className="space-y-2 mt-4 font-bold uppercase tracking-widest text-[9px] text-txt3">
             <div className="flex justify-between items-center bg-bg2/50 p-2 rounded-lg">
                <span>Active tenants</span>
                <span className="text-success">{clients.filter(c => c.is_active).length}</span>
             </div>
             <div className="flex justify-between items-center bg-bg2/50 p-2 rounded-lg text-danger">
                <span>Suspended</span>
                <span>{clients.filter(c => !c.is_active).length}</span>
             </div>
          </div>
        </div>
      </div>

      {/* Client List */}
      <div className="card overflow-hidden shadow-2xl border-primary/5">
        <div className="p-5 border-b border-border bg-bg2/30 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-txt">Infrastructure Management</h2>
            <p className="text-[10px] text-txt3 font-bold uppercase tracking-widest mt-0.5">Global Client Instances</p>
          </div>
          <button className="btn-ghost text-xs"><Download size={13}/>Platform Census</button>
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
                <tr key={c.id} className="table-row group">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                       <div className="w-9 h-9 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-bold shadow-inner border border-primary/20 group-hover:bg-primary group-hover:text-white transition-all">
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
                      <ProgressBar value={1} max={1} color="#4F8EF7" height={4} />
                    </div>
                  </td>
                  <td className="px-5 py-4 text-[10px] font-mono text-txt3">{new Date(c.created_at).toLocaleDateString()}</td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                      <button className="p-2 hover:bg-bg3 rounded-xl text-txt3 hover:text-primary transition-all"><Eye size={14}/></button>
                      <button className="p-2 hover:bg-bg3 rounded-xl text-txt3 hover:text-amber transition-all"><ShieldCheck size={14}/></button>
                      <button className="p-2 hover:bg-danger/5 rounded-xl text-txt3 hover:text-danger transition-all"><Ban size={14}/></button>
                      <button className="p-2 hover:bg-bg3 rounded-xl text-txt3 hover:text-primary transition-all"><Download size={14}/></button>
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
