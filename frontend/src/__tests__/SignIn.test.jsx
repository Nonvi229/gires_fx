import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SignIn from '../authentication/SignIn'
import { api } from '../js/api'
import { renderAt } from '../test/helpers'

vi.mock('../js/api', () => ({ api: { register: vi.fn() } }))

const show = () => renderAt('/signin', '/signin', <SignIn />)

async function fillIdentity(user, password, confirm) {
  await user.type(screen.getByLabelText('Prénom'), 'Alice')
  await user.type(screen.getByLabelText('Nom'), 'Martin')
  await user.type(screen.getByLabelText('Email'), 'alice@example.com')
  await user.type(screen.getByLabelText('Mot de passe'), password)
  await user.type(screen.getByLabelText('Confirmer le mot de passe'), confirm)
}

beforeEach(() => vi.resetAllMocks())

describe('SignIn', () => {
  it('inscrit puis va à /verify-code avec purpose=signup', async () => {
    api.register.mockResolvedValue({ message: 'ok' })
    const user = userEvent.setup()
    show()
    await fillIdentity(user, 'MotDePasse123', 'MotDePasse123')
    await user.click(screen.getByRole('button', { name: "S'inscrire" }))

    expect(api.register).toHaveBeenCalledWith('Alice', 'Martin', 'alice@example.com', 'MotDePasse123')
    const probe = await screen.findByTestId('probe')
    expect(probe).toHaveTextContent('/verify-code?email=alice%40example.com&purpose=signup')
    expect(probe).toHaveTextContent('un code à 5 chiffres')
  })

  it('refuse des mots de passe différents', async () => {
    const user = userEvent.setup()
    show()
    await fillIdentity(user, 'MotDePasse123', 'MotDePasse456')
    await user.click(screen.getByRole('button', { name: "S'inscrire" }))
    expect(await screen.findByText('Les mots de passe ne correspondent pas')).toBeInTheDocument()
    expect(api.register).not.toHaveBeenCalled()
  })

  it('refuse un mot de passe de moins de 8 caractères (contrôle JS)', async () => {
    const user = userEvent.setup()
    show()
    await fillIdentity(user, 'court', 'court')
    // fireEvent.submit contourne la validation HTML (minLength) pour atteindre le contrôle JS
    fireEvent.submit(document.querySelector('form'))
    expect(await screen.findByText('Le mot de passe doit contenir au moins 8 caractères')).toBeInTheDocument()
    expect(api.register).not.toHaveBeenCalled()
  })

  it('affiche l’erreur du serveur', async () => {
    api.register.mockRejectedValue(new Error('Une erreur est survenue'))
    const user = userEvent.setup()
    show()
    await fillIdentity(user, 'MotDePasse123', 'MotDePasse123')
    await user.click(screen.getByRole('button', { name: "S'inscrire" }))
    expect(await screen.findByText('Une erreur est survenue')).toBeInTheDocument()
    expect(screen.queryByTestId('probe')).not.toBeInTheDocument()
  })
})