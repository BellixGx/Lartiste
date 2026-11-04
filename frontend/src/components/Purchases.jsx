import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { getPurchases, createPurchase, togglePaid, deletePurchase, updatePurchase, getPurchaseActiveDates } from '../api/client'
import DeliveryCalendar from './DeliveryCalendar'
import { exportPurchases } from '../utils/exportExcel'
const UNITS = ['kg', 'pcs', 'bag', 'litre', 'box']
const PAGE_SIZE = 15

const EMPTY_ITEM = { product: '', quantity: '', unit: 'kg', unit_price: '', notes: '' }

const EMPTY_FORM = {
  date: new Date().toISOString().split('T')[0],
  supplier: '', paid: false,
  items: [{ ...EMPTY_ITEM }]
}

// Shared props for all calendars in this page
const PURCHASE_CAL_PROPS = {
  queryFn: getPurchaseActiveDates,
  queryKey: 'purchase-active-dates',
  dotColor: '#f97316',
  dotBg: '#fff7ed',
  legendLabel: 'A des achats',
}

function groupByDate(purchases) {
  const map = {}
  purchases.forEach(p => {
    const key = p.date || 'no-date'
    if (!map[key]) map[key] = []
    map[key].push(p)
  })
  return Object.entries(map).sort((a, b) => {
    if (a[0] === 'no-date') return 1
    if (b[0] === 'no-date') return -1
    return b[0].localeCompare(a[0])
  })
}

