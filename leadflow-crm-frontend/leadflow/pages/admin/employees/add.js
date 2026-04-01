import { useState } from 'react'
import { useRouter } from 'next/router'
import Layout from '../../../components/Layout'
import { Plus, Shield, RefreshCw, CheckCircle2, Copy, ArrowLeft } from 'lucide-react'
import { fetchWithAuth } from '../../../utils/api'
import { Modal } from '../../../components/UI'

export default function AddEmployee() {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [credentialsModal, setCredentialsModal] = useState({ isOpen: false, email: '', password: '' })
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState(null)
  
  // Form State
  const [formData, setFormData] = useState({
    email: '',
    first_name: '',
    last_name: '',
    role: 'TELECALLER',
    geofencing_exempt: false
  })

  const handleCreate = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const resp = await fetchWithAuth('/accounts/employees/', {
        method: 'POST',
        body: JSON.stringify(formData)
      })
      
      // Show credentials modal if password was returned
      if (resp && resp.generated_password) {
        setCredentialsModal({ isOpen: true, email: resp.email, password: resp.generated_password })
      } else {
        router.push('/admin/employees')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const copyCredentials = () => {
    navigator.clipboard.writeText(`Email: ${credentialsModal.email}\nPassword: ${credentialsModal.password}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDone = () => {
    setCredentialsModal({ ...credentialsModal, isOpen: false })
    router.push('/admin/employees')
  }

  return (
    <Layout role="admin" pageTitle="Add Employee"
      actions={
        <button onClick={() => router.push('/admin/employees')} className="btn-ghost">
          <ArrowLeft size={16} /> Back to Employees
        </button>
      }
    >
      <div className="max-w-2xl mx-auto">
        <div className="card p-6 md:p-8 border border-border mt-4">
          <div className="flex items-center gap-4 mb-8">
            <div className="p-3 bg-primary/10 rounded-xl text-primary">
              <Plus size={24} />
            </div>
            <div>
              <h2 className="font-display font-bold text-2xl text-txt">Onboard New Employee</h2>
              <p className="text-xs text-txt3 font-bold uppercase tracking-widest mt-1">Provide details to create access</p>
            </div>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-danger/10 border border-danger/20 rounded-xl text-danger text-sm font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleCreate} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-widest text-txt3 ml-1">First Name</label>
                <input 
                  required 
                  className="input w-full bg-bg3 py-3" 
                  placeholder="Enter first name"
                  value={formData.first_name}
                  onChange={e => setFormData({...formData, first_name: e.target.value})}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-widest text-txt3 ml-1">Last Name</label>
                <input 
                  required 
                  className="input w-full bg-bg3 py-3" 
                  placeholder="Enter last name"
                  value={formData.last_name}
                  onChange={e => setFormData({...formData, last_name: e.target.value})}
                />
              </div>
            </div>
            
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-widest text-txt3 ml-1">Work Email</label>
              <input 
                required 
                type="email" 
                className="input w-full bg-bg3 py-3" 
                placeholder="employee@company.com"
                value={formData.email}
                onChange={e => setFormData({...formData, email: e.target.value})}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-widest text-txt3 ml-1">Access Role</label>
              <select 
                className="input w-full bg-bg3 py-3"
                value={formData.role}
                onChange={e => setFormData({...formData, role: e.target.value})}
              >
                <option value="TELECALLER">Telecaller</option>
                <option value="FIELD_AGENT">Field Agent</option>
                <option value="MANAGER">Manager</option>
                <option value="CLIENT_ADMIN">Client Admin</option>
              </select>
            </div>

            <div className="flex items-start gap-4 p-4 bg-bg3 rounded-xl border border-border">
                <div className="mt-1">
                  <input 
                      type="checkbox" 
                      className="w-5 h-5 accent-amber-500 rounded cursor-pointer" 
                      checked={formData.geofencing_exempt}
                      onChange={e => setFormData({...formData, geofencing_exempt: e.target.checked})}
                      id="geo-exempt"
                  />
                </div>
                <div>
                    <label htmlFor="geo-exempt" className="text-base font-bold text-txt cursor-pointer block">Bypass Geofencing</label>
                    <p className="text-xs text-txt3 leading-relaxed mt-1">Exempt this employee from organization-wide location restrictions. Use for remote or traveling executives.</p>
                </div>
            </div>

            <div className="p-4 bg-primary/5 rounded-xl border border-primary/20 flex gap-4 items-start pb-5">
              <Shield size={20} className="text-primary shrink-0" />
              <p className="text-xs text-txt2 leading-relaxed">
                <strong className="text-txt">Secure Onboarding:</strong> Default credentials will be generated automatically. The employee will be required to change their password upon first login for security compliance.
              </p>
            </div>

            <div className="pt-4 flex justify-end">
              <button 
                type="button"
                onClick={()=>router.push('/admin/employees')} 
                className="btn-ghost px-6 mr-3"
              >
                Cancel
              </button>
              <button 
                type="submit" 
                disabled={submitting}
                className="btn-primary px-8 py-3"
              >
                {submitting ? <><RefreshCw className="animate-spin mr-2" size={16}/> Processing...</> : 'Register Employee'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Credentials Modal */}
      <Modal 
        isOpen={credentialsModal.isOpen} 
        onClose={handleDone}
        title="Employee Created Successfully"
        footer={
          <button onClick={handleDone} className="btn-primary px-6 py-2">Done</button>
        }
      >
        <div className="space-y-4">
          <p className="text-xs text-txt3 leading-relaxed">
            Share these credentials with the employee. They will be required to 
            <strong className="text-primary"> change their password</strong> on first login.
          </p>
          
          <div className="p-4 bg-bg3 rounded-xl border border-border space-y-3 relative">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-txt3 mb-0.5">Email</div>
              <div className="text-sm font-mono text-txt font-bold">{credentialsModal.email}</div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-txt3 mb-0.5">Password</div>
              <div className="text-sm font-mono text-primary font-bold tracking-wider">{credentialsModal.password}</div>
            </div>
            
            <button 
              onClick={copyCredentials}
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
    </Layout>
  )
}
