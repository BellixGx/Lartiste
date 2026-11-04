import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { getClients, createClient, updateClient, deleteClient } from '../api/client'
import { exportClients } from '../utils/exportExcel'

const EMPTY = { code: '', name: '', address: '', phone: '', email: '', notes: '' }

function ClientForm({ initial, onSave, onCancel, loading }) {
  const [form, setForm] = useState(initial)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  return (
    <div className="card mb-4">
      <p className="text-sm font-medium mb-3">{initial.id ? 'Modifier le client' : 'Ajouter un nouveau client'}</p>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
        <div>
          <label className="label">Code client <span className="text-gray-400 font-normal">(auto)</span></label>
          <input className="input" placeholder="" value={form.code} onChange={e => set('code', e.target.value)} />
        </div>
        <div><label className="label">Nom *</label><input className="input" placeholder="ex. Café L'Artiste" value={form.name} onChange={e => set('name', e.target.value)} /></div>
        <div><label className="label">Adresse</label><input className="input" placeholder="ex. Marina Al Hoceima" value={form.address} onChange={e => set('address', e.target.value)} /></div>
        <div><label className="label">Téléphone</label><input className="input" placeholder="ex. 0661234567" value={form.phone} onChange={e => set('phone', e.target.value)} /></div>
        <div><label className="label">Email</label><input className="input" placeholder="optionnel" value={form.email} onChange={e => set('email', e.target.value)} /></div>
        <div><label className="label">Notes</label><input className="input" placeholder="optionnel" value={form.notes} onChange={e => set('notes', e.target.value)} /></div>
      </div>
      <div className="flex gap-2">
        <button className="btn-primary" onClick={() => onSave(form)} disabled={loading}>
          {loading ? 'Enregistrement...' : '✓ Enregistrer le client'}
        </button>
        {onCancel && <button className="btn-ghost" onClick={onCancel}>Annuler</button>}
      </div>
    </div>
  )
}

export default function Clients() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editingClient, setEditingClient] = useState(null)

  const { data: rawClients, isLoading } = useQuery({ queryKey: ['clients'], queryFn: getClients })
  const clients = Array.isArray(rawClients) ? rawClients : []

  const invalidate = () => qc.invalidateQueries({ queryKey: ['clients'] })

  const createMut = useMutation({
    mutationFn: createClient,
    onSuccess: () => { invalidate(); setShowForm(false); toast.success('Client ajouté !') },
    onError: e => toast.error(e?.response?.data?.detail || 'Échec de l\'ajout du client'),
  })
  const updateMut = useMutation({
    mutationFn: ({ id, data }) => updateClient(id, data),
    onSuccess: () => { invalidate(); setEditingClient(null); toast.success('Client mis à jour !') },
    onError: e => toast.error(e?.response?.data?.detail || 'Échec de la mise à jour'),
  })
  const deleteMut = useMutation({
    mutationFn: deleteClient,
    onSuccess: () => { invalidate(); toast.success('Supprimé') },
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-lg font-semibold">Clients</h2>
        <div className="flex gap-2">
          <button className="btn-ghost text-xs px-3 py-1.5"
            onClick={() => exportClients()}
            title="Exporter les clients vers Excel">
            📥 Exporter Excel
          </button>
          <button className="btn-primary" onClick={() => { setShowForm(s => !s); setEditingClient(null) }}>
            {showForm ? '✕ Annuler' : '+ Ajouter client'}
          </button>
        </div>
      </div>
      <p className="text-sm text-gray-400 mb-4">Gérez vos clients — ils seront disponibles lors de la génération des factures.</p>

      {showForm && (
        <ClientForm
          initial={EMPTY}
          onSave={data => createMut.mutate(data)}
          loading={createMut.isPending}
        />
      )}

      <div className="card">
        <p className="text-sm font-medium mb-3">{clients.length} client{clients.length !== 1 ? 's' : ''}</p>
        {isLoading && <p className="text-sm text-gray-400 text-center py-4">Chargement...</p>}
        {!isLoading && !clients.length && <p className="text-sm text-gray-400 text-center py-6">Aucun client pour le moment. Ajoutez votre premier client ci-dessus.</p>}

        <table className="w-full border-collapse text-sm">
          {clients.length > 0 && (
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)' }}>
                <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide" style={{ padding: '8px 12px', borderRight: '1px solid var(--border)' }}>Code</th>
                <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide" style={{ padding: '8px 12px', borderRight: '1px solid var(--border)' }}>Nom</th>
                <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide" style={{ padding: '8px 12px', borderRight: '1px solid var(--border)' }}>Adresse</th>
                <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide" style={{ padding: '8px 12px', borderRight: '1px solid var(--border)' }}>Téléphone</th>
                <th style={{ width: '100px', padding: '8px 6px' }}></th>
              </tr>
            </thead>
          )}
          <tbody>
            {clients.map(c => (
              <tr key={c.id}>
                {editingClient?.id === c.id ? (
                  <td colSpan={5} style={{ padding: '8px 0' }}>
                    <ClientForm
                      initial={editingClient}
                      onSave={data => updateMut.mutate({ id: c.id, data })}
                      onCancel={() => setEditingClient(null)}
                      loading={updateMut.isPending}
                    />
                  </td>
                ) : (
                  <>
                    <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', borderRight: '1px solid var(--border)', verticalAlign: 'middle' }}>
                      <span className="text-xs px-2 py-0.5 rounded font-medium" style={{ background: 'var(--bg)', color: 'var(--text-muted)' }}>{c.code}</span>
                    </td>
                    <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', borderRight: '1px solid var(--border)', verticalAlign: 'middle' }}>
                      <p className="font-semibold">{c.name}</p>
                      {c.email && <p className="text-xs text-gray-400">{c.email}</p>}
                    </td>
                    <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', borderRight: '1px solid var(--border)', verticalAlign: 'middle' }}>
                      <p className="text-xs text-gray-500">{c.address || '—'}</p>
                    </td>
                    <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', borderRight: '1px solid var(--border)', verticalAlign: 'middle' }}>
                      <p className="text-xs text-gray-500">{c.phone || '—'}</p>
                    </td>
                    <td style={{ padding: '10px 6px', borderBottom: '1px solid var(--border)', verticalAlign: 'middle' }}>
                      <div className="flex gap-1 justify-end">
                        <button onClick={() => setEditingClient(c)} className="btn-ghost px-1.5 py-1 text-xs">✏️</button>
                        <button className="btn-danger" onClick={() => deleteMut.mutate(c.id)}>🗑</button>
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}