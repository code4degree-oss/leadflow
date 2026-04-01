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
        <button className="btn-primary shadow-lg shadow-primary/20" onClick={()=>router.push('/admin/employees/add')}>
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


    </Layout>
  )
}
