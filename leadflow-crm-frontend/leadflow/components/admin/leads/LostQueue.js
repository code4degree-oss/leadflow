import { Loader2, AlertTriangle, CheckCircle2, UserPlus, Trash2 } from 'lucide-react'

export default function LostQueue({ lostLeads, loading, onReassign, onPermanentDelete }) {
  return (
    <div className="card overflow-hidden shadow-xl border-danger/20">
      <div className="p-4 border-b border-border bg-danger/5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <AlertTriangle size={16} className="text-danger" />
          <div>
            <h2 className="text-sm font-bold text-txt">Lost Leads Review Queue</h2>
            <p className="text-[10px] text-txt3">Leads marked as Lost by employees.</p>
          </div>
        </div>
      </div>
      {loading ? (
         <div className="py-24 text-center"><Loader2 className="animate-spin mx-auto text-danger mb-2" size={32} /></div>
      ) : lostLeads.length === 0 ? (
        <div className="p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-[#10B981]/10 flex items-center justify-center mx-auto mb-4 border border-[#10B981]/20">
            <CheckCircle2 size={28} className="text-[#10B981]" />
          </div>
          <p className="text-sm font-bold text-txt">Queue is clear!</p>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {lostLeads.map(lead => (
            <div key={lead.id} className="px-5 py-4 flex items-center gap-4 hover:bg-bg2/30 transition-colors">
              <div className="w-10 h-10 rounded-full bg-danger/10 flex items-center justify-center text-danger text-xs font-bold border border-danger/20">
                {lead.first_name?.[0]}{lead.last_name?.[0] || ''}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-bold text-sm text-txt">{lead.first_name} {lead.last_name}</span>
                  <span className="text-[9px] font-bold text-danger bg-danger/10 px-1.5 py-0.5 rounded">{lead.lost_count}× lost</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[11px] font-mono text-txt3">{lead.phone}</span>
                  <span className="text-[10px] text-txt3">{lead.source}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => onReassign(lead)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-accent/10 text-accent text-[10px] font-bold hover:bg-accent/20 border border-accent/20">
                  <UserPlus size={12} /> Reassign
                </button>
                <button onClick={() => onPermanentDelete(lead.id)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-danger/10 text-danger text-[10px] font-bold hover:bg-danger/20 border border-danger/20">
                  <Trash2 size={12} /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
