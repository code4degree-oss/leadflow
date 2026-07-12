import { useState } from 'react'
import { Users, UserPlus, Shuffle, BarChart2, Loader2, CheckCircle2 } from 'lucide-react'
import clsx from 'clsx'

const ASSIGN_MODES = [
  { key: 'manual', label: 'Manual', desc: 'Pick a specific person', icon: UserPlus },
  { key: 'round_robin', label: 'Round Robin', desc: 'Distribute equally in order', icon: Shuffle },
  { key: 'load_balance', label: 'Load Balance', desc: 'Assign to least loaded', icon: BarChart2 },
]

const COUNT_OPTIONS = [5, 10, 20, 50, 100]

export default function BulkAssign({ employees, onAssign, assigning }) {
  const [assignMode, setAssignMode] = useState('manual')
  const [assignUserIds, setAssignUserIds] = useState([])
  const [fromUserId, setFromUserId] = useState('')
  const [assignStatusFilter, setAssignStatusFilter] = useState('NEW')
  const [assignCount, setAssignCount] = useState(10)

  const handleBulkAssign = () => {
    if (assignMode === 'manual' && assignUserIds.length !== 1) {
      alert('Please select exactly one user to assign leads to manually.')
      return
    }
    if (assignMode === 'round_robin' && assignUserIds.length < 2) {
      alert('Please select at least 2 or more employees for round robin distribution.')
      return
    }
    onAssign({
      mode: assignMode,
      count: assignCount,
      status_filter: assignStatusFilter,
      target_user_ids: assignMode === 'load_balance' ? [] : assignUserIds,
      from_user_id: fromUserId || undefined,
    })
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="card p-6 shadow-xl border-accent2/20">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-accent2/10 rounded-xl text-accent2">
            <Users size={24} />
          </div>
          <div>
            <h2 className="text-lg font-display font-bold text-txt">Bulk Lead Assignment</h2>
            <p className="text-xs text-txt3 mt-1">Assign uncontacted (NEW) leads to telecallers or field agents</p>
          </div>
        </div>

        {/* Assignment Mode */}
        <div className="mb-6">
          <label className="text-[10px] font-bold text-txt3 uppercase tracking-wider mb-3 block">Assignment Mode</label>
          <div className="grid grid-cols-3 gap-3">
            {ASSIGN_MODES.map(m => (
              <button key={m.key} onClick={() => setAssignMode(m.key)}
                className={clsx(
                  'p-4 rounded-xl border text-left transition-all',
                  assignMode === m.key
                    ? 'bg-accent2/10 border-accent2 shadow-md shadow-accent2/10'
                    : 'bg-card border-border hover:border-accent2/30'
                )}>
                <m.icon size={20} className={assignMode === m.key ? 'text-accent2 mb-2' : 'text-txt3 mb-2'} />
                <div className="text-sm font-bold text-txt">{m.label}</div>
                <div className="text-[10px] text-txt3 mt-0.5">{m.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Redistribute FROM (optional) */}
        <div className="mb-6">
          <label className="text-[10px] font-bold text-txt3 uppercase tracking-wider mb-2 block">Redistribute From (Optional)</label>
          <select value={fromUserId} onChange={e => setFromUserId(e.target.value)}
            className="input w-full bg-bg3 text-sm">
            <option value="">Unassigned leads (default)</option>
            {employees.map(emp => (
              <option key={emp.id} value={emp.id}>
                {emp.first_name} {emp.last_name} — {emp.role === 'FIELD_AGENT' ? '🏃 Field Agent' : emp.role === 'MANAGER' ? '👔 Manager (Caller)' : '📞 Telecaller'} ({emp.email})
              </option>
            ))}
          </select>
          <p className="text-[10px] text-txt3 mt-1">{fromUserId ? 'Leads will be taken FROM this employee and redistributed' : 'Only unassigned leads will be used'}</p>
        </div>

        {/* Lead Status Filter */}
        <div className="mb-6">
          <label className="text-[10px] font-bold text-txt3 uppercase tracking-wider mb-2 block">Lead Status Filter</label>
          <div className="flex gap-2">
            {[
              { key: 'NEW', label: 'New Only' },
              { key: 'all', label: 'All Statuses' },
            ].map(s => (
              <button key={s.key} onClick={() => setAssignStatusFilter(s.key)}
                className={clsx(
                  'px-4 py-2 rounded-lg border text-sm font-bold transition-all',
                  assignStatusFilter === s.key ? 'bg-accent2 text-white border-accent2' : 'bg-card text-txt2 border-border hover:border-accent2/30'
                )}>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Target Users */}
        {assignMode !== 'load_balance' && (
          <div className="mb-6 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center justify-between mb-2">
              <label className="text-[10px] font-bold text-txt3 uppercase tracking-wider block">Target Employees</label>
              <div className="flex gap-2">
                <button onClick={() => setAssignUserIds(employees.map(e => e.id))} className="text-[10px] font-bold text-accent hover:underline">Select All</button>
                <button onClick={() => setAssignUserIds([])} className="text-[10px] font-bold text-txt3 hover:underline">Clear</button>
              </div>
            </div>
            
            <div className="bg-bg2 border border-border rounded-xl max-h-[200px] overflow-y-auto divide-y divide-border">
              {employees.length === 0 ? (
                 <div className="p-4 text-center text-xs text-txt3">No active employees found</div>
              ) : (
                employees.map(emp => {
                  const isSelected = assignUserIds.includes(emp.id)
                  return (
                    <label 
                      key={emp.id} 
                      className={clsx("flex items-center gap-3 p-3 cursor-pointer hover:bg-bg3 transition-colors", isSelected && "bg-accent/5")}
                      onClick={(e) => {
                        e.preventDefault()
                        setAssignUserIds(prev => 
                          prev.includes(emp.id) ? prev.filter(id => id !== emp.id) : [...prev, emp.id]
                        )
                      }}
                    >
                      <div className={clsx("w-4 h-4 rounded border flex items-center justify-center shrink-0", isSelected ? "bg-accent border-accent text-white" : "border-txt3/30")}>
                        {isSelected && <CheckCircle2 size={12} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-txt truncate">{emp.first_name} {emp.last_name}</div>
                        <div className="text-[10px] text-txt3 truncate">{emp.role === 'FIELD_AGENT' ? '🏃 Field Agent' : emp.role === 'MANAGER' ? '👔 Manager' : '📞 Telecaller'} • {emp.email}</div>
                      </div>
                    </label>
                  )
                })
              )}
            </div>
            {assignMode === 'manual' && assignUserIds.length > 1 && (
              <p className="text-xs text-danger mt-2">⚠️ Manual mode requires exactly one employee selected.</p>
            )}
            {assignMode === 'round_robin' && assignUserIds.length < 2 && (
              <p className="text-xs text-danger mt-2">⚠️ Select at least 2 or more employees for Round Robin.</p>
            )}
          </div>
        )}

        {/* Count */}
        <div className="mb-6">
          <label className="text-[10px] font-bold text-txt3 uppercase tracking-wider mb-2 block">Number of Leads to Assign</label>
          <div className="flex gap-2 flex-wrap">
            {COUNT_OPTIONS.map(n => (
              <button key={n} onClick={() => setAssignCount(n)}
                className={clsx(
                  'px-4 py-2 rounded-lg border text-sm font-bold transition-all',
                  assignCount === n ? 'bg-accent2 text-white border-accent2' : 'bg-card text-txt2 border-border hover:border-accent2/30'
                )}>
                {n}
              </button>
            ))}
            <input type="number" value={assignCount} onChange={e => setAssignCount(parseInt(e.target.value) || 0)}
              className="input w-20 text-sm bg-bg3 text-center" min={1} />
          </div>
        </div>

        {/* Summary & Action */}
        <div className="p-4 bg-bg2/50 rounded-xl border border-border mb-4">
          <p className="text-xs text-txt2">
            <strong className="text-txt">Summary:</strong>{' '}
            {fromUserId
              ? <>Take <strong className="text-accent2">{assignCount}</strong> leads from <strong className="text-accent2">{employees.find(e => e.id === fromUserId)?.first_name || 'selected user'}</strong> and </>
              : <>Assign <strong className="text-accent2">{assignCount}</strong> unassigned leads </>
            }
            {assignMode === 'manual' 
              ? `to ${assignUserIds.length === 1 ? employees.find(e => e.id === assignUserIds[0])?.first_name || 'selected user' : 'selected users'}` 
              : assignMode === 'load_balance'
              ? `via load balance (auto-assigned to least loaded users)`
              : `via ${assignMode.replace(/_/g, ' ')} (${assignUserIds.length === 0 ? 'All applicable' : assignUserIds.length} users)`}
            {' '}({assignStatusFilter === 'NEW' ? 'NEW status only' : 'all statuses'})
          </p>
        </div>

        <button onClick={handleBulkAssign} disabled={assigning}
          className="btn-primary w-full justify-center py-3.5 text-sm font-bold shadow-lg shadow-accent2/20 bg-accent2 border-accent2 hover:bg-accent2/90">
          {assigning ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
          {assigning ? 'Assigning...' : `Assign ${assignCount} Leads`}
        </button>
      </div>

      <div className="p-4 bg-bg2 rounded-xl border border-border text-xs text-txt2 leading-relaxed">
        <strong className="text-txt">💡 Lead Assignment Rules:</strong>
        <ul className="mt-2 space-y-1 list-disc list-inside">
          <li>Select <strong>&quot;Redistribute From&quot;</strong> to move leads from one employee to others</li>
          <li>Leave it as <strong>&quot;Unassigned leads&quot;</strong> to assign fresh unassigned leads</li>
          <li>Leads assigned to a <strong>Field Agent</strong> bypass the telecaller pipeline</li>
          <li>Only you (Client Admin) can reassign leads between employees</li>
        </ul>
      </div>
    </div>
  )
}
