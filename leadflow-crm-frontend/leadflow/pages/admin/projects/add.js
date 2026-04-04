import { useState } from 'react'
import { useRouter } from 'next/router'
import Layout from '../../../components/Layout'
import { Plus, ArrowLeft, Building2, Loader2, MapPin, DollarSign, Home, Check } from 'lucide-react'
import { fetchWithAuth } from '../../../utils/api'
import clsx from 'clsx'

export default function AddProject() {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)

  const [name, setName] = useState('')
  const [location, setLocation] = useState('')
  const [description, setDescription] = useState('')
  const [priceRange, setPriceRange] = useState('')

  const [has1bhk, setHas1bhk] = useState(false)
  const [total1bhk, setTotal1bhk] = useState('')
  const [available1bhk, setAvailable1bhk] = useState('')

  const [has2bhk, setHas2bhk] = useState(false)
  const [total2bhk, setTotal2bhk] = useState('')
  const [available2bhk, setAvailable2bhk] = useState('')

  const [has3bhk, setHas3bhk] = useState(false)
  const [total3bhk, setTotal3bhk] = useState('')
  const [available3bhk, setAvailable3bhk] = useState('')

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!name.trim()) return

    setSubmitting(true)
    try {
      await fetchWithAuth('/projects/', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          location: location.trim(),
          description: description.trim(),
          price_range: priceRange.trim(),
          has_1bhk: has1bhk,
          total_1bhk: has1bhk ? parseInt(total1bhk) || 0 : 0,
          available_1bhk: has1bhk ? parseInt(available1bhk) || 0 : 0,
          has_2bhk: has2bhk,
          total_2bhk: has2bhk ? parseInt(total2bhk) || 0 : 0,
          available_2bhk: has2bhk ? parseInt(available2bhk) || 0 : 0,
          has_3bhk: has3bhk,
          total_3bhk: has3bhk ? parseInt(total3bhk) || 0 : 0,
          available_3bhk: has3bhk ? parseInt(available3bhk) || 0 : 0,
        })
      })
      router.push('/admin/projects')
    } catch (err) {
      alert('Failed to create project: ' + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Layout role="admin" pageTitle="Add Project"
      actions={
        <button onClick={() => router.push('/admin/projects')} className="btn-ghost">
          <ArrowLeft size={16} /> Back to Projects
        </button>
      }
    >
      <div className="max-w-2xl mx-auto">
        <div className="card p-6 md:p-8 border border-border mt-4">
          <div className="flex items-center gap-4 mb-8">
            <div className="p-3 bg-accent/10 rounded-xl text-accent">
              <Building2 size={24} />
            </div>
            <div>
              <h2 className="font-display font-bold text-2xl text-txt">Create New Project</h2>
              <p className="text-xs text-txt3 font-bold uppercase tracking-widest mt-1">Add a new property / project</p>
            </div>
          </div>

          <form onSubmit={handleCreate} className="space-y-6">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-widest text-txt3 ml-1">Project Name *</label>
              <input className="input w-full bg-bg3 py-3" placeholder="e.g. Green Valley Phase 3" required
                value={name} onChange={e => setName(e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-widest text-txt3 ml-1 flex items-center gap-1">
                <MapPin size={12} /> Location
              </label>
              <input className="input w-full bg-bg3 py-3" placeholder="e.g. Baner, Pune"
                value={location} onChange={e => setLocation(e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-widest text-txt3 ml-1 flex items-center gap-1">
                <DollarSign size={12} /> Price Range
              </label>
              <input className="input w-full bg-bg3 py-3" placeholder="e.g. 65L – 1.2Cr"
                value={priceRange} onChange={e => setPriceRange(e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-widest text-txt3 ml-1">Description</label>
              <textarea className="input w-full bg-bg3 py-3 h-24 resize-none" placeholder="Project details, amenities..."
                value={description} onChange={e => setDescription(e.target.value)} />
            </div>

            <hr className="border-border border-dashed" />

            {/* BHK Configuration */}
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-txt3 ml-1 mb-3 block">
                Unit Types & Inventory
              </label>
              <div className="space-y-3">
                {/* 1 BHK */}
                <div className={clsx('rounded-xl border p-4 transition-all', has1bhk ? 'bg-accent/5 border-accent/30' : 'bg-bg3 border-border opacity-60')}>
                  <div className="flex items-center gap-3 cursor-pointer mb-3" onClick={() => setHas1bhk(!has1bhk)}>
                    <div className={clsx('w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all shrink-0', has1bhk ? 'bg-accent border-accent text-white' : 'border-border bg-card')}>
                      {has1bhk && <Check size={12} strokeWidth={3} />}
                    </div>
                    <Home size={14} className={clsx(has1bhk ? 'text-accent' : 'text-txt3')} />
                    <span className={clsx('text-sm font-bold', has1bhk ? 'text-txt' : 'text-txt3')}>1 BHK</span>
                  </div>
                  {has1bhk && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[9px] font-bold uppercase tracking-wider text-txt3 mb-1 block">Total Flats</label>
                        <input type="number" min="0" className="input w-full bg-card py-2 text-sm" placeholder="e.g. 40"
                          value={total1bhk} onChange={e => setTotal1bhk(e.target.value)} />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold uppercase tracking-wider text-txt3 mb-1 block">Available</label>
                        <input type="number" min="0" className="input w-full bg-card py-2 text-sm" placeholder="e.g. 35"
                          value={available1bhk} onChange={e => setAvailable1bhk(e.target.value)} />
                      </div>
                    </div>
                  )}
                </div>

                {/* 2 BHK */}
                <div className={clsx('rounded-xl border p-4 transition-all', has2bhk ? 'bg-accent2/5 border-accent2/30' : 'bg-bg3 border-border opacity-60')}>
                  <div className="flex items-center gap-3 cursor-pointer mb-3" onClick={() => setHas2bhk(!has2bhk)}>
                    <div className={clsx('w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all shrink-0', has2bhk ? 'bg-accent border-accent text-white' : 'border-border bg-card')}>
                      {has2bhk && <Check size={12} strokeWidth={3} />}
                    </div>
                    <Home size={14} className={clsx(has2bhk ? 'text-accent' : 'text-txt3')} />
                    <span className={clsx('text-sm font-bold', has2bhk ? 'text-txt' : 'text-txt3')}>2 BHK</span>
                  </div>
                  {has2bhk && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[9px] font-bold uppercase tracking-wider text-txt3 mb-1 block">Total Flats</label>
                        <input type="number" min="0" className="input w-full bg-card py-2 text-sm" placeholder="e.g. 40"
                          value={total2bhk} onChange={e => setTotal2bhk(e.target.value)} />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold uppercase tracking-wider text-txt3 mb-1 block">Available</label>
                        <input type="number" min="0" className="input w-full bg-card py-2 text-sm" placeholder="e.g. 35"
                          value={available2bhk} onChange={e => setAvailable2bhk(e.target.value)} />
                      </div>
                    </div>
                  )}
                </div>

                {/* 3 BHK */}
                <div className={clsx('rounded-xl border p-4 transition-all', has3bhk ? 'bg-purple/5 border-purple/30' : 'bg-bg3 border-border opacity-60')}>
                  <div className="flex items-center gap-3 cursor-pointer mb-3" onClick={() => setHas3bhk(!has3bhk)}>
                    <div className={clsx('w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all shrink-0', has3bhk ? 'bg-accent border-accent text-white' : 'border-border bg-card')}>
                      {has3bhk && <Check size={12} strokeWidth={3} />}
                    </div>
                    <Home size={14} className={clsx(has3bhk ? 'text-accent' : 'text-txt3')} />
                    <span className={clsx('text-sm font-bold', has3bhk ? 'text-txt' : 'text-txt3')}>3 BHK</span>
                  </div>
                  {has3bhk && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[9px] font-bold uppercase tracking-wider text-txt3 mb-1 block">Total Flats</label>
                        <input type="number" min="0" className="input w-full bg-card py-2 text-sm" placeholder="e.g. 40"
                          value={total3bhk} onChange={e => setTotal3bhk(e.target.value)} />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold uppercase tracking-wider text-txt3 mb-1 block">Available</label>
                        <input type="number" min="0" className="input w-full bg-card py-2 text-sm" placeholder="e.g. 35"
                          value={available3bhk} onChange={e => setAvailable3bhk(e.target.value)} />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="pt-4 flex justify-end gap-3">
              <button type="button" onClick={() => router.push('/admin/projects')} className="btn-ghost px-6">
                Cancel
              </button>
              <button type="submit" disabled={submitting || !name.trim()}
                className="btn-primary px-8 py-3 disabled:opacity-50">
                {submitting ? <Loader2 size={16} className="animate-spin mr-2" /> : <Plus size={16} className="mr-2" />}
                {submitting ? 'Creating...' : 'Create Project'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Layout>
  )
}
