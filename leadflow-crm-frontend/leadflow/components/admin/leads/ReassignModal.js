import { useState } from 'react'
import { UserPlus, X, Loader2 } from 'lucide-react'

export default function ReassignModal({ lead, employees, loading, onConfirm, onClose }) {
  const [selectedUser, setSelectedUser] = useState('')

  if (!lead) return null

  const handleConfirm = () => {
    if (!selectedUser) return
    onConfirm(lead, selectedUser)
    setSelectedUser('')
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in" onClick={onClose}>
      <div className="bg-card w-full max-w-sm p-6 rounded-3xl border border-border shadow-2xl animate-in zoom-in-95" onClick={e=>e.stopPropagation()}>
        <div className="flex justify-between items-start mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-accent/10 rounded-xl text-accent"><UserPlus size={24} /></div>
            <div>
              <h3 className="font-display font-bold text-xl text-txt">Reassign Lead</h3>
              <p className="text-[10px] text-txt3 font-bold uppercase tracking-wider mt-1">{lead.first_name} {lead.last_name} • <span className="text-danger">Lost {lead.lost_count}×</span></p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-txt3 hover:bg-bg2 rounded-lg transition-colors"><X size={16}/></button>
        </div>
        <div className="space-y-2 mb-8">
          <label className="text-[10px] font-bold uppercase tracking-wider text-txt3 ml-1">Select New Telecaller</label>
          <select className="input w-full bg-bg3 border shadow-inner" value={selectedUser} onChange={e => setSelectedUser(e.target.value)}>
            <option value="">Choose an agent...</option>
            {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name} ({emp.email})</option>)}
          </select>
        </div>
        <div className="flex gap-3">
          <button onClick={handleConfirm} disabled={!selectedUser || loading} className="btn-primary flex-1 justify-center py-3.5 shadow-lg shadow-accent/20 disabled:opacity-50 text-sm font-bold">
            {loading ? <Loader2 size={16} className="animate-spin" /> : 'Confirm Reassignment'}
          </button>
        </div>
      </div>
    </div>
  )
}
