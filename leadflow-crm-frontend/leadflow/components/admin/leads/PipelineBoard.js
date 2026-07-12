import { Loader2, Flame } from 'lucide-react'
import clsx from 'clsx'

const PIPELINE_COLUMNS = [
  { status: 'NEW', label: 'New Leads', color: 'border-txt3/30 bg-bg2/50 text-txt2' },
  { status: 'CALLED', label: 'Contacted', color: 'border-blue-500/30 bg-blue-500/5 text-blue-500' },
  { status: 'INTERESTED', label: 'Interested', color: 'border-purple/30 bg-purple/5 text-purple' },
  { status: 'SITE_VISIT', label: 'Site Visit', color: 'border-accent2/30 bg-accent2/5 text-accent2' },
  { status: 'WON', label: 'Won', color: 'border-[#10B981]/30 bg-[#10B981]/5 text-[#10B981]' },
]

export default function PipelineBoard({ pipelineLeads, loading, onStatusDrop, onLeadClick }) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-6 min-h-[600px] snap-x">
      {PIPELINE_COLUMNS.map(col => (
        <div 
          key={col.status} 
          className="flex-shrink-0 w-80 bg-card rounded-2xl border border-border flex flex-col snap-start"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            const leadId = e.dataTransfer.getData('leadId')
            onStatusDrop(leadId, col.status)
          }}
        >
          <div className={clsx("p-4 border-b rounded-t-2xl flex items-center justify-between", col.color)}>
            <h3 className="font-bold uppercase tracking-wider text-xs">{col.label}</h3>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-white/20">
              {pipelineLeads.filter(l => l.status === col.status).length}
            </span>
          </div>
          
          <div className="p-3 flex-1 overflow-y-auto space-y-3">
            {loading ? (
              <div className="py-12 text-center"><Loader2 className="animate-spin mx-auto text-txt3" size={20} /></div>
            ) : (
              pipelineLeads.filter(l => l.status === col.status).map(lead => (
                <div 
                  key={lead.id}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData('leadId', lead.id)}
                  onClick={() => onLeadClick(lead)}
                  className="p-4 bg-bg2 rounded-xl border border-border shadow-sm hover:shadow-md hover:border-accent/30 cursor-grab active:cursor-grabbing transition-all group"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-txt group-hover:text-accent transition-colors">{lead.first_name} {lead.last_name}</span>
                      {lead.is_hot && <Flame size={12} className="text-hot" />}
                    </div>
                    <div className="w-6 h-6 rounded-full bg-accent/10 flex items-center justify-center text-[9px] font-bold text-accent" title={lead.assigned_user_name || 'Unassigned'}>
                      {lead.assigned_user_name ? lead.assigned_user_name[0].toUpperCase() : '?'}
                    </div>
                  </div>
                  <div className="text-[10px] text-txt3 font-mono mb-2">{lead.phone}</div>
                  
                  <div className="flex items-center justify-between text-[10px] mt-3">
                    <span className="text-txt2 px-2 py-1 rounded bg-bg3 border border-border truncate max-w-[120px]">
                      {lead.project_name || 'No project'}
                    </span>
                    {lead.budget && (
                      <span className="font-mono text-txt3">
                        ₹{(Number(lead.budget)/100000).toFixed(1)}L
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
