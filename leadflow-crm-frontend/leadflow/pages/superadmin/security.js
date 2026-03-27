import Layout from '../../components/Layout'
import { ShieldCheck, AlertTriangle, LogIn, XCircle, MapPin, Download, Filter } from 'lucide-react'
import clsx from 'clsx'

const SECURITY_LOG = []

const typeMap = {
  success: { color:'badge-green', icon:LogIn        },
  danger:  { color:'badge-red',   icon:XCircle      },
  warning: { color:'badge-amber', icon:AlertTriangle },
}

export default function Security() {
  return (
    <Layout role="superadmin" pageTitle="Security & Compliance"
      actions={<button className="btn-ghost text-xs"><Download size={13}/>Export Log</button>}>

      {/* Alert summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="card p-4 border-danger/20 bg-danger/5">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={14} className="text-danger" />
            <span className="text-xs text-danger font-medium uppercase tracking-wider">Threats</span>
          </div>
          <div className="font-display font-bold text-2xl text-danger">3</div>
          <div className="text-xs text-txt2 mt-1">geo-lock failures · failed logins</div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <LogIn size={14} className="text-accent" />
            <span className="text-xs text-txt2 font-medium uppercase tracking-wider">Active Sessions</span>
          </div>
          <div className="font-display font-bold text-2xl text-txt">47</div>
          <div className="text-xs text-txt2 mt-1">across all clients now</div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck size={14} className="text-accent2" />
            <span className="text-xs text-txt2 font-medium uppercase tracking-wider">Last Audit</span>
          </div>
          <div className="font-display font-bold text-2xl text-accent2">Clean</div>
          <div className="text-xs text-txt2 mt-1">no policy violations today</div>
        </div>
      </div>

      {/* IP Whitelist */}
      <div className="card p-5 mb-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="font-display font-bold text-sm text-txt">Super Admin IP Whitelist</h2>
            <p className="text-xs text-txt2 mt-0.5">Only these IPs can access the super admin panel</p>
          </div>
          <button className="btn-primary text-xs">+ Add IP</button>
        </div>
        <div className="space-y-2">
          {[
            { ip:'1.2.3.4',       label:'Office Gateway',   status:'active' },
            { ip:'5.6.7.8',       label:'VPN Exit Node',    status:'active' },
            { ip:'203.0.113.50',  label:'Home Office',      status:'active' },
          ].map((entry, i) => (
            <div key={i} className="flex items-center justify-between bg-bg3 rounded-lg px-3 py-2.5">
              <div className="flex items-center gap-3">
                <ShieldCheck size={13} className="text-accent2" />
                <span className="font-mono text-sm text-txt">{entry.ip}</span>
                <span className="text-xs text-txt3">{entry.label}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="badge badge-green">{entry.status}</span>
                <button className="text-danger text-xs hover:bg-danger/10 px-2 py-1 rounded transition-colors">Remove</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Security log */}
      <div className="card overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="font-display font-bold text-sm text-txt">Platform Security Log</h2>
          <button className="btn-ghost text-xs"><Filter size={12}/>Filter</button>
        </div>
        <table className="w-full">
          <thead className="border-b border-border bg-bg2/50">
            <tr>{['Event','User','Client','IP','Location','Time','Action'].map(h=><th key={h} className="th">{h}</th>)}</tr>
          </thead>
          <tbody>
            {SECURITY_LOG.map((row, i) => {
              const cfg = typeMap[row.type]
              const Icon = cfg.icon
              return (
                <tr key={i} className="table-row">
                  <td className="td">
                    <span className={clsx('badge', cfg.color)}>
                      <Icon size={10}/>{row.event}
                    </span>
                  </td>
                  <td className="td text-sm text-txt">{row.user}</td>
                  <td className="td text-xs text-txt2">{row.client}</td>
                  <td className="td text-xs font-mono text-txt3">{row.ip}</td>
                  <td className="td">
                    <div className="flex items-center gap-1 text-xs text-txt2">
                      <MapPin size={10}/>{row.location}
                    </div>
                  </td>
                  <td className="td text-xs font-mono text-txt3">{row.time}</td>
                  <td className="td">
                    {row.type === 'danger' && (
                      <button className="text-danger text-xs hover:bg-danger/10 px-2 py-1 rounded transition-colors">Force Logout</button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Layout>
  )
}
