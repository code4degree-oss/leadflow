import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Layout from '../../components/Layout'
import { StatusBadge, ProgressBar, Modal } from '../../components/UI'
import { Plus, Trash2, Download, KeyRound, Edit, Search, RefreshCw, AlertCircle, ToggleLeft, ToggleRight, CheckCircle2, Copy, CalendarCheck } from 'lucide-react'
import clsx from 'clsx'
import { fetchWithAuth } from '../../utils/api'
import toast from 'react-hot-toast'

export default function SuperAdminClients() {
  const router = useRouter()
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [resetModal, setResetModal] = useState({ isOpen: false, email: '', password: '' })
  const [errorModal, setErrorModal] = useState({ isOpen: false, message: '' })
  const [renewModal, setRenewModal] = useState({ isOpen: false, clientId: null, clientName: '', newDate: '' })
  const [copied, setCopied] = useState(false)

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

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this tenant? This is destructive!')) return
    try {
      await fetchWithAuth(`/superadmin/clients/clients/${id}/`, { method: 'DELETE' })
      toast.success('Organization deleted successfully.')
      fetchClients()
    } catch (err) {
      toast.error(err.message)
      setErrorModal({ isOpen: true, message: err.message })
    }
  }

  const handleResetPassword = async (id) => {
    if (!confirm('Reset admin password? The admin will need to change it on next login.')) return
    try {
      const resp = await fetchWithAuth(`/superadmin/clients/clients/${id}/reset-password/`, { method: 'POST' })
      toast.success('Password reset successful!')
      setResetModal({ isOpen: true, email: resp.email, password: resp.new_password })
    } catch (err) {
      toast.error(err.message)
      setErrorModal({ isOpen: true, message: err.message })
    }
  }

  const copyResetCredentials = () => {
    navigator.clipboard.writeText(`Email: ${resetModal.email}\nPassword: ${resetModal.password}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
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
      toast.error(err.message)
      setErrorModal({ isOpen: true, message: err.message })
    }
  }

  const handleRenew = async () => {
    if (!renewModal.newDate) return
    try {
      await fetchWithAuth(`/superadmin/clients/clients/${renewModal.clientId}/renew/`, {
        method: 'POST',
        body: JSON.stringify({ valid_until: renewModal.newDate })
      })
      toast.success(`Subscription renewed until ${renewModal.newDate}!`)
      setRenewModal({ isOpen: false, clientId: null, clientName: '', newDate: '' })
      fetchClients()
    } catch (err) {
      toast.error(err.message)
      setErrorModal({ isOpen: true, message: err.message })
    }
  }

  const getSubBadge = (c) => {
    const st = c.subscription_status
    const dr = c.days_remaining
    if (st === 'expired') return { label: 'Expired', cls: 'bg-danger/10 text-danger border-danger/20' }
    if (st === 'expiring_soon') return { label: `${dr}d left`, cls: 'bg-amber-500/10 text-amber-600 border-amber-500/20' }
    if (st === 'active') return { label: `${dr}d left`, cls: 'bg-success/10 text-success border-success/20' }
    return { label: 'No plan', cls: 'bg-bg3 text-txt3 border-border' }
  }

  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <Layout role="superadmin" pageTitle="Client Accounts"
      actions={
        <div className="flex gap-2">
           <button onClick={fetchClients} className="p-2 text-txt3 hover:text-primary transition-all">
             <RefreshCw size={14} className={clsx(loading && "animate-spin")} />
           </button>
           <button className="btn-primary shadow-lg shadow-primary/20" onClick={() => router.push('/superadmin/clients/new')}>
             <Plus size={14}/>Add Organization
           </button>
        </div>
      }
    >

      {/* Summary Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Organizations', value: clients.length, color: 'text-txt' },
          { label: 'Active Instances', value: clients.filter(c=>c.is_active).length, color: 'text-success' },
          { label: 'Platform Users', value: clients.reduce((acc, c) => acc + (c.user_count || 0), 0), color: 'text-accent' },
          { label: 'Suspended', value: clients.filter(c=>!c.is_active).length, color: 'text-danger' },
        ].map(s => (
          <div key={s.label} className="card p-4 hover:border-primary/20 transition-all group">
            <div className={clsx('font-display font-bold text-2xl group-hover:scale-105 transition-transform origin-left', s.color)}>{s.value}</div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-txt3 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters & Actions */}
      <div className="flex flex-col md:flex-row gap-4 mb-6 p-4 bg-card border border-border rounded-2xl shadow-sm">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-txt3" />
          <input 
            value={search} 
            onChange={e=>setSearch(e.target.value)}
            className="input pl-10 h-10 text-sm bg-bg3 border-border/50 focus:border-primary w-full" 
            placeholder="Search by company name…" 
          />
        </div>
        <div className="flex gap-2">
           <button className="btn-ghost px-4 text-xs font-bold uppercase tracking-wider">Plan Filter</button>
           <button className="btn-ghost px-4 text-xs font-bold uppercase tracking-wider"><Download size={14}/>Export Census</button>
        </div>
      </div>

      {/* Main Table */}
      <div className="card overflow-hidden shadow-2xl border-primary/5">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-bg2/50 border-b border-border">
                {['Organization','Status','Subscription','User Load','Actions'].map(h=>(
                  <th key={h} className="px-5 py-4 text-[10px] font-bold text-txt3 uppercase tracking-widest">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading && clients.length === 0 ? (
                <tr>
                  <td colSpan="5" className="py-24 text-center">
                    <RefreshCw className="animate-spin mx-auto text-primary mb-2" size={32} />
                    <p className="text-xs text-txt3 font-bold uppercase tracking-widest">Indexing global tenants...</p>
                  </td>
                </tr>
              ) : error ? (
                <tr><td colSpan="5" className="py-20 text-center text-danger font-bold text-sm bg-danger/5"><AlertCircle className="mx-auto mb-2" />{error}</td></tr>
              ) : (
                filtered.map((c) => {
                  const badge = getSubBadge(c)
                  return (
                  <tr key={c.id} onClick={() => router.push(`/superadmin/clients/view/${c.id}`)} className="cursor-pointer hover:bg-bg2/40 transition-colors group">
                    <td className="px-5 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-bg3 border border-border flex items-center justify-center text-txt text-xs font-bold shadow-sm group-hover:bg-primary/10 group-hover:text-primary transition-all">
                          {c.name[0]}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-bold text-sm text-txt group-hover:text-primary transition-colors">{c.name}</span>
                          <span className="text-[10px] text-txt3 font-bold uppercase">ID: {c.id.substring(0,8)}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-5"><StatusBadge status={c.is_active ? 'active' : 'inactive'} /></td>
                    <td className="px-5 py-5">
                      <div className="flex flex-col gap-1">
                        <span className={clsx('inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-bold uppercase tracking-wider w-fit', badge.cls)}>
                          {badge.label}
                        </span>
                        {c.valid_until && (
                          <span className="text-[10px] text-txt3 font-mono">{c.valid_until}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-5">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-bold text-txt">{c.user_count} / {c.max_users}</span>
                        <ProgressBar value={c.user_count} max={c.max_users} color={c.user_count/c.max_users > 0.9 ? '#EF4444' : '#4F8EF7'} height={4} />
                      </div>
                    </td>
                    <td className="px-5 py-5">
                      <div className="flex gap-1">
                        <button onClick={(e) => { e.stopPropagation(); router.push(`/superadmin/clients/${c.id}`) }} className="p-2 hover:bg-primary/10 rounded-lg text-txt3 hover:text-primary transition-all" title="Edit Organization"><Edit size={14}/></button>
                        <button onClick={(e) => { e.stopPropagation(); setRenewModal({ isOpen: true, clientId: c.id, clientName: c.name, newDate: '' }) }} className="p-2 hover:bg-success/10 rounded-lg text-txt3 hover:text-success transition-all" title="Renew Subscription"><CalendarCheck size={14}/></button>
                        <button onClick={(e) => { e.stopPropagation(); handleToggleActive(c) }} className={`p-2 rounded-lg transition-all ${c.is_active ? 'hover:bg-warning/10 text-txt3 hover:text-warning' : 'hover:bg-success/10 text-txt3 hover:text-success'}`} title={c.is_active ? 'Suspend Organization' : 'Reactivate Organization'}>
                          {c.is_active ? <ToggleRight size={14}/> : <ToggleLeft size={14}/>}
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); handleResetPassword(c.id) }} className="p-2 hover:bg-accent/10 rounded-lg text-txt3 hover:text-accent transition-all" title="Reset Admin Password"><KeyRound size={14}/></button>
                        <button onClick={(e) => { e.stopPropagation(); handleDelete(c.id) }} className="p-2 hover:bg-danger/10 rounded-lg text-txt3 hover:text-danger transition-all" title="Delete Organization"><Trash2 size={14}/></button>
                      </div>
                    </td>
                  </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal 
        isOpen={resetModal.isOpen} 
        onClose={() => setResetModal({ ...resetModal, isOpen: false })}
        title="Password Reset Successful"
        footer={
          <button onClick={() => setResetModal({ ...resetModal, isOpen: false })} className="btn-primary px-6 py-2">Close</button>
        }
      >
        <div className="space-y-4">
          <p className="text-xs text-txt3 leading-relaxed">
            The administrator password has been updated. Provide these credentials to the client. 
            They will be **forced to change it** on their next login.
          </p>
          
          <div className="p-4 bg-bg3 rounded-xl border border-border space-y-3 relative group">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widests text-txt3 mb-0.5">Admin Email</div>
              <div className="text-sm font-mono text-txt font-bold">{resetModal.email}</div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widests text-txt3 mb-0.5">New Password</div>
              <div className="text-sm font-mono text-primary font-bold tracking-wider">{resetModal.password}</div>
            </div>
            
            <button 
              onClick={copyResetCredentials}
              className="absolute top-4 right-4 p-2 bg-card hover:bg-primary/10 rounded-lg text-txt3 hover:text-primary transition-all shadow-sm border border-border"
              title="Copy Credentials"
            >
              {copied ? <CheckCircle2 size={14} className="text-success" /> : <Copy size={14} />}
            </button>
          </div>

          <div className="p-3 bg-amber/5 border border-amber/20 rounded-xl">
            <p className="text-[10px] text-amber-600 font-medium">
              ⚠️ Copy these now. This password will not be shown again.
            </p>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={errorModal.isOpen}
        onClose={() => setErrorModal({ ...errorModal, isOpen: false })}
        title="Action Failed"
        footer={
          <button onClick={() => setErrorModal({ ...errorModal, isOpen: false })} className="btn-primary px-6 py-2">Okay</button>
        }
      >
        <div className="flex items-start gap-4 text-danger bg-danger/5 p-4 rounded-xl border border-danger/20">
          <AlertCircle className="shrink-0 mt-0.5" size={18} />
          <p className="text-sm font-medium leading-relaxed">{errorModal.message}</p>
        </div>
      </Modal>

      {/* Renew Subscription Modal */}
      <Modal
        isOpen={renewModal.isOpen}
        onClose={() => setRenewModal({ ...renewModal, isOpen: false })}
        title="Renew Subscription"
        footer={
          <div className="flex gap-2">
            <button onClick={() => setRenewModal({ ...renewModal, isOpen: false })} className="btn-ghost px-6 py-2 rounded-xl border border-border">Cancel</button>
            <button onClick={handleRenew} disabled={!renewModal.newDate} className="btn-primary px-6 py-2 disabled:opacity-50">Renew Now</button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-txt2 leading-relaxed">
            Renewing subscription for <strong className="text-txt">{renewModal.clientName}</strong>. 
            Select the new end date below. The client will be instantly reactivated.
          </p>
          
          <div className="p-4 bg-bg3 rounded-xl border border-border">
            <label className="text-[10px] font-bold uppercase tracking-widest text-txt3 block mb-2">New Subscription End Date</label>
            <input 
              type="date" 
              className="input w-full bg-card text-sm"
              value={renewModal.newDate}
              min={new Date().toISOString().split('T')[0]}
              onChange={e => setRenewModal({ ...renewModal, newDate: e.target.value })}
            />
          </div>

          <div className="p-3 bg-accent/5 border border-accent/15 rounded-xl">
            <p className="text-[10px] text-txt2 font-medium">
              ✅ This will set <strong>is_active = true</strong>, update the subscription start to today, and set the end date to your selection.
            </p>
          </div>
        </div>
      </Modal>
    </Layout>
  )
}
