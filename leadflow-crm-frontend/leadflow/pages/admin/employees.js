import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Layout from '../../components/Layout'
import { SectionHeader, StatusBadge, ProgressBar, Modal } from '../../components/UI'
import { Plus, Edit, Ban, Trash2, MapPin, Target, Eye, Phone, Shield, RefreshCw, AlertCircle, User as UserIcon, CheckCircle2, Copy } from 'lucide-react'
import clsx from 'clsx'
import { fetchWithAuth } from '../../utils/api'

const roleColors = { telecaller:'badge-blue', fieldagent:'badge-amber', manager:'badge-purple', admin:'badge-accent' }

export default function Employees() {
  const router = useRouter()
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [credentialsModal, setCredentialsModal] = useState({ isOpen: false, email: '', password: '' })
  const [copied, setCopied] = useState(false)
  
  // Form State
  const [formData, setFormData] = useState({
    email: '',
    first_name: '',
    last_name: '',
    role: 'TELECALLER',
    geofencing_exempt: false
  })

  useEffect(() => {
    fetchEmployees()
  }, [])

  const fetchEmployees = async () => {
    setLoading(true)
    try {
      const data = await fetchWithAuth('/accounts/employees/')
      setEmployees(data.results || data)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const resp = await fetchWithAuth('/accounts/employees/', {
        method: 'POST',
        body: JSON.stringify(formData)
      })
      setShowModal(false)
      setFormData({ email: '', first_name: '', last_name: '', role: 'TELECALLER' })
      fetchEmployees()
      // Show credentials modal if password was returned
      if (resp && resp.generated_password) {
        setCredentialsModal({ isOpen: true, email: resp.email, password: resp.generated_password })
      }
    } catch (err) {
      alert(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const copyCredentials = () => {
    navigator.clipboard.writeText(`Email: ${credentialsModal.email}\nPassword: ${credentialsModal.password}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this employee?')) return
    try {
      await fetchWithAuth(`/accounts/employees/${id}/`, { method: 'DELETE' })
      fetchEmployees()
    } catch (err) {
      alert(err.message)
    }
  }

  const handleToggleExempt = async (e) => {
      try {
          await fetchWithAuth(`/accounts/employees/${e.id}/`, {
              method: 'PATCH',
              body: JSON.stringify({ geofencing_exempt: !e.geofencing_exempt })
          })
          fetchEmployees()
      } catch (err) {
          alert('Failed to update geofencing bypass: ' + err.message)
      }
  }

  const handleToggleActive = async (e) => {
      const action = e.is_active ? 'suspend' : 'activate'
      if (!confirm(`Are you sure you want to ${action} this employee?`)) return
      try {
          await fetchWithAuth(`/accounts/employees/${e.id}/`, {
              method: 'PATCH',
              body: JSON.stringify({ is_active: !e.is_active })
          })
          fetchEmployees()
      } catch (err) {
          alert(`Failed to ${action} employee: ` + err.message)
      }
  }

  return (
    <Layout role="admin" pageTitle="Employee Management"
      actions={
        <button className="btn-primary shadow-lg shadow-primary/20" onClick={()=>setShowModal(true)}>
          <Plus size={14}/>Add Employee
        </button>
      }
    >

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {[
          { label:'Total Staff', value: employees.length, color:'text-txt' },
          { label:'Active Now', value: employees.filter(e => e.is_active).length, color:'text-success' },
          { label:'Telecallers', value: employees.filter(e => e.role === 'TELECALLER').length, color:'text-accent' },
          { label:'Field Agents', value: employees.filter(e => e.role === 'FIELD_AGENT').length, color:'text-amber' },
        ].map(s => (
          <div key={s.label} className="card p-4 hover:border-primary/20 transition-colors group">
            <div className={clsx('font-display font-bold text-2xl group-hover:scale-105 transition-transform origin-left', s.color)}>{s.value}</div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-txt3 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Table Section */}
      <div className="card overflow-hidden shadow-sm">
        <div className="p-4 border-b border-border flex items-center justify-between bg-bg2/30">
          <h2 className="text-sm font-bold text-txt">Team Roster</h2>
          <div className="flex gap-2">
             <button onClick={fetchEmployees} className="p-1.5 text-txt3 hover:text-primary transition-colors">
               <RefreshCw size={14} className={clsx(loading && "animate-spin")} />
             </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-bg2/50 border-b border-border">
                <th className="px-4 py-3 text-[10px] font-bold text-txt3 uppercase tracking-widest">Employee</th>
                <th className="px-4 py-3 text-[10px] font-bold text-txt3 uppercase tracking-widest">Role</th>
                <th className="px-4 py-3 text-[10px] font-bold text-txt3 uppercase tracking-widest text-center">Geo-Bypass</th>
                <th className="px-4 py-3 text-[10px] font-bold text-txt3 uppercase tracking-widest text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan="3" className="py-20 text-center">
                    <RefreshCw className="animate-spin text-primary mx-auto mb-2" size={24} />
                    <p className="text-xs text-txt3">Loading team data...</p>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan="3" className="py-20 text-center">
                    <AlertCircle className="text-danger mx-auto mb-2" size={24} />
                    <p className="text-xs font-bold text-txt2">Failed to load employees</p>
                    <p className="text-[10px] text-txt3">{error}</p>
                  </td>
                </tr>
              ) : employees.length === 0 ? (
                <tr>
                  <td colSpan="3" className="py-20 text-center">
                    <UserIcon className="text-txt3 mx-auto mb-2 opacity-20" size={32} />
                    <p className="text-xs text-txt3">No employees found. Add your first team member!</p>
                  </td>
                </tr>
              ) : (
                employees.map(e => (
                  <tr key={e.id} className={clsx("hover:bg-bg2/30 transition-colors group", !e.is_active && "opacity-80")}>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className={clsx(
                          "w-9 h-9 rounded-full border flex items-center justify-center text-xs font-bold shadow-inner flex-shrink-0",
                          e.is_active ? "bg-primary/10 border-primary/20 text-primary" : "bg-danger/10 border-danger/20 text-danger"
                        )}>
                          {e.first_name[0]}{e.last_name[0]}
                        </div>
                        <div className="flex flex-col">
                          <span className={clsx("text-sm font-bold leading-tight", !e.is_active && "text-danger")}>{e.first_name} {e.last_name}</span>
                          <span className="text-[10px] text-txt3 font-mono">{e.email}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <span className={clsx('badge px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-tighter flex-shrink-0', roleColors[e.role.toLowerCase()] || 'badge-gray')}>
                          {e.role}
                        </span>
                        {!e.is_active && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-tighter bg-danger/10 text-danger border border-danger/20 flex-shrink-0">
                            Suspended
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center">
                        {e.role === 'CLIENT_ADMIN' ? (
                            <span className="text-[10px] text-accent2 font-bold uppercase tracking-widest bg-accent2/10 px-2 py-0.5 rounded" title="Admins are always exempt from geofencing">N/A</span>
                        ) : (
                            <button 
                                onClick={() => handleToggleExempt(e)}
                                className={clsx(
                                    "relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none",
                                    e.geofencing_exempt ? "bg-accent2" : "bg-border2"
                                )}
                                title={e.geofencing_exempt ? "Geofencing Bypassed" : "Bound by Geofencing"}
                            >
                                <span 
                                    className={clsx(
                                        "inline-block h-3 w-3 transform rounded-full bg-white transition-transform",
                                        e.geofencing_exempt ? "translate-x-5" : "translate-x-1"
                                    )} 
                                />
                            </button>
                        )}
                    </td>
                    <td className="px-4 py-4">
                      {e.role === 'CLIENT_ADMIN' ? (
                        <div className="flex items-center justify-center">
                          <span className="text-[10px] text-accent2 font-bold uppercase tracking-widest bg-accent2/10 px-2 py-0.5 rounded" title="Actions locked for organization admins">N/A</span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-1 transition-opacity">
                          <button onClick={() => router.push(`/admin/employees/${e.id}`)} className="p-2 hover:bg-bg3 rounded-lg text-txt3 hover:text-accent transition-all" title="View Profile">
                            <Eye size={14}/>
                          </button>
                          <button className="p-2 hover:bg-bg3 rounded-lg text-txt3 hover:text-primary transition-all" title="Edit Profile">
                            <Edit size={14}/>
                          </button>
                          <button 
                            onClick={() => handleToggleActive(e)}
                            className={clsx("p-2 rounded-lg transition-all", e.is_active ? "text-txt3 hover:bg-danger/10 hover:text-danger" : "text-[#10B981] bg-[#10B981]/10 hover:bg-[#10B981]/20 hover:text-[#059669]")} 
                            title={e.is_active ? "Suspend Employee" : "Activate Employee"}
                          >
                            {e.is_active ? <Ban size={14}/> : <CheckCircle2 size={14}/>}
                          </button>
                          <button 
                            onClick={() => handleDelete(e.id)}
                            className="p-2 hover:bg-danger/10 rounded-lg text-txt3 hover:text-danger transition-all" 
                            title="Delete Employee"
                          >
                            <Trash2 size={14}/>
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Employee Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setShowModal(false)}>
          <div className="bg-card w-full max-w-md p-6 rounded-2xl border border-border shadow-2xl animate-in slide-in-from-bottom-4 duration-300" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-primary/10 rounded-lg text-primary">
                <Plus size={20} />
              </div>
              <div>
                <h3 className="font-display font-bold text-lg text-txt">Onboard Employee</h3>
                <p className="text-[10px] text-txt3 font-bold uppercase tracking-widest leading-none">Adding to your client roster</p>
              </div>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-tighter text-txt3 ml-1">First Name</label>
                  <input 
                    required 
                    className="input w-full bg-bg3" 
                    placeholder="Enter first name"
                    value={formData.first_name}
                    onChange={e => setFormData({...formData, first_name: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-tighter text-txt3 ml-1">Last Name</label>
                  <input 
                    required 
                    className="input w-full bg-bg3" 
                    placeholder="Enter last name"
                    value={formData.last_name}
                    onChange={e => setFormData({...formData, last_name: e.target.value})}
                  />
                </div>
              </div>
              
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-tighter text-txt3 ml-1">Work Email</label>
                <input 
                  required 
                  type="email" 
                  className="input w-full bg-bg3" 
                  placeholder="employee@company.com"
                  value={formData.email}
                  onChange={e => setFormData({...formData, email: e.target.value})}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-tighter text-txt3 ml-1">Access Role</label>
                <select 
                  className="input w-full bg-bg3"
                  value={formData.role}
                  onChange={e => setFormData({...formData, role: e.target.value})}
                >
                  <option value="TELECALLER">Telecaller</option>
                  <option value="FIELD_AGENT">Field Agent</option>
                  <option value="MANAGER">Manager</option>
                  <option value="CLIENT_ADMIN">Client Admin</option>
                </select>
              </div>

              <div className="flex items-center gap-3 p-3 bg-bg3 rounded-xl border border-border mt-2">
                 <input 
                     type="checkbox" 
                     className="w-4 h-4 accent-amber-500" 
                     checked={formData.geofencing_exempt}
                     onChange={e => setFormData({...formData, geofencing_exempt: e.target.checked})}
                 />
                 <div>
                     <p className="text-sm font-bold text-txt">Bypass Geofencing</p>
                     <p className="text-[10px] text-txt3 leading-tight mt-0.5">Exempt this employee from organization-wide location restrictions. Necessary for remote or traveling executives.</p>
                 </div>
              </div>

              <div className="p-3 bg-primary/5 rounded-xl border border-primary/10 flex gap-3 items-start">
                <Shield size={16} className="text-primary mt-0.5 shrink-0" />
                <p className="text-[10px] text-txt2 leading-relaxed">
                  Default credentials will be sent to the employee. They will be required to change their password upon first login for security compliance.
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button 
                  type="submit" 
                  disabled={submitting}
                  className="btn-primary flex-1 justify-center py-3"
                >
                  {submitting ? <RefreshCw className="animate-spin" size={16}/> : 'Register Employee'}
                </button>
                <button 
                  type="button"
                  onClick={()=>setShowModal(false)} 
                  className="btn-ghost px-6"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Credentials Modal */}
      <Modal 
        isOpen={credentialsModal.isOpen} 
        onClose={() => setCredentialsModal({ ...credentialsModal, isOpen: false })}
        title="Employee Created Successfully"
        footer={
          <button onClick={() => setCredentialsModal({ ...credentialsModal, isOpen: false })} className="btn-primary px-6 py-2">Done</button>
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