function UnitPicker({ value, onChange }) {
  return (
    <div className="flex gap-1 flex-wrap">
      {UNITS.map(u => (
        <button key={u} type="button" onClick={() => onChange(u)}
          className="px-2 py-1 rounded-md text-xs font-medium border transition-all"
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

function SupplierPicker({ value, onChange, suppliers }) {
  if (!suppliers.length) return null
  return (
    <div className="flex gap-1 flex-wrap mt-1">
      {suppliers.map(s => (
        <button key={s} type="button" onClick={() => onChange(s)}
          className="px-2 py-1 rounded-md text-xs font-medium border transition-all"
          style={{
            background: value === s ? '#111827' : 'var(--bg)',
            color: value === s ? 'white' : 'var(--text-muted)',
            borderColor: value === s ? '#111827' : 'var(--border)',
          }}>
          {s}
        </button>
      ))}
    </div>
  )
}

function EditRow({ p, onSave, onCancel }) {
  const [form, setForm] = useState({
    date: p.date || '',
    product: p.product,
    supplier: p.supplier,
    quantity: p.quantity,
    unit: p.unit,
    unit_price: p.unit_price,
    paid: p.paid,
    notes: p.notes || ''
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div className="py-3 px-3 my-1 rounded-xl border border-gray-200" style={{ background: 'var(--bg)' }}>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-2">
        <div>
          <label className="label">Date <span className="text-gray-400">(optionnel)</span></label>
          <input className="input" type="date" value={form.date || ''} onChange={e => set('date', e.target.value || null)} />
        </div>
        <div><label className="label">Produit</label><input className="input" value={form.product} onChange={e => set('product', e.target.value)} /></div>
        <div><label className="label">Fournisseur</label><input className="input" value={form.supplier} onChange={e => set('supplier', e.target.value)} /></div>
        <div><label className="label">Quantité</label><input className="input" type="number" value={form.quantity} onChange={e => set('quantity', e.target.value)} /></div>
        <div><label className="label">PU (DH)</label><input className="input" type="number" step="0.01" value={form.unit_price} onChange={e => set('unit_price', e.target.value)} /></div>
        <div><label className="label">Notes</label><input className="input" value={form.notes} onChange={e => set('notes', e.target.value)} /></div>
      </div>
      <div className="mb-3">
        <label className="label">Unité</label>
        <UnitPicker value={form.unit} onChange={v => set('unit', v)} />
      </div>
      <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer mb-3">
        <input type="checkbox" checked={form.paid} onChange={e => set('paid', e.target.checked)} className="w-4 h-4" />
        Marquer comme payé
      </label>
      <div className="flex gap-2">
        <button className="btn-primary text-xs py-1.5 px-3"
          onClick={() => onSave({ ...form, quantity: parseFloat(form.quantity) || 0, unit_price: parseFloat(form.unit_price) || 0, date: form.date || null })}>
          ✓ Enregistrer
        </button>
        <button className="btn-ghost text-xs py-1.5 px-3" onClick={onCancel}>Annuler</button>
      </div>
    </div>
  )
}

export default function Purchases() {
  const qc = useQueryClient()
  const [form, setForm] = useState(EMPTY_FORM)
  const [selectedDay, setSelectedDay] = useState(new Date().toISOString().split('T')[0])
  const [editingId, setEditingId] = useState(null)
  const [page, setPage] = useState(0)

  const { data: rawDayPurchases, isLoading: loadingDay } = useQuery({
    queryKey: ['purchases', selectedDay],
    queryFn: () => getPurchases(selectedDay),
  })
  const { data: rawAllPurchases, isLoading: loadingAll } = useQuery({
    queryKey: ['purchases-all'],
    queryFn: () => getPurchases(''),
  })

  const isLoading = loadingDay || loadingAll

  const dayPurchases = Array.isArray(rawDayPurchases) ? rawDayPurchases : []
  const allPurchases = Array.isArray(rawAllPurchases) ? rawAllPurchases : []

  const noDatePurchases = allPurchases.filter(p => !p.date)
  const purchases = [
    ...dayPurchases.filter(p => p.date === selectedDay),
    ...noDatePurchases,
  ]

  const knownSuppliers = [...new Set(allPurchases.map(p => p.supplier).filter(Boolean))].sort()

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['purchases'] })
    qc.invalidateQueries({ queryKey: ['purchases-all'] })
    qc.invalidateQueries({ queryKey: ['dashboard'] })
  }

  const updateMut = useMutation({
    mutationFn: ({ id, data }) => updatePurchase(id, data),
    onSuccess: () => { invalidate(); setEditingId(null); toast.success('Mis à jour !') },
    onError: () => toast.error('Échec de la mise à jour'),
  })
  const toggleMut = useMutation({ mutationFn: togglePaid, onSuccess: invalidate })
  const deleteMut = useMutation({
    mutationFn: deletePurchase,
    onSuccess: () => { invalidate(); toast.success('Supprimé') },
  })

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const setItem = (i, k, v) => setForm(f => {
    const items = [...f.items]
    items[i] = { ...items[i], [k]: v }
    return { ...f, items }
  })
  const addItem = () => setForm(f => ({ ...f, items: [...f.items, { ...EMPTY_ITEM }] }))
  const removeItem = (i) => setForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }))

  const submit = async () => {
    if (!form.supplier.trim()) return toast.error('Le fournisseur est requis')
    const validItems = form.items.filter(it => it.product.trim())
    if (!validItems.length) return toast.error('Ajoutez au moins un produit')
    const rows = validItems.map(it => ({
      date: form.date && form.date.trim() !== '' ? form.date : null,
      supplier: form.supplier,
      paid: form.paid,
      product: it.product.trim(),
      quantity: parseFloat(it.quantity) || 0,
      unit: it.unit,
      unit_price: parseFloat(it.unit_price) || 0,
      notes: it.notes || '',
    }))
    try {
      await Promise.all(rows.map(r => createPurchase(r)))
      invalidate()
      setForm(EMPTY_FORM)
      toast.success(`${rows.length} achat${rows.length > 1 ? 's' : ''} enregistré${rows.length > 1 ? 's' : ''} !`)
    } catch {
      toast.error('Échec de l\'enregistrement')
    }
  }

  const changeDay = (offset) => {
    const d = new Date(selectedDay + 'T12:00:00')
    d.setDate(d.getDate() + offset)
    setSelectedDay(d.toISOString().split('T')[0])
    setPage(0)
  }

  const isToday = selectedDay === new Date().toISOString().split('T')[0]
  const dayLabel = new Date(selectedDay + 'T12:00:00').toLocaleDateString('fr-MA', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  })

  const totalAll    = purchases.reduce((s, p) => s + p.total, 0)
  const totalPaid   = purchases.filter(p => p.paid).reduce((s, p) => s + p.total, 0)
  const totalUnpaid = totalAll - totalPaid

  const groups      = groupByDate(purchases)
  const allRows     = groups.flatMap(([, items]) => items)
  const totalPages  = Math.ceil(allRows.length / PAGE_SIZE)
  const pagedRows   = allRows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const pagedGroups = groupByDate(pagedRows)

  return (
    <div>
       <div className="flex items-center justify-between mb-1">
        <h2 className="text-lg font-semibold">Achats</h2>
        <button className="btn-ghost text-xs px-3 py-1.5"
          onClick={() => exportPurchases()}
          title="Exporter tous les achats vers Excel">
          📥 Exporter Excel
        </button>
      </div>
      <p className="text-sm text-gray-400 mb-4">Enregistrez les achats — par fournisseur, avec plusieurs produits par entrée.</p>

      {/* Day selector */}
      <div className="card flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <button className="btn-ghost px-2 py-1" onClick={() => changeDay(-1)}>←</button>
          <DeliveryCalendar
            value={selectedDay}
            onChange={v => { setSelectedDay(v); setPage(0) }}
            label=""
            {...PURCHASE_CAL_PROPS}
          />
          <button className="btn-ghost px-2 py-1" onClick={() => changeDay(1)} disabled={isToday}>→</button>
          {!isToday && (
            <button className="btn-ghost px-3 py-1 text-xs"
              onClick={() => { setSelectedDay(new Date().toISOString().split('T')[0]); setPage(0) }}>
              Aujourd'hui
            </button>
          )}
        </div>
        <p className="text-sm text-gray-500 capitalize">{dayLabel}</p>
      </div>

      {/* Day totals */}
      <div className="card flex flex-wrap justify-between items-center gap-3 mb-4">
        <div>
          <p className="text-xs text-gray-400 mb-0.5">Total affiché</p>
          <p className="text-xl font-semibold">{totalAll.toFixed(2)} DH</p>
        </div>
        <div className="flex gap-6">
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Payé</p>
            <p className="text-base font-medium text-green-600">✓ {totalPaid.toFixed(2)} DH</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Impayé</p>
            <p className="text-base font-medium text-red-500">⚠ {totalUnpaid.toFixed(2)} DH</p>
          </div>
        </div>
      </div>

      {/* Add form */}
      <div className="card mb-4">
        <p className="text-sm font-medium mb-3">Ajouter un achat</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
          <div>
            <label className="label">Date <span className="text-gray-400 font-normal">(optionnel)</span></label>
            <DeliveryCalendar
              value={form.date}
              onChange={v => set('date', v)}
              label=""
              {...PURCHASE_CAL_PROPS}
            />
            {form.date && (
              <button className="text-xs text-gray-400 mt-1 underline" onClick={() => set('date', '')}>
                Effacer la date
              </button>
            )}
            {!form.date && <p className="text-xs text-gray-400 mt-1">Aucune date sélectionnée</p>}
          </div>
          <div>
            <label className="label">Fournisseur</label>
            <input className="input" placeholder="ex. Marché Boujeloud"
              value={form.supplier} onChange={e => set('supplier', e.target.value)} />
            <SupplierPicker value={form.supplier} onChange={v => set('supplier', v)} suppliers={knownSuppliers} />
          </div>
          <div className="flex items-center pt-5">
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input type="checkbox" className="w-4 h-4 cursor-pointer"
                checked={form.paid} onChange={e => set('paid', e.target.checked)} />
              Tout marquer comme payé
            </label>
          </div>
        </div>

        {/* Product rows */}
        <div className="mb-3">
          <label className="label mb-2">Produits</label>
          <div className="grid gap-1 mb-1 text-xs font-medium text-gray-400 uppercase tracking-wide px-1"
            style={{ gridTemplateColumns: '1fr 80px 90px 90px 32px' }}>
            <span>Produit</span><span>Qté</span><span>PU (DH)</span><span>Notes</span><span></span>
          </div>
          {form.items.map((item, i) => (
            <div key={i} className="mb-2 p-3 rounded-lg" style={{ border: '1px solid var(--border)', background: 'var(--bg)' }}>
              <div className="grid gap-2 mb-2" style={{ gridTemplateColumns: '1fr 80px 90px 90px 32px' }}>
                <input className="input" placeholder="ex. Bac Chocolat 4kg"
                  value={item.product} onChange={e => setItem(i, 'product', e.target.value)} />
                <input className="input" type="number" placeholder="1" min="0"
                  value={item.quantity} onChange={e => setItem(i, 'quantity', e.target.value)} />
                <input className="input" type="number" placeholder="0.00" step="0.01" min="0"
                  value={item.unit_price} onChange={e => setItem(i, 'unit_price', e.target.value)} />
                <input className="input" placeholder="note..."
                  value={item.notes} onChange={e => setItem(i, 'notes', e.target.value)} />
                <button onClick={() => removeItem(i)} disabled={form.items.length === 1}
                  className="btn-danger flex items-center justify-center"
                  style={{ opacity: form.items.length === 1 ? 0.3 : 1 }}>✕</button>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">Unité:</span>
                <UnitPicker value={item.unit} onChange={v => setItem(i, 'unit', v)} />
                {item.quantity && item.unit_price && (
                  <span className="ml-auto text-xs font-semibold text-gray-600">
                    = {(parseFloat(item.quantity) * parseFloat(item.unit_price)).toFixed(2)} DH
                  </span>
                )}
              </div>
            </div>
          ))}
          <button className="btn-ghost text-xs py-1.5 px-3" onClick={addItem}>+ Ajouter produit</button>
        </div>

        <button className="btn-primary" onClick={submit}>
          + Enregistrer les achats
        </button>
      </div>

      {/* List */}
      <div className="card">
        <p className="text-sm font-medium mb-1">
          {dayPurchases.filter(p => p.date === selectedDay).length} achat{dayPurchases.filter(p => p.date === selectedDay).length !== 1 ? 's' : ''} le <span className="capitalize">{dayLabel}</span>
          {noDatePurchases.length > 0 && <span className="text-gray-400"> + {noDatePurchases.length} sans date</span>}
        </p>

        {isLoading && <p className="text-sm text-gray-400 text-center py-4">Chargement...</p>}
        {!isLoading && !purchases.length && (
          <p className="text-sm text-gray-400 text-center py-6">Aucun achat pour ce jour.</p>
        )}

        {pagedGroups.map(([date, items]) => (
          <div key={date} className="mb-4">
            {date !== 'no-date' ? (
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2 mt-3 capitalize">
                {new Date(date + 'T12:00:00').toLocaleDateString('fr-MA', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
            ) : (
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2 mt-3 italic">
                📌 Aucune date assignée
              </p>
            )}

            <table className="w-full border-collapse text-sm">
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)' }}>
                  <th style={{ width: '32px', padding: '8px 6px' }}></th>
                  <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide"
                    style={{ padding: '8px 12px', borderRight: '1px solid var(--border)' }}>Produit / Fournisseur</th>
                  <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide"
                    style={{ padding: '8px 12px', borderRight: '1px solid var(--border)' }}>Quantité</th>
                  <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide"
                    style={{ padding: '8px 12px', borderRight: '1px solid var(--border)' }}>Unité</th>
                  <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide"
                    style={{ padding: '8px 12px', borderRight: '1px solid var(--border)' }}>PU</th>
                  <th className="text-center text-xs font-semibold text-gray-400 uppercase tracking-wide"
                    style={{ padding: '8px 12px', borderRight: '1px solid var(--border)' }}>Statut</th>
                  <th className="text-right text-xs font-semibold text-gray-400 uppercase tracking-wide"
                    style={{ padding: '8px 12px' }}>Total (DH)</th>
                  <th style={{ width: '80px', padding: '8px 6px' }}></th>
                </tr>
              </thead>
              <tbody>
                {items.map(p => (
                  <tr key={p.id}>
                    {editingId === p.id ? (
                      <td colSpan={8} style={{ padding: '8px 0' }}>
                        <EditRow
                          p={p}
                          onSave={(data) => updateMut.mutate({ id: p.id, data })}
                          onCancel={() => setEditingId(null)}
                        />
                      </td>
                    ) : (
                      <>
                        <td style={{ padding: '10px 6px', borderBottom: '1px solid var(--border)', verticalAlign: 'middle' }}>
                          <button
                            onClick={() => toggleMut.mutate(p.id)}
                            className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all
                              ${p.paid ? 'bg-green-500 border-green-500' : 'bg-white border-gray-300 hover:border-gray-500'}`}
                          >
                            {p.paid && (
                              <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </button>
                        </td>
                        <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', borderRight: '1px solid var(--border)', verticalAlign: 'middle' }}>
                          <p className="font-semibold text-sm">{p.product}</p>
                          <p className="text-xs text-gray-400 mt-0.5">🏪 {p.supplier}</p>
                          {p.notes && <p className="text-xs text-gray-400 italic mt-0.5">{p.notes}</p>}
                        </td>
                        <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', borderRight: '1px solid var(--border)', verticalAlign: 'middle' }}>
                          <span className="font-medium">{p.quantity}</span>
                        </td>
                        <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', borderRight: '1px solid var(--border)', verticalAlign: 'middle' }}>
                          <span className="text-xs px-2 py-0.5 rounded font-medium"
                            style={{ background: 'var(--bg)', color: 'var(--text-muted)' }}>
                            {p.unit}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', borderRight: '1px solid var(--border)', verticalAlign: 'middle' }}>
                          <span className="text-sm">{p.unit_price.toFixed(2)}</span>
                        </td>
                        <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', borderRight: '1px solid var(--border)', verticalAlign: 'middle', textAlign: 'center' }}>
                          <span className={`text-xs px-2 py-1 rounded-full font-medium
                            ${p.paid ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-500'}`}>
                            {p.paid ? '✓ Payé' : '⚠ Impayé'}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', verticalAlign: 'middle', textAlign: 'right' }}>
                          <span className="font-bold text-sm">{p.total.toFixed(2)}</span>
                        </td>
                        <td style={{ padding: '10px 6px', borderBottom: '1px solid var(--border)', verticalAlign: 'middle' }}>
                          <div className="flex items-center gap-1 justify-end">
                            <button onClick={() => setEditingId(p.id)} className="btn-ghost px-1.5 py-1 text-xs" title="Modifier">✏️</button>
                            <button className="btn-danger" onClick={() => deleteMut.mutate(p.id)}>🗑</button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
            <button className="btn-ghost text-xs px-3 py-1.5" onClick={() => setPage(p => p - 1)} disabled={page === 0}>← Précédent</button>
            <span className="text-xs text-gray-400">Page {page + 1} sur {totalPages}</span>
            <button className="btn-ghost text-xs px-3 py-1.5" onClick={() => setPage(p => p + 1)} disabled={page >= totalPages - 1}>Suivant →</button>
          </div>
        )}
      </div>
    </div>
  )
}