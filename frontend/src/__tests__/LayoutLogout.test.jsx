import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import Layout from '../components/Layout'


function LoginStub() {
    const { state } = useLocation()
    return <p>page de connexion : {state?.message}</p>
}

function show() {
    render(
        <MemoryRouter initialEntries={['/assets']}>
            <Routes>
                <Route path="/login" element={<LoginStub />} />
                <Route element={<Layout />}>
                    <Route path="*" element={<div>contenu</div>} />
                </Route>
            </Routes>
        </MemoryRouter>
    )
}


const logoutBtn = () => screen.getByRole('button', { name: 'Déconnexion' })

beforeEach(() => {
    localStorage.clear()
    localStorage.setItem('token', 'abc')
})

describe('Layout : déconnexion avec confirmation', () => {
    it('demande confirmation sans déconnecter', () => {
        show()
        fireEvent.click(logoutBtn())
        expect(screen.getByRole('alertdialog', { name: 'Se déconnecter ?' })).toBeInTheDocument()
        expect(localStorage.getItem('token')).toBe('abc')
        expect(screen.queryByText('page de connexion')).not.toBeInTheDocument()
    })

    it('annuler garde la session', () => {
        show()
        fireEvent.click(logoutBtn())
        fireEvent.click(screen.getByRole('button', { name: 'Annuler' }))
        expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
        expect(localStorage.getItem('token')).toBe('abc')
    })

    it('Échap garde la session', () => {
        show()
        fireEvent.click(logoutBtn())
        fireEvent.keyDown(screen.getByRole('alertdialog'), { key: 'Escape' })
        expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
        expect(localStorage.getItem('token')).toBe('abc')
    })

    it('confirmer efface le jeton et va à /login avec un message de déconnexion', async () => {
        show()
        fireEvent.click(logoutBtn())
        fireEvent.click(screen.getByRole('button', { name: 'Se déconnecter' }))
        expect(await screen.findByText(/vous avez été déconnecté/i)).toBeInTheDocument()
        expect(localStorage.getItem('token')).toBeNull()
    })
    it('sur mobile, le bouton du menu « Plus » demande aussi confirmation', () => {
        show()
        fireEvent.click(screen.getByRole('button', { name: 'Plus' }))
        const buttons = screen.getAllByRole('button', { name: 'Déconnexion' })
        fireEvent.click(buttons[buttons.length - 1]) // le dernier est celui du menu « Plus »
        expect(screen.getByRole('alertdialog', { name: 'Se déconnecter ?' })).toBeInTheDocument()
        expect(localStorage.getItem('token')).toBe('abc')
    })
})