import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import clsx from 'clsx'

export function StatCard({ label, value, sub, trend, color = 'accent', icon: Icon, sparkData }) {
  const colorMap = {
    accent: 'accent',
    pink: 'accent2',
    purple: 'purple',
    amber: 'amber',
    green: '[#10B981]',
    orange: 'hot',
  }
  const resolvedColor = colorMap[color] || colorMap.accent

  const trendEl = trend > 0
    ? <span className="flex items-center gap-0.5 text-[#10B981] text-[10px] font-bold"><TrendingUp size={11}/>{trend}%</span>
    : trend < 0
    ? <span className="flex items-center gap-0.5 text-danger text-[10px] font-bold"><TrendingDown size={11}/>{Math.abs(trend)}%</span>
    : <span className="flex items-center gap-0.5 text-txt3 text-[10px] font-bold"><Minus size={11}/>0%</span>

  return (
    <div className="accent-card p-5 group hover-lift relative overflow-hidden h-full flex flex-col justify-between">
      <div className={clsx(
        "absolute -top-8 -right-8 w-24 h-24 rounded-full opacity-[0.04] group-hover:opacity-[0.08] transition-opacity duration-500",
        `bg-${resolvedColor}`
      )} />
      
      <div>
        <div className="flex items-center justify-between mb-3">
          {Icon && (
            <div className={clsx(
              `w-10 h-10 rounded-xl bg-${resolvedColor}/8 flex items-center justify-center text-${resolvedColor}`,
              `group-hover:bg-${resolvedColor} group-hover:text-white transition-all duration-300`
            )}>
              <Icon size={18} />
            </div>
          )}
          {trend !== undefined && trendEl}
        </div>
        
        <div className="font-display font-extrabold text-3xl text-txt leading-none tracking-tight animate-count-up">
          {value}
        </div>
        <div className="text-xs text-txt3 mt-1.5 font-medium">{label}</div>
      </div>
      
      {sub && (
        <div className={clsx("text-[10px] uppercase font-bold tracking-widest mt-4 pt-3 border-t border-border/40", `text-${resolvedColor}`)}>
          {sub}
        </div>
      )}
      
      {sparkData && sparkData.length > 0 && (
        <div className="absolute bottom-0 left-0 right-0 opacity-40 group-hover:opacity-60 transition-opacity">
          <MiniAreaChart data={sparkData} color={`var(--${colorMap[color] || 'accent'})`} height={40} />
        </div>
      )}
    </div>
  )
}


export function MiniAreaChart({ data, color = 'var(--accent)', height = 60 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={`g-${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.25} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.5}
          fill={`url(#g-${color.replace('#','')})`} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

export function MiniBarChart({ data, height = 80 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }} barSize={8}>
        <defs>
          <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#250099" />
            <stop offset="100%" stopColor="#ef0379" />
          </linearGradient>
        </defs>
        <Bar dataKey="v" fill="url(#barGrad)" radius={[4,4,0,0]} opacity={0.9} />
        <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'var(--txt3)' }} axisLine={false} tickLine={false} />
        <Tooltip
          cursor={{ fill: 'var(--bg2)' }}
          contentStyle={{ background: '#1a1a1a', border: 'none', borderRadius: 8, fontSize: 12, color: 'white' }}
          itemStyle={{ color: 'white' }}
        />
      </BarChart>
    </ResponsiveContainer>
  )
}

