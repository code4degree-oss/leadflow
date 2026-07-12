import { RefreshCw, Loader2, Trash2, FileSpreadsheet, Layers, Flame, CheckCircle2, AlertTriangle, Trophy } from 'lucide-react'
import clsx from 'clsx'

export default function BatchTracking({ batchStats, loading, deletingBatch, onRefresh, onDeleteBatch, onFilterByBatch }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold font-display text-txt">Batch Progress Tracking</h2>
        <button onClick={onRefresh} className="btn-ghost text-xs"><RefreshCw size={14} className={clsx("mr-2", loading && "animate-spin")} />Refresh Stats</button>
      </div>
      
      {loading ? (
         <div className="py-24 text-center card"><Loader2 className="animate-spin mx-auto text-purple mb-2" size={32} /><p className="text-xs text-txt3">Loading Batch Stats...</p></div>
      ) : batchStats.length === 0 ? (
        <div className="py-24 text-center card"><Layers className="mx-auto text-txt3 opacity-40 mb-3" size={40} /><p className="text-sm font-bold text-txt">No batches uploaded yet.</p></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {batchStats.map((batch, idx) => (
            <div key={idx} onClick={() => onFilterByBatch(batch.batch_id || batch.source)} className="card p-5 border-t-4 border-t-purple shadow-md hover:shadow-lg hover:border-border2 transition-all cursor-pointer relative group">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <FileSpreadsheet size={20} className="text-purple" />
                  <div>
                    <h3 className="font-bold text-txt truncate max-w-[150px] md:max-w-[180px]" title={batch.source}>{batch.source}</h3>
                    <div className="text-[10px] text-txt3">{batch.created_at ? new Date(batch.created_at).toLocaleDateString() : 'Unknown date'}</div>
                  </div>
                </div>
                <button 
                  onClick={(e) => { e.stopPropagation(); onDeleteBatch(batch.source); }}
                  disabled={deletingBatch === batch.source}
                  className="p-1.5 text-danger opacity-0 group-hover:opacity-100 hover:bg-danger/10 rounded-lg transition-all"
                  title="Delete Batch"
                >
                  {deletingBatch === batch.source ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                </button>
              </div>
              
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-bg2/50 p-2 rounded border border-border">
                  <div className="text-[9px] uppercase tracking-wider text-txt3 mb-0.5">Total Leads</div>
                  <div className="font-bold text-txt">{batch.total}</div>
                </div>
                <div className="bg-hot/5 p-2 rounded border border-hot/20 flex items-center justify-between">
                  <div>
                    <div className="text-[9px] uppercase tracking-wider text-hot mb-0.5">Hot Leads</div>
                    <div className="font-bold text-hot">{batch.hot_leads || 0}</div>
                  </div>
                  <Flame size={14} className="text-hot opacity-50"/>
                </div>
                <div className="bg-purple/5 p-2 rounded border border-purple/20 flex items-center justify-between">
                  <div>
                    <div className="text-[9px] uppercase tracking-wider text-purple mb-0.5">Interested</div>
                    <div className="font-bold text-purple">{batch.interested_leads || 0}</div>
                  </div>
                  <CheckCircle2 size={14} className="text-purple opacity-50"/>
                </div>
                <div className="bg-[#10B981]/5 p-2 rounded border border-[#10B981]/20 flex items-center justify-between">
                  <div>
                    <div className="text-[9px] uppercase tracking-wider text-[#10B981] mb-0.5">Converted</div>
                    <div className="font-bold text-[#10B981]">{batch.won}</div>
                  </div>
                  <Trophy size={14} className="text-[#10B981] opacity-50"/>
                </div>
                <div className="bg-danger/5 p-2 rounded border border-danger/20 flex items-center justify-between col-span-2">
                  <div>
                    <div className="text-[9px] uppercase tracking-wider text-danger mb-0.5">Wrong / Lost Leads</div>
                    <div className="font-bold text-danger">{batch.wrong_leads || 0}</div>
                  </div>
                  <AlertTriangle size={14} className="text-danger opacity-50"/>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
