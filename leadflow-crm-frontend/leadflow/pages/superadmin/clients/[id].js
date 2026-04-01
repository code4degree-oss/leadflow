import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Layout from '../../../components/Layout'
import { Building2, ShieldCheck, RefreshCw, ArrowLeft, CheckCircle2, Copy, AlertCircle } from 'lucide-react'
import { fetchWithAuth } from '../../../utils/api'
import { Modal } from '../../../components/UI'

export default function NewClientPage() {
  const router = useRouter()
  const { id } = router.query
  const isEditing = !!id && id !== 'new'

  const [submitting, setSubmitting] = useState(false)
  const [loadingClient, setLoadingClient] = useState(false)
  const [credentials, setCredentials] = useState(null)
  const [copied, setCopied] = useState(false)
  const [errorModal, setErrorModal] = useState({ isOpen: false, message: '' })

  const [formData, setFormData] = useState({
    name: '',
    max_users: 10,
    storage_quota_mb: 1024,
    plan: 'basic',
    trial_days: 14,
    subscription_start: new Date().toISOString().split('T')[0],
    valid_until: '',
    is_active: true,
    admin_email: '',
    admin_first_name: '',
    admin_last_name: '',
    admin_phone: ''
  })

  // Auto-calculate valid_until when subscription_start or trial_days change (only for new orgs)
  useEffect(() => {
    if (!isEditing && formData.subscription_start && formData.trial_days > 0) {
      const start = new Date(formData.subscription_start)
      start.setDate(start.getDate() + formData.trial_days)
      const autoEnd = start.toISOString().split('T')[0]
      setFormData(prev => ({ ...prev, valid_until: autoEnd }))
    }
  }, [formData.subscription_start, formData.trial_days, isEditing])

  // Load existing client data if editing
  useEffect(() => {
    if (id && id !== 'new') {
      setLoadingClient(true)
      fetchWithAuth(`/superadmin/clients/clients/${id}/`)
        .then(data => {
          setFormData({ ...data, admin_email: '', admin_first_name: '', admin_last_name: '', admin_phone: '' })
        })
        .catch(err => setErrorModal({ isOpen: true, message: err.message }))
        .finally(() => setLoadingClient(false))
    }
  }, [id])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    
    const payload = { ...formData }
    // Validate date - must be YYYY-MM-DD format or null
    if (!payload.valid_until || !/^\d{4}-\d{2}-\d{2}$/.test(payload.valid_until)) {
      payload.valid_until = null
    }
    // Remove subdomain if present (from loaded data)
    delete payload.subdomain
    
    try {
      if (isEditing && id !== 'new') {
        const { admin_email, admin_first_name, admin_last_name, admin_phone, ...updatePayload } = payload
        await fetchWithAuth(`/superadmin/clients/clients/${id}/`, {
          method: 'PUT',
          body: JSON.stringify(updatePayload)
        })
        router.push('/superadmin/clients')
      } else {
        const resp = await fetchWithAuth('/superadmin/clients/clients/', {
          method: 'POST',
          body: JSON.stringify(payload)
        })
        if (resp && resp.admin_password && resp.admin_password !== "User already exists") {
          setCredentials({ email: resp.admin_email, password: resp.admin_password })
        } else {
          router.push('/superadmin/clients')
        }
      }
    } catch (err) {
      setErrorModal({ isOpen: true, message: err.message })
    } finally {
      setSubmitting(false)
    }
  }

  const copyCredentials = () => {
    if (!credentials) return
    navigator.clipboard.writeText(`Email: ${credentials.email}\nPassword: ${credentials.password}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loadingClient) {
    return (
      <Layout role="superadmin" pageTitle="Loading...">
        <div className="flex items-center justify-center py-32">
          <RefreshCw className="animate-spin text-primary" size={32} />
        </div>
      </Layout>
    )
  }

  // Show credentials after successful creation
  if (credentials) {
    return (
      <Layout role="superadmin" pageTitle="Organization Provisioned">
        <div className="max-w-lg mx-auto mt-8">
          <div className="card p-8">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-success/10 rounded-2xl text-success">
                <CheckCircle2 size={28} />
              </div>
              <div>
                <h2 className="font-display font-bold text-xl text-txt">Organization Created!</h2>
                <p className="text-xs text-txt3">Admin credentials generated successfully</p>
              </div>
            </div>

            <div className="p-4 bg-bg3 rounded-2xl border border-border space-y-3 mb-6">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-txt3">Admin Email</label>
                <p className="text-sm font-mono text-txt font-bold">{credentials.email}</p>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-txt3">Initial Password</label>
                <p className="text-sm font-mono text-txt font-bold">{credentials.password}</p>
              </div>
            </div>

            <div className="p-3 bg-warning/5 border border-warning/20 rounded-xl mb-6">
              <p className="text-xs text-txt2">
                ⚠️ Copy these credentials now. The password will not be shown again. The admin will be required to change it on first login.
              </p>
            </div>

            <div className="flex gap-3">
              <button onClick={copyCredentials} className="btn-primary flex-1 justify-center py-3">
                {copied ? <><CheckCircle2 size={14}/>Copied!</> : <><Copy size={14}/>Copy Credentials</>}
              </button>
              <button onClick={() => router.push('/superadmin/clients')} className="btn-ghost px-6 rounded-2xl border border-border">
                Back to Clients
              </button>
            </div>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout role="superadmin" pageTitle={isEditing ? 'Edit Organization' : 'New Organization'}
      actions={
        <button onClick={() => router.push('/superadmin/clients')} className="btn-ghost px-4 text-xs font-bold uppercase tracking-wider">
          <ArrowLeft size={14}/>Back to Clients
        </button>
      }
    >
      <div className="max-w-2xl mx-auto mt-4">
        <div className="card p-8">
          <div className="flex items-center gap-4 mb-8">
            <div className="p-3 bg-primary/10 rounded-2xl text-primary">
              <Building2 size={24} />
            </div>
            <div>
              <h3 className="font-display font-bold text-xl text-txt">{isEditing ? 'Edit Organization' : 'Provision New Organization'}</h3>
              <p className="text-[10px] text-txt3 font-bold uppercase tracking-widest leading-none">{isEditing ? 'Update instance settings' : 'Create a new client instance'}</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Organization Details Section */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-widest text-txt3 mb-3 flex items-center gap-2">
                <div className="w-5 h-5 rounded-lg bg-primary/10 flex items-center justify-center text-primary text-[10px] font-bold">1</div>
                Organization Details
              </h4>
              <div className="space-y-4 pl-7">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-tighter text-txt3 ml-1">Company Name</label>
                  <input 
                    required 
                    className="input w-full bg-bg3 text-sm" 
                    placeholder="SunCity Realty Pvt Ltd" 
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                  />
                </div>
              </div>
            </div>

            {/* Admin Details Section */}
            {!isEditing && (
              <div>
                <h4 className="text-xs font-bold uppercase tracking-widest text-txt3 mb-3 flex items-center gap-2">
                  <div className="w-5 h-5 rounded-lg bg-primary/10 flex items-center justify-center text-primary text-[10px] font-bold">2</div>
                  Admin Details
                </h4>
                <div className="space-y-4 pl-7">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-tighter text-txt3 ml-1">First Name</label>
                      <input 
                        required 
                        className="input w-full bg-bg3 text-sm" 
                        placeholder="John" 
                        value={formData.admin_first_name}
                        onChange={e => setFormData({...formData, admin_first_name: e.target.value})}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-tighter text-txt3 ml-1">Last Name</label>
                      <input 
                        required 
                        className="input w-full bg-bg3 text-sm" 
                        placeholder="Doe" 
                        value={formData.admin_last_name}
                        onChange={e => setFormData({...formData, admin_last_name: e.target.value})}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-tighter text-txt3 ml-1">Email Address</label>
                    <input 
                      required 
                      type="email"
                      className="input w-full bg-bg3 text-sm" 
                      placeholder="admin@company.com" 
                      value={formData.admin_email}
                      onChange={e => setFormData({...formData, admin_email: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-tighter text-txt3 ml-1">Phone Number</label>
                    <input 
                      type="tel"
                      className="input w-full bg-bg3 text-sm" 
                      placeholder="+91 98765 43210" 
                      value={formData.admin_phone}
                      onChange={e => setFormData({...formData, admin_phone: e.target.value})}
                    />
                  </div>
                  <p className="text-[9px] text-txt3 ml-1">A secure password will be auto-generated. The admin will be required to change it on first login.</p>
                </div>
              </div>
            )}

            {/* Plan & Billing Section */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-widest text-txt3 mb-3 flex items-center gap-2">
                <div className="w-5 h-5 rounded-lg bg-primary/10 flex items-center justify-center text-primary text-[10px] font-bold">{isEditing ? '2' : '3'}</div>
                Plan & Billing
              </h4>
              <div className="space-y-4 pl-7">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-tighter text-txt3 ml-1">User Limit</label>
                    <input 
                      required 
                      type="number" 
                      className="input w-full bg-bg3 text-sm" 
                      placeholder="20" 
                      value={formData.max_users}
                      onChange={e => setFormData({...formData, max_users: parseInt(e.target.value)})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-tighter text-txt3 ml-1">Storage Quota (MB)</label>
                    <input 
                      required 
                      type="number" 
                      className="input w-full bg-bg3 text-sm" 
                      placeholder="1024" 
                      value={formData.storage_quota_mb}
                      onChange={e => setFormData({...formData, storage_quota_mb: parseInt(e.target.value)})}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-tighter text-txt3 ml-1">Plan</label>
                    <select 
                      className="input w-full bg-bg3 text-sm" 
                      value={formData.plan}
                      onChange={e => setFormData({...formData, plan: e.target.value})}
                    >
                      <option value="basic">Basic</option>
                      <option value="pro">Pro</option>
                      <option value="enterprise">Enterprise</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-tighter text-txt3 ml-1">Trial / Billing Cycle (Days)</label>
                    <input 
                      required 
                      type="number" 
                      className="input w-full bg-bg3 text-sm" 
                      placeholder="14" 
                      value={formData.trial_days}
                      onChange={e => setFormData({...formData, trial_days: parseInt(e.target.value) || 0})}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-tighter text-txt3 ml-1">Start Date</label>
                    <input 
                      type="date" 
                      className="input w-full bg-bg3 text-sm" 
                      value={formData.subscription_start || ''}
                      onChange={e => setFormData({...formData, subscription_start: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-tighter text-txt3 ml-1">End Date (Valid Until)</label>
                    <input 
                      type="date" 
                      className="input w-full bg-bg3 text-sm" 
                      value={formData.valid_until || ''}
                      onChange={e => setFormData({...formData, valid_until: e.target.value})}
                    />
                  </div>
                </div>
                {!isEditing && formData.subscription_start && formData.valid_until && (
                  <p className="text-[10px] text-txt3 ml-1 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent2 inline-block"></span>
                    Auto-calculated: {formData.trial_days} day trial from {formData.subscription_start} → expires {formData.valid_until}
                  </p>
                )}
              </div>
            </div>

            {/* Security Notice */}
            <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10 flex gap-3 items-center">
              <ShieldCheck size={18} className="text-primary shrink-0" />
              <p className="text-[10px] text-txt2 leading-relaxed font-medium">
                Initializing organization with standard security protocols and multi-tenant isolation.
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button 
                type="submit" 
                disabled={submitting}
                className="btn-primary flex-1 justify-center py-4 text-xs shadow-lg shadow-primary/20"
              >
                {submitting ? <RefreshCw className="animate-spin" size={16}/> : isEditing ? 'Save Changes' : 'Launch Organization'}
              </button>
              <button 
                type="button"
                onClick={() => router.push('/superadmin/clients')} 
                className="btn-ghost px-6 rounded-2xl border border-border"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>

      <Modal
        isOpen={errorModal.isOpen}
        onClose={() => setErrorModal({ ...errorModal, isOpen: false })}
        title="Error Detected"
        footer={
          <button onClick={() => setErrorModal({ ...errorModal, isOpen: false })} className="btn-primary px-6 py-2">Understand</button>
        }
      >
        <div className="flex items-start gap-4 text-danger bg-danger/5 p-4 rounded-xl border border-danger/20">
          <AlertCircle className="shrink-0 mt-0.5" size={18} />
          <p className="text-sm font-medium leading-relaxed">{errorModal.message}</p>
        </div>
      </Modal>
    </Layout>
  )
}
