import { useState, useEffect } from 'react'
import { X, User, Phone, Mail, DollarSign, MapPin, FileText, Smartphone, Flame } from 'lucide-react'
import { fetchWithAuth } from '../utils/api'
import clsx from 'clsx'

export default function AddLeadModal({ isOpen, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    email: '',
    budget: '',
    area: '',
    notes: '',
    is_whatsapp: false,
    is_hot: false,
    assigned_to_id: ''
  })
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (!isOpen) return null

  useEffect(() => {
    if (isOpen) {
      fetchWithAuth('/accounts/employees/')
        .then(data => {
          const empList = data.results || data || []
          setEmployees(empList.filter(e => ['TELECALLER', 'FIELD_AGENT', 'MANAGER'].includes(e.role)))
        })
        .catch(err => console.error('Failed to load employees:', err))
    }
  }, [isOpen])

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await fetchWithAuth('/leads/quick-add/', {
        method: 'POST',
        body: JSON.stringify(formData)
      })
      if (onSuccess) onSuccess()
      onClose()
    } catch (err) {
      setError(err.message || 'Failed to add lead')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div 
        className="bg-card w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-border bg-bg2/50">
          <div>
            <h2 className="text-lg font-bold text-txt">Add Lead Manually</h2>
            <p className="text-xs text-txt3 mt-0.5">Enter details and optionally assign immediately.</p>
          </div>
          <button onClick={onClose} className="p-2 text-txt3 hover:text-txt hover:bg-bg3 rounded-xl transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5">
          {error && (
            <div className="mb-4 p-3 bg-danger/10 border border-danger/20 text-danger text-sm rounded-xl font-medium">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold text-txt3 uppercase tracking-wider mb-1.5 block flex items-center gap-1.5">
                  <User size={12} /> First Name *
                </label>
                <input required type="text" name="first_name" value={formData.first_name} onChange={handleChange} className="input w-full bg-bg3 text-sm" placeholder="John" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-txt3 uppercase tracking-wider mb-1.5 block flex items-center gap-1.5">
                  <User size={12} /> Last Name
                </label>
                <input type="text" name="last_name" value={formData.last_name} onChange={handleChange} className="input w-full bg-bg3 text-sm" placeholder="Doe" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold text-txt3 uppercase tracking-wider mb-1.5 block flex items-center gap-1.5">
                  <Phone size={12} /> Phone *
                </label>
                <input required type="tel" name="phone" value={formData.phone} onChange={handleChange} className="input w-full bg-bg3 text-sm" placeholder="+91 9876543210" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-txt3 uppercase tracking-wider mb-1.5 block flex items-center gap-1.5">
                  <Mail size={12} /> Email
                </label>
                <input type="email" name="email" value={formData.email} onChange={handleChange} className="input w-full bg-bg3 text-sm" placeholder="john@example.com" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold text-txt3 uppercase tracking-wider mb-1.5 block flex items-center gap-1.5">
                  <DollarSign size={12} /> Budget (₹)
                </label>
                <input type="number" name="budget" value={formData.budget} onChange={handleChange} className="input w-full bg-bg3 text-sm" placeholder="e.g. 5000000" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-txt3 uppercase tracking-wider mb-1.5 block flex items-center gap-1.5">
                  <MapPin size={12} /> Location / Area
                </label>
                <input type="text" name="area" value={formData.area} onChange={handleChange} className="input w-full bg-bg3 text-sm" placeholder="e.g. Baner, Pune" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold text-txt3 uppercase tracking-wider mb-1.5 block flex items-center gap-1.5">
                  <User size={12} /> Assign To (Optional)
                </label>
                <select name="assigned_to_id" value={formData.assigned_to_id} onChange={handleChange} className="input w-full bg-bg3 text-sm">
                  <option value="">Leave Unassigned (Queue)</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.first_name} {emp.last_name} ({emp.role.replace('_', ' ')})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-txt3 uppercase tracking-wider mb-1.5 block flex items-center gap-1.5">
                <FileText size={12} /> Notes / Inquiry Details
              </label>
              <textarea name="notes" value={formData.notes} onChange={handleChange} className="input w-full bg-bg3 text-sm min-h-[80px] resize-none" placeholder="Add any details from WhatsApp or the inquiry..."></textarea>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3 p-3 bg-[#25D366]/5 border border-[#25D366]/20 rounded-xl">
                <input type="checkbox" id="is_whatsapp" name="is_whatsapp" checked={formData.is_whatsapp} onChange={handleChange} className="w-4 h-4 rounded border-border text-[#25D366] focus:ring-[#25D366]" />
                <label htmlFor="is_whatsapp" className="text-sm font-medium text-txt cursor-pointer flex items-center gap-1.5">
                  <Smartphone size={14} className="text-[#25D366]" /> Source is WhatsApp message
                </label>
              </div>

              <div className="flex items-center gap-3 p-3 bg-[#F43F5E]/5 border border-[#F43F5E]/20 rounded-xl">
                <input type="checkbox" id="is_hot" name="is_hot" checked={formData.is_hot} onChange={handleChange} className="w-4 h-4 rounded border-border text-[#F43F5E] focus:ring-[#F43F5E]" />
                <label htmlFor="is_hot" className="text-sm font-medium text-txt cursor-pointer flex items-center gap-1.5">
                  <Flame size={14} className="text-[#F43F5E]" /> Mark as High-Priority (Hot Lead)
                </label>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl text-sm font-bold text-txt3 hover:text-txt hover:bg-bg3 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn-primary shadow-lg shadow-accent/20 flex items-center gap-2">
              {loading ? 'Adding...' : 'Add Lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
