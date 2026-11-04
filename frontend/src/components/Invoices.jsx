import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { getInvoices, createInvoice, deleteInvoice, downloadPDF, getClientsByDate, getClientsByRange, getClients } from '../api/client'
import axios from 'axios'
import DeliveryCalendar from './DeliveryCalendar'
import { exportInvoices } from '../utils/exportExcel'

const PAYMENT_METHODS = ['Espèce', 'Chèque', 'Virement', 'Carte bancaire']

const today = new Date().toISOString().split('T')[0]

const EMPTY = {
  number: '',
  client: '',
  client_code: '',
  client_address: '',
  invoice_type: 'single_day',
  delivery_date: today,
  date_from: '',
  date_to: '',
  payment_method: 'Espèce'
}

function formatDayLabel(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('fr-MA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

function periodLabel(inv) {
  if (inv.invoice_type === 'single_day') {
    return inv.delivery_date ? formatDayLabel(inv.delivery_date) : '—'
  }
  if (inv.invoice_type === 'range') {
    const f = inv.date_from || '—'
    const t = inv.date_to   || '—'
    return `${f} → ${t}`
  }
  return 'Toutes les livraisons'
}

function typeLabel(type) {
  if (type === 'single_day') return { text: 'Jour unique', color: '#3b82f6' }
  if (type === 'range')      return { text: 'Période', color: '#8b5cf6' }
  return                            { text: 'Tout temps', color: '#f59e0b' }
}

export default function Invoices() {
  const qc = useQueryClient()
  const [form, setForm] = useState(EMPTY)
  const [expandedId, setExpandedId] = useState(null)

  const { data: rawInvoices, isLoading } = useQuery({ queryKey: ['invoices'], queryFn: getInvoices })
  const { data: rawClients } = useQuery({ queryKey: ['clients'], queryFn: getClients })
  const invoices = Array.isArray(rawInvoices) ? rawInvoices : []
  const clients  = Array.isArray(rawClients)  ? rawClients  : []

  // Load clients based on mode
  const { data: clientsOfDay = [] } = useQuery({
    queryKey: ['clients-by-date', form.delivery_date],
    queryFn: () => getClientsByDate(form.delivery_date),
    enabled: form.invoice_type === 'single_day' && !!form.delivery_date,
  })

  const { data: clientsOfRange = [] } = useQuery({
    queryKey: ['clients-by-range', form.date_from, form.date_to],
    queryFn: () => getClientsByRange(form.date_from, form.date_to),
    enabled: form.invoice_type === 'range',
  })

  const { data: clientsAllTime = [] } = useQuery({
    queryKey: ['clients-by-range-all'],
    queryFn: () => getClientsByRange('', ''),
    enabled: form.invoice_type === 'all_time',
  })

  const clientOptions =
    form.invoice_type === 'single_day' ? clientsOfDay :
    form.invoice_type === 'range'      ? clientsOfRange :
    clientsAllTime

  useEffect(() => {
    axios.get('/api/invoices/next-number').then(r => {
      setForm(f => ({ ...f, number: r.data.number }))
    }).catch(() => {})
  }, [])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const changeType = (type) => {
    setForm(f => ({ ...f, invoice_type: type, client: '', client_code: '', client_address: '' }))
  }

  const selectClient = (name) => {
    const c = clients.find(c => c.name === name)
    setForm(f => ({
      ...f,
      client: name,
      client_code: c?.code || '',
      client_address: c?.address || '',
    }))
  }

  const toggleExpand = (id) => setExpandedId(prev => prev === id ? null : id)

  const createMut = useMutation({
    mutationFn: createInvoice,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] })
      axios.get('/api/invoices/next-number').then(r => {
        setForm(f => ({ ...EMPTY, invoice_type: f.invoice_type, number: r.data.number }))
      }).catch(() => setForm(EMPTY))
      toast.success('Facture créée !')
    },
    onError: e => toast.error(e?.response?.data?.detail || 'Échec de la création de la facture'),
  })

  const deleteMut = useMutation({
    mutationFn: deleteInvoice,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoices'] }); toast.success('Supprimé') },
  })

  const submit = () => {
    if (!form.client) return toast.error('Veuillez sélectionner un client')
    if (form.invoice_type === 'single_day' && !form.delivery_date) return toast.error('Veuillez sélectionner une date de livraison')
    createMut.mutate({
      ...form,
      delivery_date: form.invoice_type === 'single_day' ? form.delivery_date : null,
      date_from: form.invoice_type !== 'single_day' ? (form.date_from || null) : null,
      date_to:   form.invoice_type !== 'single_day' ? (form.date_to   || null) : null,
    })
  }

  return (
    <div>
        <div className="flex items-center justify-between mb-1">
        <h2 className="text-lg font-semibold">Factures</h2>
        <button className="btn-ghost text-xs px-3 py-1.5"
          onClick={() => exportInvoices()}
          title="Exporter toutes les factures vers Excel">
          📥 Exporter Excel
        </button>
      </div>
      <p className="text-sm text-gray-400 mb-4">Générez des factures par jour, par période, ou toutes les livraisons d'un client.</p>

      {/* Generate form */}
      <div className="card mb-5">
        <p className="text-sm font-medium mb-3">Générer une facture</p>

        {/* Mode selector */}
        <div className="flex gap-2 mb-4">
          {[
            { key: 'single_day', label: '📅 Jour unique' },
            { key: 'range',      label: '📆 Période' },
            { key: 'all_time',   label: '🗂 Tout temps'   },
          ].map(m => (
            <button key={m.key} onClick={() => changeType(m.key)}
              className="px-4 py-2 rounded-lg text-sm font-medium border transition-all"
              style={{
                background: form.invoice_type === m.key ? '#111827' : 'var(--bg)',
                color: form.invoice_type === m.key ? 'white' : 'var(--text-muted)',
                borderColor: form.invoice_type === m.key ? '#111827' : 'var(--border)',
              }}>
              {m.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">

          {/* Date fields based on mode */}
          {form.invoice_type === 'single_day' && (
            <div>
              <DeliveryCalendar value={form.delivery_date} onChange={v => { set('delivery_date', v); set('client', '') }} label="① Date de livraison" />
            </div>
          )}

          {form.invoice_type === 'range' && (
            <>
              <div>
                <label className="label">① Date de début</label>
                <input className="input" type="date" value={form.date_from} onChange={e => { set('date_from', e.target.value); set('client', '') }} />
              </div>
              <div>
                <label className="label">② Date de fin</label>
                <input className="input" type="date" value={form.date_to} onChange={e => { set('date_to', e.target.value); set('client', '') }} />
              </div>
            </>
          )}

          {form.invoice_type === 'all_time' && (
            <div className="flex items-center">
              <p className="text-sm text-gray-400 italic">Toutes les livraisons du client sélectionné seront incluses.</p>
            </div>
          )}

          {/* Client */}
          <div>
            <label className="label">{form.invoice_type === 'single_day' ? '② ' : form.invoice_type === 'range' ? '③ ' : '① '}Client</label>
            <select className="input" value={form.client} onChange={e => selectClient(e.target.value)}>
              <option value="">— sélectionner client —</option>
              {clientOptions.map(name => <option key={name} value={name}>{name}</option>)}
            </select>
            {clientOptions.length > 0
              ? <p className="text-xs text-green-600 mt-1">{clientOptions.length} client(s) disponible(s)</p>
              : <p className="text-xs text-gray-400 mt-1">Aucun client trouvé pour cette période</p>
            }
          </div>

          {/* Facture number */}
          <div>
            <label className="label">N° Facture (auto)</label>
            <input className="input" value={form.number} onChange={e => set('number', e.target.value)} placeholder="F-2026-0001" />
          </div>

          {/* Payment method */}
          <div>
            <label className="label">Mode de règlement</label>
            <select className="input" value={form.payment_method} onChange={e => set('payment_method', e.target.value)}>
              {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

        </div>

        <button className="btn-primary" onClick={submit} disabled={createMut.isPending}>
          {createMut.isPending ? 'Génération...' : '📄 Générer la facture'}
        </button>
      </div>

      {isLoading && <p className="text-sm text-gray-400 text-center py-4">Chargement...</p>}
      {!isLoading && !invoices.length && <p className="text-sm text-gray-400 text-center py-6">Aucune facture pour le moment.</p>}

      {invoices.map(inv => {
        const tl = typeLabel(inv.invoice_type)
        return (
          <div key={inv.id} className="card mb-3">

            {/* Header */}
            <div className="flex justify-between items-center" style={{ cursor: 'pointer' }}
              onClick={() => toggleExpand(inv.id)}>
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-sm font-bold">📄 {inv.number}</p>
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{ background: tl.color + '20', color: tl.color }}>
                    {tl.text}
                  </span>
                </div>
                <p className="text-xs text-gray-400">
                  <strong style={{ color: 'var(--text)' }}>{inv.client}</strong>
                  {inv.client_code && <span> · Code: {inv.client_code}</span>}
                </p>
                <p className="text-xs text-gray-400 mt-0.5 capitalize">{periodLabel(inv)}</p>
                <p className="text-sm font-semibold mt-1">{inv.total.toFixed(2)} Dh</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-400 text-sm">{expandedId === inv.id ? '▲' : '▼'}</span>
                <button className="btn-ghost text-xs px-3 py-1.5"
                  onClick={e => { e.stopPropagation(); downloadPDF(inv.id) }}>
                  ⬇ PDF
                </button>
                <button className="btn-danger"
                  onClick={e => { e.stopPropagation(); deleteMut.mutate(inv.id) }}>
                  🗑
                </button>
              </div>
            </div>

            {/* Expanded */}
            {expandedId === inv.id && (
              <div style={{ marginTop: '16px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                {inv.client_address && <p className="text-xs text-gray-400 mb-2">📍 {inv.client_address}</p>}
                <p className="text-xs text-gray-400 mb-3 capitalize">{periodLabel(inv)} · {inv.payment_method}</p>

                <table className="w-full border-collapse">
                  <thead>
                    <tr style={{ background: '#4b5563', color: 'white' }}>
                      <th style={{ padding: '9px 10px', textAlign: 'left',  fontSize: '12px', width: '44px' }}>Réf</th>
                      {inv.invoice_type !== 'single_day' && (
                        <th style={{ padding: '9px 10px', textAlign: 'left', fontSize: '12px', width: '90px' }}>Date</th>
                      )}
                      <th style={{ padding: '9px 10px', textAlign: 'left',  fontSize: '12px' }}>Désignation</th>
                      <th style={{ padding: '9px 10px', textAlign: 'right', fontSize: '12px', width: '80px' }}>Quantité</th>
                      <th style={{ padding: '9px 10px', textAlign: 'right', fontSize: '12px', width: '80px' }}>PU</th>
                      <th style={{ padding: '9px 10px', textAlign: 'right', fontSize: '12px', width: '90px' }}>Total TTC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inv.items.map((item, i) => (
                      <tr key={item.id} style={{ background: i % 2 === 0 ? 'var(--surface)' : 'var(--bg)' }}>
                        <td style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)', fontSize: '13px' }}>{item.ref}</td>
                        {inv.invoice_type !== 'single_day' && (
                          <td style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)', fontSize: '12px', color: 'var(--text-muted)' }}>
                            {item.date || '—'}
                          </td>
                        )}
                        <td style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)', fontSize: '13px', fontWeight: 500 }}>{item.product}</td>
                        <td style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)', textAlign: 'right', fontSize: '13px' }}>{item.quantity.toFixed(2)}</td>
                        <td style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)', textAlign: 'right', fontSize: '13px' }}>{item.unit_price.toFixed(2)}</td>
                        <td style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)', textAlign: 'right', fontSize: '13px', fontWeight: 600 }}>{item.total.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="flex justify-end mt-4">
                  <div style={{ width: '240px', border: '1px solid var(--border)', borderRadius: '6px', overflow: 'hidden' }}>
                    {[['Total HT :', inv.total.toFixed(2) + ' Dh'], ['Total TTC :', inv.total.toFixed(2) + ' Dh']].map(([label, val]) => (
                      <div key={label} className="flex justify-between px-3 py-2 text-xs" style={{ borderBottom: '1px solid var(--border)' }}>
                        <span className="text-gray-400">{label}</span><span>{val}</span>
                      </div>
                    ))}
                    <div className="flex justify-between px-3 py-2 text-sm font-bold" style={{ background: '#4b5563', color: 'white' }}>
                      <span>Net à payer :</span><span>{inv.total.toFixed(2)} Dh</span>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-2 text-right italic">Mode de règlement : {inv.payment_method}</p>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}