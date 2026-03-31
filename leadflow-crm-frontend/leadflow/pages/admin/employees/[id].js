import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Layout from '../../../components/Layout'
import { fetchWithAuth } from '../../../utils/api'
import { 
  User as UserIcon, Activity, PhoneCall, KeyRound, 
  ChevronLeft, Loader2, Calendar, Target, Clock, AlertTriangle, ShieldCheck, CheckCircle2 
} from 'lucide-react'
import clsx from 'clsx'
import { StatusBadge } from '../../../components/UI'

export default function EmployeeDetails() {
  const router = useRouter()
  const { id } = router.query

  const [activeTab, setActiveTab] = useState('profile')
  const [employee, setEmployee] = useState(null)
  const [performance, setPerformance] = useState(null)
  const [loading, setLoading] = useState(true)
  const [resettingPwd, setResettingPwd] = useState(false)
  const [newPassword, setNewPassword] = useState(null)

  useEffect(() => {
    if (id) {
      fetchEmployeeData()
    }
  }, [id])

  const fetchEmployeeData = async () => {
    setLoading(true)
    try {
      // Fetch user profile
      const userRes = await fetchWithAuth(`/accounts/employees/${id}/`)
      setEmployee(userRes)

      // Fetch performance data & find this specific user
      const perfRes = await fetchWithAuth('/leads/performance-report/')
      const userPerf = perfRes?.team_performance?.find(p => p.id === id) || null
      setPerformance(userPerf)

    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleResetPassword = async () => {
    if (!confirm(`Are you sure you want to reset the password for ${employee.first_name}? They will lose access to their current password.`)) return
    
    setResettingPwd(true)
    try {
      const generated = Math.random().toString(36).slice(-10) + '!A'
      const finalRes = await fetchWithAuth(`/accounts/employees/${id}/reset-password/`, {
        method: 'POST',
        body: JSON.stringify({ password: generated })
      })
      
      setNewPassword(generated)
    } catch (err) {
      alert("Failed to reset password: " + err.message)
    } finally {
      setResettingPwd(false)
    }
  }

  if (loading) {
    return (
      <Layout role="admin" pageTitle="Employee Profile">
        <div className="flex flex-col items-center justify-center py-24">
          <Loader2 className="animate-spin text-accent mb-4" size={32} />
          <p className="text-txt3">Loading employee data...</p>
        </div>
      </Layout>
    )
  }

  if (!employee) {
    return (
      <Layout role="admin" pageTitle="Error">
        <div className="py-24 text-center text-txt3">Employee not found or you don't have access.</div>
      </Layout>
    )
  }

  return (
    <Layout role="admin" pageTitle="Employee Profile">
      
      {/* Back Button */}
      <button onClick={() => router.back()} className="flex items-center gap-2 text-sm font-bold text-txt3 hover:text-txt mb-6 transition-colors">
        <ChevronLeft size={16} /> Back to Team
      </button>

      {/* Header Profile Card */}
      <div className="bg-card border border-border rounded-3xl p-6 md:p-8 mb-6 shadow-sm flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent to-accent2 flex items-center justify-center shadow-lg shadow-accent/20 shrink-0">
            <span className="text-2xl font-display font-black text-white capitalize">
              {employee.first_name?.[0]}{employee.last_name?.[0]}
            </span>
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold text-txt capitalize">{employee.first_name} {employee.last_name}</h1>
            <p className="text-txt3 font-mono text-sm mt-1">{employee.email}</p>
            <div className="flex items-center gap-2 mt-2">
              <span className="badge badge-accent shadow-sm">{employee.role.replace(/_/g, ' ')}</span>
              {employee.is_active ? (
                <span className="badge bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/20">Active</span>
              ) : (
                <span className="badge bg-danger/10 text-danger border border-danger/20">Inactive</span>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex flex-col gap-2 w-full md:w-auto">
          <div className="p-4 rounded-xl border border-border bg-bg2/50 flex items-center justify-between gap-6">
            <div>
              <p className="text-[10px] uppercase tracking-wider font-bold text-txt3 mb-1">Calls Today</p>
              <p className="text-2xl font-display font-black text-txt">{performance?.calls_today || 0}</p>
            </div>
            <div className="w-px h-10 bg-border mx-2"></div>
            <div>
              <p className="text-[10px] uppercase tracking-wider font-bold text-txt3 mb-1">Daily Target</p>
              <p className="text-2xl font-display font-black text-accent">{performance?.target || 0}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Layout */}
      <div className="flex flex-col lg:flex-row gap-6">
        
        {/* Sidebar Navigation */}
        <div className="w-full lg:w-64 shrink-0 flex flex-col gap-2">
          {[
            { id: 'profile', label: 'Security & Profile', icon: ShieldCheck },
            { id: 'performance', label: 'Performance Analytics', icon: Activity },
            { id: 'pipeline', label: 'Current Pipeline', icon: Target },
            { id: 'activity', label: 'Live Activity', icon: Clock },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                "w-full flex items-center gap-3 px-5 py-3.5 rounded-xl text-sm font-bold transition-all text-left border",
                activeTab === tab.id 
                  ? "bg-card border-accent shadow-xl shadow-accent/5 text-accent scale-[1.02] z-10" 
                  : "bg-transparent border-transparent text-txt3 hover:bg-card hover:border-border hover:shadow-sm"
              )}
            >
              <tab.icon size={18} /> {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Contents */}
        <div className="flex-1 bg-card border border-border rounded-3xl min-h-[500px] overflow-hidden shadow-sm relative">
          
          {/* ═══ TAB: PROFILE ═══ */}
          {activeTab === 'profile' && (
            <div className="p-8 animate-in fade-in slide-in-from-bottom-4">
              <h2 className="text-lg font-bold text-txt mb-6 flex items-center gap-2"><UserIcon size={20} className="text-accent"/> Profile Settings</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div>
                  <label className="block text-[10px] font-bold text-txt3 uppercase tracking-wider mb-2">First Name</label>
                  <input type="text" readOnly value={employee.first_name} className="input w-full bg-bg2 text-txt3 cursor-not-allowed" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-txt3 uppercase tracking-wider mb-2">Last Name</label>
                  <input type="text" readOnly value={employee.last_name} className="input w-full bg-bg2 text-txt3 cursor-not-allowed" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-bold text-txt3 uppercase tracking-wider mb-2">Email Address</label>
                  <input type="email" readOnly value={employee.email} className="input w-full bg-bg2 text-txt3 cursor-not-allowed" />
                </div>
              </div>

              <div className="h-px bg-border w-full my-8"></div>

              <h2 className="text-lg font-bold text-danger mb-4 flex items-center gap-2"><KeyRound size={20}/> Security & Access</h2>
              <div className="bg-danger/5 border border-danger/20 rounded-2xl p-6">
                <h3 className="text-sm font-bold text-txt mb-2">Force Password Reset</h3>
                <p className="text-xs text-txt3 mb-5 leading-relaxed">
                  Generate a new secure, random password for this employee. They will be logged out of their current session and must use the new credentials to log back in.
                </p>
                <button 
                  onClick={handleResetPassword}
                  disabled={resettingPwd}
                  className="px-6 py-2.5 bg-danger text-white text-xs font-bold rounded-xl shadow-lg shadow-danger/20 hover:bg-danger/90 transition-all flex items-center gap-2"
                >
                  {resettingPwd ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />} 
                  Generate New Password
                </button>

                {newPassword && (
                  <div className="mt-6 p-5 bg-[#10B981]/10 border border-[#10B981]/20 rounded-xl animate-in zoom-in">
                    <p className="text-xs font-bold text-[#10B981] mb-2 flex items-center gap-2">
                      <CheckCircle2 size={16} /> Password Reset Successful!
                    </p>
                    <p className="text-[10px] text-txt2 mb-3">Please share these exact credentials securely with the employee.</p>
                    <div className="bg-bg3 p-4 rounded-lg border border-border font-mono text-sm leading-loose">
                      <div className="text-txt2">Email: <span className="text-txt font-bold">{employee.email}</span></div>
                      <div className="text-txt2">Password: <span className="text-txt font-bold bg-accent/10 px-2 py-0.5 rounded selection:bg-accent selection:text-white">{newPassword}</span></div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ═══ TAB: PERFORMANCE ═══ */}
          {activeTab === 'performance' && (
            <div className="p-8 animate-in fade-in slide-in-from-bottom-4">
               <h2 className="text-lg font-bold text-txt mb-6 flex items-center gap-2"><Activity size={20} className="text-accent"/> Analytics Dashboard</h2>
               
               {performance ? (
                 <div className="space-y-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-bg3 border border-border p-5 rounded-2xl">
                        <p className="text-[10px] uppercase font-bold text-txt3 tracking-wider mb-2 break-words">Calls Output</p>
                        <p className="text-3xl font-display font-black text-txt">{performance.calls_today}</p>
                      </div>
                      <div className="bg-[#10B981]/10 border border-[#10B981]/20 p-5 rounded-2xl">
                        <p className="text-[10px] uppercase font-bold text-[#10B981] tracking-wider mb-2">Won Today</p>
                        <p className="text-3xl font-display font-black text-[#10B981]">{performance.won_today || 0}</p>
                      </div>
                      <div className="bg-danger/10 border border-danger/20 p-5 rounded-2xl">
                        <p className="text-[10px] uppercase font-bold text-danger tracking-wider mb-2">Lost Today</p>
                        <p className="text-3xl font-display font-black text-danger">{performance.lost_today || 0}</p>
                      </div>
                      <div className="bg-purple/10 border border-purple/20 p-5 rounded-2xl">
                        <p className="text-[10px] uppercase font-bold text-purple tracking-wider mb-2">Site Visits</p>
                        <p className="text-3xl font-display font-black text-purple">{performance.visits_today || 0}</p>
                      </div>
                    </div>

                    <div className="bg-bg2/50 border border-border rounded-xl p-8 text-center flex flex-col items-center justify-center min-h-[250px]">
                      <Activity size={48} className="text-txt3/30 mb-4" />
                      <p className="text-sm font-bold text-txt3">Detailed charts are in development.</p>
                      <p className="text-xs text-txt3 max-w-sm mt-2">Historical charting mechanisms will plug in here to visualize {employee.first_name}'s daily growth.</p>
                    </div>
                 </div>
               ) : (
                 <p className="text-txt3 text-sm">No performance data available for today.</p>
               )}
            </div>
          )}

          {/* ═══ TAB: PIPELINE ═══ */}
          {activeTab === 'pipeline' && (
            <div className="p-8 flex flex-col h-full animate-in fade-in slide-in-from-bottom-4">
              <h2 className="text-lg font-bold text-txt mb-6 flex items-center gap-2"><Target size={20} className="text-accent"/> Current Private Pipeline</h2>
              
              <div className="flex-1 bg-bg2/50 border border-border rounded-xl p-8 flex flex-col items-center justify-center text-center">
                <Target size={48} className="text-txt3/30 mb-4" />
                <h3 className="text-sm font-bold text-txt mb-2">Restricted Access</h3>
                <p className="text-xs text-txt3 max-w-sm mb-6 leading-relaxed">
                  To view {employee.first_name}'s specific assigned leads, please use the main Leads table and filter "Assigned To" them. Individual lead pipelines are hidden here to optimize performance.
                </p>
              </div>
            </div>
          )}

          {/* ═══ TAB: ACTIVITY ═══ */}
          {activeTab === 'activity' && (
            <div className="p-8 flex flex-col h-full animate-in fade-in slide-in-from-bottom-4">
              <h2 className="text-lg font-bold text-txt mb-6 flex items-center gap-2"><Clock size={20} className="text-accent"/> Live Activity Feed</h2>
              
              <div className="flex-1 overflow-y-auto">
                {/* Mocking activity feed since endpoint isn't wired for single user yet */}
                <div className="relative pl-6 border-l-2 border-border/60 py-4 space-y-8">
                  <div className="relative">
                    <span className="absolute -left-[31px] top-1 w-4 h-4 rounded-full bg-accent border-4 border-card"></span>
                    <p className="text-sm font-bold text-txt">Viewing profile metadata</p>
                    <p className="text-xs text-txt3 font-mono mt-1 pt-1">Just now</p>
                  </div>
                  <div className="relative opacity-60">
                    <span className="absolute -left-[31px] top-1 w-4 h-4 rounded-full bg-bg3 border-4 border-card"></span>
                    <p className="text-sm font-medium text-txt">Signed in to dashboard</p>
                    <p className="text-xs text-txt3 font-mono mt-1 pt-1">Today, {employee.last_login ? new Date(employee.last_login).toLocaleTimeString() : 'N/A'}</p>
                  </div>
                  
                  <div className="mt-8 pt-8 border-t border-border/50 text-center">
                    <p className="text-[10px] text-txt3 uppercase tracking-widest font-bold">End of feed</p>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </Layout>
  )
}
