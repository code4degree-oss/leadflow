import { useState, useEffect } from 'react'
import Layout from '../../components/Layout'
import { Trash2, Download, Loader2, FileSpreadsheet, AlertTriangle, Users, Layers, Trophy } from 'lucide-react'
import clsx from 'clsx'
import { fetchWithAuth } from '../../utils/api'

import { LeadsTable, PipelineBoard, BatchTracking, LostQueue, WonLeads, BulkAssign, LeadDetailDrawer, ReassignModal } from '../../components/admin/leads'

export default function AdminLeads() {
  // ─── Core Data ───
  const [leads, setLeads] = useState([])
  const [lostLeads, setLostLeads] = useState([])
  const [batchStats, setBatchStats] = useState([])
  const [employees, setEmployees] = useState([])
  const [pipelineLeads, setPipelineLeads] = useState([])
  const [wonLeads, setWonLeads] = useState([])

  // ─── Loading / Error ───
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState(null)
  const [loadingPipeline, setLoadingPipeline] = useState(false)
  const [assigning, setAssigning] = useState(false)
  const [deletingBatch, setDeletingBatch] = useState(null)

  // ─── Tab & Filters ───
  const [activeTab, setActiveTab] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [isHotFilter, setIsHotFilter] = useState(false)
  const [search, setSearch] = useState('')
  const [batchFilter, setBatchFilter] = useState('all')
  const [sourceOptions, setSourceOptions] = useState([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [totalLeads, setTotalLeads] = useState(0)

  // ─── Detail Drawer ───
  const [detailLead, setDetailLead] = useState(null)
  const [timeline, setTimeline] = useState([])
  const [followUps, setFollowUps] = useState([])
  const [loadingDetail, setLoadingDetail] = useState(false)

  // ─── Reassign Modal ───
  const [reassignLead, setReassignLead] = useState(null)

  // ─── Effects ───
  useEffect(() => { 
    fetchEmployees() 
    fetchBatchProgress()
  }, [])

  useEffect(() => {
    if (activeTab === 'all') fetchLeads()
    if (activeTab === 'pipeline') fetchPipelineLeads()
    if (activeTab === 'batches') fetchBatchProgress()
    if (activeTab === 'lost') fetchLostQueue()
    if (activeTab === 'won') fetchWonLeads()
  }, [activeTab, page, pageSize, statusFilter, batchFilter, isHotFilter])

  useEffect(() => { setPage(1) }, [search, statusFilter, batchFilter, isHotFilter])

  useEffect(() => {
    if (activeTab === 'all') {
      const delay = setTimeout(fetchLeads, 500)
      return () => clearTimeout(delay)
    }
  }, [search])

  // ─── Data Fetchers ───
  const fetchLeads = async () => {
    try {
      setLoading(true)
      let url = `/leads/?page=${page}&page_size=${pageSize}`
      if (search) url += `&search=${search}`
      if (statusFilter !== 'all') url += `&status=${statusFilter.toUpperCase()}`
      if (batchFilter !== 'all') {
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(batchFilter);
        if (isUUID) url += `&batch_id=${batchFilter}`;
        else url += `&source=${encodeURIComponent(batchFilter)}`;
      }
      if (isHotFilter) url += `&is_hot=true`
      const data = await fetchWithAuth(url)
      setLeads(data.results || [])
      setTotalLeads(data.count || 0)
      setError(null)
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  const fetchBatchProgress = async () => {
    try {
      setLoading(true)
      const data = await fetchWithAuth('/leads/batch-progress/')
      setBatchStats(data || [])
      setSourceOptions([{ id: 'all', name: 'All Sources' }, ...(data || []).map(b => ({ id: b.batch_id || b.source, name: b.source }))])
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  const fetchPipelineLeads = async () => {
    try {
      setLoadingPipeline(true)
      const data = await fetchWithAuth('/leads/?page_size=200&ordering=-updated_at')
      setPipelineLeads(data.results || [])
    } catch (err) { console.error(err) }
    finally { setLoadingPipeline(false) }
  }

  const fetchLostQueue = async () => {
    try {
      setLoading(true)
      const data = await fetchWithAuth('/leads/lost-queue/')
      setLostLeads(data.results || data || [])
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  const fetchEmployees = async () => {
    try {
      const data = await fetchWithAuth('/accounts/employees/')
      setEmployees((data.results || data || []).filter(e => e.role === 'TELECALLER' || e.role === 'FIELD_AGENT' || e.role === 'MANAGER'))
    } catch (err) { /* */ }
  }

  const fetchWonLeads = async () => {
    try {
      setLoading(true)
      const data = await fetchWithAuth('/leads/won-leads/')
      setWonLeads(data || [])
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  // ─── Handlers ───
  const handleStatusDrop = async (leadId, newStatus) => {
    if (!leadId || !newStatus) return
    setPipelineLeads(prev => prev.map(lead => 
      lead.id.toString() === leadId ? { ...lead, status: newStatus } : lead
    ))
    try {
      await fetchWithAuth(`/leads/${leadId}/`, { method: 'PATCH', body: JSON.stringify({ status: newStatus }) })
    } catch (err) {
      alert("Failed to update status: " + err.message)
      fetchPipelineLeads()
    }
  }

  const openDetailDrawer = async (lead) => {
    setDetailLead(lead)
    setLoadingDetail(true)
    try {
      const [t, f] = await Promise.all([
        fetchWithAuth(`/leads/${lead.id}/timeline/`).catch(() => []),
        fetchWithAuth(`/leads/${lead.id}/follow-ups/`).catch(() => [])
      ])
      setTimeline(t || [])
      setFollowUps(f || [])
    } catch (err) { console.error(err) }
    finally { setLoadingDetail(false) }
  }

  const handleExport = async (format = 'csv') => {
    try {
      setExporting(true)
      const response = await fetchWithAuth(`/leads/export/?format=${format}`, {
        method: 'GET',
        headers: { 'Accept': format === 'csv' ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
      }, true)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `leads_export_${new Date().toISOString().split('T')[0]}.${format === 'csv' ? 'csv' : 'xlsx'}`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
    } catch (err) { alert('Export failed: ' + err.message) }
    finally { setExporting(false) }
  }

  const handleBulkDelete = async () => {
    if (!confirm('⚠️ SYSTEM WARNING ⚠️\n\nYou are about to PERMANENTLY DELETE ALL LEADS in the system.\nThis action CANNOT be undone.\n\nAre you absolutely sure you want to proceed?')) return
    const check = prompt('Type "DELETE" to confirm complete wipe of all leads:')
    if (check !== 'DELETE') return
    try {
      await fetchWithAuth('/leads/bulk-delete/', { method: 'DELETE' })
      alert('All leads have been permanently deleted.')
      fetchLeads()
      fetchBatchProgress()
    } catch (err) { alert('Error during bulk delete: ' + err.message) }
  }

  const handleDeleteBatch = async (source) => {
    const check = prompt(`⚠️ This will permanently delete all leads in batch "${source}".\nType "${source}" to confirm:`)
    if (check !== source) {
      if (check !== null) alert("Batch name did not match. Deletion cancelled.")
      return
    }
    try {
      setDeletingBatch(source)
      await fetchWithAuth('/leads/bulk-delete-batch/', { method: 'DELETE', body: JSON.stringify({ source }) })
      alert(`Batch "${source}" and all its leads were successfully deleted.`)
      fetchBatchProgress()
      if (batchFilter === source) setBatchFilter('all')
      if (activeTab === 'all') fetchLeads()
    } catch (err) { alert("Error deleting batch: " + err.message) }
    finally { setDeletingBatch(null) }
  }

  const handleBulkAssign = async (payload) => {
    setAssigning(true)
    try {
      const result = await fetchWithAuth('/leads/bulk-assign/', {
        method: 'POST', body: JSON.stringify(payload)
      })
      alert(result.detail)
      fetchLeads()
    } catch (err) { alert('Error: ' + err.message) }
    finally { setAssigning(false) }
  }

  const handleAdminReassign = async (lead, userId) => {
    try {
      const result = await fetchWithAuth(`/leads/${lead.id}/admin-reassign/`, {
        method: 'POST', body: JSON.stringify({ user_id: userId })
      })
      alert(result.detail)
      setReassignLead(null)
      fetchLostQueue()
    } catch (err) { alert('Error: ' + err.message) }
  }

  const handlePermanentDelete = async (leadId) => {
    if (!confirm('⚠️ PERMANENTLY delete this lead?')) return
    try {
      await fetchWithAuth(`/leads/${leadId}/permanent-delete/`, { method: 'DELETE' })
      fetchLostQueue()
    } catch (err) { alert('Error: ' + err.message) }
  }

  // ─── Tab Config ───
  const TABS = [
    { key: 'all', label: 'All Leads', color: 'bg-accent text-white border-accent shadow-lg shadow-accent/20' },
    { key: 'assign', label: 'Assign Leads', icon: Users, color: 'bg-accent2 text-white border-accent2 shadow-lg shadow-accent2/20' },
    { key: 'pipeline', label: 'Pipeline Board', icon: Layers, color: 'bg-amber text-white border-amber shadow-lg shadow-amber/20' },
    { key: 'won', label: 'Won Leads', icon: Trophy, color: 'bg-[#10B981] text-white border-[#10B981] shadow-lg shadow-[#10B981]/20' },
    { key: 'batches', label: 'Batch Tracking', icon: Layers, color: 'bg-purple text-white border-purple shadow-lg shadow-purple/20' },
    { key: 'lost', label: 'Lost Queue', icon: AlertTriangle, color: 'bg-danger text-white border-danger shadow-lg shadow-danger/20' },
  ]

  return (
    <Layout role="admin" pageTitle="Lead Management"
      actions={
        <div className="flex gap-2 items-center">
          <button onClick={handleBulkDelete} className="btn-ghost text-xs border-danger/20 hover:bg-danger/10 hover:text-danger text-danger">
            <Trash2 size={13} className="mr-1" /> Delete All Leads
          </button>
          <div className="w-px h-6 bg-border mx-1"></div>
          <button disabled={exporting} onClick={() => handleExport('csv')} className="btn-ghost text-xs group">
            {exporting ? <Loader2 size={13} className="animate-spin text-accent" /> : <Download size={13} />} Export CSV
          </button>
          <button disabled={exporting} onClick={() => handleExport('excel')} className="btn-ghost text-xs border-green/20 hover:bg-green/5 text-green-600">
            {exporting ? <Loader2 size={13} className="animate-spin" /> : <FileSpreadsheet size={13} />} Excel
          </button>
        </div>
      }
    >
      {/* Tab Navigation */}
      <div className="flex gap-2 mb-6 border-b border-border pb-4 flex-wrap">
        {TABS.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={clsx('px-5 py-2.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-2',
              activeTab === tab.key ? tab.color : 'bg-card text-txt2 border-border hover:bg-bg3')}>
            {tab.icon && <tab.icon size={14} />}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'all' && (
        <LeadsTable
          leads={leads} loading={loading} error={error}
          search={search} onSearchChange={setSearch}
          statusFilter={statusFilter} onStatusFilterChange={setStatusFilter}
          isHotFilter={isHotFilter} onHotFilterChange={setIsHotFilter}
          batchFilter={batchFilter} onBatchFilterChange={setBatchFilter}
          sourceOptions={sourceOptions}
          page={page} pageSize={pageSize} totalLeads={totalLeads}
          onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1) }}
          onRefresh={fetchLeads} onLeadClick={openDetailDrawer}
        />
      )}

      {activeTab === 'assign' && (
        <BulkAssign employees={employees} onAssign={handleBulkAssign} assigning={assigning} />
      )}

      {activeTab === 'pipeline' && (
        <PipelineBoard pipelineLeads={pipelineLeads} loading={loadingPipeline} onStatusDrop={handleStatusDrop} onLeadClick={openDetailDrawer} />
      )}

      {activeTab === 'won' && (
        <WonLeads wonLeads={wonLeads} loading={loading} />
      )}

      {activeTab === 'batches' && (
        <BatchTracking
          batchStats={batchStats} loading={loading} deletingBatch={deletingBatch}
          onRefresh={fetchBatchProgress} onDeleteBatch={handleDeleteBatch}
          onFilterByBatch={(id) => { setBatchFilter(id); setActiveTab('all') }}
        />
      )}

      {activeTab === 'lost' && (
        <LostQueue
          lostLeads={lostLeads} loading={loading}
          onReassign={(lead) => setReassignLead(lead)}
          onPermanentDelete={handlePermanentDelete}
        />
      )}

      {/* Overlays */}
      <LeadDetailDrawer
        lead={detailLead} timeline={timeline} followUps={followUps}
        loading={loadingDetail} onClose={() => setDetailLead(null)}
      />

      <ReassignModal
        lead={reassignLead} employees={employees} loading={loading}
        onConfirm={handleAdminReassign} onClose={() => setReassignLead(null)}
      />
    </Layout>
  )
}
