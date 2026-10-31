import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import LogIn from '../authentication/LogIn'
import { api } from '../js/api'
import { renderAt } from '../test/helpers'

vi.mock('../js/api', () => ({ api: { login: vi.fn() } }))

async function submit(user) {
  await user.type(screen.getByLabelText('Email'), 'alice@example.com')
  await user.type(screen.getByLabelText('Mot de passe'), 'MotDePasse123')
  await user.click(screen.getByRole('button', { name: 'Se connecter' }))
}

beforeEach(() => vi.resetAllMocks())

describe('LogIn', () => {
  it('stocke le jeton puis va à /', async () => {
    api.login.mockResolvedValue({ token: 'jwt-abc' })
    const user = userEvent.setup()
    renderAt('/login', '/login', <LogIn />)
    await submit(user)

    expect(api.login).toHaveBeenCalledWith('alice@example.com', 'MotDePasse123')
    expect(await screen.findByTestId('probe')).toHaveTextContent('/|')
    expect(localStorage.getItem('token')).toBe('jwt-abc')
  })

  it('affiche l’erreur et ne stocke rien', async () => {
    api.login.mockRejectedValue(new Error('Email ou mot de passe incorrect'))
    const user = userEvent.setup()
    renderAt('/login', '/login', <LogIn />)
    await submit(user)

    expect(await screen.findByText('Email ou mot de passe incorrect')).toBeInTheDocument()
    expect(localStorage.getItem('token')).toBeNull()
    expect(screen.queryByTestId('probe')).not.toBeInTheDocument()
  })

  it('affiche le message de succès reçu par navigation', () => {
    renderAt(
      { pathname: '/login', state: { message: 'Compte activé. Vous pouvez vous connecter.' } },
      '/login', <LogIn />
    )
    expect(screen.getByText('Compte activé. Vous pouvez vous connecter.')).toBeInTheDocument()
  })

  it('propose les liens mot de passe oublié et inscription', () => {
    renderAt('/login', '/login', <LogIn />)
    expect(screen.getByRole('link', { name: 'Mot de passe oublié ?' })).toHaveAttribute('href', '/forgot-password')
    expect(screen.getByRole('link', { name: 'Créer un compte' })).toHaveAttribute('href', '/signin')
  })
})