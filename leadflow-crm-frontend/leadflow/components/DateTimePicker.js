import { useState, useRef, useEffect } from 'react'
import { Calendar, Clock, ChevronLeft, ChevronRight, X } from 'lucide-react'
import clsx from 'clsx'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const DAYS = ['Su','Mo','Tu','We','Th','Fr','Sa']

export default function DateTimePicker({ value, onChange, label, required, readOnly, hint, hintColor = 'text-txt3', accentColor = 'accent' }) {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState('calendar') // 'calendar' | 'time'
  const ref = useRef(null)

  // Parse value into parts
  const parsed = value ? new Date(value) : null
  const [year, setYear] = useState(parsed?.getFullYear() || new Date().getFullYear())
  const [month, setMonth] = useState(parsed?.getMonth() || new Date().getMonth())
  const [day, setDay] = useState(parsed?.getDate() || null)
  const [hour, setHour] = useState(parsed ? parsed.getHours() % 12 || 12 : 10)
  const [minute, setMinute] = useState(parsed?.getMinutes() || 0)
  const [ampm, setAmpm] = useState(parsed ? (parsed.getHours() >= 12 ? 'PM' : 'AM') : 'AM')

  // Sync from external value changes
  useEffect(() => {
    if (value) {
      const d = new Date(value)
      setYear(d.getFullYear())
      setMonth(d.getMonth())
      setDay(d.getDate())
      setHour(d.getHours() % 12 || 12)
      setMinute(d.getMinutes())
      setAmpm(d.getHours() >= 12 ? 'PM' : 'AM')
    }
  }, [value])

  // Close on outside click
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const emitChange = (y, m, d, h, min, ap) => {
    let h24 = h
    if (ap === 'PM' && h !== 12) h24 = h + 12
    if (ap === 'AM' && h === 12) h24 = 0
    const date = new Date(y, m, d, h24, min, 0, 0)
    const pad = n => String(n).padStart(2, '0')
    const formatted = `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
    onChange(formatted)
  }

  const selectDay = (d) => {
    setDay(d)
    emitChange(year, month, d, hour, minute, ampm)
    setView('time')
  }

  const changeHour = (h) => {
    setHour(h)
    emitChange(year, month, day, h, minute, ampm)
  }

  const changeMinute = (m) => {
    setMinute(m)
    emitChange(year, month, day, hour, m, ampm)
  }

  const toggleAmPm = () => {
    const newAp = ampm === 'AM' ? 'PM' : 'AM'
    setAmpm(newAp)
    emitChange(year, month, day, hour, minute, newAp)
  }

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(year - 1) }
    else setMonth(month - 1)
  }

  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(year + 1) }
    else setMonth(month + 1)
  }

  // Calendar grid
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const today = new Date()
  const isToday = (d) => today.getDate() === d && today.getMonth() === month && today.getFullYear() === year

  // Format display
  const displayValue = parsed
    ? `${parsed.getDate()} ${MONTHS[parsed.getMonth()]} ${parsed.getFullYear()}, ${hour}:${String(minute).padStart(2,'0')} ${ampm}`
    : ''

  return (
    <div ref={ref} className="relative">
      {label && (
        <label className="text-[10px] font-bold text-txt3 uppercase tracking-wider mb-2 flex items-center gap-2">
          <Calendar size={12} className={`text-${accentColor}`} />
          {label}
          {required && <span className="text-danger ml-auto text-[8px]">REQUIRED</span>}
        </label>
      )}

      {/* Trigger */}
      <button
        type="button"
        disabled={readOnly}
        onClick={() => !readOnly && setOpen(!open)}
        className={clsx(
          'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all text-sm',
          readOnly ? 'bg-amber/10 border-amber/20 cursor-not-allowed' :
          open ? `bg-${accentColor}/5 border-${accentColor}/30 shadow-md` :
          'bg-bg3 border-border hover:border-accent/30',
          !displayValue && 'text-txt3'
        )}
      >
        <div className="flex items-center gap-2 flex-1">
          {displayValue ? (
            <>
              <Calendar size={14} className="text-accent shrink-0" />
              <span className="text-sm font-medium text-txt">{displayValue}</span>
            </>
          ) : (
            <span className="text-sm text-txt3">Select date & time...</span>
          )}
        </div>
        {displayValue && !readOnly && (
          <button type="button" onClick={(e) => { e.stopPropagation(); onChange(''); setDay(null) }}
            className="p-0.5 hover:bg-bg3 rounded text-txt3">
            <X size={12} />
          </button>
        )}
      </button>

      {hint && <p className={`text-[9px] ${hintColor} mt-1 font-medium`}>{hint}</p>}

      {/* Popup */}
      {open && !readOnly && (
        <div className="absolute top-full left-0 mt-2 z-50 bg-card border border-border rounded-2xl shadow-2xl p-4 w-[300px] animate-in fade-in zoom-in-95">
          
          {/* View Toggle */}
          <div className="flex mb-3 bg-bg2/50 rounded-xl p-1 gap-1">
            <button type="button" onClick={() => setView('calendar')}
              className={clsx('flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all flex items-center justify-center gap-1.5',
                view === 'calendar' ? 'bg-accent text-white shadow-sm' : 'text-txt3 hover:text-txt')}>
              <Calendar size={11} /> Date
            </button>
            <button type="button" onClick={() => setView('time')}
              className={clsx('flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all flex items-center justify-center gap-1.5',
                view === 'time' ? 'bg-accent text-white shadow-sm' : 'text-txt3 hover:text-txt')}>
              <Clock size={11} /> Time
            </button>
          </div>

          {view === 'calendar' ? (
            <>
              {/* Month/Year Header */}
              <div className="flex items-center justify-between mb-3">
                <button type="button" onClick={prevMonth} className="p-1.5 hover:bg-bg3 rounded-lg text-txt3"><ChevronLeft size={14} /></button>
                <span className="text-sm font-bold text-txt">{MONTHS[month]} {year}</span>
                <button type="button" onClick={nextMonth} className="p-1.5 hover:bg-bg3 rounded-lg text-txt3"><ChevronRight size={14} /></button>
              </div>

              {/* Day Names */}
              <div className="grid grid-cols-7 gap-1 mb-1">
                {DAYS.map(d => (
                  <div key={d} className="text-center text-[9px] font-bold text-txt3 uppercase py-1">{d}</div>
                ))}
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: firstDay }).map((_, i) => <div key={`e-${i}`} />)}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const d = i + 1
                  const selected = d === day
                  const isPast = new Date(year, month, d) < new Date(today.getFullYear(), today.getMonth(), today.getDate())
                  return (
                    <button
                      key={d} type="button"
                      onClick={() => !isPast && selectDay(d)}
                      disabled={isPast}
                      className={clsx(
                        'w-full aspect-square rounded-lg text-xs font-medium transition-all flex items-center justify-center',
                        selected ? 'bg-accent text-white font-bold shadow-md shadow-accent/30' :
                        isToday(d) ? 'bg-accent/10 text-accent font-bold ring-1 ring-accent/30' :
                        isPast ? 'text-txt3/30 cursor-not-allowed' :
                        'text-txt hover:bg-bg2 hover:text-accent'
                      )}
                    >
                      {d}
                    </button>
                  )
                })}
              </div>
            </>
          ) : (
            /* TIME PICKER */
            <div className="space-y-4">
              {/* Hour Selector */}
              <div>
                <label className="text-[9px] font-bold text-txt3 uppercase mb-2 block">Hour</label>
                <div className="grid grid-cols-6 gap-1.5">
                  {[1,2,3,4,5,6,7,8,9,10,11,12].map(h => (
                    <button key={h} type="button" onClick={() => changeHour(h)}
                      className={clsx(
                        'py-2 rounded-lg text-xs font-bold transition-all',
                        hour === h ? 'bg-accent text-white shadow-md shadow-accent/30' : 'bg-bg2/50 text-txt2 hover:bg-accent/10 hover:text-accent'
                      )}>
                      {h}
                    </button>
                  ))}
                </div>
              </div>

              {/* Minute Selector */}
              <div>
                <label className="text-[9px] font-bold text-txt3 uppercase mb-2 block">Minute</label>
                <div className="grid grid-cols-6 gap-1.5">
                  {[0,5,10,15,20,25,30,35,40,45,50,55].map(m => (
                    <button key={m} type="button" onClick={() => changeMinute(m)}
                      className={clsx(
                        'py-2 rounded-lg text-xs font-bold transition-all',
                        minute === m ? 'bg-accent text-white shadow-md shadow-accent/30' : 'bg-bg2/50 text-txt2 hover:bg-accent/10 hover:text-accent'
                      )}>
                      {String(m).padStart(2,'0')}
                    </button>
                  ))}
                </div>
              </div>

              {/* AM/PM Toggle */}
              <div>
                <label className="text-[9px] font-bold text-txt3 uppercase mb-2 block">Period</label>
                <div className="flex gap-2">
                  <button type="button" onClick={() => { setAmpm('AM'); emitChange(year, month, day, hour, minute, 'AM') }}
                    className={clsx('flex-1 py-2.5 rounded-xl text-sm font-bold transition-all',
                      ampm === 'AM' ? 'bg-accent text-white shadow-md shadow-accent/30' : 'bg-bg2/50 text-txt2 hover:bg-accent/10')}>
                    AM
                  </button>
                  <button type="button" onClick={() => { setAmpm('PM'); emitChange(year, month, day, hour, minute, 'PM') }}
                    className={clsx('flex-1 py-2.5 rounded-xl text-sm font-bold transition-all',
                      ampm === 'PM' ? 'bg-accent text-white shadow-md shadow-accent/30' : 'bg-bg2/50 text-txt2 hover:bg-accent/10')}>
                    PM
                  </button>
                </div>
              </div>

              {/* Done button */}
              <button type="button" onClick={() => setOpen(false)}
                className="w-full py-2.5 bg-accent text-white rounded-xl text-sm font-bold shadow-md shadow-accent/20 hover:opacity-90 transition-all">
                Done
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
