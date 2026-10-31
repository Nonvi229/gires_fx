import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import PasswordField from '../components/PasswordField'

describe('PasswordField', () => {
  it('masque le mot de passe par défaut', () => {
    render(<PasswordField label="Mot de passe" />)
    expect(screen.getByLabelText('Mot de passe')).toHaveAttribute('type', 'password')
  })

  it('bascule entre masqué et visible', async () => {
    const user = userEvent.setup()
    render(<PasswordField label="Mot de passe" />)
    const input = screen.getByLabelText('Mot de passe')

    await user.click(screen.getByRole('button', { name: 'Afficher le mot de passe' }))
    expect(input).toHaveAttribute('type', 'text')
    const hide = screen.getByRole('button', { name: 'Masquer le mot de passe' })
    expect(hide).toHaveAttribute('aria-pressed', 'true')

    await user.click(hide)
    expect(input).toHaveAttribute('type', 'password')
  })

  it('transmet les props à l’input', () => {
    render(<PasswordField label="Mot de passe" name="password" autoComplete="new-password" minLength={8} required />)
    const input = screen.getByLabelText('Mot de passe')
    expect(input).toHaveAttribute('name', 'password')
    expect(input).toHaveAttribute('autocomplete', 'new-password')
    expect(input).toBeRequired()
  })

  it('ne soumet pas le formulaire en cliquant sur l’œil', async () => {
    let submitted = false
    const user = userEvent.setup()
    render(<form onSubmit={(e) => { e.preventDefault(); submitted = true }}><PasswordField label="MDP" /></form>)
    await user.click(screen.getByRole('button', { name: 'Afficher le mot de passe' }))
    expect(submitted).toBe(false)
  })
})