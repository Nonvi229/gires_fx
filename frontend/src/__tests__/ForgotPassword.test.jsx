import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ForgotPassword from '../authentication/ForgotPassword'
import { api } from '../js/api'
import { renderAt } from '../test/helpers'

vi.mock('../js/api', () => ({ api: { forgot: vi.fn() } }))

const show = () => renderAt('/forgot-password', '/forgot-password', <ForgotPassword />)

beforeEach(() => vi.resetAllMocks())

describe('ForgotPassword', () => {
  it('demande un code puis va à /verify-code avec purpose=reset', async () => {
    api.forgot.mockResolvedValue({})
    const user = userEvent.setup()
    show()
    await user.type(screen.getByLabelText('Email'), 'alice@example.com')
    await user.click(screen.getByRole('button', { name: 'Envoyer le code' }))

    expect(api.forgot).toHaveBeenCalledWith('alice@example.com')
    const probe = await screen.findByTestId('probe')
    expect(probe).toHaveTextContent('/verify-code?email=alice%40example.com&purpose=reset')
    expect(probe).toHaveTextContent('un code à 5 chiffres')
  })

  it('affiche l’erreur et reste sur la page', async () => {
    api.forgot.mockRejectedValue(new Error('Serveur injoignable. Réessayez dans un instant.'))
    const user = userEvent.setup()
    show()
    await user.type(screen.getByLabelText('Email'), 'alice@example.com')
    await user.click(screen.getByRole('button', { name: 'Envoyer le code' }))
    expect(await screen.findByText('Serveur injoignable. Réessayez dans un instant.')).toBeInTheDocument()
    expect(screen.queryByTestId('probe')).not.toBeInTheDocument()
  })
})