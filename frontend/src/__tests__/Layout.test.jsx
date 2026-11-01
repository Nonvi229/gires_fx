import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import Layout from '../components/Layout'
import { Probe } from '../test/helpers'

function show(path = '/') {
    return render(
        <MemoryRouter initialEntries={[path]}>
            <Routes>
                <Route path="/login" element={<Probe />} />
                <Route element={<Layout />}>
                    <Route index element={<div>ACCUEIL</div>} />
                    <Route path="assets" element={<div>ACTIFS</div>} />
                    <Route path="stats" element={<div>STATS</div>} />
                </Route>
            </Routes>
        </MemoryRouter>
    )
}

const main = () => within(screen.getByRole('navigation', { name: 'Menu principal' }))
const mobile = () => within(screen.getByRole('navigation', { name: 'Menu mobile' }))

describe('Layout : menu', () => {
    it('affiche les 7 entrées avec les bonnes adresses', () => {
        show()
        const expected = {
            Accueil: '/', Actifs: '/assets', Algorithmes: '/algorithms', Trades: '/trades',
            Statistiques: '/stats', Fonds: '/funds', Paramètres: '/settings',
        }
        for (const [label, href] of Object.entries(expected)) {
            expect(main().getByRole('link', { name: label })).toHaveAttribute('href', href)
        }
    })

    it('affiche la page courante dans la zone de contenu', () => {
        show('/assets')
        expect(screen.getByText('ACTIFS')).toBeInTheDocument()
    })

    it('marque l’entrée active (et seulement elle)', () => {
        show('/assets')
        expect(main().getByRole('link', { name: 'Actifs' })).toHaveAttribute('aria-current', 'page')
        expect(main().getByRole('link', { name: 'Accueil' })).not.toHaveAttribute('aria-current')
    })

    it('navigue au clic', async () => {
        const user = userEvent.setup()
        show()
        await user.click(main().getByRole('link', { name: 'Statistiques' }))
        expect(screen.getByText('STATS')).toBeInTheDocument()
    })

    it('déconnecte : jeton effacé puis /login', async () => {
        localStorage.setItem('token', 'abc')
        const user = userEvent.setup()
        const { container } = show()
        const sidebar = within(container.querySelector('.sidebar'))
        await user.click(sidebar.getByRole('button', { name: 'Déconnexion' }))
        expect(localStorage.getItem('token')).toBeNull()
        expect(await screen.findByTestId('probe')).toHaveTextContent('/login')
    })
})

describe('Layout : interrupteur global', () => {
    it('bascule entre actifs et en pause', async () => {
        const user = userEvent.setup()
        show()
        const sw = screen.getByRole('switch')
        expect(sw).toBeChecked()
        expect(sw).toHaveTextContent('Algorithmes actifs')
        await user.click(sw)
        expect(sw).not.toBeChecked()
        expect(sw).toHaveTextContent('Algorithmes en pause')
    })
})

describe('Layout : mobile', () => {
    it('montre 4 entrées plus « Plus »', () => {
        show()
        const names = mobile().getAllByRole('link').map((l) => l.textContent)
        expect(names).toEqual(['Accueil', 'Actifs', 'Algorithmes', 'Trades'])
        expect(mobile().getByRole('button', { name: 'Plus' })).toBeInTheDocument()
    })

    it('« Plus » ouvre Statistiques, Fonds, Paramètres, puis se ferme à la navigation', async () => {
        const user = userEvent.setup()
        show()
        expect(screen.queryByRole('menu')).not.toBeInTheDocument()
        await user.click(mobile().getByRole('button', { name: 'Plus' }))

        const sheet = within(screen.getByRole('menu'))
        for (const label of ['Statistiques', 'Fonds', 'Paramètres', 'Déconnexion']) {
            expect(sheet.getByText(label)).toBeInTheDocument()
        }
        await user.click(sheet.getByRole('link', { name: 'Statistiques' }))
        expect(screen.getByText('STATS')).toBeInTheDocument()
        expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    })
})

describe('Layout : logo et repli', () => {
    it('le logo ramène à l’accueil', async () => {
        const user = userEvent.setup()
        show('/assets')
        const link = within(document.querySelector('.sidebar'))
            .getByRole('link', { name: /retour à l’accueil/ })
        expect(link).toHaveAttribute('href', '/')
        await user.click(link)
        expect(screen.getByText('ACCUEIL')).toBeInTheDocument()
    })

    it('replie et déplie le menu, et mémorise le choix', async () => {
        const user = userEvent.setup()
        const { container, unmount } = show()
        const shell = container.querySelector('.shell')
        expect(shell).not.toHaveClass('is-collapsed')

        await user.click(screen.getByRole('button', { name: 'Replier le menu' }))
        expect(shell).toHaveClass('is-collapsed')
        expect(localStorage.getItem('sidebar-collapsed')).toBe('1')
        // les libellés restent accessibles
        expect(main().getByRole('link', { name: 'Actifs' })).toHaveAttribute('title', 'Actifs')

        unmount()
        const again = show()
        expect(again.container.querySelector('.shell')).toHaveClass('is-collapsed')

        await user.click(screen.getByRole('button', { name: 'Déplier le menu' }))
        expect(localStorage.getItem('sidebar-collapsed')).toBe('0')
    })
})

it('rejoue l’animation à chaque changement de page', async () => {
    const user = userEvent.setup()
    const { container } = show()
    const first = container.querySelector('.page-transition')
    await user.click(main().getByRole('link', { name: 'Actifs' }))
    expect(container.querySelector('.page-transition')).not.toBe(first)
})