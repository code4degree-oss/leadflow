import { useState } from 'react'
import { X, PhoneCall, History, Bell, FileText, Calendar, CheckCircle2, Circle, Flame, MapPin, Clock, DollarSign, Building2, UserCheck, AlertTriangle, Loader2, ChevronRight } from 'lucide-react'
import clsx from 'clsx'
import { StatusBadge } from '../../UI'

const TIMELINE_ICONS = {
  'CALL_LOGGED': PhoneCall, 'STATUS_CHANGE': CheckCircle2, 'ASSIGNED': ChevronRight,
  'REASSIGNED': ChevronRight, 'FOLLOW_UP_SET': Calendar, 'FOLLOW_UP_COMPLETED': CheckCircle2,
  'SITE_VISIT_SCHEDULED': MapPin, 'SITE_VISIT_COMPLETED': CheckCircle2, 'NOTE_ADDED': FileText,
  'ESCALATED': Flame, 'IMPORTED': FileText,
}

const TIMELINE_COLORS = {
  'CALL_LOGGED': 'text-accent bg-accent/10', 'STATUS_CHANGE': 'text-purple bg-purple/10',
  'FOLLOW_UP_SET': 'text-amber bg-amber/10', 'FOLLOW_UP_COMPLETED': 'text-[#10B981] bg-[#10B981]/10',
  'SITE_VISIT_SCHEDULED': 'text-accent2 bg-accent2/10', 'ESCALATED': 'text-danger bg-danger/10',
}

const DETAIL_TABS = [
  { key: 'info', label: 'Details', icon: FileText },
  { key: 'timeline', label: 'History', icon: History },
  { key: 'followups', label: 'Follow-ups', icon: Bell },
]

