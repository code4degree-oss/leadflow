import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Layout from '../../components/Layout'
import { StatusBadge, Modal } from '../../components/UI'
import { 
  CreditCard, CalendarCheck, AlertTriangle, CheckCircle2, 
  XCircle, Clock, RefreshCw, Search, Filter, ArrowUpRight,
  Building2, TrendingUp, ShieldAlert, CalendarDays
} from 'lucide-react'
import clsx from 'clsx'
import { fetchWithAuth } from '../../utils/api'

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

  const getStatusConfig = (status) => {
    switch (status) {
      case 'active': return { label: 'Active', icon: CheckCircle2, color: 'text-success', bg: 'bg-success/10', border: 'border-success/20' }
      case 'expiring_soon': return { label: 'Expiring Soon', icon: AlertTriangle, color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/20' }
      case 'expired': return { label: 'Expired', icon: XCircle, color: 'text-danger', bg: 'bg-danger/10', border: 'border-danger/20' }
      default: return { label: 'No Plan', icon: Clock, color: 'text-txt3', bg: 'bg-bg3', border: 'border-border' }
    }
  }

  const getPlanBadge = (plan) => {
    const colors = {
      basic: 'bg-bg3 text-txt3 border-border',
      pro: 'bg-accent/10 text-accent border-accent/20',
      enterprise: 'bg-purple/10 text-purple border-purple/20'
    }
    return colors[plan] || colors.basic
  }

  return (
    <Layout role="superadmin" pageTitle="Billing & Plans"
      actions={
        <button onClick={fetchClients} className="p-2 hover:bg-card2 rounded-xl transition-all text-txt3">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      }
    >
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Active Plans', value: active.length, icon: CheckCircle2, color: 'text-success', accent: 'bg-success/10 border-success/20', onClick: () => setStatusFilter('active') },
          { label: 'Expiring Soon', value: expiringSoon.length, icon: AlertTriangle, color: 'text-amber-500', accent: 'bg-amber-500/10 border-amber-500/20', onClick: () => setStatusFilter('expiring_soon') },
          { label: 'Expired', value: expired.length, icon: XCircle, color: 'text-danger', accent: 'bg-danger/10 border-danger/20', onClick: () => setStatusFilter('expired') },
          { label: 'No Plan Set', value: noPlan.length, icon: Clock, color: 'text-txt3', accent: 'bg-bg3 border-border', onClick: () => setStatusFilter('no_plan') },
        ].map(s => (
          <div
            key={s.label}
            onClick={s.onClick}
            className={clsx(
              'card p-4 cursor-pointer transition-all hover:shadow-lg group border',
              statusFilter === s.label.toLowerCase().replace(/ /g, '_') ? 'ring-2 ring-primary/30' : ''
            )}
          >
            <div className="flex items-center justify-between mb-3">
              <div className={clsx('p-2 rounded-xl border', s.accent)}>
                <s.icon size={16} className={s.color} />
              </div>
              <ArrowUpRight size={14} className="text-txt3 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className={clsx('font-display font-bold text-2xl', s.color)}>{s.value}</div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-txt3 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-txt3" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input pl-10 h-10 text-sm bg-card border-border/50 focus:border-primary w-full"
            placeholder="Search organizations…"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {['all', 'active', 'expiring_soon', 'expired', 'no_plan'].map(f => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={clsx(
                'px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest border transition-all',
                statusFilter === f
                  ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20'
                  : 'bg-card text-txt3 border-border hover:border-primary/30 hover:text-primary'
              )}
            >
              {f === 'all' ? 'All' : f.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Subscription Cards */}
      {loading ? (
        <div className="py-20 text-center">
          <RefreshCw size={28} className="animate-spin mx-auto text-primary mb-3" />
          <p className="text-xs text-txt3 font-bold uppercase tracking-widest">Loading billing data…</p>
        </div>
      ) : error ? (
        <div className="card p-8 text-center border-danger/20">
          <ShieldAlert size={32} className="mx-auto text-danger mb-3" />
          <p className="text-sm text-danger font-bold">{error}</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <CreditCard size={32} className="mx-auto text-txt3 mb-3" />
          <p className="text-sm text-txt3">No organizations match the current filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(client => {
            const cfg = getStatusConfig(client.subscription_status)
            const StatusIcon = cfg.icon
            return (
              <div
                key={client.id}
                className={clsx(
                  'card overflow-hidden transition-all hover:shadow-xl group border',
                  client.subscription_status === 'expired' && 'border-danger/20 bg-danger/[0.02]',
                  client.subscription_status === 'expiring_soon' && 'border-amber-500/20 bg-amber-500/[0.02]'
                )}
              >
                {/* Header */}
                <div className="p-4 border-b border-border/50">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-bg3 border border-border flex items-center justify-center text-txt font-bold text-sm shrink-0 group-hover:bg-primary/10 group-hover:text-primary transition-all">
                        {client.name[0]}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-sm text-txt truncate">{client.name}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={clsx('inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border', getPlanBadge(client.plan))}>
                            {client.plan}
                          </span>
                          <span className="text-[10px] text-txt3">{client.user_count}/{client.max_users} users</span>
                        </div>
                      </div>
                    </div>
                    <div className={clsx('flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold uppercase border', cfg.bg, cfg.color, cfg.border)}>
                      <StatusIcon size={11} />
                      {cfg.label}
                    </div>
                  </div>
                </div>

                {/* Body */}
                <div className="p-4 space-y-3">
                  {/* Date info */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-2.5 bg-bg2/50 rounded-xl">
                      <div className="text-[9px] font-bold uppercase tracking-widest text-txt3 mb-1">Start Date</div>
                      <div className="text-xs font-bold text-txt font-mono">
                        {client.subscription_start || '—'}
                      </div>
                    </div>
                    <div className="p-2.5 bg-bg2/50 rounded-xl">
                      <div className="text-[9px] font-bold uppercase tracking-widest text-txt3 mb-1">End Date</div>
                      <div className="text-xs font-bold text-txt font-mono">
                        {client.valid_until || '—'}
                      </div>
                    </div>
                  </div>

                  {/* Days remaining bar */}
                  {client.days_remaining != null && (
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[9px] font-bold uppercase tracking-widest text-txt3">Time Remaining</span>
                        <span className={clsx('text-xs font-bold font-mono', 
                          client.days_remaining <= 0 ? 'text-danger' : client.days_remaining <= 7 ? 'text-amber-500' : 'text-success'
                        )}>
                          {client.days_remaining <= 0 ? `${Math.abs(client.days_remaining)}d overdue` : `${client.days_remaining}d left`}
                        </span>
                      </div>
                      <div className="w-full h-2 bg-bg3 rounded-full overflow-hidden">
                        <div
                          className={clsx('h-full rounded-full transition-all duration-500',
                            client.days_remaining <= 0 ? 'bg-danger' : client.days_remaining <= 7 ? 'bg-amber-500' : 'bg-success'
                          )}
                          style={{ width: `${Math.max(2, Math.min(100, (client.days_remaining / 365) * 100))}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Trial info */}
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-txt3 font-bold uppercase tracking-wider">Trial / Cycle</span>
                    <span className="text-txt font-bold">{client.trial_days} days</span>
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="px-4 py-3 border-t border-border/50 bg-bg2/20 flex items-center gap-2">
                  <button
                    onClick={() => setRenewModal({ isOpen: true, clientId: client.id, clientName: client.name, newDate: '' })}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-success/10 hover:bg-success/20 text-success border border-success/20 rounded-xl text-xs font-bold transition-all"
                  >
                    <CalendarCheck size={13} />
                    Renew
                  </button>
                  <button
                    onClick={() => router.push(`/superadmin/clients/${client.id}`)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-xl text-xs font-bold transition-all"
                  >
                    <Building2 size={13} />
                    Edit Org
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Renew Modal */}
      <Modal
        isOpen={renewModal.isOpen}
        onClose={() => setRenewModal({ ...renewModal, isOpen: false })}
        title="Renew Subscription"
        footer={
          <div className="flex gap-2">
            <button onClick={() => setRenewModal({ ...renewModal, isOpen: false })} className="btn-ghost px-6 py-2 rounded-xl border border-border">Cancel</button>
            <button onClick={handleRenew} disabled={!renewModal.newDate} className="btn-primary px-6 py-2 disabled:opacity-50">Renew Now</button>
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
              className="input w-full bg-card text-sm"
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
