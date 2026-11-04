import { useState, useEffect, useRef } from 'react'
import DeliveryCalendar from './DeliveryCalendar'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { getDeliveries, createDelivery, updateDelivery, deleteDelivery, getClients } from '../api/client'
import { exportDeliveries } from '../utils/exportExcel'

const UNITS = ['kg', 'pcs', 'bag', 'litre', 'box']
const PAGE_SIZE = 20

const CLIENT_COLORS = [
  { bg: '#EEF2FF', border: '#C7D2FE', text: '#3730A3', badge: '#818CF8' },
  { bg: '#EEF2FF', border: '#C7D2FE', text: '#3730A3', badge: '#818CF8' },
  { bg: '#EEF2FF', border: '#C7D2FE', text: '#3730A3', badge: '#818CF8' },
  { bg: '#EEF2FF', border: '#C7D2FE', text: '#3730A3', badge: '#818CF8' },
  { bg: '#EEF2FF', border: '#C7D2FE', text: '#3730A3', badge: '#818CF8' },
  { bg: '#EEF2FF', border: '#C7D2FE', text: '#3730A3', badge: '#818CF8' },
  { bg: '#EEF2FF', border: '#C7D2FE', text: '#3730A3', badge: '#818CF8' },
  { bg: '#EEF2FF', border: '#C7D2FE', text: '#3730A3', badge: '#818CF8' },
]

const EMPTY_ITEM = { product: '', quantity: '', unit: 'bag', unit_price: '' }
const EMPTY_FORM = {
  date: '',   // optional — empty means no date
  client: '', address: '', notes: '',
  items: [{ ...EMPTY_ITEM }]
}

function UnitPicker({ value, onChange }) {
  return (
    <div className="flex gap-1 flex-wrap">
      {UNITS.map(u => (
        <button key={u} type="button" onClick={() => onChange(u)}
          className="px-2 py-0.5 rounded text-xs font-medium border transition-all"
          style={{
            background: value === u ? '#111827' : 'var(--bg)',
            color: value === u ? 'white' : 'var(--text-muted)',
            borderColor: value === u ? '#111827' : 'var(--border)',
          }}>
          {u}
        </button>
      ))}
    </div>
  )
}

