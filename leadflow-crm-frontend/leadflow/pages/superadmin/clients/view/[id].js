import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Layout from '../../../../components/Layout'
import { StatusBadge, ProgressBar, Modal } from '../../../../components/UI'
import { ArrowLeft, Building2, KeyRound, AlertCircle, ToggleLeft, ToggleRight, CheckCircle2, Copy, HardDrive, Users, Phone, Mail, RefreshCw, ShieldCheck, Globe, MapPin } from 'lucide-react'
import { fetchWithAuth } from '../../../../utils/api'
import clsx from 'clsx'

export default function ClientMasterPanel() {
  const router = useRouter()
  const { id } = router.query

  const [client, setClient] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [resetModal, setResetModal] = useState({ isOpen: false, email: '', password: '' })
  const [storageModal, setStorageModal] = useState(false)
  const [newStorageQuota, setNewStorageQuota] = useState('')
  const [updatingStorage, setUpdatingStorage] = useState(false)
  
  // Subscription Manage State
  const [subModal, setSubModal] = useState(false)
  const [subForm, setSubForm] = useState({ plan: 'basic', valid_until: '', max_users: 5 })
  const [updatingSub, setUpdatingSub] = useState(false)

  const [errorModal, setErrorModal] = useState({ isOpen: false, message: '' })
  const [copied, setCopied] = useState(false)
  
  const [featureModal, setFeatureModal] = useState(false)
  const [togglingFeature, setTogglingFeature] = useState(false)

  useEffect(() => {
    if (id) {
      fetchClientDetails()
    }
  }, [id])

  const fetchClientDetails = async () => {
    setLoading(true)
    try {
      const data = await fetchWithAuth(`/superadmin/clients/clients/${id}/details/`)
      setClient(data)
      setNewStorageQuota(data.storage_quota_mb.toString())
      setSubForm({ plan: data.plan || 'basic', valid_until: data.valid_until || '', max_users: data.max_users || 5 })
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleToggleActive = async () => {
    const action = client.is_active ? 'suspend' : 'reactivate'
    if (!confirm(`Are you sure you want to ${action} "${client.name}"?`)) return
    try {
      await fetchWithAuth(`/superadmin/clients/clients/${id}/`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: !client.is_active })
      })
      fetchClientDetails()
    } catch (err) {
      setErrorModal({ isOpen: true, message: err.message })
    }
  }

  const handleResetPassword = async () => {
    if (!confirm('Reset admin password? The admin will need to change it on next login.')) return
    try {
      const resp = await fetchWithAuth(`/superadmin/clients/clients/${id}/reset-password/`, { method: 'POST' })
      setResetModal({ isOpen: true, email: resp.email, password: resp.new_password })
    } catch (err) {
      setErrorModal({ isOpen: true, message: err.message })
    }
  }

  const handleUpdateStorage = async (e) => {
    e.preventDefault()
    setUpdatingStorage(true)
    try {
      await fetchWithAuth(`/superadmin/clients/clients/${id}/`, {
        method: 'PATCH',
        body: JSON.stringify({ storage_quota_mb: parseInt(newStorageQuota) })
      })
      setStorageModal(false)
      fetchClientDetails()
    } catch (err) {
      setErrorModal({ isOpen: true, message: err.message })
    } finally {
      setUpdatingStorage(false)
    }
  }

  const handleUpdateSubscription = async (e) => {
    e.preventDefault()
    setUpdatingSub(true)
    try {
      await fetchWithAuth(`/superadmin/clients/clients/${id}/`, {
        method: 'PATCH',
        body: JSON.stringify({
          plan: subForm.plan,
          valid_until: subForm.valid_until,
          max_users: parseInt(subForm.max_users)
        })
      })
      setSubModal(false)
      fetchClientDetails()
    } catch (err) {
      setErrorModal({ isOpen: true, message: err.message })
    } finally {
      setUpdatingSub(false)
    }
  }

  const handleToggleFeature = async (featureName) => {
    setTogglingFeature(true)
    try {
      const payload = {}
      if (featureName === 'geofencing') payload.geofencing_enabled = !client.geofencing_enabled
      
      const updated = await fetchWithAuth(`/superadmin/clients/clients/${id}/`, {
        method: 'PATCH',
        body: JSON.stringify(payload)
      })
      setClient({ ...client, ...updated })
    } catch (err) {
      setErrorModal({ isOpen: true, message: err.message })
    } finally {
      setTogglingFeature(false)
    }
  }

  const copyResetCredentials = () => {
    navigator.clipboard.writeText(`Email: ${resetModal.email}\nPassword: ${resetModal.password}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading && !client) {
    return (
      <Layout role="superadmin" pageTitle="Loading Client Details...">
        <div className="flex items-center justify-center py-32">
          <RefreshCw className="animate-spin text-primary" size={32} />
        </div>
      </Layout>
    )
  }

  if (error && !client) {
    return (
      <Layout role="superadmin" pageTitle="Error">
        <div className="p-8 text-center text-danger">
          <AlertCircle className="mx-auto mb-4" size={48} />
          <h2 className="text-xl font-bold font-display">Could not load client</h2>
          <p>{error}</p>
          <button onClick={() => router.push('/superadmin/clients')} className="btn-primary mt-6">Go Back</button>
        </div>
      </Layout>
    )
  }

  return (
    <Layout role="superadmin" pageTitle={`Client Overview: ${client?.name || 'Loading...'}`}
      actions={
        <div className="flex gap-2">
          <button onClick={fetchClientDetails} className="p-2 text-txt3 hover:text-primary transition-all">
            <RefreshCw size={14} className={clsx(loading && "animate-spin")} />
          </button>
          <button onClick={() => router.push('/superadmin/clients')} className="btn-ghost px-4 text-xs font-bold uppercase tracking-wider">
            <ArrowLeft size={14} className="mr-1 inline" />Back
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-6">
        
        {/* Top Section: Client Header & Admin Details */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="card p-6 flex items-start gap-4 lg:col-span-2 shadow-xl border-primary/5">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex flex-col items-center justify-center text-primary border border-primary/20 shrink-0 shadow-inner">
              <span className="text-2xl font-bold font-display">{client.name ? client.name[0].toUpperCase() : <Building2 />}</span>
            </div>
            <div className="flex-1">
              <div className="flex justify-between items-start mb-1">
                <h1 className="text-2xl font-bold font-display text-txt">{client.name}</h1>
                <StatusBadge status={client.is_active ? 'active' : 'inactive'} />
              </div>
              <p className="text-xs text-txt3 font-mono mb-4">ID: {client.id}</p>
              
              <div className="flex flex-wrap gap-2">
                <button onClick={() => router.push(`/superadmin/clients/${client.id}`)} className="btn-ghost text-xs px-3 py-1.5 rounded-lg bg-bg2">Edit Org</button>
                <button onClick={handleToggleActive} className={clsx("btn-ghost text-xs px-3 py-1.5 rounded-lg", client.is_active ? 'bg-warning/10 text-warning hover:bg-warning/20' : 'bg-success/10 text-success hover:bg-success/20')}>
                  {client.is_active ? <ToggleRight size={14}/> : <ToggleLeft size={14}/>} {client.is_active ? 'Suspend' : 'Reactivate'}
                </button>
                <button onClick={handleResetPassword} className="btn-ghost text-xs px-3 py-1.5 rounded-lg bg-accent/10 text-accent hover:bg-accent/20">
                  <KeyRound size={14}/> Reset Admin Pass
                </button>
                <button onClick={() => setStorageModal(true)} className="btn-ghost text-xs px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20">
                  <HardDrive size={14}/> Update Storage
                </button>
                <button onClick={() => setFeatureModal(true)} className="btn-ghost text-xs px-3 py-1.5 rounded-lg bg-accent/10 text-accent hover:bg-accent/20 border border-accent/20 shadow-sm transition-all hover:scale-[1.02]">
                  <Globe size={14}/> Manage Features
                </button>
              </div>
            </div>
          </div>

          <div className="card p-6 shadow-xl border-bg2 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-full -z-10 group-hover:scale-110 transition-transform"></div>
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-txt3 mb-4 flex items-center gap-2">
              <ShieldCheck size={14} className="text-primary"/> Admin Contact
            </h3>
            <div className="space-y-3">
              <div>
                <p className="text-sm font-bold text-txt">{client.admin_first_name} {client.admin_last_name}</p>
                <p className="text-[10px] text-txt3 uppercase tracking-wider font-bold">Primary Admin</p>
              </div>
              <div className="flex items-center gap-2 text-sm text-txt2 hover:text-primary transition-colors">
                <Mail size={14} className="text-txt3"/> {client.admin_email}
              </div>
              {client.admin_phone && (
                <div className="flex items-center gap-2 text-sm text-txt2 hover:text-primary transition-colors">
                  <Phone size={14} className="text-txt3"/> {client.admin_phone}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Resources Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           <div className="card p-5 group">
             <div className="flex justify-between items-center mb-4">
               <h3 className="text-[10px] font-bold uppercase tracking-widest text-txt3 flex items-center gap-2"><HardDrive size={14} className="text-primary"/> Storage Capacity</h3>
               <span className="text-xs font-bold font-mono bg-bg2 px-2 py-0.5 rounded text-txt">{client.storage_used_mb || 0} / {client.storage_quota_mb} MB</span>
             </div>
             <ProgressBar 
               value={client.storage_used_mb || 0} 
               max={client.storage_quota_mb} 
               color={(client.storage_used_mb || 0) / client.storage_quota_mb > 0.9 ? '#EF4444' : '#4F8EF7'} 
               height={6} 
             />
             <div className="mt-3 flex justify-between items-center">
                 <p className="text-[10px] text-txt3">Usage Level: {Math.round(((client.storage_used_mb || 0) / client.storage_quota_mb) * 100)}%</p>
                 <button onClick={() => setStorageModal(true)} className="text-[10px] text-primary hover:underline font-bold uppercase">Increase</button>
             </div>
           </div>

           <div className="card p-5 group">
             <div className="flex justify-between items-center mb-4">
               <h3 className="text-[10px] font-bold uppercase tracking-widest text-txt3 flex items-center gap-2"><Users size={14} className="text-accent"/> User Limits</h3>
               <span className="text-xs font-bold font-mono bg-bg2 px-2 py-0.5 rounded text-txt">{client.user_count} / {client.max_users} Licenses</span>
             </div>
             <ProgressBar 
               value={client.user_count} 
               max={client.max_users} 
               color={client.user_count / client.max_users > 0.9 ? '#EF4444' : '#A374F9'} 
               height={6} 
             />
             <div className="mt-3">
                 <p className="text-[10px] text-txt3">Usage Level: {Math.round((client.user_count / client.max_users) * 100)}%</p>
             </div>
           </div>

           <div className="card p-5 group relative overflow-hidden">
             <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-bl-full -z-10 group-hover:scale-110 transition-transform"></div>
             <div className="flex justify-between items-center mb-4">
               <h3 className="text-[10px] font-bold uppercase tracking-widest text-txt3">Subscription Plan</h3>
               <button onClick={() => setSubModal(true)} className="text-[10px] text-primary hover:underline font-bold uppercase z-10">Manage</button>
             </div>
             <div className="flex items-end gap-2 mb-1">
                 <span className="text-2xl font-bold font-display text-txt capitalize">{client.plan}</span>
                 <span className="text-xs text-txt3 mb-1 font-bold uppercase tracking-wider bg-bg2 px-2 py-0.5 rounded">Tier</span>
             </div>
             <p className="text-xs text-txt3 mt-2 tracking-wide">Valid Until: <span className="font-bold text-txt">{client.valid_until ? new Date(client.valid_until).toLocaleDateString() : 'N/A'}</span></p>
           </div>
        </div>

        {/* Users / Employees Table */}
        <div className="card shadow-md">
          <div className="p-4 border-b border-border flex justify-between items-center bg-bg2/30">
            <h3 className="text-xs font-bold uppercase tracking-widest text-txt flex items-center gap-2">
              <Users size={16} className="text-txt3"/> Employees ({client.users?.length || 0})
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-bg2/50 border-b border-border">
                  <th className="px-5 py-3 text-[10px] font-bold text-txt3 uppercase tracking-widest">Employee</th>
                  <th className="px-5 py-3 text-[10px] font-bold text-txt3 uppercase tracking-widest">Role</th>
                  <th className="px-5 py-3 text-[10px] font-bold text-txt3 uppercase tracking-widest">Status</th>
                  <th className="px-5 py-3 text-[10px] font-bold text-txt3 uppercase tracking-widest">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {client.users?.length === 0 ? (
                  <tr><td colSpan="4" className="py-12 text-center text-txt3 text-sm">No employees configured.</td></tr>
                ) : (
                  client.users?.map((user) => (
                    <tr key={user.id} className="hover:bg-bg2/40 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-bg3 border border-border flex items-center justify-center text-xs font-bold text-txt">
                                {user.first_name?.[0]}{user.last_name?.[0]}
                            </div>
                            <div>
                                <div className="text-sm font-bold text-txt">{user.first_name} {user.last_name}</div>
                                <div className="text-xs text-txt3">{user.email}</div>
                            </div>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-md bg-bg2 border border-border text-txt2">{user.role?.replace('_', ' ')}</span>
                      </td>
                      <td className="px-5 py-3"><StatusBadge status={user.is_active ? 'active' : 'inactive'} /></td>
                      <td className="px-5 py-3 text-xs text-txt3">{new Date(user.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Storage Update Modal */}
      <Modal isOpen={storageModal} onClose={() => setStorageModal(false)} title="Update Storage Quota" footer={
        <>
            <button type="button" onClick={() => setStorageModal(false)} className="btn-ghost px-4 py-2">Cancel</button>
            <button onClick={handleUpdateStorage} disabled={updatingStorage} className="btn-primary px-6 py-2">
                {updatingStorage ? <RefreshCw className="animate-spin" size={16}/> : 'Update Quota'}
            </button>
        </>
      }>
        <div className="space-y-4">
            <p className="text-xs text-txt3">Increase or decrease the storage allocation for <b>{client.name}</b>. This will take effect immediately.</p>
            <div>
                <label className="text-[10px] font-bold uppercase tracking-tighter text-txt3 ml-1">New Quota in MB</label>
                <input 
                    type="number" 
                    className="input w-full bg-bg3 text-sm" 
                    value={newStorageQuota} 
                    onChange={e => setNewStorageQuota(e.target.value)} 
                />
            </div>
            <div className="text-xs text-txt3 flex gap-2 items-center bg-primary/10 p-2 rounded-lg text-primary">
                <HardDrive size={14}/> Current usage is {client.storage_used_mb || 0} MB
            </div>
        </div>
      </Modal>

      {/* Manage Subscription Modal */}
      <Modal isOpen={subModal} onClose={() => setSubModal(false)} title="Manage Subscription"
        footer={
          <div className="flex gap-2">
            <button type="button" onClick={() => setSubModal(false)} className="btn-ghost px-6 py-2 rounded-xl">Cancel</button>
            <button type="button" onClick={handleUpdateSubscription} disabled={updatingSub} className="btn-primary px-6 py-2">
              {updatingSub ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        }
      >
        <form id="subForm" onSubmit={handleUpdateSubscription} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-txt mb-1 block">Plan Tier</label>
            <select
              value={subForm.plan}
              onChange={(e) => setSubForm({...subForm, plan: e.target.value})}
              className="input w-full bg-card"
            >
              <option value="basic">Basic</option>
              <option value="pro">Pro</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-txt mb-1 block">Expiration Date</label>
            <input
              type="date"
              value={subForm.valid_until}
              onChange={(e) => setSubForm({...subForm, valid_until: e.target.value})}
              className="input w-full bg-card"
              required
            />
          </div>
          <div>
            <label className="text-xs font-bold text-txt mb-1 block">Maximum Allowed Users</label>
            <input
              type="number"
              value={subForm.max_users}
              onChange={(e) => setSubForm({...subForm, max_users: e.target.value})}
              className="input w-full bg-card"
              min="1"
              required
            />
          </div>
        </form>
      </Modal>

      {/* Feature Flags Modal */}
      <Modal isOpen={featureModal} onClose={() => setFeatureModal(false)} title={`Features & Modules: ${client?.name}`} footer={
        <button onClick={() => setFeatureModal(false)} className="btn-primary px-6 py-2">Done</button>
      }>
        <div className="space-y-4">
          <p className="text-xs text-txt3 bg-accent/5 p-3 rounded-lg border border-accent/10">
            Toggle enterprise modules and access grants for this specific client organization. Changes take effect on the client's next network request.
          </p>
          
          <div className="card p-4 flex items-center justify-between border-border hover:border-accent/40 transition-colors bg-bg/50">
            <div>
              <h4 className="text-sm font-bold text-txt flex items-center gap-2"><MapPin size={16} className="text-accent"/> Location Geofencing</h4>
              <p className="text-[10px] text-txt3 mt-1 max-w-[280px] leading-relaxed">
                Overrides standard authentication routing to strictly enforce GPS verification against corporate boundaries defined by the Tenant Admin.
              </p>
            </div>
            
            <button 
                onClick={() => handleToggleFeature('geofencing')}
                disabled={togglingFeature}
                className={clsx(
                  "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-bg shrink-0",
                  client?.geofencing_enabled ? "bg-success" : "bg-border2",
                  togglingFeature && "opacity-50 cursor-wait"
                )}
              >
              <span 
                className={clsx(
                  "inline-block h-4 w-4 transform rounded-full bg-white transition-transform drop-shadow-sm",
                  client?.geofencing_enabled ? "translate-x-6" : "translate-x-1"
                )} 
              />
            </button>
          </div>
        </div>
      </Modal>

      {/* Password Reset Modal */}
      <Modal isOpen={resetModal.isOpen} onClose={() => setResetModal({ ...resetModal, isOpen: false })} title="Password Reset Successful" footer={
        <button onClick={() => setResetModal({ ...resetModal, isOpen: false })} className="btn-primary px-6 py-2">Close</button>
      }>
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
            <button onClick={copyResetCredentials} className="absolute top-4 right-4 p-2 bg-card hover:bg-primary/10 rounded-lg text-txt3 hover:text-primary transition-all shadow-sm border border-border" title="Copy Credentials">
              {copied ? <CheckCircle2 size={14} className="text-success" /> : <Copy size={14} />}
            </button>
          </div>
        </div>
      </Modal>

      {/* Error Modal */}
      <Modal isOpen={errorModal.isOpen} onClose={() => setErrorModal({ ...errorModal, isOpen: false })} title="Action Failed" footer={
        <button onClick={() => setErrorModal({ ...errorModal, isOpen: false })} className="btn-primary px-6 py-2">Okay</button>
      }>
        <div className="flex items-start gap-4 text-danger bg-danger/5 p-4 rounded-xl border border-danger/20">
          <AlertCircle className="shrink-0 mt-0.5" size={18} />
          <p className="text-sm font-medium leading-relaxed">{errorModal.message}</p>
        </div>
      </Modal>

    </Layout>
  )
}
