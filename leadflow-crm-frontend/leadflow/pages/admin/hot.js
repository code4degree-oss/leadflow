import { useState, useEffect } from 'react'
import Layout from '../../components/Layout'
import { StatusBadge } from '../../components/UI'
import { Flame, Phone, PhoneCall, Calendar, ArrowRight, XCircle, Loader2, DollarSign, MapPin, Building2, User } from 'lucide-react'
import clsx from 'clsx'
import { fetchWithAuth } from '../../utils/api'
import { useRouter } from 'next/router'

export default function AdminHotLeads() {
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [toggling, setToggling] = useState(false)
  const router = useRouter()

  useEffect(() => {
    fetchHotLeads()
  }, [])

  const fetchHotLeads = async () => {
    try {
      setLoading(true)
      const data = await fetchWithAuth('/leads/')
      const allLeads = data.results || data || []
      const hotLeads = allLeads.filter(l => l.is_hot)
      setLeads(hotLeads)
      
      // Keep selected lead in sync or select first if none selected
      if (selected) {
        const stillHot = hotLeads.find(l => l.id === selected.id)
        if (stillHot) setSelected(stillHot)
        else setSelected(hotLeads[0] || null)
      } else if (hotLeads.length > 0) {
        setSelected(hotLeads[0])
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleToggleHot = async (e) => {
    if (e) e.stopPropagation()
    if (!selected) return
    
    setToggling(true)
    try {
      await fetchWithAuth(`/leads/${selected.id}/toggle-hot/`, { method: 'POST' })
      // Re-fetch to update list
      await fetchHotLeads()
    } catch (err) {
      alert("Failed to remove hot flag: " + err.message)
    } finally {
      setToggling(false)
    }
  }

  const navigateToLead = () => {
    router.push('/admin/leads')
  }

  return (
    <Layout role="admin" pageTitle="Hot Leads">

      <div className="flex items-center gap-2 mb-5 p-3 bg-hot/8 border border-hot/20 rounded-xl">
        <Flame size={16} className="text-hot" />
        <span className="text-sm text-hot font-medium">
          {loading ? 'Loading...' : `${leads.length} hot leads — high-priority company prospects`}
        </span>
      </div>

      <div className="grid grid-cols-5 gap-4">
        {/* List */}
        <div className="col-span-2 space-y-3 max-h-[calc(100vh-160px)] overflow-y-auto pr-2">
          {loading ? (
            <div className="card p-10 text-center flex flex-col items-center">
              <Loader2 className="animate-spin text-hot mb-3" size={28} />
              <div className="text-txt2">Loading hot leads...</div>
            </div>
          ) : leads.map(lead => (
            <div key={lead.id} onClick={() => setSelected(lead)}
              className={clsx('card p-4 cursor-pointer transition-all border-l-2 border-hot hot-glow hover:border-border2',
                selected?.id === lead.id && 'bg-card2 shadow-md')}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Flame size={13} className="text-hot" />
                  <span className="font-semibold text-sm text-txt">{lead.first_name} {lead.last_name}</span>
                </div>
              </div>
              <div className="text-xs font-mono text-txt3 mb-2">{lead.phone}</div>
              <div className="flex items-center justify-between mt-1">
                <StatusBadge status={lead.status.toLowerCase()} />
                <span className="text-[10px] text-txt3 uppercase tracking-wider bg-bg2 px-1.5 py-0.5 rounded">{lead.assigned_user_name || 'Unassigned'}</span>
              </div>
              
              {lead.next_call_at && (
                <div className="flex items-center gap-1 mt-3 p-1.5 bg-accent/5 rounded mb-1 border border-accent/10">
                  <Calendar size={10} className="text-accent" />
                  <span className="text-[10px] font-bold text-accent">
                    Next: {new Date(lead.next_call_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute:'2-digit' })}
                  </span>
                </div>
              )}
            </div>
          ))}
          {!loading && leads.length === 0 && (
            <div className="card p-12 text-center rounded-2xl border-dashed border-2 border-hot/20">
              <div className="w-16 h-16 rounded-full bg-hot/10 flex items-center justify-center mx-auto mb-4 relative">
                <Flame size={28} className="text-hot absolute" />
                <div className="absolute inset-0 border-2 border-hot/30 rounded-full animate-ping opacity-20" />
              </div>
              <p className="font-display font-bold text-lg text-txt mb-1">No hot leads yet</p>
              <p className="text-xs text-txt3">Mark leads as Hot from the main lead management panel.</p>
              <button onClick={navigateToLead} className="btn-ghost mt-4 text-xs font-bold text-accent">
                Go to All Leads <ArrowRight size={14} className="ml-1 inline" />
              </button>
            </div>
          )}
        </div>

        {/* Detail */}
        <div className="col-span-3">
          {selected ? (
            <div className="card p-6 shadow-xl sticky top-4 border-t-4 border-t-hot bg-gradient-to-b from-hot/5 to-transparent">
              <div className="flex items-start justify-between mb-6 pb-6 border-b border-border">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-full bg-hot/10 flex items-center justify-center border-2 border-hot shadow-lg shadow-hot/20 relative">
                    <Flame size={24} className="text-hot" />
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-card flex items-center justify-center border border-border">
                      <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
                    </div>
                  </div>
                  <div>
                    <h2 className="font-display font-bold text-2xl text-txt">{selected.first_name} {selected.last_name}</h2>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="font-mono text-sm text-txt bg-bg3 px-2 py-0.5 rounded border border-border">{selected.phone}</span>
                      <StatusBadge status={selected.status.toLowerCase()} />
                      <span className="text-[10px] font-bold text-hot bg-hot/10 px-2.5 py-1 rounded-full uppercase tracking-wider border border-hot/20 flex items-center gap-1">
                        <Flame size={10} /> Hot Prospect
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={`tel:${selected.phone}`}
                    className="p-2 bg-bg3 border border-border text-txt3 hover:text-[#10B981] hover:border-[#10B981]/30 hover:bg-[#10B981]/10 transition-all rounded-xl flex items-center justify-center shrink-0"
                    title="Call via Dialer"
                  >
                    <PhoneCall size={20} />
                  </a>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                {[
                  { label: 'Telecaller', value: selected.assigned_user_name || 'Unassigned', icon: Phone },
                  { label: 'Budget', value: selected.budget ? `₹${Number(selected.budget).toLocaleString('en-IN')}` : 'Not specified', icon: DollarSign },
                  { label: 'Project', value: selected.project_name || 'Not specified', icon: Building2 },
                  { label: 'Field Agent', value: selected.field_agent_name || 'Unassigned', icon: User },
                ].map((item, i) => (
                  <div key={i} className="bg-card rounded-xl p-4 border border-border flex items-start gap-3 shadow-sm hover:border-accent/30 transition-colors">
                    <div className="p-2 bg-bg2 rounded-lg text-txt3">
                      <item.icon size={16} />
                    </div>
                    <div>
                      <div className="text-[9px] font-bold uppercase tracking-wider text-txt3 mb-0.5">{item.label}</div>
                      <div className="text-sm font-bold text-txt truncate max-w-[150px]">{item.value}</div>
                    </div>
                  </div>
                ))}
              </div>

              {selected.next_call_at && (
                <div className="mb-6 p-4 bg-accent/5 border border-accent/20 rounded-xl flex items-center justify-between shadow-inner">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-accent/10 rounded-lg text-accent"><Calendar size={20} /></div>
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-txt3 mb-0.5">Next Scheduled Action</div>
                      <div className="text-sm font-bold text-accent">
                        {new Date(selected.next_call_at).toLocaleString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                  <span className={clsx("text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider border", new Date(selected.next_call_at) < new Date() ? 'bg-danger/10 text-danger border-danger/20' : 'bg-[#10B981]/10 text-[#10B981] border-[#10B981]/20')}>
                    {new Date(selected.next_call_at) < new Date() ? 'Overdue' : 'Upcoming'}
                  </span>
                </div>
              )}

              <div className="mb-8">
                <div className="text-[10px] font-bold uppercase tracking-wider text-txt3 mb-2 flex items-center gap-2">
                  Telecaller Notes
                </div>
                <div className="bg-bg2/50 rounded-xl p-5 text-sm text-txt2 min-h-[100px] whitespace-pre-wrap leading-relaxed border border-border shadow-inner font-mono">
                  {selected.notes || 'No notes currently attached to this prospect. Follow up with assigned telecaller.'}
                </div>
              </div>

              <div className="space-y-3 mt-auto">
                <button onClick={navigateToLead} className="btn-primary w-full justify-center py-4 text-sm font-bold shadow-lg shadow-accent/20">
                  <ArrowRight size={16} className="mr-2" /> View in Admin Leads Panel for Full Details
                </button>
                <button 
                  onClick={handleToggleHot}
                  disabled={toggling}
                  className="w-full flex items-center justify-center px-4 py-3.5 rounded-xl bg-bg3 border border-border text-xs font-bold text-txt2 transition-all hover:bg-danger/10 hover:text-danger hover:border-danger/30 hover:shadow-md disabled:opacity-50">
                  {toggling ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={16} className="mr-2" />} 
                  Revoke Hot Flag Admin Override
                </button>
              </div>
            </div>
          ) : (
            !loading && leads.length > 0 && (
              <div className="card p-12 text-center h-full flex flex-col items-center justify-center border-dashed border-2 border-border bg-bg2/30">
                <Flame size={48} className="text-hot opacity-40 mb-6 drop-shadow-lg" />
                <p className="font-display font-bold text-xl text-txt">Review Hot Priority Leads</p>
                <p className="text-sm text-txt3 mt-2 max-w-sm">Select a lead from the list on the left to view their detailed profile, current team assignment, and priority metrics.</p>
              </div>
            )
          )}
        </div>
      </div>
    </Layout>
  )
}
