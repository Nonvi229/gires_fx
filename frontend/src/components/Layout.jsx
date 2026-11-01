import { useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import Background, { Logo } from './Background'
import { NAV } from '../config/nav'
import '../css/layout.css'
import ConfirmDialog from './ConfirmDialog'

function Icon({ d }) {
    return (
        <svg className="nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
            aria-hidden="true">
            <path d={d} />
        </svg>
    )
}

function HomeLogo() {
    return (
        <Link to="/" className="logo-link" aria-label="GIRES FX, retour à l’accueil">
            <Logo />
        </Link>
    )
}

const TITLE_OVERRIDES = { '/': 'Tableau de bord' }

// Titre de la section courante, d'après NAV (les pages de détail gardent le titre de leur section)
function pageTitle(pathname) {
    const match = NAV
        .filter((n) => (n.to === '/' ? pathname === '/' : pathname === n.to || pathname.startsWith(`${n.to}/`)))
        .sort((a, b) => b.to.length - a.to.length)[0]
    if (!match) return ''
    return TITLE_OVERRIDES[match.to] ?? match.label
}

const linkClass = ({ isActive }) => `nav-link${isActive ? ' active' : ''}`
const KEY = 'sidebar-collapsed'
const readCollapsed = () => {
    try { return localStorage.getItem(KEY) === '1' } catch { return false }
}

export default function Layout() {
    const nav = useNavigate()
    const [more, setMore] = useState(false)
    const { pathname } = useLocation()
    const title = pageTitle(pathname)

    const [confirmLogout, setConfirmLogout] = useState(false)
    const logout = () => {
        localStorage.removeItem('token')
        nav('/login', { replace: true, state: { message: 'Vous avez été déconnecté. À bientôt !' } })
    }
    const askLogout = () => { setMore(false); setConfirmLogout(true) }
    const secondary = NAV.filter((n) => !n.mobile)
    const [collapsed, setCollapsed] = useState(readCollapsed)

    const toggleSidebar = () => {
        setCollapsed((c) => {
            try { localStorage.setItem(KEY, c ? '0' : '1') } catch { /* ignoré */ }
            return !c
        })
    }

    return (
        <>
            <Background />
            <div className={`shell${collapsed ? ' is-collapsed' : ''}`}>
                <aside className="sidebar">
                    <div className="sidebar__head">
                        <HomeLogo />
                        <button
                            type="button" className="collapse-btn"
                            onClick={toggleSidebar}
                            aria-expanded={!collapsed}
                            aria-label={collapsed ? 'Déplier le menu' : 'Replier le menu'}
                        >
                            <Icon d={collapsed ? 'M9 6l6 6-6 6' : 'M15 6l-6 6 6 6'} />
                        </button>
                    </div>
                    <nav aria-label="Menu principal" className="sidebar__nav">
                        {NAV.map((n) => (
                            <NavLink key={n.to} to={n.to} end={n.end} className={linkClass} title={n.label}>
                                <Icon d={n.icon} /><span>{n.label}</span>
                            </NavLink>
                        ))}
                    </nav>
                    <button type="button" className="nav-link nav-logout" onClick={askLogout} title="Déconnexion">
                        <Icon d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 8l-4 4 4 4M6 12h10" />
                        <span>Déconnexion</span>
                    </button>
                </aside>
                <div className="content">
                    <header className="topbar">
                        <div className="topbar__brand"><Logo /></div>
                        <h1 className="topbar__title">{title}</h1>
                    </header>
                    <main className="main">
                        <div key={pathname} className="page-transition">
                            <Outlet />
                        </div>
                    </main>
                </div>
            </div>

            <nav aria-label="Menu mobile" className="tabbar">
                {NAV.filter((n) => n.mobile).map((n) => (
                    <NavLink key={n.to} to={n.to} end={n.end} className={linkClass} onClick={() => setMore(false)}>
                        <Icon d={n.icon} /><span>{n.label}</span>
                    </NavLink>
                ))}
                <button type="button" className="nav-link" aria-expanded={more} onClick={() => setMore((m) => !m)}>
                    <Icon d="M5 12h.01M12 12h.01M19 12h.01" /><span>Plus</span>
                </button>
            </nav>

            {more && (
                <div className="sheet" role="menu" aria-label="Plus">
                    {secondary.map((n) => (
                        <NavLink key={n.to} to={n.to} className={linkClass} onClick={() => setMore(false)}>
                            <Icon d={n.icon} /><span>{n.label}</span>
                        </NavLink>
                    ))}
                    <button type="button" className="nav-link" onClick={askLogout}>
                        <Icon d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 8l-4 4 4 4M6 12h10" />
                        <span>Déconnexion</span>
                    </button>
                </div>
            )}

            {confirmLogout && (
                <ConfirmDialog
                    title="Se déconnecter ?"
                    message="Vous êtes sur le point de vous déconnectez de votre compte. Vous devrez vous reconnecter plus tard pour accéder à votre tableau de bord."
                    confirmLabel="Se déconnecter"
                    cancelLabel="Annuler"
                    onConfirm={() => { setConfirmLogout(false); logout() }}
                    onCancel={() => setConfirmLogout(false)}
                />
            )}
        </>
    )
}