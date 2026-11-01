import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { api } from '../js/api'

vi.mock('../js/api', () => ({ api: { me: vi.fn() } }))
vi.mock('../pages/Home', () => ({ default: () => <div>PAGE HOME</div> }))
vi.mock('../authentication/LogIn', () => ({ default: () => <div>PAGE LOGIN</div> }))

const show = (path) =>
    render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>)

beforeEach(() => {
    vi.resetAllMocks()
    localStorage.setItem('token', 'jwt-ok')
    api.me.mockResolvedValue({ email: 'a@b.c' })
})

describe('routes protégées', () => {
    it.each([
        ['/assets', 'Actifs'],
        ['/algorithms', 'Algorithmes'],
        ['/trades', 'Trades'],
        ['/stats', 'Statistiques'],
        ['/funds', 'Fonds'],
        ['/settings', 'Paramètres'],
    ])('%s affiche la page « %s » dans le menu', async (path, title) => {
        show(path)
        expect(await screen.findByRole('heading', { name: title })).toBeInTheDocument()
        expect(screen.getByRole('navigation', { name: 'Menu principal' })).toBeInTheDocument()
    })

    it('/assets/EURUSD affiche le détail avec un lien retour', async () => {
        show('/assets/EURUSD')
        expect(await screen.findByRole('heading', { name: 'EURUSD' })).toBeInTheDocument()
        const back = screen.getByRole('link', { name: '← Actifs' })
        expect(back).toHaveAttribute('href', '/assets')
    })

    it('/algorithms/42 affiche le détail', async () => {
        show('/algorithms/42')
        expect(await screen.findByRole('heading', { name: 'Algorithme 42' })).toBeInTheDocument()
    })

    it.each(['/assets', '/stats', '/funds'])('%s sans jeton renvoie vers /login', async (path) => {
        localStorage.clear()
        show(path)
        expect(await screen.findByText('PAGE LOGIN')).toBeInTheDocument()
        expect(api.me).not.toHaveBeenCalled()
    })

    it('un jeton refusé par le serveur renvoie vers /login', async () => {
        api.me.mockRejectedValue(new Error('Session invalide ou expirée'))
        show('/trades')
        expect(await screen.findByText('PAGE LOGIN')).toBeInTheDocument()
        expect(localStorage.getItem('token')).toBeNull()
    })
})