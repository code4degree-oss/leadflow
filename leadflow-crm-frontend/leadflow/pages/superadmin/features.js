import { useState, useEffect } from 'react'
import Layout from '../../components/Layout'
import { fetchWithAuth } from '../../utils/api'
import { Globe, MapPin, Building2, Search, CheckCircle2, ShieldAlert } from 'lucide-react'
import clsx from 'clsx'

export default function FeatureFlags() {
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [toggling, setToggling] = useState(null) // holds client ID being toggled

  const fetchClients = async () => {
    try {
      const data = await fetchWithAuth('/superadmin/clients/clients/')
      setClients(Array.isArray(data) ? data : (data?.results || []))
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchClients()
  }, [])

  const handleToggleGeofencing = async (client) => {
    setToggling(client.id)
    try {
      const updated = await fetchWithAuth(`/superadmin/clients/clients/${client.id}/`, {
        method: 'PATCH',
        // Toggle the current state
        body: JSON.stringify({ geofencing_enabled: !client.geofencing_enabled }),
      })
      
      // Update local state
      setClients(clients.map(c => c.id === client.id ? { ...c, geofencing_enabled: updated.geofencing_enabled } : c))
    } catch (err) {
      console.error("Failed to toggle geofencing", err)
      alert("Failed to update feature flag: " + err.message)
    } finally {
      setToggling(null)
    }
  }

  const filteredClients = (Array.isArray(clients) ? clients : []).filter(c => 
    c.name?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <Layout role="superadmin" pageTitle="Feature Flags">
      <div className="flex flex-col gap-6 max-w-5xl">
        
        {/* Header Section */}
        <div className="card p-6 border-l-4 border-l-purple flex items-start justify-between bg-bg2/40 shadow-sm relative overflow-hidden">
           <div className="absolute -right-4 -bottom-4 opacity-5 text-purple pointer-events-none">
              <Globe size={180} />
           </div>
           <div className="max-w-xl">
              <h2 className="text-lg font-bold font-display text-txt flex items-center gap-2">
                  <Globe size={18} className="text-purple"/> Global Feature Operations
              </h2>
              <p className="text-sm text-txt2 mt-2 leading-relaxed">
                  Control early-access features, security modules, and beta programs across your tenant organizations. High-impact security features like Geofencing enforce GPS-verified restrictions immediately when toggled on.
              </p>
           </div>
        </div>

        {/* Filters */}
        <div className="flex justify-between items-center bg-card p-3 rounded-2xl shadow-sm border border-border">
          <div className="relative w-80">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-txt3" />
            <input 
              type="text" 
              placeholder="Search organizations..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-10 w-full bg-bg/50 border-none focus:bg-bg"
            />
          </div>
        </div>

        {/* Feature Matrix / Client List */}
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-bg/50 border-b border-border">
                  <th className="px-6 py-4 text-[10px] font-bold text-txt3 uppercase tracking-wider">Organization</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-txt3 uppercase tracking-wider text-center">Location Geofencing</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-txt3 uppercase tracking-wider text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="3" className="px-6 py-8 text-center text-txt3 animate-pulse">Loading directory...</td></tr>
                ) : filteredClients.map((client) => (
                  <tr key={client.id} className="border-b border-border hover:bg-bg/40 transition-colors">
                    
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-purple/10 flex items-center justify-center text-purple">
                          <Building2 size={18} />
                        </div>
                        <div>
                          <div className="font-bold text-txt">{client.name}</div>
                          <div className="text-xs text-txt3 font-mono mt-0.5">{client.id.split('-')[0]}</div>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex flex-col items-center justify-center gap-2">
                         <button 
                           onClick={() => handleToggleGeofencing(client)}
                           disabled={toggling === client.id}
                           className={clsx(
                             "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-purple focus:ring-offset-2 focus:ring-offset-bg",
                             client.geofencing_enabled ? "bg-success" : "bg-border",
                             toggling === client.id && "opacity-50 cursor-wait"
                           )}
                         >
                            <span 
                              className={clsx(
                                "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                                client.geofencing_enabled ? "translate-x-6" : "translate-x-1"
                              )} 
                            />
                         </button>
                         {client.geofencing_enabled ? (
                            <span className="text-[10px] font-bold text-success uppercase tracking-widest flex items-center gap-1">
                               <ShieldAlert size={10}/> Enforced
                            </span>
                         ) : (
                            <span className="text-[10px] font-bold text-txt3 uppercase tracking-widest flex items-center gap-1">
                               <MapPin size={10}/> Global
                            </span>
                         )}
                      </div>
                    </td>

                    <td className="px-6 py-4 text-right">
                       <span className={clsx(
                         "px-2.5 py-1 text-xs font-bold rounded-lg uppercase tracking-wider border",
                         client.is_active ? "bg-success/10 text-success border-success/20" : "bg-danger/10 text-danger border-danger/20"
                       )}>
                         {client.is_active ? 'Active' : 'Suspended'}
                       </span>
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!loading && filteredClients.length === 0 && (
             <div className="p-12 text-center text-txt3 flex flex-col items-center justify-center">
                 <Building2 size={40} className="mb-4 opacity-20"/>
                 <p>No client organizations found matching your search.</p>
             </div>
          )}
        </div>

      </div>
    </Layout>
  )
}
