import { render } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'

/** Affiche l'adresse et le state reçus : sert à vérifier les redirections. */
export function Probe() {
  const l = useLocation()
  return <div data-testid="probe">{l.pathname}{l.search}|{JSON.stringify(l.state)}</div>
}

/** Monte `element` sur `path` ; toute autre destination affiche <Probe />. */
export function renderAt(entry, path, element) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path={path} element={element} />
        <Route path="*" element={<Probe />} />
      </Routes>
    </MemoryRouter>
  )
}