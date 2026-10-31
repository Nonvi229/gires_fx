import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { api } from '../js/api'

vi.mock('../js/api', () => ({ api: { me: vi.fn() } }))
vi.mock('../pages/Home', () => ({ default: () => <div>PAGE HOME</div> }))
vi.mock('../authentication/LogIn', () => ({ default: () => <div>PAGE LOGIN</div> }))

const show = (path = '/') =>
  render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>)

beforeEach(() => vi.resetAllMocks())

describe('garde Private', () => {
  it('renvoie vers /login sans jeton, sans appeler l’API', async () => {
    show()
    expect(await screen.findByText('PAGE LOGIN')).toBeInTheDocument()
    expect(api.me).not.toHaveBeenCalled()
  })

  it('affiche la page quand le serveur valide le jeton', async () => {
    localStorage.setItem('token', 'jwt-ok')
    api.me.mockResolvedValue({ email: 'a@b.c' })
    show()
    expect(await screen.findByText('PAGE HOME')).toBeInTheDocument()
    expect(localStorage.getItem('token')).toBe('jwt-ok')
  })

  it('supprime le jeton refusé et renvoie vers /login', async () => {
    localStorage.setItem('token', 'jwt-perime')
    api.me.mockRejectedValue(new Error('Session invalide ou expirée'))
    show()
    expect(await screen.findByText('PAGE LOGIN')).toBeInTheDocument()
    expect(localStorage.getItem('token')).toBeNull()
  })

  it('une route inconnue renvoie vers / puis /login sans jeton', async () => {
    show('/nimporte-quoi')
    expect(await screen.findByText('PAGE LOGIN')).toBeInTheDocument()
  })
})