export default function LeadDetailDrawer({ lead, timeline, followUps, loading, onClose }) {
  const [detailTab, setDetailTab] = useState('info')

  if (!lead) return null

  const getIcon = (type) => TIMELINE_ICONS[type] || Circle
  const getColor = (type) => TIMELINE_COLORS[type] || 'text-txt3 bg-bg3'

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-end animate-in fade-in" onClick={onClose}>
      <div className="bg-card w-full max-w-lg h-full shadow-2xl animate-in slide-in-from-right flex flex-col border-l border-border" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-6 py-5 border-b border-border bg-bg2/50">
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display font-bold text-xl text-txt">{lead.first_name} {lead.last_name}</h2>
                {lead.is_hot && <span className="text-[9px] font-bold text-hot bg-hot/10 px-2 py-0.5 rounded-full border border-hot/20">🔥 Hot</span>}
              </div>
              <p className="text-xs text-txt3 font-mono mt-1">{lead.phone} {lead.email && `• ${lead.email}`}</p>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <StatusBadge status={lead.status.toLowerCase()} />
                <span className="px-2 py-0.5 bg-bg3 border border-border rounded text-[9px] uppercase tracking-wider">{lead.source}</span>
                <span className="text-[10px] font-bold text-accent bg-accent/10 px-2 py-0.5 rounded">👤 {lead.assigned_user_name || 'Unassigned'}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={`tel:${lead.phone}`}
                className="p-2 bg-bg3 border border-border text-txt3 hover:text-[#10B981] hover:border-[#10B981]/30 hover:bg-[#10B981]/10 transition-all rounded-xl flex items-center justify-center shrink-0"
                title="Call via Dialer"
              >
                <PhoneCall size={20} />
              </a>
              <button onClick={onClose} className="p-2 hover:bg-danger/10 hover:text-danger hover:border-danger/30 border border-transparent transition-all rounded-xl text-txt3"><X size={20} /></button>
            </div>
          </div>
        </div>

        {/* Tab Bar */}
        <div className="flex border-b border-border bg-card">
          {DETAIL_TABS.map(tab => (
            <button key={tab.key} onClick={() => setDetailTab(tab.key)}
              className={clsx(
                'flex-1 flex items-center justify-center gap-2 py-3 text-[11px] font-bold uppercase tracking-wider border-b-2 transition-colors',
                detailTab === tab.key ? 'border-accent text-accent bg-accent/5' : 'border-transparent text-txt3 hover:text-txt hover:bg-bg2'
              )}>
              <tab.icon size={14} />{tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto">
          {detailTab === 'info' && (
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'Budget', value: lead.budget ? `₹${Number(lead.budget).toLocaleString('en-IN')}` : 'Not set', icon: DollarSign },
                  { label: 'Area', value: lead.area || 'Not set', icon: MapPin },
                  { label: 'Project', value: lead.project_name || 'Not set', icon: Building2 },
                  { label: 'Flat/Unit', value: lead.interested_flat || 'Not set', icon: FileText },
                  { label: 'Field Agent', value: lead.field_agent_name || 'Not assigned', icon: UserCheck },
                  { label: 'Lost Count', value: `${lead.lost_count}×`, icon: AlertTriangle },
                ].map(item => (
                  <div key={item.label} className="p-4 bg-bg2/50 rounded-xl border border-border hover:border-accent/30 transition-colors">
                    <div className="flex items-center gap-2 mb-2">
                      <item.icon size={12} className="text-txt3" />
                      <span className="text-[10px] font-bold text-txt3 uppercase tracking-wider">{item.label}</span>
                    </div>
                    <p className="text-sm font-bold text-txt">{item.value}</p>
                  </div>
                ))}
              </div>
              {lead.next_call_at && (
                <div className={clsx("p-4 rounded-xl border flex items-center gap-3", new Date(lead.next_call_at) < new Date() ? "bg-danger/5 border-danger/20" : "bg-accent/5 border-accent/20")}>
                  <Calendar size={20} className={new Date(lead.next_call_at) < new Date() ? "text-danger" : "text-accent"} />
                  <div>
                    <span className="text-[10px] font-bold text-txt3 uppercase">Next Scheduled Action</span>
                    <p className={clsx("text-sm font-bold mt-0.5", new Date(lead.next_call_at) < new Date() ? "text-danger" : "text-accent")}>
                      {new Date(lead.next_call_at).toLocaleString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              )}
              <div>
                <h4 className="text-[10px] font-bold text-txt3 uppercase tracking-wider mb-2 flex items-center gap-1.5"><FileText size={12}/> Notes from Telecaller</h4>
                <div className="p-4 bg-bg2/50 rounded-xl border border-border text-sm text-txt2 whitespace-pre-wrap font-mono min-h-[80px]">
                  {lead.notes || 'No specific notes recorded yet.'}
                </div>
              </div>
            </div>
          )}

          {detailTab === 'timeline' && (
            <div className="p-6">
              {loading ? (
                <div className="py-12 text-center"><Loader2 className="animate-spin mx-auto text-accent mb-2" size={20} /><p className="text-xs text-txt3">Loading history...</p></div>
              ) : timeline.length === 0 ? (
                <div className="py-12 text-center border-dashed border-2 border-border rounded-xl"><History size={28} className="mx-auto text-txt3 opacity-40 mb-2" /><p className="text-sm font-bold text-txt3">No activity logged.</p></div>
              ) : (
                <div className="relative">
                  <div className="absolute left-[15px] top-6 bottom-6 w-px bg-border" />
                  <div className="space-y-5">
                    {timeline.map((event, i) => {
                      const Icon = getIcon(event.activity_type)
                      const colorClass = getColor(event.activity_type)
                      return (
                        <div key={event.id || i} className="flex gap-4 relative">
                          <div className={clsx('w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10 border shadow-sm outline outline-4 outline-card', colorClass.replace('text-', 'border-').replace('bg-', 'bg-').split(' ')[1])}>
                            <Icon size={14} className={colorClass.split(' ')[0]} />
                          </div>
                          <div className="flex-1 min-w-0 bg-bg2/50 border border-border rounded-xl p-3 shadow-sm hover:border-txt3 transition-colors">
                            <p className="text-sm font-bold text-txt leading-tight">{event.title}</p>
                            <div className="flex items-center gap-2 mt-2">
                              <span className="text-[10px] font-bold uppercase tracking-wider bg-bg3 px-1.5 py-0.5 rounded text-txt2">{event.performed_by_name}</span>
                              <span className="text-[10px] text-txt3 font-mono">
                                {new Date(event.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {detailTab === 'followups' && (
            <div className="p-6">
              {loading ? (
                <div className="py-12 text-center"><Loader2 className="animate-spin mx-auto text-accent mb-2" size={20} /><p className="text-xs text-txt3">Loading follow-ups...</p></div>
              ) : followUps.length === 0 ? (
                <div className="py-12 text-center border-dashed border-2 border-border rounded-xl"><Bell size={28} className="mx-auto text-txt3 opacity-40 mb-2" /><p className="text-sm font-bold text-txt3">No follow-ups.</p></div>
              ) : (
                <div className="space-y-3">
                  {followUps.map((fu, i) => {
                    const isPast = new Date(fu.scheduled_at) < new Date()
                    return (
                      <div key={fu.id || i} className={clsx('p-4 rounded-xl border flex gap-3',
                        fu.is_completed ? 'bg-[#10B981]/5 border-[#10B981]/20' :
                        isPast ? 'bg-danger/5 border-danger/20' : 'bg-accent/5 border-accent/20')}>
                        <div className="mt-0.5">
                          {fu.is_completed ? <CheckCircle2 size={16} className="text-[#10B981]" /> :
                           isPast ? <Clock size={16} className="text-danger" /> : <Calendar size={16} className="text-accent" />}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1 text-xs">
                            <span className={clsx("font-bold", fu.is_completed ? 'text-[#10B981]' : isPast ? 'text-danger' : 'text-accent')}>
                              {new Date(fu.scheduled_at).toLocaleString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <span className={clsx('text-[9px] font-bold uppercase px-2 py-0.5 rounded-full',
                              fu.is_completed ? 'bg-[#10B981]/10 text-[#10B981]' :
                              isPast ? 'bg-danger/10 text-danger' : 'bg-accent/10 text-accent')}>
                              {fu.is_completed ? 'Done' : isPast ? 'Overdue' : 'Upcoming'}
                            </span>
                          </div>
                          <div className="text-[10px] text-txt3 mb-1.5 font-bold uppercase tracking-wider">Set by {fu.created_by_name}</div>
                          {fu.note && <p className="text-xs text-txt2 leading-relaxed bg-bg3/50 p-2 rounded-lg font-mono border border-border/50">{fu.note}</p>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
