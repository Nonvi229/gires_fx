// `icon` : tracé SVG (viewBox 24x24). `mobile` : présent dans la barre du bas.
export const NAV = [
  { to: '/', label: 'Accueil', end: true, mobile: true,
    icon: 'M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z' },
  { to: '/assets', label: 'Actifs', mobile: true,
    icon: 'M3 17l6-6 4 4 8-8M15 7h6v6' },
  { to: '/algorithms', label: 'Algorithmes', mobile: true,
    icon: 'M12 2v4M12 18v4M2 12h4M18 12h4M5 5l3 3M16 16l3 3M5 19l3-3M16 8l3-3' },
  { to: '/trades', label: 'Trades', mobile: true,
    icon: 'M4 6h16M4 12h16M4 18h10' },
  { to: '/stats', label: 'Statistiques',
    icon: 'M5 20V10M12 20V4M19 20v-7' },
  { to: '/funds', label: 'Fonds',
    icon: 'M3 7h18v12H3zM3 7l3-3h12l3 3M16 13h2' },
  { to: '/settings', label: 'Paramètres',
    icon: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM12 3v3M12 18v3M3 12h3M18 12h3' },
]