import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getActiveDates } from '../api/client'

const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const MONTHS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']

function formatDayLabel(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('fr-MA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

export default function DeliveryCalendar({
  value,
  onChange,
  label = 'Date',
  queryFn,         // optional: override active-dates fetcher
  queryKey,        // optional: override query key prefix
  dotColor = '#3b82f6',   // blue for deliveries, orange for purchases
  dotBg,           // highlight bg for days with activity
  legendLabel,     // legend text
}) {
  const today = new Date()
  const [open, setOpen] = useState(false)
  const [viewYear, setViewYear]   = useState(value ? parseInt(value.split('-')[0]) : today.getFullYear())
  const [viewMonth, setViewMonth] = useState(value ? parseInt(value.split('-')[1]) - 1 : today.getMonth())

  const activeFn  = queryFn  || getActiveDates
  const activeKey = queryKey || 'active-dates'
  const activeBg  = dotBg   || '#eff6ff'
  const legend    = legendLabel || 'Has deliveries'

  const { data: activeDays = [] } = useQuery({
    queryKey: [activeKey, viewYear, viewMonth + 1],
    queryFn: () => activeFn(viewYear, viewMonth + 1),
  })

  const firstDay = new Date(viewYear, viewMonth, 1)
  const startOffset = (firstDay.getDay() + 6) % 7
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()

  const cells = []
  for (let i = 0; i < startOffset; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  const select = (day) => {
    const mm = String(viewMonth + 1).padStart(2, '0')
    const dd = String(day).padStart(2, '0')
    onChange(`${viewYear}-${mm}-${dd}`)
    setOpen(false)
  }

  const isSelected = (day) => {
    if (!value || !day) return false
    const mm = String(viewMonth + 1).padStart(2, '0')
    const dd = String(day).padStart(2, '0')
    return value === `${viewYear}-${mm}-${dd}`
  }

  const isToday = (day) =>
    day === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear()

  const hasActivity = (day) => activeDays.includes(day)

  return (
    <div style={{ position: 'relative' }}>
      {label && <label className="label">{label}</label>}

      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="input text-left flex items-center justify-between gap-2"
        style={{ cursor: 'pointer' }}
      >
        <span style={{ color: value ? 'var(--text)' : 'var(--text-muted)', fontSize: '14px' }}>
          {value ? value : 'Pick a date'}
        </span>
        <span style={{ fontSize: '16px' }}>📅</span>
      </button>
      {value && (
        <p className="text-xs text-gray-400 mt-1 capitalize">{formatDayLabel(value)}</p>
      )}

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />

          <div style={{
            position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 50,
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: '12px', padding: '16px', width: '280px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)'
          }}>

            {/* Month navigation */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <button onClick={prevMonth} className="btn-ghost" style={{ padding: '4px 10px', fontSize: '16px' }}>‹</button>
              <span style={{ fontSize: '14px', fontWeight: 600 }}>{MONTHS[viewMonth]} {viewYear}</span>
              <button onClick={nextMonth} className="btn-ghost" style={{ padding: '4px 10px', fontSize: '16px' }}>›</button>
            </div>

            {/* Legend */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '10px', fontSize: '11px', color: 'var(--text-muted)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: dotColor, display: 'inline-block' }} />
                {legend}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#111827', display: 'inline-block' }} />
                Selected
              </span>
            </div>

            {/* Day headers */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', marginBottom: '4px' }}>
              {DAYS.map(d => (
                <div key={d} style={{ textAlign: 'center', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', padding: '4px 0' }}>{d}</div>
              ))}
            </div>

            {/* Day cells */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
              {cells.map((day, i) => {
                if (!day) return <div key={`empty-${i}`} />
                const selected = isSelected(day)
                const todayDay = isToday(day)
                const active   = hasActivity(day)

                return (
                  <button
                    key={day}
                    onClick={() => select(day)}
                    style={{
                      position: 'relative',
                      padding: '6px 0',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: selected ? 700 : todayDay ? 600 : 400,
                      border: todayDay && !selected ? `1.5px solid ${dotColor}` : '1.5px solid transparent',
                      background: selected ? '#111827' : active ? activeBg : 'transparent',
                      color: selected ? 'white' : todayDay ? dotColor : 'var(--text)',
                      cursor: 'pointer',
                      transition: 'all 0.1s',
                    }}
                    onMouseEnter={e => { if (!selected) e.currentTarget.style.background = 'var(--bg)' }}
                    onMouseLeave={e => { if (!selected) e.currentTarget.style.background = active ? activeBg : 'transparent' }}
                  >
                    {day}
                    {active && (
                      <span style={{
                        position: 'absolute', bottom: '2px', left: '50%', transform: 'translateX(-50%)',
                        width: '4px', height: '4px', borderRadius: '50%',
                        background: selected ? 'white' : dotColor, display: 'block'
                      }} />
                    )}
                  </button>
                )
              })}
            </div>

            {/* Today shortcut */}
            <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--border)', textAlign: 'center' }}>
              <button
                onClick={() => {
                  const td = today.toISOString().split('T')[0]
                  onChange(td)
                  setViewYear(today.getFullYear())
                  setViewMonth(today.getMonth())
                  setOpen(false)
                }}
                className="btn-ghost"
                style={{ fontSize: '12px', padding: '4px 14px' }}
              >
                Today
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}