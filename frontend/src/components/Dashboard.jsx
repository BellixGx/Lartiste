import { useQuery } from '@tanstack/react-query'
import { getDashboard } from '../api/client'

function StatCard({ label, value, sub, color = 'text-gray-900' }) {
  return (
    <div className="stat-card">
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-2xl font-semibold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

function BarChart({ title, entries, unit = '' }) {
  if (!entries.length) return (
    <div className="card">
      <p className="text-sm font-medium text-gray-700 mb-3">{title}</p>
      <p className="text-sm text-gray-400 text-center py-4">Aucune donnée pour le moment.</p>
    </div>
  )
  const max = Math.max(...entries.map(e => e.value))
  return (
    <div className="card">
      <p className="text-sm font-medium text-gray-700 mb-4">{title}</p>
      <div className="space-y-3">
        {entries.map(({ name, value, suffix }) => (
          <div key={name} className="flex items-center gap-3 text-sm">
            <span className="w-32 text-gray-500 truncate text-xs" title={name}>{name}</span>
            <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
              <div className="h-2 rounded-full bg-gray-800 transition-all" style={{ width: `${Math.round((value / max) * 100)}%` }} />
            </div>
            <span className="w-24 text-right text-gray-800 font-medium text-xs whitespace-nowrap">
              {typeof value === 'number' ? value.toFixed(2) : value} {suffix || unit}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['dashboard'],
    queryFn: getDashboard,
    refetchInterval: 5000
  })

  if (isLoading) return <p className="text-sm text-gray-400 p-4">Chargement du tableau de bord...</p>
  if (isError || !data) return <p className="text-sm text-red-400 p-4">Impossible de charger le tableau de bord. Le backend est-il en cours d'exécution ?</p>

  const safe = (n) => (typeof n === 'number' ? n.toFixed(2) : '0.00')

  const delEntries = Object.entries(data.deliveries_by_product || {})
    .map(([name, v]) => ({ name, value: v?.qty ?? 0, suffix: v?.unit || '' }))
    .sort((a, b) => b.value - a.value)

  const purEntries = Object.entries(data.purchases_by_product || {})
    .map(([name, value]) => ({ name, value: value ?? 0 }))
    .sort((a, b) => b.value - a.value)

  return (
    <div>
      <h2 className="text-lg font-semibold mb-1">Tableau de bord</h2>
      <p className="text-sm text-gray-400 mb-5">Aperçu en temps réel de votre stock, argent et flux.</p>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
        <StatCard label="Total acheté"      value={`${safe(data.total_purchased)} MAD`}  sub="depuis le début" />
        <StatCard label="Payé"              value={`${safe(data.total_paid)} MAD`}       sub="réglé"             color="text-green-600" />
        <StatCard label="Non payé / Dette"  value={`${safe(data.total_unpaid)} MAD`}      sub="restant"           color="text-red-500" />
        <StatCard label="Valeur livrée"     value={`${safe(data.total_delivered)} MAD`}  sub="depuis le début" />
        <StatCard label="Solde du stock"    value={`${safe(data.stock_balance)} MAD`}    sub="valeur est. restante" />
        <StatCard label="Clients actifs"    value={data.unique_clients ?? 0}              sub="clients uniques" />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <BarChart title="Quantité livrée par produit" entries={delEntries} />
        <BarChart title="Achats par produit (MAD)"    entries={purEntries} unit="MAD" />
      </div>
    </div>
  )
}