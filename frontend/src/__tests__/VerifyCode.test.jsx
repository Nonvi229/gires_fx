import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import VerifyCode from '../authentication/VerifyCode'
import { api } from '../js/api'
import { renderAt } from '../test/helpers'

vi.mock('../js/api', () => ({
  api: { verifyEmail: vi.fn(), verifyResetCode: vi.fn(), resendCode: vi.fn(), forgot: vi.fn() },
}))

const RESET = '/verify-code?email=a%40b.c&purpose=reset'
const SIGNUP = '/verify-code?email=a%40b.c&purpose=signup'

const show = (entry) => renderAt(entry, '/verify-code', <VerifyCode />)
const inputs = () => screen.getAllByLabelText(/^Chiffre/)
const typeCode = async (user, code) => {
  await user.click(inputs()[0])
  await user.keyboard(code)
}
const tick = async (seconds) => {
  for (let i = 0; i < seconds; i++) await act(async () => { vi.advanceTimersByTime(1000) })
}

beforeEach(() => vi.resetAllMocks())

describe('VerifyCode : mot de passe oublié', () => {
  it('envoie le code au cinquième chiffre et passe à /reset-password avec le jeton', async () => {
    api.verifyResetCode.mockResolvedValue({ token: 'tok123' })
    const user = userEvent.setup()
    show(RESET)
    await typeCode(user, '12345')

    await waitFor(() => expect(api.verifyResetCode).toHaveBeenCalledWith('a@b.c', '12345'))
    const probe = await screen.findByTestId('probe')
    expect(probe).toHaveTextContent('/reset-password')
    expect(probe).toHaveTextContent('"token":"tok123"')
    expect(probe).not.toHaveTextContent('tok123|')   // le jeton n'est pas dans l'URL
    expect(api.verifyEmail).not.toHaveBeenCalled()
  })

  it('ne rappelle pas l’API avant 5 chiffres', async () => {
    const user = userEvent.setup()
    show(RESET)
    await typeCode(user, '1234')
    expect(api.verifyResetCode).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Valider le code' })).toBeDisabled()
  })

  it('accepte un collage', async () => {
    api.verifyResetCode.mockResolvedValue({ token: 't' })
    const user = userEvent.setup()
    show(RESET)
    await user.click(inputs()[0])
    await user.paste('12345')
    await waitFor(() => expect(api.verifyResetCode).toHaveBeenCalledWith('a@b.c', '12345'))
  })

  it('ignore les lettres', async () => {
    const user = userEvent.setup()
    show(RESET)
    await typeCode(user, 'ab')
    inputs().forEach((i) => expect(i).toHaveValue(''))
  })

  it('affiche l’erreur, vide les cases et secoue', async () => {
    api.verifyResetCode.mockRejectedValue(new Error('Code invalide ou expiré.'))
    const user = userEvent.setup()
    show(RESET)
    await typeCode(user, '00000')

    expect(await screen.findByText('Code invalide ou expiré.')).toBeInTheDocument()
    inputs().forEach((i) => expect(i).toHaveValue(''))
    expect(inputs()[0]).toHaveFocus()
    expect(inputs()[0].parentElement).toHaveClass('shake')
    expect(screen.queryByTestId('probe')).not.toBeInTheDocument()   // pas de redirection
  })

  it('affiche le message transmis par la page précédente', () => {
    renderAt(
      { pathname: '/verify-code', search: '?email=a%40b.c&purpose=reset', state: { message: 'Code envoyé.' } },
      '/verify-code', <VerifyCode />
    )
    expect(screen.getByText('Code envoyé.')).toBeInTheDocument()
  })

  it('bloque le renvoi 60 s puis rappelle forgot', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    api.forgot.mockResolvedValue({})
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    show(RESET)

    expect(screen.getByRole('button', { name: 'Renvoyer le code (60s)' })).toBeDisabled()
    await tick(60)
    const button = screen.getByRole('button', { name: 'Renvoyer le code' })
    expect(button).toBeEnabled()

    await user.click(button)
    expect(api.forgot).toHaveBeenCalledWith('a@b.c')
    expect(await screen.findByText('Un nouveau code vient d’être envoyé.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Renvoyer le code (60s)' })).toBeDisabled()
  })

  it('affiche l’erreur du renvoi', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    api.forgot.mockRejectedValue(new Error('Serveur injoignable.'))
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    show(RESET)
    await tick(60)
    await user.click(screen.getByRole('button', { name: 'Renvoyer le code' }))
    expect(await screen.findByText('Serveur injoignable.')).toBeInTheDocument()
  })
})

describe('VerifyCode : inscription', () => {
  it('active le compte puis va à /login avec un message', async () => {
    api.verifyEmail.mockResolvedValue({ message: 'Compte activé' })
    const user = userEvent.setup()
    show(SIGNUP)
    await typeCode(user, '54321')

    await waitFor(() => expect(api.verifyEmail).toHaveBeenCalledWith('a@b.c', '54321'))
    const probe = await screen.findByTestId('probe')
    expect(probe).toHaveTextContent('/login')
    expect(probe).toHaveTextContent('Compte activé. Vous pouvez vous connecter.')
    expect(api.verifyResetCode).not.toHaveBeenCalled()
  })

  it('utilise resendCode avec un délai de 30 s', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    api.resendCode.mockResolvedValue({})
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    show(SIGNUP)

    expect(screen.getByRole('button', { name: 'Renvoyer le code (30s)' })).toBeDisabled()
    await tick(30)
    await user.click(screen.getByRole('button', { name: 'Renvoyer le code' }))
    expect(api.resendCode).toHaveBeenCalledWith('a@b.c')
    expect(api.forgot).not.toHaveBeenCalled()
  })
})