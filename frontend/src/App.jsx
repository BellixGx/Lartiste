import { useState, useEffect } from 'react'
import Dashboard from './components/Dashboard'
import Purchases from './components/Purchases'
import Deliveries from './components/Deliveries'
import Invoices from './components/Invoices'
import Clients from './components/Clients'

const TABS = [
  { id: 'dashboard',  label: 'Tableau de bord',  icon: '📊' },
  { id: 'purchases',  label: 'Achats',  icon: '🛒' },
  { id: 'deliveries', label: 'Livraisons', icon: '🚚' },
  { id: 'clients',    label: 'Clients',    icon: '👥' },
  { id: 'invoices',   label: 'Factures',   icon: '📄' },
]

export default function App() {
  const [tab, setTab] = useState(() => {
    return sessionStorage.getItem('activeTab') || 'dashboard'
  })
  const [dark, setDark] = useState(() => localStorage.getItem('theme') === 'dark')
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('theme', dark ? 'dark' : 'light')
  }, [dark])

  const switchTab = (id) => {
    setTab(id)
    sessionStorage.setItem('activeTab', id)
    setMenuOpen(false) // close mobile menu after picking a tab
  }

  const PAGES = {
    dashboard:  <Dashboard />,
    purchases:  <Purchases />,
    deliveries: <Deliveries />,
    clients:    <Clients />,
    invoices:   <Invoices />,
  }

  const activeTabInfo = TABS.find(t => t.id === tab)

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg)' }}>
      <header
        style={{ backgroundColor: 'var(--surface)', borderBottom: '1px solid var(--border)' }}
        className="sticky top-0 z-20"
      >
        <div className="max-w-5xl mx-auto px-4 flex items-center justify-between h-14 md:h-16">
          {/* Logo */}
          <div className="flex items-center gap-2 min-w-0">
            <img src="/logo.png" alt="Med Gelato" className="h-10 md:h-16 w-auto object-contain shrink-0" />
            <span style={{ color: 'var(--text)' }} className="font-semibold text-sm truncate">
              Med Gelato
            </span>
          </div>

          {/* Desktop nav — hidden on mobile */}
          <nav className="hidden md:flex items-center gap-1">
            {TABS.map(t => (
              <button key={t.id} onClick={() => switchTab(t.id)}
                style={tab === t.id
                  ? { background: '#111827', color: 'white' }
                  : { color: 'var(--text-muted)', background: 'transparent' }}
                className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all hover:opacity-80 whitespace-nowrap">
                <span className="mr-1.5">{t.icon}</span>{t.label}
              </button>
            ))}
            <button onClick={() => setDark(d => !d)}
              className="ml-2 w-9 h-9 rounded-lg flex items-center justify-center transition-all shrink-0"
              style={{ border: '1px solid var(--border)', color: 'var(--text-muted)', background: 'transparent' }}
              title={dark ? 'Mode clair' : 'Mode sombre'}>
              {dark ? '☀️' : '🌙'}
            </button>
          </nav>

          {/* Mobile controls: theme toggle + hamburger — hidden on desktop */}
          <div className="flex md:hidden items-center gap-2">
            <button onClick={() => setDark(d => !d)}
              className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
              style={{ border: '1px solid var(--border)', color: 'var(--text-muted)', background: 'transparent' }}
              title={dark ? 'Mode clair' : 'Mode sombre'}>
              {dark ? '☀️' : '🌙'}
            </button>
            <button
              onClick={() => setMenuOpen(o => !o)}
              className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
              style={{ border: '1px solid var(--border)', color: 'var(--text)', background: 'transparent' }}
              aria-label="Menu"
            >
              {menuOpen ? '✕' : '☰'}
            </button>
          </div>
        </div>

        {/* Mobile dropdown menu */}
        {menuOpen && (
          <nav
            className="md:hidden flex flex-col px-4 pb-3 gap-1"
            style={{ backgroundColor: 'var(--surface)', borderTop: '1px solid var(--border)' }}
          >
            {TABS.map(t => (
              <button key={t.id} onClick={() => switchTab(t.id)}
                style={tab === t.id
                  ? { background: '#111827', color: 'white' }
                  : { color: 'var(--text-muted)', background: 'transparent' }}
                className="px-3 py-2.5 rounded-lg text-sm font-medium text-left transition-all">
                <span className="mr-1.5">{t.icon}</span>{t.label}
              </button>
            ))}
          </nav>
        )}
      </header>

      <main className="max-w-5xl mx-auto px-3 md:px-4 py-4 md:py-6">
        {PAGES[tab]}
      </main>
    </div>
  )
}