import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import Layout from '../components/Layout'

function renderAt(path) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<Layout />}>
          <Route path="*" element={<div>contenu</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  )
}

describe('Layout : titre de page dans l’en-tête', () => {
  it.each([
    ['/', 'Tableau de bord'],
    ['/assets', 'Actifs'],
    ['/assets/EURUSD', 'Actifs'],
    ['/algorithms/42', 'Algorithmes'],
    ['/stats', 'Statistiques'],
    ['/funds', 'Fonds']
  ])('%s affiche « %s »', (path, title) => {
    renderAt(path)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(title)
  })
})