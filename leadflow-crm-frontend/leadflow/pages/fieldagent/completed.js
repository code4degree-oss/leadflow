import { useState, useEffect } from 'react'
import Layout from '../../components/Layout'
import { StatusBadge } from '../../components/UI'
import { MapPin, CheckCircle, RefreshCw, Phone, Building2, User, Trophy, XCircle } from 'lucide-react'
import clsx from 'clsx'
import { fetchWithAuth } from '../../utils/api'

export default function FieldAgentCompletedVisits() {
  const [completedVisits, setCompletedVisits] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchCompletedVisits()
  }, [])

  const fetchCompletedVisits = async () => {
    setLoading(true)
    try {
      const data = await fetchWithAuth('/visits/?status=COMPLETED')
      setCompletedVisits(data.results || data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const getOutcomeStyle = (outcome) => {
    const o = (outcome || '').toUpperCase()
    if (o === 'WON') return 'bg-success/10 text-success border-success/20'
    if (o === 'INTERESTED') return 'bg-primary/10 text-primary border-primary/20'
    if (o === 'LOST' || o === 'NOT_INTERESTED') return 'bg-danger/10 text-danger border-danger/20'
    return 'bg-bg3 text-txt3 border-border'
  }

  const getOutcomeIcon = (outcome) => {
    const o = (outcome || '').toUpperCase()
    if (o === 'WON') return Trophy
    if (o === 'NOT_INTERESTED' || o === 'LOST') return XCircle
    return CheckCircle
  }

  return (
    <Layout role="fieldagent" pageTitle="Completed Visits">

      <div className="card overflow-hidden shadow-lg border-border/50 max-w-5xl mx-auto">
        <div className="px-5 py-4 border-b border-border bg-bg2/30 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-success/10 rounded-xl text-success">
              <CheckCircle size={18} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-txt">Completed Visits</h2>
              <p className="text-[10px] text-txt3 font-mono">You have completed {completedVisits.length} visits</p>
            </div>
          </div>
          <button onClick={fetchCompletedVisits} className="p-2 bg-card hover:bg-bg2 border border-border rounded-lg text-txt2 hover:text-primary transition-all shadow-sm">
            <RefreshCw size={14} className={clsx(loading && "animate-spin")} />
          </button>
        </div>

        <div className="divide-y divide-border">
          {loading ? (
             <div className="py-20 text-center flex flex-col items-center">
               <RefreshCw className="animate-spin text-accent mb-3" size={24} />
               <p className="text-xs text-txt3 font-mono">Loading completed visits...</p>
             </div>
          ) : completedVisits.length === 0 ? (
            <div className="py-24 text-center flex flex-col items-center">
              <div className="w-16 h-16 rounded-3xl bg-bg3 flex items-center justify-center mb-4 text-txt3 shadow-inner">
                <CheckCircle size={32} className="opacity-20" />
              </div>
              <div className="text-txt font-bold text-sm mb-1">No Completed Visits</div>
              <div className="text-txt3 text-xs max-w-[200px] leading-relaxed">
                Site visits you complete from the dashboard will appear here.
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-0">
              {completedVisits.map(visit => {
                const Icon = getOutcomeIcon(visit.outcome)
                return (
                  <div key={visit.id} className="p-5 border-b border-r border-border hover:bg-bg2/30 transition-colors">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="text-sm font-bold text-txt mb-1">{visit.lead_name}</div>
                        <span className={clsx(
                          'text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border',
                          getOutcomeStyle(visit.outcome)
                        )}>
                          {visit.outcome || 'N/A'}
                        </span>
                      </div>
                      <div className={clsx('w-8 h-8 rounded-full flex items-center justify-center border', getOutcomeStyle(visit.outcome))}>
                        <Icon size={14} />
                      </div>
                    </div>
                    
                    <div className="space-y-1.5 mb-4">
                      <div className="flex items-center gap-2 text-[10px] text-txt3 font-mono">
                        <Phone size={11} className="opacity-50" /> {visit.lead_phone}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-txt3 font-mono">
                        <MapPin size={11} className="opacity-50" /> {visit.project_name || 'N/A'}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-txt3 font-mono">
                        <User size={11} className="opacity-50" /> TC: {visit.telecaller_name || 'N/A'}
                      </div>
                    </div>

                    {visit.notes && (
                      <div className="text-[10px] text-txt2 bg-bg3/50 p-2.5 rounded-xl border border-border/50 leading-relaxed mb-3">
                        {visit.notes}
                      </div>
                    )}
                    
                    <div className="text-[9px] text-txt4 uppercase tracking-widest font-bold mt-auto pt-3 border-t border-border/30">
                      Completed: {new Date(visit.completed_at).toLocaleString()}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}
