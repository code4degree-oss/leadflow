import { useState, useEffect } from 'react'
import Layout from '../../components/Layout'
import { Building2, MapPin, DollarSign, Home, Loader2, Search } from 'lucide-react'
import clsx from 'clsx'
import { fetchWithAuth } from '../../utils/api'

export default function TelecallerProjects() {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

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

  const filtered = projects.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.location || '').toLowerCase().includes(search.toLowerCase())
  )

  const BhkCard = ({ label, total, available, active }) => {
    if (!active) return null
    const pct = total > 0 ? Math.round((available / total) * 100) : 0
    const soldOut = available === 0
    return (
      <div className={clsx(
        'rounded-xl border p-3 text-center transition-all',
        soldOut ? 'bg-danger/5 border-danger/20' : 'bg-accent2/5 border-accent2/20'
      )}>
        <div className="flex items-center justify-center gap-1 mb-1">
          <Home size={12} className={soldOut ? 'text-danger' : 'text-accent2'} />
          <span className={clsx('text-xs font-bold', soldOut ? 'text-danger' : 'text-accent2')}>{label}</span>
        </div>
        <div className={clsx('font-display font-bold text-lg', soldOut ? 'text-danger' : 'text-txt')}>
          {available}<span className="text-txt3 text-xs font-normal">/{total}</span>
        </div>
        <div className="text-[9px] text-txt3 font-medium">
          {soldOut ? '🔴 Sold out' : `${pct}% available`}
        </div>
        {/* Progress bar */}
        <div className="w-full h-1 bg-bg3 rounded-full mt-2 overflow-hidden">
          <div
            className={clsx('h-full rounded-full transition-all', soldOut ? 'bg-danger' : 'bg-accent2')}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    )
  }

  return (
    <Layout role="telecaller" pageTitle="Projects">
      {/* Search */}
      <div className="mb-5">
        <div className="relative max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-txt3" />
          <input
            className="input w-full pl-9 bg-bg3 py-2.5 text-sm"
            placeholder="Search projects by name or location..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="card p-16 flex flex-col items-center justify-center text-center">
          <Loader2 size={32} className="animate-spin text-accent mb-3" />
          <div className="text-txt2 font-medium text-sm">Loading projects...</div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-16 flex flex-col items-center justify-center text-center border-dashed border-2 border-border">
          <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4">
            <Building2 size={28} className="text-accent" />
          </div>
          <p className="font-display font-bold text-lg text-txt mb-1">
            {search ? 'No projects found' : 'No projects available'}
          </p>
          <p className="text-xs text-txt3">
            {search ? 'Try a different search term.' : 'Your admin has not added any projects yet.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(p => (
            <div key={p.id} className="card p-5 border border-border hover:border-accent/30 transition-all">
              {/* Header */}
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
                  <Building2 size={18} className="text-accent" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-display font-bold text-sm text-txt">{p.name}</div>
                  {p.location && (
                    <div className="flex items-center gap-1 text-[10px] text-txt3 mt-0.5">
                      <MapPin size={9} /> {p.location}
                    </div>
                  )}
                </div>
              </div>

              {/* Price */}
              {p.price_range && (
                <div className="flex items-center gap-1.5 mb-4 text-xs text-txt2 bg-bg3 px-3 py-1.5 rounded-lg border border-border w-fit">
                  <DollarSign size={12} className="text-accent" />
                  <span className="font-bold">{p.price_range}</span>
                </div>
              )}

              {/* BHK Grid */}
              {(p.has_1bhk || p.has_2bhk || p.has_3bhk) ? (
                <div className="grid grid-cols-3 gap-2">
                  <BhkCard label="1 BHK" total={p.total_1bhk} available={p.available_1bhk} active={p.has_1bhk} />
                  <BhkCard label="2 BHK" total={p.total_2bhk} available={p.available_2bhk} active={p.has_2bhk} />
                  <BhkCard label="3 BHK" total={p.total_3bhk} available={p.available_3bhk} active={p.has_3bhk} />
                </div>
              ) : (
                <div className="text-xs text-txt3 bg-bg3 p-3 rounded-lg text-center border border-border">
                  No unit details added yet
                </div>
              )}

              {/* Description */}
              {p.description && (
                <p className="text-[10px] text-txt3 mt-3 line-clamp-2 leading-relaxed">{p.description}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </Layout>
  )
}
