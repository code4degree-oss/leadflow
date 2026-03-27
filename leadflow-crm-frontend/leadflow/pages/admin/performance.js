import Layout from '../../components/Layout'
import { StatCard, MiniAreaChart, MiniBarChart, SectionHeader, ProgressBar } from '../../components/UI'
import { BarChart2, TrendingUp, Phone, CheckCircle, Calendar, Download, Filter } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, Legend, CartesianGrid } from 'recharts'

const MONTHLY = []

const TEAM = []

const TOOLTIP_STYLE = {
  contentStyle: { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 },
  itemStyle: { color: 'var(--txt)' },
  labelStyle: { color: 'var(--txt2)' },
}

export default function Performance() {
  return (
    <Layout role="admin" pageTitle="Team Performance"
      actions={<button className="btn-ghost text-xs"><Download size={13}/>Export Report</button>}>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Calls Today"  value="212" sub="of 300 target"    trend={-8}  color="accent"  icon={Phone}       />
        <StatCard label="Leads Won (Month)"  value="48"  sub="₹3.4Cr pipeline"  trend={30}  color="green"   icon={TrendingUp}  />
        <StatCard label="Site Visits"        value="67"  sub="this month"        trend={22}  color="amber"   icon={Calendar}    />
        <StatCard label="Conversion Rate"    value="14%" sub="won / total leads" trend={4}   color="purple"  icon={BarChart2}   />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="card p-5 col-span-2">
          <SectionHeader title="Monthly Performance Trend" sub="Calls, won leads, and site visits" />
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={MONTHLY} margin={{ top: 5, right: 10, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--txt3)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--txt3)' }} axisLine={false} tickLine={false} />
              <Tooltip {...tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 11, color: 'var(--txt2)' }} />
              <Line type="monotone" dataKey="calls" stroke="var(--accent)" strokeWidth={2} dot={false} name="Calls" />
              <Line type="monotone" dataKey="won"   stroke="#10B981" strokeWidth={2} dot={false} name="Won" />
              <Line type="monotone" dataKey="visits" stroke="#F59E0B" strokeWidth={2} dot={false} name="Visits" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-5">
          <SectionHeader title="Today's Call Target" sub="Per agent progress" />
          <div className="space-y-4 mt-2">
            {TEAM.map(e => (
              <div key={e.name}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-medium text-txt truncate">{e.name.split(' ')[0]}</span>
                  <span className="text-xs font-mono text-txt2">{e.calls}/{e.target}</span>
                </div>
                <ProgressBar
                  value={e.calls} max={e.target}
                  color={e.calls/e.target >= 0.9 ? '#00D4AA' : e.calls/e.target >= 0.6 ? '#F5A623' : '#FF5A5A'}
                  height={5}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Team table */}
      <div className="card overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="section-title">Individual Performance — Today</h2>
          <div className="flex gap-2">
            <button className="btn-ghost text-xs"><Filter size={12}/>Date Range</button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-border bg-bg2/50">
              <tr>
                {['Employee','Calls / Target','Won','Lost','Site Visits','Login','Logout','Rate'].map(h => (
                  <th key={h} className="th">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TEAM.map((e, i) => (
                <tr key={i} className="table-row">
                  <td className="td">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-accent/10 flex items-center justify-center text-accent text-xs font-bold">
                        {e.name.split(' ').map(n=>n[0]).join('')}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-txt">{e.name}</div>
                        <div className="text-xs text-txt3 capitalize">{e.role}</div>
                      </div>
                    </div>
                  </td>
                  <td className="td">
                    <div className="flex items-center gap-2 w-32">
                      <span className="text-sm font-mono text-txt w-10">{e.calls}/{e.target}</span>
                      <ProgressBar value={e.calls} max={e.target}
                        color={e.calls/e.target>=0.9?'#00D4AA':e.calls/e.target>=0.6?'#F5A623':'#FF5A5A'} height={4}/>
                    </div>
                  </td>
                  <td className="td"><span className="text-accent2 font-mono font-medium">{e.won}</span></td>
                  <td className="td"><span className="text-danger font-mono">{e.lost}</span></td>
                  <td className="td"><span className="text-amber font-mono">{e.visits}</span></td>
                  <td className="td text-txt2 text-xs font-mono">{e.login}</td>
                  <td className="td text-txt2 text-xs font-mono">{e.logout || <span className="text-accent2 pulse-dot">online</span>}</td>
                  <td className="td">
                    <span className={`font-mono font-medium text-sm ${
                      parseInt(e.rate)>=90?'text-accent2':parseInt(e.rate)>=60?'text-amber':'text-danger'
                    }`}>{e.rate}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  )
}