function formatDayLabel(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('fr-MA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

// ── Product Autocomplete ───────────────────────────────────────────────────────
function ProductInput({ value, onChange, onSelect, suggestions }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  const filtered = value.trim() === ''
    ? suggestions.slice(0, 8)
    : suggestions.filter(s => s.product.toLowerCase().includes(value.toLowerCase())).slice(0, 8)

  useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  return (
    <div ref={ref} style={{ position: 'relative', flex: 1 }}>
      <input
        className="input"
        placeholder="ex. Bac Chocolat 4kg"
        value={value}
        autoComplete="off"
        onChange={e => { onChange(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
      />
      {open && filtered.length > 0 && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 200,
          background: 'var(--surface)', border: '1px solid #C7D2FE',
          borderRadius: 10, boxShadow: '0 8px 24px rgba(99,102,241,0.10)',
          overflow: 'hidden',
        }}>
          {filtered.map((s, i) => (
            <button
              key={i}
              type="button"
              onMouseDown={e => { e.preventDefault(); onSelect(s); setOpen(false) }}
              style={{
                width: '100%', display: 'flex', alignItems: 'center',
                justifyContent: 'space-between', padding: '8px 12px',
                background: 'transparent', border: 'none', cursor: 'pointer',
                borderBottom: i < filtered.length - 1 ? '1px solid #EEF2FF' : 'none',
                textAlign: 'left',
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#EEF2FF'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{s.product}</p>
                <p style={{ fontSize: 11, color: '#818CF8', marginTop: 1 }}>
                  {s.unit}
                  {s.unit_price > 0 ? ` · ${s.unit_price.toFixed(2)} DH` : ''}
                  {s.client ? ` · ${s.client}` : ''}
                </p>
              </div>
              <span style={{
                fontSize: 10, padding: '2px 8px', borderRadius: 6, flexShrink: 0,
                background: '#EEF2FF', color: '#3730A3', fontWeight: 700, marginLeft: 8,
              }}>↵ remplir</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Inline edit row ────────────────────────────────────────────────────────────
function EditRow({ delivery, onSave, onCancel }) {
  const [form, setForm] = useState({
    product: delivery.product,
    quantity: delivery.quantity,
    unit: delivery.unit,
    unit_price: delivery.unit_price,
    notes: delivery.notes || '',
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <tr style={{ background: '#FFFBEB' }}>
      <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', borderRight: '1px solid var(--border)' }}>
        <input className="input" value={form.product} onChange={e => set('product', e.target.value)} placeholder="Produit" style={{ marginBottom: 6 }} />
        <input className="input" value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Notes (optionnel)" style={{ fontSize: 12 }} />
      </td>
      <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', borderRight: '1px solid var(--border)', textAlign: 'right' }}>
        <input className="input" type="number" value={form.quantity} onChange={e => set('quantity', e.target.value)} style={{ textAlign: 'right', width: 80 }} />
      </td>
      <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', borderRight: '1px solid var(--border)' }}>
        <UnitPicker value={form.unit} onChange={v => set('unit', v)} />
      </td>
      <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', borderRight: '1px solid var(--border)', textAlign: 'right' }}>
        <input className="input" type="number" step="0.01" value={form.unit_price} onChange={e => set('unit_price', e.target.value)} style={{ textAlign: 'right', width: 90 }} />
      </td>
      <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', textAlign: 'right', fontWeight: 700, color: '#059669' }}>
        {(parseFloat(form.quantity || 0) * parseFloat(form.unit_price || 0)).toFixed(2)}
      </td>
      <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border)', textAlign: 'right' }}>
        <div className="flex gap-1 justify-end">
          <button className="btn-primary" style={{ fontSize: 13, padding: '5px 12px' }}
            onClick={() => onSave({ ...delivery, product: form.product, quantity: parseFloat(form.quantity) || 0, unit: form.unit, unit_price: parseFloat(form.unit_price) || 0, notes: form.notes })}>✓</button>
          <button className="btn-ghost" style={{ fontSize: 13, padding: '5px 12px' }} onClick={onCancel}>✕</button>
        </div>
      </td>
    </tr>
  )
}

// ── Client Summary Card ────────────────────────────────────────────────────────
function ClientSummaryCard({ deliveries }) {
  const clientMap = {}
  deliveries.forEach(d => {
    if (!clientMap[d.client]) clientMap[d.client] = { total: 0, count: 0, items: [] }
    clientMap[d.client].total += d.total
    clientMap[d.client].count += 1
    clientMap[d.client].items.push(d)
  })
  const sorted = Object.entries(clientMap).sort((a, b) => b[1].total - a[1].total)
  const [selectedClient, setSelectedClient] = useState(sorted[0]?.[0] || '')

  useEffect(() => {
    setSelectedClient(sorted[0]?.[0] || '')
  }, [deliveries.length, sorted[0]?.[0]])

  const selected = selectedClient ? clientMap[selectedClient] : null

  return (
    <div className="card mb-4" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '14px 18px 10px', borderBottom: '1px solid var(--border)' }}>
        <p style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
          Résumé par Client
        </p>
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', padding: '14px 18px' }}>
        {sorted.map(([name, data], idx) => {
          const palette = CLIENT_COLORS[idx % CLIENT_COLORS.length]
          const isActive = selectedClient === name
          return (
            <button key={name}
              onClick={() => setSelectedClient(prev => prev === name ? '' : name)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4,
                padding: '10px 14px', borderRadius: 12,
                border: `2px solid ${isActive ? palette.border : 'transparent'}`,
                background: isActive ? palette.bg : 'var(--bg)',
                cursor: 'pointer', transition: 'all 0.18s', minWidth: 120,
                boxShadow: isActive ? `0 2px 8px ${palette.badge}33` : 'none',
              }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: palette.badge, display: 'inline-block', flexShrink: 0 }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: isActive ? palette.text : 'var(--text)' }}>{name}</span>
              </div>
              <span style={{ fontSize: 15, fontWeight: 800, color: isActive ? palette.text : 'var(--text)', letterSpacing: '-0.02em' }}>
                {data.total.toFixed(2)} <span style={{ fontSize: 11, fontWeight: 500, opacity: 0.7 }}>DH</span>
              </span>
              <span style={{ fontSize: 11, color: isActive ? palette.text : 'var(--text-muted)', opacity: 0.8 }}>
                {data.count} ligne{data.count !== 1 ? 's' : ''}
              </span>
            </button>
          )
        })}
      </div>
      {selected && (() => {
        const idx = sorted.findIndex(([n]) => n === selectedClient)
        const palette = CLIENT_COLORS[idx % CLIENT_COLORS.length]
        return (
          <div style={{ borderTop: `2px solid ${palette.border}`, background: palette.bg, padding: '14px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: palette.badge, display: 'inline-block' }} />
                <span style={{ fontSize: 15, fontWeight: 800, color: palette.text }}>{selectedClient}</span>
              </div>
              <span style={{ fontSize: 14, fontWeight: 700, color: palette.text }}>
                {selected.total.toFixed(2)} DH
                <span style={{ fontSize: 11, fontWeight: 400, marginLeft: 6, opacity: 0.7 }}>({selected.count} lignes)</span>
              </span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${palette.border}` }}>
                  {['Date', 'Produit', 'Qté', 'Total'].map((h, i) => (
                    <th key={h} style={{ textAlign: i >= 2 ? 'right' : 'left', padding: '4px 8px', color: palette.text, opacity: 0.7, fontWeight: 600, textTransform: 'uppercase', fontSize: 10, letterSpacing: '0.05em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {selected.items.map(d => (
                  <tr key={d.id} style={{ borderBottom: `1px solid ${palette.border}` }}>
                    <td style={{ padding: '6px 8px', color: palette.text, opacity: 0.75 }}>{d.date || '—'}</td>
                    <td style={{ padding: '6px 8px', color: palette.text, fontWeight: 500 }}>{d.product}</td>
                    <td style={{ padding: '6px 8px', color: palette.text, textAlign: 'right' }}>{d.quantity} {d.unit}</td>
                    <td style={{ padding: '6px 8px', color: palette.text, textAlign: 'right', fontWeight: 700 }}>{d.total.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      })()}
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function Deliveries() {
  const qc = useQueryClient()
  const [form, setForm] = useState(EMPTY_FORM)
  const [selectedDay, setSelectedDay] = useState(new Date().toISOString().split('T')[0])
  const [openClient, setOpenClient] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [page, setPage] = useState(1)

  const { data: rawDeliveries, isLoading } = useQuery({
    queryKey: ['deliveries', selectedDay],
    queryFn: () => getDeliveries(selectedDay),
  })

  // Fetch all deliveries for autocomplete suggestions
  const { data: rawAllDeliveries } = useQuery({
    queryKey: ['deliveries-all'],
    queryFn: () => getDeliveries(''),
    staleTime: 5 * 60 * 1000,
  })

  const { data: rawClients } = useQuery({ queryKey: ['clients'], queryFn: getClients })

  const deliveries = Array.isArray(rawDeliveries) ? rawDeliveries : []
  const allDeliveries = Array.isArray(rawAllDeliveries) ? rawAllDeliveries : []
  const clients = Array.isArray(rawClients) ? rawClients : []

  // Deduplicated product suggestions from history, most recent first
  const productSuggestions = (() => {
    const seen = new Set()
    const list = []
    ;[...allDeliveries].reverse().forEach(d => {
      const key = d.product.trim().toLowerCase()
      if (!seen.has(key)) {
        seen.add(key)
        list.push({ product: d.product, unit: d.unit, unit_price: d.unit_price, client: d.client })
      }
    })
    return list
  })()

  useEffect(() => {
    setOpenClient(null)
    setPage(1)
    setEditingId(null)
  }, [selectedDay])

  useEffect(() => {
    if (deliveries.length > 0 && openClient === null) {
      setOpenClient(deliveries[0]?.client || null)
    }
  }, [deliveries.length])

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['deliveries'] })
    qc.invalidateQueries({ queryKey: ['deliveries-all'] })
    qc.invalidateQueries({ queryKey: ['dashboard'] })
  }

  const createMut = useMutation({
    mutationFn: (rows) => Promise.all(rows.map(r => createDelivery(r))),
    onSuccess: () => { invalidate(); setForm(EMPTY_FORM); toast.success('Livraison enregistrée !') },
    onError: () => toast.error('Échec de l\'enregistrement'),
  })

  const updateMut = useMutation({
    mutationFn: (d) => updateDelivery(d.id, {
      date: d.date || null, client: d.client, address: d.address,
      product: d.product, quantity: d.quantity, unit: d.unit,
      unit_price: d.unit_price, notes: d.notes,
    }),
    onSuccess: () => { invalidate(); setEditingId(null); toast.success('Mis à jour !') },
    onError: () => toast.error('Échec de la mise à jour'),
  })

  const deleteMut = useMutation({
    mutationFn: deleteDelivery,
    onSuccess: () => { invalidate(); toast.success('Supprimé') },
  })

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const setItem = (i, k, v) => setForm(f => {
    const items = [...f.items]
    items[i] = { ...items[i], [k]: v }
    return { ...f, items }
  })

  // Fill product row from autocomplete suggestion
  const fillItem = (i, s) => setForm(f => {
    const items = [...f.items]
    items[i] = {
      ...items[i],
      product: s.product,
      unit: s.unit,
      unit_price: s.unit_price > 0 ? s.unit_price : items[i].unit_price,
    }
    return { ...f, items }
  })

  const addItem = () => setForm(f => ({ ...f, items: [...f.items, { ...EMPTY_ITEM }] }))
  const removeItem = (i) => setForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }))

  const selectClient = (name) => {
    const c = clients.find(c => c.name === name)
    setForm(f => ({ ...f, client: name, address: c?.address || '' }))
  }

  const submit = () => {
    if (!form.client) return toast.error('Veuillez sélectionner un client')
    const validItems = form.items.filter(it => it.product.trim())
    if (!validItems.length) return toast.error('Ajoutez au moins un produit')
    const rows = validItems.map(it => ({
      date: form.date || null,   // null when no date selected
      client: form.client, address: form.address,
      product: it.product.trim(), quantity: parseFloat(it.quantity) || 0,
      unit: it.unit, unit_price: parseFloat(it.unit_price) || 0, notes: form.notes,
    }))
    createMut.mutate(rows)
  }

  const changeDay = (offset) => {
    const d = new Date(selectedDay + 'T12:00:00')
    d.setDate(d.getDate() + offset)
    setSelectedDay(d.toISOString().split('T')[0])
  }

  const isToday = selectedDay === new Date().toISOString().split('T')[0]

  const byClient = {}
  deliveries.forEach(d => {
    if (!byClient[d.client]) byClient[d.client] = []
    byClient[d.client].push(d)
  })

  const totalValue = deliveries.reduce((s, d) => s + d.total, 0)
  const uniqueClients = Object.keys(byClient).length
  const allClientEntries = Object.entries(byClient)

  const needsPagination = deliveries.length > PAGE_SIZE
  const totalPages = Math.ceil(deliveries.length / PAGE_SIZE)
  let pagedEntries = allClientEntries
  if (needsPagination) {
    const start = (page - 1) * PAGE_SIZE
    const end = start + PAGE_SIZE
    const sliced = deliveries.slice(start, end)
    const pagedMap = {}
    sliced.forEach(d => {
      if (!pagedMap[d.client]) pagedMap[d.client] = []
      pagedMap[d.client].push(d)
    })
    pagedEntries = Object.entries(pagedMap)
  }

  const clientColorMap = {}
  allClientEntries.forEach(([name], idx) => {
    clientColorMap[name] = CLIENT_COLORS[idx % CLIENT_COLORS.length]
  })

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div className="flex items-center justify-between mb-1">
                <h2 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--text)', lineHeight: 1.1 }}>Livraisons</h2>
                <button className="btn-ghost text-xs px-3 py-1.5"
                  onClick={() => exportDeliveries(selectedDay)}
                  title="Exporter les livraisons vers Excel">
                  📥 Exporter Excel
                </button>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>Enregistrez les livraisons — plusieurs produits par client par jour.</p>
      </div>

      {/* Day selector */}
      <div className="card flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <button className="btn-ghost px-2 py-1" onClick={() => changeDay(-1)}>←</button>
          <DeliveryCalendar value={selectedDay} onChange={v => setSelectedDay(v)} label="" />
          <button className="btn-ghost px-2 py-1" onClick={() => changeDay(1)} disabled={isToday}>→</button>
        </div>
        <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{formatDayLabel(selectedDay)}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="stat-card">
          <p className="text-xs text-gray-400 mb-1">Livraisons</p>
          <p style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em' }}>{deliveries.length}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-gray-400 mb-1">Valeur totale</p>
          <p style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em' }}>{totalValue.toFixed(2)}<span className="text-sm text-gray-400 ml-1">DH</span></p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-gray-400 mb-1">Clients</p>
          <p style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em' }}>{uniqueClients}</p>
        </div>
      </div>

      {deliveries.length > 0 && <ClientSummaryCard deliveries={deliveries} />}

      {/* Add form */}
      <div className="card mb-4">
        <p style={{ fontSize: 15, fontWeight: 700, marginBottom: 14, letterSpacing: '-0.01em' }}>＋ Nouvelle livraison</p>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <label className="label" style={{ margin: 0 }}>Date <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 400 }}>(optionnel)</span></label>
              {form.date && (
                <button
                  type="button"
                  onClick={() => setField('date', '')}
                  style={{ fontSize: 10, color: '#EF4444', background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px' }}
                >
                  ✕ effacer
                </button>
              )}
            </div>
            <DeliveryCalendar value={form.date} onChange={v => setField('date', v)} label="" />
            {!form.date && (
              <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3, fontStyle: 'italic' }}>Aucune date sélectionnée</p>
            )}
          </div>
          <div>
            <label className="label">Client</label>
            <select className="input" value={form.client} onChange={e => selectClient(e.target.value)}>
              <option value="">— choisir client —</option>
              {clients.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Adresse</label>
            <input className="input" placeholder="auto ou manuel" value={form.address} onChange={e => setField('address', e.target.value)} />
          </div>
        </div>

        {/* Product rows */}
        <div className="mb-3">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <label className="label" style={{ margin: 0 }}>Produits</label>
            {productSuggestions.length > 0 && (
              <span style={{ fontSize: 11, color: '#818CF8', fontWeight: 500 }}>
                💡 Cliquez sur le champ pour voir l'historique
              </span>
            )}
          </div>

          {form.items.map((item, i) => (
            <div key={i} className="mb-3 p-3 rounded-lg" style={{ border: '1px solid var(--border)', background: 'var(--bg)' }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'flex-start' }}>
                <ProductInput
                  value={item.product}
                  onChange={v => setItem(i, 'product', v)}
                  onSelect={s => fillItem(i, s)}
                  suggestions={productSuggestions}
                />
                <input className="input" type="number" placeholder="1" value={item.quantity}
                  onChange={e => setItem(i, 'quantity', e.target.value)}
                  style={{ width: 90, flexShrink: 0 }} />
                <input className="input" type="number" placeholder="300.00" step="0.01" value={item.unit_price}
                  onChange={e => setItem(i, 'unit_price', e.target.value)}
                  style={{ width: 100, flexShrink: 0 }} />
                <button onClick={() => removeItem(i)} disabled={form.items.length === 1}
                  className="btn-danger flex items-center justify-center"
                  style={{ opacity: form.items.length === 1 ? 0.3 : 1, flexShrink: 0 }}>✕</button>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">Unité:</span>
                <UnitPicker value={item.unit} onChange={v => setItem(i, 'unit', v)} />
                {item.quantity && item.unit_price && (
                  <span className="ml-auto text-xs font-semibold" style={{ color: '#059669' }}>
                    = {(parseFloat(item.quantity) * parseFloat(item.unit_price)).toFixed(2)} DH
                  </span>
                )}
              </div>
            </div>
          ))}
          <button className="btn-ghost text-xs py-1.5 px-3" onClick={addItem}>+ Ajouter produit</button>
        </div>

        <div className="mb-3">
          <label className="label">Notes</label>
          <input className="input" placeholder="optionnel..." value={form.notes} onChange={e => setField('notes', e.target.value)} />
        </div>

        <button className="btn-primary" onClick={submit} disabled={createMut.isPending}>
          {createMut.isPending ? 'Enregistrement...' : '+ Enregistrer'}
        </button>
      </div>

      {/* Delivery list */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <p style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text)' }}>Livraisons du jour</p>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, textTransform: 'capitalize' }}>{formatDayLabel(selectedDay)}</p>
          </div>
          {needsPagination && (
            <span style={{ fontSize: 12, color: 'var(--text-muted)', background: 'var(--bg)', padding: '4px 10px', borderRadius: 8, border: '1px solid var(--border)' }}>
              {deliveries.length} entrées · p.{page}/{totalPages}
            </span>
          )}
        </div>

        {isLoading && <p className="text-sm text-gray-400 text-center py-6">Chargement...</p>}
        {!isLoading && !deliveries.length && <p className="text-sm text-gray-400 text-center py-8">Aucune livraison ce jour.</p>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {pagedEntries.map(([clientName, items]) => {
            const clientTotal = items.reduce((s, d) => s + d.total, 0)
            const isOpen = openClient === clientName
            const palette = clientColorMap[clientName] || CLIENT_COLORS[0]

            return (
              <div key={clientName} style={{ borderRadius: 14, border: `2px solid ${isOpen ? palette.border : 'var(--border)'}`, overflow: 'hidden', transition: 'border-color 0.2s', background: 'var(--surface)' }}>
                <button type="button"
                  onClick={() => { setOpenClient(prev => prev === clientName ? null : clientName); setEditingId(null) }}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', background: isOpen ? palette.bg : 'transparent', cursor: 'pointer', border: 'none', transition: 'background 0.2s', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: palette.badge, display: 'inline-block', flexShrink: 0 }} />
                    <div style={{ textAlign: 'left' }}>
                      <p style={{ fontSize: 16, fontWeight: 800, color: isOpen ? palette.text : 'var(--text)', letterSpacing: '-0.02em' }}>{clientName}</p>
                      <p style={{ fontSize: 11, color: isOpen ? palette.text : 'var(--text-muted)', opacity: 0.75, marginTop: 1 }}>
                        {items[0]?.address || '—'} · {items.length} ligne{items.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                    <span style={{ fontSize: 17, fontWeight: 800, color: isOpen ? palette.text : 'var(--text)', letterSpacing: '-0.02em' }}>
                      {clientTotal.toFixed(2)} <span style={{ fontSize: 12, fontWeight: 500, opacity: 0.6 }}>DH</span>
                    </span>
                    <span style={{ fontSize: 12, color: isOpen ? palette.text : 'var(--text-muted)', display: 'inline-block', transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.2s' }}>▼</span>
                  </div>
                </button>

                {isOpen && (
                  <div style={{ borderTop: `1px solid ${palette.border}` }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ background: palette.bg }}>
                          {['Produit', 'Qté', 'Unité', 'Prix (DH)', 'Total (DH)', ''].map((h, i) => (
                            <th key={i} style={{ padding: '8px 12px', textAlign: i === 0 ? 'left' : i === 5 ? 'right' : 'right', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: palette.text, opacity: 0.7, borderBottom: `1px solid ${palette.border}`, borderRight: i < 5 ? `1px solid ${palette.border}` : 'none', width: i === 5 ? 90 : 'auto' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {items.map(d => (
                          editingId === d.id
                            ? <EditRow key={d.id} delivery={d} onSave={(updated) => updateMut.mutate(updated)} onCancel={() => setEditingId(null)} />
                            : (
                              <tr key={d.id} style={{ background: 'var(--surface)' }}
                                onMouseEnter={e => e.currentTarget.style.background = palette.bg + '88'}
                                onMouseLeave={e => e.currentTarget.style.background = 'var(--surface)'}>
                                <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', borderRight: '1px solid var(--border)' }}>
                                  <p style={{ fontWeight: 600 }}>{d.product}</p>
                                  {d.notes && <p style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic', marginTop: 2 }}>{d.notes}</p>}
                                </td>
                                <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', borderRight: '1px solid var(--border)', textAlign: 'right', fontWeight: 500 }}>{d.quantity}</td>
                                <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', borderRight: '1px solid var(--border)' }}>
                                  <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, fontWeight: 600, background: palette.bg, color: palette.text, border: `1px solid ${palette.border}` }}>{d.unit}</span>
                                </td>
                                <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', borderRight: '1px solid var(--border)', textAlign: 'right' }}>{d.unit_price.toFixed(2)}</td>
                                <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', textAlign: 'right', fontWeight: 700, color: '#059669' }}>{d.total.toFixed(2)}</td>
                                <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border)', textAlign: 'right' }}>
                                  <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                                    <button className="btn-ghost" style={{ fontSize: 12, padding: '4px 8px' }} onClick={() => setEditingId(d.id)}>✏️</button>
                                    <button className="btn-danger" style={{ fontSize: 12, padding: '4px 8px' }} onClick={() => deleteMut.mutate(d.id)}>🗑</button>
                                  </div>
                                </td>
                              </tr>
                            )
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {needsPagination && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 16, marginTop: 16, borderTop: '1px solid var(--border)' }}>
            <button className="btn-ghost text-sm px-3 py-1.5" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Précédent</button>
            <div style={{ display: 'flex', gap: 4 }}>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <button key={p} onClick={() => setPage(p)}
                  style={{ padding: '4px 10px', borderRadius: 7, fontSize: 12, fontWeight: 600, border: '1px solid', background: p === page ? '#111827' : 'var(--bg)', color: p === page ? 'white' : 'var(--text)', borderColor: p === page ? '#111827' : 'var(--border)', cursor: 'pointer' }}>{p}</button>
              ))}
            </div>
            <button className="btn-ghost text-sm px-3 py-1.5" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Suivant →</button>
          </div>
        )}
      </div>
    </div>
  )
}