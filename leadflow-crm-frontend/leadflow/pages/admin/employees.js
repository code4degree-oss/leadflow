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
      const data = await fetchWithAuth('/accounts/employees/?page_size=500')
      setEmployees(data.results || data)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
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
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        {[
          { label:'Total Staff', value: employees.length, color:'accent', icon: Users },
          { label:'Active Now', value: employees.filter(e => e.is_active).length, color:'green', icon: CheckCircle2 },
          { label:'Managers', value: employees.filter(e => e.role === 'MANAGER').length, color:'purple', icon: Shield },
          { label:'Telecallers', value: employees.filter(e => e.role === 'TELECALLER').length, color:'pink', icon: Phone },
          { label:'Field Agents', value: employees.filter(e => e.role === 'FIELD_AGENT').length, color:'amber', icon: MapPin },
        ].map(s => (
          <div key={s.label}>
             <StatCard label={s.label} value={s.value} color={s.color} icon={s.icon} />
          </div>
        ))}
      </div>

      {/* Grid Section */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold text-txt">Team Roster</h2>
        <button onClick={fetchEmployees} className="p-2 hover:bg-bg2 rounded-xl transition-all text-txt3 hover:text-txt" title="Refresh">
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {loading ? (
        <div className="py-20 text-center">
          <RefreshCw className="animate-spin text-accent mx-auto mb-3" size={24} />
          <p className="text-xs font-bold uppercase tracking-widest text-txt3">Loading team data...</p>
        </div>
      ) : error ? (
        <div className="py-20 text-center">
          <AlertCircle className="text-danger mx-auto mb-2" size={24} />
          <p className="text-xs font-bold text-txt2">Failed to load employees</p>
          <p className="text-[10px] text-txt3">{error}</p>
        </div>
      ) : employees.length === 0 ? (
        <div className="py-20 text-center accent-card border-dashed border-2">
          <UserIcon className="text-txt3 mx-auto mb-3 opacity-20" size={32} />
          <p className="text-sm font-bold text-txt3">No employees found. Add your first team member!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {employees.map(e => (
            <div key={e.id} className={clsx(
              "accent-card p-5 hover-lift group relative overflow-hidden flex flex-col",
              !e.is_active && "opacity-75 grayscale-[30%]"
            )}>
              {/* Glow */}
              <div className={clsx(
                "absolute -top-10 -right-10 w-28 h-28 rounded-full opacity-0 group-hover:opacity-[0.05] transition-opacity duration-500",
                e.is_active ? "bg-accent" : "bg-danger"
              )} />
              
              {/* Header */}
              <div className="flex items-start justify-between mb-4 relative z-10">
                <div className={clsx(
                  "w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold border transition-all duration-300",
                  e.is_active 
                    ? "bg-accent/8 border-accent/10 text-accent group-hover:bg-accent group-hover:text-white"
                    : "bg-danger/8 border-danger/10 text-danger"
                )}>
                  {e.first_name[0]}{e.last_name[0]}
                </div>
                <div className="flex items-center gap-1.5">
                  <div className={clsx("w-2 h-2 rounded-full", e.is_active ? "bg-[#10B981]" : "bg-danger")} />
                  <span className={clsx("text-[9px] font-bold uppercase tracking-wider", e.is_active ? "text-[#10B981]" : "text-danger")}>
                    {e.is_active ? 'Active' : 'Suspended'}
                  </span>
                </div>
              </div>

              {/* Info */}
              <div className="mb-4 flex-1 relative z-10">
                <div className="text-sm font-bold text-txt mb-0.5 group-hover:text-accent transition-colors">
                  {e.first_name} {e.last_name}
                </div>
                <div className="text-[10px] text-txt3 font-mono truncate" title={e.email}>{e.email}</div>
                <div className="mt-2.5">
                   <span className={clsx('badge px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest', roleColors[e.role.toLowerCase()] || 'badge-gray')}>
                     {e.role.replace('_', ' ')}
                   </span>
                </div>
              </div>

              {/* Geo & Actions */}
              <div className="pt-3 border-t border-border/40 flex items-center justify-between relative z-10">
                <div className="flex items-center gap-2">
                  <span className="text-[9px] text-txt3 font-bold uppercase tracking-wider flex items-center gap-1">
                    <MapPin size={10} /> Geo-Bypass
                  </span>
                  {e.role === 'CLIENT_ADMIN' ? (
                    <span className="text-[9px] text-accent2 font-bold uppercase bg-accent2/10 px-1.5 py-0.5 rounded">N/A</span>
                  ) : (
                    <button 
                        onClick={() => handleToggleExempt(e)}
                        className={clsx(
                            "relative inline-flex h-4 w-7 items-center rounded-full transition-colors",
                            e.geofencing_exempt ? "bg-accent2" : "bg-border2"
                        )}
                        title={e.geofencing_exempt ? "Bypassed" : "Bound by Geofencing"}
                    >
                        <span className={clsx(
                            "inline-block h-2 w-2 transform rounded-full bg-white transition-transform",
                            e.geofencing_exempt ? "translate-x-4" : "translate-x-1"
                        )} />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-0.5">
                  <button onClick={() => router.push(`/admin/employees/${e.id}`)} className="p-1.5 rounded-lg text-txt3 hover:bg-accent/10 hover:text-accent transition-all" title="View Profile">
                    <Eye size={13}/>
                  </button>
                  {e.role !== 'CLIENT_ADMIN' && (
                    <button 
                      onClick={() => handleToggleActive(e)}
                      className={clsx("p-1.5 rounded-lg transition-all", e.is_active ? "text-txt3 hover:bg-danger/10 hover:text-danger" : "text-[#10B981] bg-[#10B981]/10 hover:bg-[#10B981]/20 hover:text-[#059669]")} 
                      title={e.is_active ? "Suspend" : "Activate"}
                    >
                      {e.is_active ? <Ban size={13}/> : <CheckCircle2 size={13}/>}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}


    </Layout>
  )
}
