import { useState } from 'react'
import { useRouter } from 'next/router'
import Layout from '../../components/Layout'
import { SectionHeader, StatusBadge } from '../../components/UI'
import { Plus, Edit, Trash2, Briefcase, Building2, MapPin } from 'lucide-react'
import clsx from 'clsx'

const PROJECTS = []

export default function Projects() {
  const router = useRouter()

  return (
    <Layout role="admin" pageTitle="Projects"
      actions={<button className="btn-primary" onClick={()=>router.push('/admin/projects/add')}><Plus size={14}/>Add Project</button>}>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {PROJECTS.map(p => (
          <div key={p.id} className={clsx('card p-5', p.status==='inactive'&&'opacity-60')}>
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center">
                  <Building2 size={16} className="text-accent" />
                </div>
                <div>
                  <div className="font-display font-bold text-sm text-txt">{p.name}</div>
                  <div className="flex items-center gap-1 text-xs text-txt3 mt-0.5">
                    <MapPin size={10}/>{p.location}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={p.status} />
                <button className="p-1.5 hover:bg-card2 rounded text-txt3 hover:text-accent transition-colors"><Edit size={13}/></button>
                <button className="p-1.5 hover:bg-card2 rounded text-txt3 hover:text-danger transition-colors"><Trash2 size={13}/></button>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-3 mb-3">
              {[
                ['Total Units', p.units,     'text-txt'    ],
                ['Available',   p.available, p.available===0?'text-danger':p.available<10?'text-amber':'text-accent2'],
                ['Leads',       p.leads,     'text-accent' ],
                ['Won',         p.won,       'text-accent2'],
              ].map(([l,v,c])=>(
                <div key={l} className="bg-bg3 rounded-lg p-2.5 text-center">
                  <div className={clsx('font-display font-bold text-lg', c)}>{v}</div>
                  <div className="text-xs text-txt3 mt-0.5">{l}</div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between text-xs text-txt3 pt-3 border-t border-border">
              <span className="font-mono">{p.price}</span>
              <span>{p.available === 0 ? '🔴 Sold out' : `${p.available} units left`}</span>
            </div>
          </div>
        ))}
      </div>


    </Layout>
  )
}
