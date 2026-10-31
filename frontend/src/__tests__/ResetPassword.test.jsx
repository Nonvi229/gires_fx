import { act, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ResetPassword from '../authentication/ResetPassword'
import { api } from '../js/api'
import { renderAt } from '../test/helpers'

vi.mock('../js/api', () => ({ api: { resetPassword: vi.fn() } }))

const withToken = { pathname: '/reset-password', state: { token: 'tok123' } }
const show = (entry = withToken) => renderAt(entry, '/reset-password', <ResetPassword />)

async function fill(user, a, b) {
  await user.type(screen.getByLabelText('Nouveau mot de passe'), a)
  await user.type(screen.getByLabelText('Confirmer'), b)
  await user.click(screen.getByRole('button', { name: 'Réinitialiser' }))
}

beforeEach(() => vi.resetAllMocks())

describe('ResetPassword', () => {
  it('renvoie vers /forgot-password sans jeton', async () => {
    show('/reset-password')
    expect(await screen.findByTestId('probe')).toHaveTextContent('/forgot-password')
  })

  it('refuse des mots de passe différents sans appeler l’API', async () => {
    const user = userEvent.setup()
    show()
    await fill(user, 'MotDePasse123', 'MotDePasse456')
    expect(await screen.findByText('Les mots de passe ne correspondent pas')).toBeInTheDocument()
    expect(api.resetPassword).not.toHaveBeenCalled()
  })

  it('envoie jeton et nouveau mot de passe, puis redirige vers /login', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    api.resetPassword.mockResolvedValue({ message: 'ok' })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    show()
    await fill(user, 'NouveauMdp456', 'NouveauMdp456')

    expect(api.resetPassword).toHaveBeenCalledWith('tok123', 'NouveauMdp456')
    expect(await screen.findByText('Mot de passe modifié. Redirection…')).toBeInTheDocument()

    await act(async () => { vi.advanceTimersByTime(1500) })
    const probe = await screen.findByTestId('probe')
    expect(probe).toHaveTextContent('/login')
    expect(probe).toHaveTextContent('Votre mot de passe a été changé')
  })

  it('affiche l’erreur du serveur (jeton expiré) et ne redirige pas', async () => {
    api.resetPassword.mockRejectedValue(new Error('Délai dépassé, recommencez la procédure.'))
    const user = userEvent.setup()
    show()
    await fill(user, 'NouveauMdp456', 'NouveauMdp456')
    expect(await screen.findByText('Délai dépassé, recommencez la procédure.')).toBeInTheDocument()
    expect(screen.queryByTestId('probe')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Recommencer' })).toHaveAttribute('href', '/forgot-password')
  })

  it('réactive le bouton après une erreur', async () => {
    api.resetPassword.mockRejectedValue(new Error('Erreur'))
    const user = userEvent.setup()
    show()
    await fill(user, 'NouveauMdp456', 'NouveauMdp456')
    await screen.findByText('Erreur')
    expect(screen.getByRole('button', { name: 'Réinitialiser' })).toBeEnabled()
  })
})