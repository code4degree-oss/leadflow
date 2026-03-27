import { useState, useEffect } from 'react'
import Layout from '../../components/Layout'
import { Upload, FileText, CheckCircle, AlertTriangle, XCircle, Users, RefreshCw, Trash2, ArrowRight } from 'lucide-react'
import clsx from 'clsx'
import { fetchWithAuth } from '../../utils/api'

export default function LeadUpload() {
  const [stage, setStage] = useState('upload')
  const [batchName, setBatchName] = useState('')
  const [distMode, setDistMode] = useState('manual')
  const [manualUser, setManualUser] = useState('')
  const [telecallers, setTelecallers] = useState([])
  const [dragOver, setDragOver] = useState(false)
  const [file, setFile] = useState(null)

  useEffect(() => {
    fetchWithAuth('/accounts/employees/')
      .then(data => {
        const list = (data.results || data || []).filter(e => e.role === 'TELECALLER')
        setTelecallers(list)
      })
      .catch(() => {})
  }, [])

  const [result, setResult] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')

  const handleDrop = (e) => {
    e.preventDefault(); setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f) { setFile(f); }
  }

  const handleProcess = async () => {
    if (!file || !batchName) return
    setStage('processing')
    setErrorMsg('')
    
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('batch_name', batchName) // Optional if backend supports naming later
      
      const data = await fetchWithAuth('/batches/', {
        method: 'POST',
        body: formData,
        // Don't set Content-Type header manually for FormData
      })
      
      // After upload, trigger distribution based on mode
      if (distMode === 'round_robin') {
        try {
          await fetchWithAuth('/leads/assign-round-robin/', { method: 'POST' })
        } catch (e) { /* some leads may already be assigned */ }
      } else if (distMode === 'manual' && manualUser) {
        // Assign all unassigned leads to the selected telecaller
        const leadsData = await fetchWithAuth('/leads/').catch(() => ({}))
        const unassigned = (leadsData.results || leadsData || []).filter(l => !l.assigned_to)
        for (const lead of unassigned) {
          await fetchWithAuth(`/leads/${lead.id}/manual-assign/`, {
            method: 'POST',
            body: JSON.stringify({ user_id: manualUser })
          }).catch(() => {})
        }
      }
      
      setResult(data)
      setStage('result')
    } catch (err) {
      setErrorMsg(err.message)
      setStage('upload')
    }
  }

  return (
    <Layout role="admin" pageTitle="Lead Upload">
      <div className="max-w-3xl mx-auto">

        {/* Steps */}
        <div className="flex items-center gap-0 mb-8">
          {[['upload','1','Upload File'],['result','2','Review & Distribute']].map(([s, num, label], i) => (
            <div key={s} className="flex items-center">
              <div className="flex items-center gap-2">
                <div className={clsx(
                  'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all',
                  stage===s ? 'bg-accent text-white' : stage==='result' && s==='upload' ? 'bg-accent2 text-bg' : 'bg-border2 text-txt3'
                )}>
                  {stage==='result' && s==='upload' ? <CheckCircle size={14}/> : num}
                </div>
                <span className={clsx('text-sm font-medium', stage===s ? 'text-txt' : 'text-txt3')}>{label}</span>
              </div>
              {i < 1 && <div className="w-16 h-px bg-border2 mx-3" />}
            </div>
          ))}
        </div>

        {stage === 'upload' && (
          <div className="space-y-4">
            {/* Batch name */}
            <div className="card p-5">
              <label className="label mb-2 block">Batch Source Name *</label>
              <input
                value={batchName}
                onChange={e => setBatchName(e.target.value)}
                placeholder="e.g. March Newspaper Ad, Facebook Campaign Feb"
                className="input"
              />
              <p className="text-xs text-txt3 mt-2">This name will be attached to all leads from this upload for tracking</p>
            </div>

            {/* Drop zone */}
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => document.getElementById('file-input').click()}
              className={clsx(
                'card p-10 border-2 border-dashed cursor-pointer transition-all flex flex-col items-center gap-3 text-center',
                dragOver ? 'border-accent bg-accent/5' : file ? 'border-accent2/50 bg-accent2/5' : 'border-border2 hover:border-border'
              )}
            >
              <input id="file-input" type="file" accept=".csv,.xlsx,.xls" className="hidden"
                onChange={e => setFile(e.target.files[0])} />
              {file ? (
                <>
                  <FileText size={32} className="text-accent2" />
                  <div className="text-sm font-medium text-accent2">{file.name}</div>
                  <div className="text-xs text-txt3">{(file.size/1024).toFixed(1)} KB · Click to change</div>
                </>
              ) : (
                <>
                  <Upload size={32} className="text-txt3" />
                  <div className="text-sm font-medium text-txt">Drop CSV or Excel file here</div>
                  <div className="text-xs text-txt3">or click to browse · .csv, .xlsx, .xls supported</div>
                  <div className="badge badge-gray mt-2">Max 50MB</div>
                </>
              )}
            </div>

            {/* Distribution mode */}
            <div className="card p-5">
              <label className="label mb-3 block">Distribution Mode</label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { id:'manual',         label:'Manual',           desc:'You assign each lead individually' },
                  { id:'round_robin',    label:'Round-Robin',      desc:'Distributed evenly in order' },
                  { id:'load_balanced',  label:'Load Balanced',    desc:'Assigned to least-loaded agent' },
                ].map(m => (
                  <div
                    key={m.id}
                    onClick={() => setDistMode(m.id)}
                    className={clsx(
                      'p-3 rounded-lg border cursor-pointer transition-all',
                      distMode===m.id ? 'border-accent bg-accent/8' : 'border-border2 hover:border-border bg-bg3'
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div className={clsx('w-3 h-3 rounded-full border-2 transition-all',
                        distMode===m.id ? 'border-accent bg-accent' : 'border-border2')} />
                      <span className="text-sm font-medium text-txt">{m.label}</span>
                    </div>
                    <p className="text-xs text-txt3 pl-5">{m.desc}</p>
                  </div>
                ))}
              </div>

              {/* Telecaller picker for manual mode */}
              {distMode === 'manual' && (
                <div className="mt-3">
                  <label className="text-[10px] font-bold uppercase tracking-tighter text-txt3 ml-1 mb-1 block">Assign all leads to:</label>
                  <select 
                    className="input w-full bg-bg3 text-sm"
                    value={manualUser}
                    onChange={e => setManualUser(e.target.value)}
                  >
                    <option value="">Select a telecaller…</option>
                    {telecallers.map(tc => (
                      <option key={tc.id} value={tc.id}>{tc.first_name} {tc.last_name} ({tc.email})</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <button
              onClick={handleProcess}
              disabled={!file || !batchName}
              className={clsx('btn-primary w-full justify-center py-3', (!file || !batchName) && 'opacity-40 cursor-not-allowed')}
            >
              Process & Upload <ArrowRight size={15}/>
            </button>
          </div>
        )}

        {stage === 'upload' && errorMsg && (
          <div className="bg-danger/10 text-danger p-4 rounded-lg mt-4 text-sm font-medium border border-danger/20 flex gap-2">
            <AlertTriangle size={18}/> {errorMsg}
          </div>
        )}

        {stage === 'processing' && (
          <div className="card p-16 flex flex-col items-center justify-center gap-4">
            <div className="w-12 h-12 rounded-full border-2 border-accent border-t-transparent animate-spin" />
            <div className="text-sm font-medium text-txt">Processing leads…</div>
            <div className="text-xs text-txt3">Uploading file · Normalizing phones · Checking deduplication</div>
          </div>
        )}

        {stage === 'result' && result && (
          <div className="space-y-4">
            {/* Summary cards */}
            <div className="grid grid-cols-4 gap-3">
              {[
                { label:'Total Rows',  value:result.total_rows,      color:'text-txt',    bg:'bg-card'        },
                { label:'Successfully Imported', value:result.imported_count,      color:'text-accent2',bg:'bg-accent2/8'   },
                { label:'Failed Rows',     value:result.failed_count,    color:'text-danger', bg:'bg-danger/8'    },
              ].map(s => (
                <div key={s.label} className={clsx('rounded-xl p-4 border border-border text-center', s.bg)}>
                  <div className={clsx('font-display font-bold text-2xl', s.color)}>{s.value}</div>
                  <div className="text-xs text-txt2 mt-1">{s.label}</div>
                </div>
              ))}
            </div>

            {/* Error review */}
            {result.failed_count > 0 && (
            <div className="card overflow-hidden">
              <div className="p-4 border-b border-border flex items-center gap-2">
                <AlertTriangle size={14} className="text-amber" />
                <span className="text-sm font-semibold text-amber">Row Errors</span>
                <span className="badge badge-amber ml-1">{result.failed_count}</span>
              </div>
              <div className="divide-y divide-border max-h-64 overflow-y-auto">
                {Object.entries(result.error_log || {}).map(([rowKey, errors], i) => (
                  <div key={i} className="px-4 py-3 flex items-start gap-4">
                    <div className="w-16 flex-shrink-0 text-xs text-txt3 font-mono">{rowKey.replace('_', ' ')}</div>
                    <div className="flex-1">
                      {errors.map((e, idx) => (
                         <div key={idx} className="text-sm font-medium text-danger">{e}</div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            )}


            {/* Confirm distribute */}
            <div className="card p-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-txt">Review Completed</div>
                  <div className="text-xs text-txt2 mt-0.5">Uploaded {result.imported_count} leads to the system. You can now distribute them from the Leads page.</div>
                </div>
                <button className="btn-primary" onClick={() => window.location.href = '/admin/leads'}>
                  <Users size={14}/> View Leads
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
