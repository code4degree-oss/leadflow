import { useState, useEffect } from 'react'
import Layout from '../../components/Layout'
import { MessageSquare, Upload, CheckCircle, AlertTriangle, Users, ArrowRight, Trash2, Edit3, Phone, MapPin, Wallet, User, X, Copy, Sparkles, FileText, RefreshCw } from 'lucide-react'
import clsx from 'clsx'
import { fetchWithAuth } from '../../utils/api'
import Link from 'next/link'

const SAMPLE_TEXT = `>> Forwarded

Clint name - Ram patil
*No-8459122869
Bhk - 3 bhk
Location-,Ravet
Budject - 85 lakhs
SLG through project
Other Cp thru -
Suggested-star vista project details send ready to move

>> Forwarded

Clint name - Priya Sharma
*No-9876543210
Bhk - 2 bhk
Location - Hinjewadi
Budget - 65 lakhs
Facebook
Suggested - Sunrise Heights 2BHK ready possession`

export default function WhatsAppExtract() {
  const [rawText, setRawText] = useState('')
  const [stage, setStage] = useState('paste') // paste → preview → result
  const [previews, setPreviews] = useState([])
  const [extractMeta, setExtractMeta] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Import options
  const [projects, setProjects] = useState([])
  const [telecallers, setTelecallers] = useState([])
  const [selectedProject, setSelectedProject] = useState('')
  const [selectedAssignee, setSelectedAssignee] = useState('')
  const [skipDuplicates, setSkipDuplicates] = useState(true)
  const [importResult, setImportResult] = useState(null)

  useEffect(() => {
    // Load projects and telecallers for dropdowns
    fetchWithAuth('/projects/')
      .then(data => {
        const list = data.results || data || []
        setProjects(list.filter(p => p.is_active !== false))
      })
      .catch(() => {})

    fetchWithAuth('/accounts/employees/')
      .then(data => {
        const list = (data.results || data || []).filter(e => e.role === 'TELECALLER')
        setTelecallers(list)
      })
      .catch(() => {})
  }, [])

  // ── Step 1: Extract ──
  const handleExtract = async () => {
    if (!rawText.trim()) return
    setLoading(true)
    setError('')

    try {
      const data = await fetchWithAuth('/leads/extract-whatsapp/', {
        method: 'POST',
        body: JSON.stringify({ raw_text: rawText })
      })
      setPreviews(data.leads || [])
      setExtractMeta(data)
      setStage('preview')
    } catch (err) {
      setError(err.message || 'Failed to extract leads')
    } finally {
      setLoading(false)
    }
  }

  // ── Step 2: Import ──
  const handleImport = async () => {
    const validLeads = previews.filter(p => p.is_valid && !(skipDuplicates && p.is_duplicate))
    if (!validLeads.length) return
    setLoading(true)
    setError('')

    try {
      const data = await fetchWithAuth('/leads/import-whatsapp/', {
        method: 'POST',
        body: JSON.stringify({
          leads: validLeads,
          project_id: selectedProject || undefined,
          assign_to: selectedAssignee || undefined,
          skip_duplicates: skipDuplicates,
        })
      })
      setImportResult(data)
      setStage('result')
    } catch (err) {
      setError(err.message || 'Failed to import leads')
    } finally {
      setLoading(false)
    }
  }

  // ── Edit lead in preview ──
  const updatePreview = (index, field, value) => {
    setPreviews(prev => prev.map(p =>
      p.index === index ? { ...p, [field]: value } : p
    ))
  }

  const removePreview = (index) => {
    setPreviews(prev => prev.filter(p => p.index !== index))
  }

  const validCount = previews.filter(p => p.is_valid && !(skipDuplicates && p.is_duplicate)).length
  const dupCount = previews.filter(p => p.is_duplicate).length

  return (
    <Layout role="admin" pageTitle="WhatsApp Lead Import"
      actions={
        <Link href="/admin/upload" className="btn-secondary text-xs">
          <Upload size={13}/> CSV Upload
        </Link>
      }
    >
      <div className="max-w-4xl mx-auto">

        {/* Progress Steps */}
        <div className="flex items-center gap-0 mb-8">
          {[
            ['paste', '1', 'Paste Messages'],
            ['preview', '2', 'Review & Edit'],
            ['result', '3', 'Import Complete']
          ].map(([s, num, label], i) => (
            <div key={s} className="flex items-center">
              <div className="flex items-center gap-2">
                <div className={clsx(
                  'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all',
                  stage === s ? 'bg-accent text-white shadow-lg shadow-accent/30' :
                  (stage === 'preview' && s === 'paste') || (stage === 'result') ? 'bg-accent2 text-bg' :
                  'bg-border2 text-txt3'
                )}>
                  {((stage === 'preview' && s === 'paste') || (stage === 'result' && s !== 'result'))
                    ? <CheckCircle size={14}/> : num}
                </div>
                <span className={clsx('text-sm font-medium', stage === s ? 'text-txt' : 'text-txt3')}>{label}</span>
              </div>
              {i < 2 && <div className="w-12 h-px bg-border2 mx-3" />}
            </div>
          ))}
        </div>

        {/* ═══ STAGE 1: PASTE ═══ */}
        {stage === 'paste' && (
          <div className="space-y-4">
            {/* Info Card */}
            <div className="card p-5 border-accent/20 bg-accent/5">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0">
                  <MessageSquare size={20} className="text-accent" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-txt">Paste WhatsApp Forwarded Messages</h3>
                  <p className="text-xs text-txt2 mt-1 leading-relaxed">
                    Copy-paste one or more forwarded lead messages below. The system will automatically extract 
                    name, phone, BHK preference, location, budget, and source from each message.
                  </p>
                </div>
              </div>
            </div>

            {/* Textarea */}
            <div className="card overflow-hidden">
              <div className="p-4 border-b border-border flex items-center justify-between">
                <label className="label">Raw WhatsApp Text</label>
                <button
                  onClick={() => setRawText(SAMPLE_TEXT)}
                  className="text-xs text-accent hover:text-accent/80 font-medium flex items-center gap-1 transition-colors"
                >
                  <Copy size={12}/> Paste Sample
                </button>
              </div>
              <textarea
                value={rawText}
                onChange={e => setRawText(e.target.value)}
                placeholder={`>> Forwarded\n\nClint name - Ram Patil\n*No-8459122869\nBhk - 3 bhk\nLocation-, Ravet\nBudject - 85 lakhs\n...\n\nPaste one or more messages here...`}
                className="w-full p-4 bg-bg3 text-sm text-txt font-mono leading-relaxed resize-none focus:outline-none min-h-[280px] placeholder:text-txt3/50"
                rows={14}
              />
              <div className="p-3 bg-bg3 border-t border-border flex items-center justify-between">
                <span className="text-xs text-txt3">
                  {rawText.trim() ? `${rawText.split('\n').length} lines` : 'No text pasted yet'}
                </span>
                {rawText.trim() && (
                  <button onClick={() => setRawText('')} className="text-xs text-txt3 hover:text-danger flex items-center gap-1">
                    <X size={12}/> Clear
                  </button>
                )}
              </div>
            </div>

            {error && (
              <div className="bg-danger/10 text-danger p-4 rounded-xl text-sm font-medium border border-danger/20 flex gap-2 items-start">
                <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" /> {error}
              </div>
            )}

            <button
              onClick={handleExtract}
              disabled={!rawText.trim() || loading}
              className={clsx(
                'btn-primary w-full justify-center py-3 shadow-lg shadow-accent/20',
                (!rawText.trim() || loading) && 'opacity-40 cursor-not-allowed'
              )}
            >
              {loading ? (
                <><RefreshCw size={15} className="animate-spin"/> Extracting...</>
              ) : (
                <><Sparkles size={15}/> Extract Leads</>
              )}
            </button>
          </div>
        )}

        {/* ═══ STAGE 2: PREVIEW ═══ */}
        {stage === 'preview' && (
          <div className="space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-3 gap-3">
              <div className="card p-4 text-center">
                <div className="font-display font-bold text-2xl text-txt">{extractMeta?.total_extracted || 0}</div>
                <div className="text-xs text-txt2 mt-1">Total Found</div>
              </div>
              <div className="card p-4 text-center bg-accent2/5 border-accent2/20">
                <div className="font-display font-bold text-2xl text-accent2">{validCount}</div>
                <div className="text-xs text-txt2 mt-1">Ready to Import</div>
              </div>
              <div className={clsx('card p-4 text-center', dupCount > 0 ? 'bg-amber/5 border-amber/20' : '')}>
                <div className={clsx('font-display font-bold text-2xl', dupCount > 0 ? 'text-amber' : 'text-txt3')}>{dupCount}</div>
                <div className="text-xs text-txt2 mt-1">Duplicates</div>
              </div>
            </div>

            {/* Lead Cards */}
            <div className="space-y-3">
              {previews.map((lead, idx) => (
                <div key={lead.index} className={clsx(
                  'card overflow-hidden transition-all',
                  lead.is_duplicate && skipDuplicates && 'opacity-50',
                  !lead.is_valid && 'border-danger/30'
                )}>
                  {/* Card Header */}
                  <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-bg3/50">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-txt3">#{idx + 1}</span>
                      <span className="font-medium text-sm text-txt">
                        {lead.first_name} {lead.last_name}
                      </span>
                      {lead.is_duplicate && (
                        <span className="badge badge-amber text-[10px]">Duplicate</span>
                      )}
                      {!lead.is_valid && (
                        <span className="badge badge-red text-[10px]">Invalid</span>
                      )}
                    </div>
                    <button onClick={() => removePreview(lead.index)} className="text-txt3 hover:text-danger transition-colors p-1">
                      <Trash2 size={14}/>
                    </button>
                  </div>

                  {/* Card Body — Editable Fields */}
                  <div className="p-4 grid grid-cols-2 md:grid-cols-3 gap-3">
                    <EditField icon={User} label="First Name" value={lead.first_name}
                      onChange={v => updatePreview(lead.index, 'first_name', v)} />
                    <EditField icon={User} label="Last Name" value={lead.last_name}
                      onChange={v => updatePreview(lead.index, 'last_name', v)} />
                    <EditField icon={Phone} label="Phone" value={lead.phone}
                      onChange={v => updatePreview(lead.index, 'phone', v)} required />
                    <EditField icon={MapPin} label="Location" value={lead.location}
                      onChange={v => updatePreview(lead.index, 'location', v)} />
                    <EditField icon={Wallet} label="Budget" value={lead.budget}
                      onChange={v => updatePreview(lead.index, 'budget', v)} />
                    <EditField label="BHK" value={lead.bhk_preference}
                      onChange={v => updatePreview(lead.index, 'bhk_preference', v)} />
                  </div>

                  {/* Notes row */}
                  {lead.notes && (
                    <div className="px-4 pb-3">
                      <div className="text-[10px] font-bold uppercase text-txt3 mb-1">Notes</div>
                      <div className="text-xs text-txt2 bg-bg3 rounded-lg p-2">{lead.notes}</div>
                    </div>
                  )}

                  {/* Matched project */}
                  {lead.matched_project && (
                    <div className="px-4 pb-3">
                      <span className="badge badge-green text-[10px]">
                        <CheckCircle size={10}/> Auto-matched: {lead.matched_project.name}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Import Options */}
            <div className="card p-5 space-y-4">
              <h3 className="font-semibold text-sm text-txt">Import Options</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-tighter text-txt3 ml-1 mb-1.5 block">Assign to Project</label>
                  <select className="input w-full bg-bg3 text-sm" value={selectedProject} onChange={e => setSelectedProject(e.target.value)}>
                    <option value="">No project (assign later)</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-tighter text-txt3 ml-1 mb-1.5 block">Assign to Telecaller</label>
                  <select className="input w-full bg-bg3 text-sm" value={selectedAssignee} onChange={e => setSelectedAssignee(e.target.value)}>
                    <option value="">Unassigned (distribute later)</option>
                    {telecallers.map(tc => (
                      <option key={tc.id} value={tc.id}>{tc.first_name} {tc.last_name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={skipDuplicates} onChange={e => setSkipDuplicates(e.target.checked)}
                  className="w-4 h-4 rounded border-border2 text-accent focus:ring-accent" />
                <span className="text-sm text-txt2">Skip duplicate phone numbers</span>
              </label>
            </div>

            {error && (
              <div className="bg-danger/10 text-danger p-4 rounded-xl text-sm font-medium border border-danger/20 flex gap-2 items-start">
                <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" /> {error}
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setStage('paste')} className="btn-secondary flex-1 justify-center py-3">
                ← Back to Paste
              </button>
              <button
                onClick={handleImport}
                disabled={validCount === 0 || loading}
                className={clsx(
                  'btn-primary flex-1 justify-center py-3 shadow-lg shadow-accent/20',
                  (validCount === 0 || loading) && 'opacity-40 cursor-not-allowed'
                )}
              >
                {loading ? (
                  <><RefreshCw size={15} className="animate-spin"/> Importing...</>
                ) : (
                  <><Upload size={15}/> Import {validCount} Leads</>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ═══ STAGE 3: RESULT ═══ */}
        {stage === 'result' && importResult && (
          <div className="space-y-4">
            {/* Success card */}
            <div className="card p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-accent2/10 flex items-center justify-center mx-auto mb-4">
                <CheckCircle size={32} className="text-accent2" />
              </div>
              <h2 className="font-display font-bold text-xl text-txt">Import Complete!</h2>
              <p className="text-sm text-txt2 mt-2">
                Successfully imported {importResult.imported_count} leads from WhatsApp messages.
              </p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="card p-4 text-center bg-accent2/5 border-accent2/20">
                <div className="font-display font-bold text-2xl text-accent2">{importResult.imported_count}</div>
                <div className="text-xs text-txt2 mt-1">Imported</div>
              </div>
              <div className="card p-4 text-center">
                <div className="font-display font-bold text-2xl text-amber">{importResult.skipped_duplicates}</div>
                <div className="text-xs text-txt2 mt-1">Skipped (Duplicates)</div>
              </div>
              <div className="card p-4 text-center">
                <div className="font-display font-bold text-2xl text-danger">{importResult.errors?.length || 0}</div>
                <div className="text-xs text-txt2 mt-1">Errors</div>
              </div>
            </div>

            {/* Error details */}
            {importResult.errors?.length > 0 && (
              <div className="card overflow-hidden">
                <div className="p-4 border-b border-border flex items-center gap-2">
                  <AlertTriangle size={14} className="text-amber" />
                  <span className="text-sm font-semibold text-amber">Import Errors</span>
                </div>
                <div className="divide-y divide-border max-h-48 overflow-y-auto">
                  {importResult.errors.map((err, i) => (
                    <div key={i} className="px-4 py-2 text-sm text-danger">
                      Row {err.index + 1}: {err.error}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <button onClick={() => { setStage('paste'); setRawText(''); setPreviews([]); setImportResult(null) }}
                className="btn-secondary flex-1 justify-center py-3">
                <MessageSquare size={14}/> Import More
              </button>
              <button onClick={() => window.location.href = '/admin/leads'}
                className="btn-primary flex-1 justify-center py-3">
                <Users size={14}/> View Leads
              </button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}

// ── Inline Editable Field Component ──
function EditField({ icon: Icon, label, value, onChange, required }) {
  return (
    <div>
      <div className="flex items-center gap-1 mb-1">
        {Icon && <Icon size={10} className="text-txt3" />}
        <span className="text-[10px] font-bold uppercase tracking-tighter text-txt3">{label}</span>
        {required && !value && <span className="text-danger text-[10px]">*</span>}
      </div>
      <input
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        className={clsx(
          'input text-sm w-full bg-bg3',
          required && !value && 'border-danger/40'
        )}
        placeholder={`Enter ${label.toLowerCase()}`}
      />
    </div>
  )
}