const RCOLORS = ['#250099', '#ef0379', '#10B981', '#F59E0B']
export function DonutChart({ data, height = 140 }) {
  const total = data.reduce((sum, d) => sum + d.value, 0)
  const activeCount = data.find(d => d.name === 'Active')?.value || 0
  
  return (
    <div className="relative" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={42} outerRadius={60}
            dataKey="value" paddingAngle={2} stroke="none">
            {data.map((_, i) => <Cell key={i} fill={RCOLORS[i % RCOLORS.length]} />)}
          </Pie>
          <Tooltip
            contentStyle={{ background: '#1a1a1a', border: 'none', borderRadius: 8, fontSize: 12, color: 'white' }}
            itemStyle={{ color: 'white' }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
         <span className="font-display font-bold text-2xl text-txt">{activeCount}</span>
         <span className="text-[9px] uppercase font-bold text-txt3 tracking-wider">Active</span>
      </div>
    </div>
  )
}

export function ProgressBar({ value, max, height = 8 }) {
  const pct = Math.min(100, Math.round((value / max) * 100))
  return (
    <div className="progress-track w-full" style={{ height }}>
      <div className="progress-fill" style={{ width: `${pct}%`, height }} />
    </div>
  )
}

export function StatusBadge({ status }) {
  const map = {
    new:            'badge-blue',
    called:         'badge-purple',
    interested:     'badge-pink',
    not_interested: 'badge-gray',
    not_answered:   'badge-amber',
    invalid_number: 'badge-red',
    site_visit:     'badge-amber',
    visited:        'badge-green',
    won:            'badge-green',
    lost:           'badge-gray',
    hot:            'badge-pink',
    aged:           'badge-gray',
    duplicate:      'badge-amber',
    scheduled:      'badge-blue',
    completed:      'badge-green',
    cancelled:      'badge-gray',
    active:         'badge-pink',
    inactive:       'badge-gray',
    trial:          'badge-amber',
    pending:        'badge-amber',
    processing:     'badge-purple',
    ready:          'badge-green',
    expired:        'badge-gray',
  }
  let label = status?.replace(/_/g, ' ')
  if (status === 'called') {
    label = 'follow up'
  }
  return <span className={clsx('badge capitalize', map[status] || 'badge-gray')}>{label}</span>
}

export function LeadRow({ lead, onAction, showAssignee = true }) {
  return (
    <tr className={clsx('table-row', lead.is_hot && 'hot-glow')}>
      <td className="td">
        <div className="flex items-center gap-2">
          {lead.is_hot && <span className="w-1.5 h-1.5 rounded-full bg-hot pulse-dot" />}
          <div>
            <div className="font-medium text-txt">{lead.name}</div>
            <div className="text-xs text-txt3 font-mono">{lead.phone}</div>
          </div>
        </div>
      </td>
      {showAssignee && (
        <td className="td text-txt2 text-xs">{lead.assignee || '—'}</td>
      )}
      <td className="td"><StatusBadge status={lead.status} /></td>
      <td className="td text-txt2 text-xs">{lead.project || '—'}</td>
      <td className="td text-txt3 text-xs font-mono">{lead.last_activity}</td>
      <td className="td">
        <div className="flex items-center gap-1">
          {onAction && (
            <>
              <button onClick={() => onAction('reassign', lead)} className="btn-ghost text-xs py-1 px-2">Reassign</button>
              <button onClick={() => onAction('delete', lead)} className="text-danger hover:bg-danger/10 px-2 py-1 rounded text-xs transition-colors">Delete</button>
            </>
          )}
        </div>
      </td>
    </tr>
  )
}

export function SectionHeader({ title, sub, children }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div>
        <h2 className="section-title">{title}</h2>
        {sub && <p className="text-xs text-txt2 mt-0.5">{sub}</p>}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  )
}

export function EmptyState({ icon: Icon, message, sub }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {Icon && <Icon size={32} className="text-txt3 mb-3" />}
      <div className="text-txt2 font-medium">{message}</div>
      {sub && <div className="text-txt3 text-xs mt-1">{sub}</div>}
    </div>
  )
}

export function Modal({ isOpen, onClose, title, children, footer }) {
  if (!isOpen) return null
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      <div className="bg-card w-full max-w-md rounded-2xl border border-border shadow-2xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-border">
          <h3 className="font-display font-bold text-lg text-txt">{title}</h3>
        </div>
        <div className="p-6">
          {children}
        </div>
        {footer && (
          <div className="p-4 bg-bg2/50 border-t border-border flex justify-end gap-2 rounded-b-2xl">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
