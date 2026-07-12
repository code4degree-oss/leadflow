import { Loader2, Trophy } from 'lucide-react'

export default function WonLeads({ wonLeads, loading }) {
  return (
    <div className="card overflow-hidden shadow-xl border-[#10B981]/20">
      <div className="p-4 border-b border-border bg-[#10B981]/5 flex items-center gap-3">
        <Trophy size={18} className="text-[#10B981]" />
        <div>
          <h2 className="text-sm font-bold text-txt">Won Leads</h2>
          <p className="text-[10px] text-txt3">Successfully converted leads with credit attribution</p>
        </div>
        <span className="ml-auto text-lg font-display font-extrabold text-[#10B981]">{wonLeads.length}</span>
      </div>
      {loading ? (
        <div className="py-24 text-center"><Loader2 className="animate-spin mx-auto text-[#10B981] mb-2" size={32} /></div>
      ) : wonLeads.length === 0 ? (
        <div className="p-16 text-center">
          <Trophy size={40} className="mx-auto text-txt3 opacity-30 mb-3" />
          <p className="text-sm font-bold text-txt">No won leads yet</p>
          <p className="text-xs text-txt3 mt-1">Leads marked as WON will appear here with full credit attribution.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-bg2/50 border-b border-border">
                <th className="th">Lead</th>
                <th className="th">Project</th>
                <th className="th">Budget</th>
                <th className="th">Telecaller</th>
                <th className="th">Field Agent</th>
                <th className="th">Won Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {wonLeads.map(lead => (
                <tr key={lead.id} className="hover:bg-[#10B981]/5 transition-colors">
                  <td className="td">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-[#10B981]/10 flex items-center justify-center text-[#10B981] text-xs font-bold border border-[#10B981]/20">
                        🎉
                      </div>
                      <div>
                        <div className="text-sm font-bold text-txt">{lead.first_name} {lead.last_name}</div>
                        <div className="text-[10px] text-txt3 font-mono">{lead.phone}</div>
                      </div>
                    </div>
                  </td>
                  <td className="td text-xs text-txt2">{lead.project_name || '—'}</td>
                  <td className="td text-xs font-mono text-txt2">{lead.budget ? `₹${Number(lead.budget).toLocaleString('en-IN')}` : '—'}</td>
                  <td className="td">
                    {lead.telecaller_name ? (
                      <span className="text-xs font-bold text-accent bg-accent/10 px-2 py-1 rounded-lg">
                        📞 {lead.telecaller_name}
                      </span>
                    ) : <span className="text-xs text-txt3">—</span>}
                  </td>
                  <td className="td">
                    {lead.field_agent_name ? (
                      <span className="text-xs font-bold text-amber bg-amber/10 px-2 py-1 rounded-lg">
                        🏃 {lead.field_agent_name}
                      </span>
                    ) : <span className="text-xs text-txt3">—</span>}
                  </td>
                  <td className="td text-xs font-mono text-txt3">
                    {lead.won_date ? new Date(lead.won_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
