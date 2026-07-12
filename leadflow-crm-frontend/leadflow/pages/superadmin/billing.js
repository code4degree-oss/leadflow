import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Layout from '../../components/Layout'
import { Modal } from '../../components/UI'
import { 
  CreditCard, CalendarCheck, AlertTriangle, CheckCircle2, 
  XCircle, Clock, RefreshCw, Search, ArrowUpRight,
  Building2, ShieldAlert, Zap, Crown, Shield, Activity
} from 'lucide-react'
import clsx from 'clsx'
import { fetchWithAuth } from '../../utils/api'

// ─── Plan badge config ───
const PLAN_CONFIG = {
  basic:      { label: 'Basic',      icon: Zap,    bg: 'bg-border/60 text-txt2',                    dot: 'bg-txt3' },
  pro:        { label: 'Pro',        icon: Crown,  bg: 'bg-accent/8 text-accent border border-accent/15', dot: 'bg-accent' },
  enterprise: { label: 'Enterprise', icon: Shield, bg: 'bg-purple/8 text-purple border border-purple/15', dot: 'bg-purple' },
}

export default function BillingPlansPage() {
  const router = useRouter()
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [renewModal, setRenewModal] = useState({ isOpen: false, clientId: null, clientName: '', newDate: '' })
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchClients()
  }, [])

  const fetchClients = async () => {
    setLoading(true)
    try {
      const data = await fetchWithAuth('/superadmin/clients/clients/')
      setClients(data.results || data || [])
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleRenew = async () => {
    if (!renewModal.newDate) return
    try {
      await fetchWithAuth(`/superadmin/clients/clients/${renewModal.clientId}/renew/`, {
        method: 'POST',
        body: JSON.stringify({ valid_until: renewModal.newDate })
      })
      setRenewModal({ isOpen: false, clientId: null, clientName: '', newDate: '' })
      fetchClients()
    } catch (err) {
      setError(err.message)
    }
  }

  // Stats
  const active = clients.filter(c => c.subscription_status === 'active')
  const expiringSoon = clients.filter(c => c.subscription_status === 'expiring_soon')
  const expired = clients.filter(c => c.subscription_status === 'expired')
  const noPlan = clients.filter(c => c.subscription_status === 'no_plan')

  // Filter
  const filtered = clients.filter(c => {
    const matchSearch = c.name.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'all' || c.subscription_status === statusFilter
    return matchSearch && matchStatus
  })

  return (
    <Layout role="superadmin" pageTitle="Billing & Plans"
      actions={
        <button onClick={fetchClients} className="p-2 hover:bg-card2 rounded-xl transition-all text-txt3 hover:text-txt">
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
        </button>
      }
    >
      {/* ═══ KPI Cards ═══ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 stagger-grid">
        {[
          { label: 'Active Plans', value: active.length, icon: CheckCircle2, color: 'text-[#10B981]', bg: 'bg-[#10B981]/8 group-hover:bg-[#10B981]', border: '', onClick: () => setStatusFilter('active') },
          { label: 'Expiring Soon', value: expiringSoon.length, icon: AlertTriangle, color: 'text-amber-500', bg: 'bg-amber-500/8 group-hover:bg-amber-500', border: expiringSoon.length > 0 ? 'border-amber-500/20 bg-amber-500/[0.02]' : '', onClick: () => setStatusFilter('expiring_soon') },
          { label: 'Expired', value: expired.length, icon: XCircle, color: 'text-danger', bg: 'bg-danger/8 group-hover:bg-danger', border: expired.length > 0 ? 'border-danger/20 bg-danger/[0.02]' : '', onClick: () => setStatusFilter('expired') },
          { label: 'No Plan Set', value: noPlan.length, icon: Clock, color: 'text-txt3', bg: 'bg-bg3 group-hover:bg-txt3', border: '', onClick: () => setStatusFilter('no_plan') },
        ].map(s => (
          <div
            key={s.label}
            onClick={s.onClick}
            className={clsx(
              'accent-card p-5 cursor-pointer group',
              s.border,
              statusFilter === s.label.toLowerCase().replace(/ /g, '_') ? 'ring-2 ring-primary/30 shadow-md' : ''
            )}
          >
            <div className="flex items-center justify-between mb-4">
              <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 group-hover:text-white', s.bg, s.color)}>
                <s.icon size={18} />
              </div>
              <ArrowUpRight size={14} className="text-txt3 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="font-display font-extrabold text-3xl text-txt leading-none tracking-tight">{s.value}</div>
            <div className="text-xs font-bold uppercase tracking-widest text-txt3 mt-1.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* ═══ Filters ═══ */}
      <div className="flex flex-col md:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-txt3" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input pl-10 h-10 text-sm bg-card border-border/50 focus:border-accent w-full rounded-xl shadow-sm"
            placeholder="Search organizations…"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap p-1 bg-border/40 rounded-xl">
          {['all', 'active', 'expiring_soon', 'expired', 'no_plan'].map(f => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={clsx(
                'px-4 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all',
                statusFilter === f
                  ? 'bg-card text-txt shadow-sm'
                  : 'text-txt3 hover:text-txt'
              )}
            >
              {f === 'all' ? 'All' : f.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* ═══ Subscription Cards ═══ */}
      {loading ? (
        <div className="py-24 text-center">
          <RefreshCw size={24} className="animate-spin mx-auto text-accent mb-3" />
          <p className="text-xs text-txt3 font-bold uppercase tracking-widest">Loading billing data…</p>
        </div>
      ) : error ? (
        <div className="card p-8 text-center border-danger/20 bg-danger/[0.02]">
          <ShieldAlert size={32} className="mx-auto text-danger mb-3" />
          <p className="text-sm text-danger font-bold">{error}</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-16 text-center shadow-sm">
          <CreditCard size={32} className="mx-auto text-txt3/40 mb-3" />
          <p className="text-sm font-bold text-txt">No matching organizations</p>
          <p className="text-xs text-txt3 mt-1">Try adjusting your filters or search terms.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 stagger-grid">
          {filtered.map(client => {
            const plan = PLAN_CONFIG[client.plan] || PLAN_CONFIG.basic
            const PlanIcon = plan.icon
            
            // Calculate progress properly
            const isOverdue = client.days_remaining != null && client.days_remaining <= 0
            const progressColor = isOverdue ? 'bg-danger' : client.days_remaining <= 7 ? 'bg-amber-500' : 'bg-[#10B981]'
            const progressWidth = isOverdue ? 100 : Math.max(2, Math.min(100, (client.days_remaining / 365) * 100))

            return (
              <div
                key={client.id}
                className={clsx(
                  'accent-card flex flex-col group',
                  client.subscription_status === 'expired' && 'border-danger/30 bg-danger/[0.02] shadow-[0_2px_10px_rgba(239,68,68,0.05)]',
                  client.subscription_status === 'expiring_soon' && 'border-amber-500/30 bg-amber-500/[0.02] shadow-[0_2px_10px_rgba(245,158,11,0.05)]'
                )}
              >
                {/* Header */}
                <div className="p-5 border-b border-border/60">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-accent/8 border border-accent/10 flex items-center justify-center text-accent font-bold text-sm shrink-0 group-hover:bg-accent group-hover:text-white transition-all duration-300">
                        {client.name[0]?.toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-sm text-txt truncate group-hover:text-accent transition-colors">{client.name}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={clsx('inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase', plan.bg)}>
                            <PlanIcon size={10} />
                            {plan.label}
                          </span>
                          <span className="text-[10px] text-txt3 font-mono">{client.user_count}/{client.max_users} users</span>
                        </div>
                      </div>
                    </div>
                    {client.subscription_status === 'expired' && (
                      <div className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold uppercase bg-danger/10 text-danger border border-danger/20">
                        <XCircle size={12} /> Expired
                      </div>
                    )}
                  </div>
                </div>

                {/* Body */}
                <div className="p-5 flex-1 space-y-4">
                  {/* Date info */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-[9px] font-bold uppercase tracking-widest text-txt3 mb-1">Start Date</div>
                      <div className="text-xs font-bold text-txt font-mono bg-bg2/50 px-2.5 py-1.5 rounded-lg inline-block">
                        {client.subscription_start || '—'}
                      </div>
                    </div>
                    <div>
                      <div className="text-[9px] font-bold uppercase tracking-widest text-txt3 mb-1">End Date</div>
                      <div className="text-xs font-bold text-txt font-mono bg-bg2/50 px-2.5 py-1.5 rounded-lg inline-block">
                        {client.valid_until || '—'}
                      </div>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  {client.days_remaining != null && (
                    <div className="pt-2">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[9px] font-bold uppercase tracking-widest text-txt3">Time Remaining</span>
                        <span className={clsx('text-xs font-bold font-mono', 
                          isOverdue ? 'text-danger' : client.days_remaining <= 7 ? 'text-amber-500' : 'text-[#10B981]'
                        )}>
                          {isOverdue ? `${Math.abs(client.days_remaining)}d overdue` : `${client.days_remaining}d left`}
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-bg3 rounded-full overflow-hidden">
                        <div
                          className={clsx('h-full rounded-full transition-all duration-500', progressColor)}
                          style={{ width: `${progressWidth}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Trial info */}
                  <div className="flex items-center justify-between text-[10px] pt-1">
                    <span className="text-txt3 font-bold uppercase tracking-wider flex items-center gap-1.5"><Activity size={12}/> Trial / Cycle</span>
                    <span className="text-txt font-mono font-bold">{client.trial_days} days</span>
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="px-5 py-3.5 border-t border-border/60 bg-bg2/30 flex items-center gap-3 mt-auto">
                  <button
                    onClick={() => setRenewModal({ isOpen: true, clientId: client.id, clientName: client.name, newDate: '' })}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-card hover:bg-accent hover:text-white text-txt border border-border/80 hover:border-accent rounded-xl text-xs font-bold shadow-sm transition-all"
                  >
                    <CalendarCheck size={14} />
                    Renew
                  </button>
                  <button
                    onClick={() => router.push(`/superadmin/clients/view/${client.id}`)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-card hover:bg-bg3 text-txt border border-border/80 rounded-xl text-xs font-bold shadow-sm transition-all"
                  >
                    <Building2 size={14} />
                    Manage
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ═══ Renew Modal ═══ */}
      <Modal
        isOpen={renewModal.isOpen}
        onClose={() => setRenewModal({ ...renewModal, isOpen: false })}
        title="Renew Subscription"
        footer={
          <div className="flex gap-2">
            <button onClick={() => setRenewModal({ ...renewModal, isOpen: false })} className="btn-ghost px-6 py-2 rounded-xl border border-border">Cancel</button>
            <button onClick={handleRenew} disabled={!renewModal.newDate} className="btn-primary px-6 py-2 disabled:opacity-50">Confirm Renewal</button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-txt2 leading-relaxed">
            Renewing subscription for <strong className="text-txt">{renewModal.clientName}</strong>.
            Select the new end date below. The client will be instantly reactivated.
          </p>

          <div className="p-4 bg-bg3 rounded-xl border border-border">
            <label className="text-[10px] font-bold uppercase tracking-widest text-txt3 block mb-2">New Subscription End Date</label>
            <input
              type="date"
              className="input w-full bg-card text-sm font-mono"
              value={renewModal.newDate}
              min={new Date().toISOString().split('T')[0]}
              onChange={e => setRenewModal({ ...renewModal, newDate: e.target.value })}
            />
          </div>

          <div className="p-3 bg-accent/5 border border-accent/15 rounded-xl">
            <p className="text-[10px] text-txt2 font-medium">
              ✅ This will set <strong>is_active = true</strong>, update the subscription start to today, and set the end date to your selection.
            </p>
          </div>
        </div>
      </Modal>
    </Layout>
  )
}
