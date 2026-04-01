import { useRouter } from 'next/router'
import Layout from '../../../components/Layout'
import { Plus, ArrowLeft, Building2 } from 'lucide-react'

export default function AddProject() {
  const router = useRouter()

  const handleCreate = (e) => {
    e.preventDefault()
    // For now, redirect back to projects as no API is connected yet
    router.push('/admin/projects')
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
              <p className="text-xs text-txt3 font-bold uppercase tracking-widest mt-1">Add details for a new property</p>
            </div>
          </div>

          <form onSubmit={handleCreate} className="space-y-6">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-widest text-txt3 ml-1">Project Name</label>
              <input className="input w-full bg-bg3 py-3" placeholder="Green Valley Phase 3" required />
            </div>
            
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-widest text-txt3 ml-1">Location</label>
              <input className="input w-full bg-bg3 py-3" placeholder="Pune, Maharashtra" required />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-widest text-txt3 ml-1">Total Units</label>
                <input className="input w-full bg-bg3 py-3" type="number" placeholder="80" required />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-widest text-txt3 ml-1">Available Units</label>
                <input className="input w-full bg-bg3 py-3" type="number" placeholder="80" required />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-widest text-txt3 ml-1">Price Range</label>
              <input className="input w-full bg-bg3 py-3" placeholder="65L – 1.2Cr" required />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-widest text-txt3 ml-1">Description</label>
              <textarea className="input w-full bg-bg3 py-3 h-28 resize-none" placeholder="Project details…" required />
            </div>

            <div className="pt-4 flex justify-end">
              <button 
                type="button"
                onClick={()=>router.push('/admin/projects')} 
                className="btn-ghost px-6 mr-3"
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="btn-primary px-8 py-3"
              >
                <Plus size={16} className="mr-2"/> Create Project
              </button>
            </div>
          </form>
        </div>
      </div>
    </Layout>
  )
}
