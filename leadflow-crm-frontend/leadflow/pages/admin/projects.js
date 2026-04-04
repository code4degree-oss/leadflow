import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Layout from '../../components/Layout'
import { Plus, Trash2, Building2, Loader2, ToggleLeft, ToggleRight, MapPin, DollarSign, Home } from 'lucide-react'
import clsx from 'clsx'
import { fetchWithAuth } from '../../utils/api'

export default function Projects() {
  const router = useRouter()
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState(null)
  const [deleting, setDeleting] = useState(null)

  useEffect(() => {
    loadProjects()
  }, [])

  const loadProjects = async () => {
    setLoading(true)
    try {
      const data = await fetchWithAuth('/projects/')
      setProjects(data.results || data || [])
    } catch (err) {
      console.error('Failed to load projects:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleToggleActive = async (project) => {
    setToggling(project.id)
    try {
      await fetchWithAuth(`/projects/${project.id}/`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: !project.is_active })
      })
      setProjects(prev => prev.map(p => p.id === project.id ? { ...p, is_active: !p.is_active } : p))
    } catch (err) {
      alert('Failed to toggle: ' + err.message)
    } finally {
      setToggling(null)
    }
  }

  const handleDelete = async (project) => {
    if (!confirm(`Are you sure you want to delete "${project.name}"?`)) return
    setDeleting(project.id)
    try {
      await fetchWithAuth(`/projects/${project.id}/`, { method: 'DELETE' })
      setProjects(prev => prev.filter(p => p.id !== project.id))
    } catch (err) {
      alert('Failed to delete: ' + err.message)
    } finally {
      setDeleting(null)
    }
  }

  const BhkPill = ({ label, total, available, active }) => {
    if (!active) return null
    const soldOut = available === 0
    return (
      <div className={clsx(
        'text-[10px] font-bold px-2.5 py-1 rounded-lg border flex items-center gap-1',
        soldOut
          ? 'bg-danger/10 text-danger border-danger/20'
          : 'bg-accent2/10 text-accent2 border-accent2/20'
      )}>
        <Home size={10} />
        {label}: {available}/{total}
      </div>
    )
  }

  return (
    <Layout role="admin" pageTitle="Projects"
      actions={<button className="btn-primary" onClick={() => router.push('/admin/projects/add')}><Plus size={14} />Add Project</button>}>

      {loading ? (
        <div className="card p-16 flex flex-col items-center justify-center text-center">
          <Loader2 size={32} className="animate-spin text-accent mb-3" />
          <div className="text-txt2 font-medium text-sm">Loading projects...</div>
        </div>
      ) : projects.length === 0 ? (
        <div className="card p-16 flex flex-col items-center justify-center text-center border-dashed border-2 border-border">
          <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4">
            <Building2 size={28} className="text-accent" />
          </div>
          <p className="font-display font-bold text-lg text-txt mb-1">No projects yet</p>
          <p className="text-xs text-txt3 mb-4">Create your first project to start organizing leads by property.</p>
          <button onClick={() => router.push('/admin/projects/add')} className="btn-primary">
            <Plus size={14} className="mr-1" /> Create First Project
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map(p => (
            <div key={p.id} className={clsx('card p-5 transition-all border border-border', !p.is_active && 'opacity-50')}>
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
                    <Building2 size={18} className="text-accent" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-display font-bold text-sm text-txt truncate">{p.name}</div>
                    {p.location && (
                      <div className="flex items-center gap-1 text-[10px] text-txt3 mt-0.5">
                        <MapPin size={9} /> {p.location}
                      </div>
                    )}
                  </div>
                </div>
                <span className={clsx(
                  'text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border shrink-0',
                  p.is_active
                    ? 'bg-[#10B981]/10 text-[#10B981] border-[#10B981]/20'
                    : 'bg-danger/10 text-danger border-danger/20'
                )}>
                  {p.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>

              {/* Price & Leads */}
              <div className="flex items-center gap-3 mb-3 text-xs text-txt3">
                {p.price_range && (
                  <span className="flex items-center gap-1 bg-bg3 px-2 py-0.5 rounded border border-border">
                    <DollarSign size={10} /> {p.price_range}
                  </span>
                )}
                <span className="bg-bg3 px-2 py-0.5 rounded border border-border font-mono">
                  {p.lead_count || 0} leads
                </span>
              </div>

              {/* BHK Pills */}
              {(p.has_1bhk || p.has_2bhk || p.has_3bhk) && (
                <div className="flex flex-wrap gap-2 mb-3">
                  <BhkPill label="1BHK" total={p.total_1bhk} available={p.available_1bhk} active={p.has_1bhk} />
                  <BhkPill label="2BHK" total={p.total_2bhk} available={p.available_2bhk} active={p.has_2bhk} />
                  <BhkPill label="3BHK" total={p.total_3bhk} available={p.available_3bhk} active={p.has_3bhk} />
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-between pt-3 border-t border-border">
                <button
                  onClick={() => handleToggleActive(p)}
                  disabled={toggling === p.id}
                  className={clsx(
                    'flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-all border',
                    p.is_active
                      ? 'text-txt3 bg-bg3 border-border hover:text-amber hover:border-amber/30'
                      : 'text-[#10B981] bg-[#10B981]/10 border-[#10B981]/20 hover:bg-[#10B981]/20'
                  )}
                >
                  {toggling === p.id ? <Loader2 size={12} className="animate-spin" /> :
                    p.is_active ? <ToggleRight size={14} /> : <ToggleLeft size={14} />
                  }
                  {p.is_active ? 'Deactivate' : 'Activate'}
                </button>
                <button
                  onClick={() => handleDelete(p)}
                  disabled={deleting === p.id}
                  className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg text-txt3 bg-bg3 border border-border hover:text-danger hover:border-danger/30 transition-all disabled:opacity-50"
                >
                  {deleting === p.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Layout>
  )
}
