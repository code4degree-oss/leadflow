import Layout from '../../components/Layout'
import { StatusBadge } from '../../components/UI'
import { Bell, Phone, Clock, CheckCircle, Calendar } from 'lucide-react'
import clsx from 'clsx'

const REMINDERS = []

const groups = [
  { label: 'Overdue',   items: REMINDERS.filter(r=>r.overdue),              color:'text-danger',  border:'border-danger/20', bg:'bg-danger/5' },
  { label: 'Today',     items: REMINDERS.filter(r=>!r.overdue && r.time.startsWith('Today')),  color:'text-accent', border:'border-accent/20', bg:'bg-accent/5' },
  { label: 'Upcoming',  items: REMINDERS.filter(r=>!r.overdue && !r.time.startsWith('Today')), color:'text-txt2',   border:'border-border',    bg:'' },
]

export default function Reminders() {
  return (
    <Layout role="telecaller" pageTitle="Call Reminders">
      <div className="max-w-2xl space-y-5">
        {groups.map(g => g.items.length > 0 && (
          <div key={g.label} className={clsx('card overflow-hidden border', g.border, g.bg)}>
            <div className={clsx('px-4 py-3 border-b border-border flex items-center gap-2', g.border)}>
              <Bell size={14} className={g.color} />
              <span className={clsx('text-sm font-semibold', g.color)}>{g.label}</span>
              <span className="badge badge-gray ml-1">{g.items.length}</span>
            </div>
            <div className="divide-y divide-border">
              {g.items.map((r, i) => (
                <div key={i} className="px-4 py-3.5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={clsx('w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
                      r.overdue ? 'bg-danger/15' : 'bg-accent/10')}>
                      {r.overdue ? <Clock size={14} className="text-danger" /> : <Bell size={14} className="text-accent" />}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-txt">{r.name}</div>
                      <div className="text-xs font-mono text-txt3">{r.phone}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={clsx('text-xs font-medium', r.overdue?'text-danger':'text-accent')}>{r.time}</span>
                        {r.project !== '—' && <span className="text-xs text-txt3">· {r.project}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={r.status} />
                    <button className="btn-primary text-xs py-1.5 px-3"><Phone size={11}/>Call</button>
                    <button className="p-1.5 hover:bg-card2 rounded text-txt3 hover:text-accent2 transition-colors" title="Mark done">
                      <CheckCircle size={14}/>
                    </button>
                    <button className="p-1.5 hover:bg-card2 rounded text-txt3 hover:text-accent transition-colors" title="Reschedule">
                      <Calendar size={14}/>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        {REMINDERS.length === 0 && (
          <div className="card p-16 flex flex-col items-center justify-center text-center">
            <CheckCircle size={32} className="text-accent2 mb-3" />
            <div className="text-txt2 font-medium">All caught up!</div>
            <div className="text-txt3 text-xs mt-1">No pending call reminders</div>
          </div>
        )}
      </div>
    </Layout>
  )
}
