import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Settings from '../pages/Settings'
import { api } from '../js/api'

vi.mock('../js/api', () => ({
  api: { me: vi.fn(), updateProfile: vi.fn(), changePassword: vi.fn() },
}))

const ME = { name: 'Awa', surname: 'Dossou', email: 'awa@exemple.com' }
const region = (name) => within(screen.getByRole('region', { name }))

async function show() {
  render(<Settings />)
  await screen.findByDisplayValue('Awa')
}

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset())
  api.me.mockResolvedValue({ ...ME })
  localStorage.clear()
  delete document.documentElement.dataset.motion
})

describe('Settings : profil', () => {
  it('pré-remplit le profil, e-mail en lecture seule', async () => {
    await show()
    const profil = region('Profil')
    expect(profil.getByLabelText('Nom')).toHaveValue('Dossou')
    expect(profil.getByLabelText('Adresse e-mail')).toHaveValue('awa@exemple.com')
    expect(profil.getByLabelText('Adresse e-mail')).toHaveAttribute('readonly')
  })

  it('n’active « Enregistrer » qu’après une modification', async () => {
    await show()
    const profil = region('Profil')
    expect(profil.getByRole('button', { name: 'Enregistrer' })).toBeDisabled()
    fireEvent.change(profil.getByLabelText('Prénom'), { target: { value: 'Marc' } })
    expect(profil.getByRole('button', { name: 'Enregistrer' })).toBeEnabled()
  })

  it('envoie les valeurs nettoyées puis confirme', async () => {
    api.updateProfile.mockResolvedValue({ ...ME, name: 'Marc' })
    await show()
    const profil = region('Profil')
    fireEvent.change(profil.getByLabelText('Prénom'), { target: { value: '  Marc ' } })
    fireEvent.click(profil.getByRole('button', { name: 'Enregistrer' }))
    await waitFor(() =>
      expect(api.updateProfile).toHaveBeenCalledWith({ name: 'Marc', surname: 'Dossou' }))
    expect(await profil.findByText('Profil mis à jour.')).toBeInTheDocument()
    expect(profil.getByRole('button', { name: 'Enregistrer' })).toBeDisabled()
  })

  it('refuse un prénom vide ou trop court sans appeler l’API', async () => {
    await show()
    const profil = region('Profil')
    fireEvent.change(profil.getByLabelText('Prénom'), { target: { value: '   ' } })
    fireEvent.click(profil.getByRole('button', { name: 'Enregistrer' }))
    expect(profil.getByRole('alert')).toHaveTextContent('au moins 2 caractères')
    expect(api.updateProfile).not.toHaveBeenCalled()
  })

  it('affiche l’erreur du serveur', async () => {
    api.updateProfile.mockRejectedValue(new Error('Serveur injoignable.'))
    await show()
    const profil = region('Profil')
    fireEvent.change(profil.getByLabelText('Prénom'), { target: { value: 'Marc' } })
    fireEvent.click(profil.getByRole('button', { name: 'Enregistrer' }))
    expect(await profil.findByRole('alert')).toHaveTextContent('Serveur injoignable.')
  })
})

describe('Settings : mot de passe', () => {
  const fill = (current, next, confirm) => {
    const s = region('Sécurité')
    fireEvent.change(s.getByLabelText('Mot de passe actuel'), { target: { value: current } })
    fireEvent.change(s.getByLabelText('Nouveau mot de passe'), { target: { value: next } })
    fireEvent.change(s.getByLabelText('Confirmer le nouveau mot de passe'), { target: { value: confirm } })
  }
  const submit = () =>
    fireEvent.click(region('Sécurité').getByRole('button', { name: 'Changer le mot de passe' }))

  it('désactive le bouton tant que les trois champs ne sont pas remplis', async () => {
    await show()
    expect(region('Sécurité').getByRole('button', { name: 'Changer le mot de passe' })).toBeDisabled()
  })

  it('refuse des mots de passe différents sans appeler l’API', async () => {
    await show()
    fill('ancien123', 'nouveau456', 'autre7890')
    submit()
    expect(region('Sécurité').getByRole('alert')).toHaveTextContent('Les mots de passe ne correspondent pas.')
    expect(api.changePassword).not.toHaveBeenCalled()
  })

  it('refuse un mot de passe de moins de 8 caractères', async () => {
    await show()
    fill('ancien123', 'court', 'court')
    submit()
    expect(region('Sécurité').getByRole('alert')).toHaveTextContent('au moins 8 caractères')
    expect(api.changePassword).not.toHaveBeenCalled()
  })

  it('refuse un nouveau mot de passe identique à l’actuel', async () => {
    await show()
    fill('memeMdp123', 'memeMdp123', 'memeMdp123')
    submit()
    expect(region('Sécurité').getByRole('alert')).toHaveTextContent('différent de l’actuel')
    expect(api.changePassword).not.toHaveBeenCalled()
  })

  it('envoie les deux mots de passe, vide les champs et confirme', async () => {
    api.changePassword.mockResolvedValue({ token: 'nouveau-jeton' })
    await show()
    fill('ancien123', 'nouveau456', 'nouveau456')
    submit()
    await waitFor(() => expect(api.changePassword).toHaveBeenCalledWith('ancien123', 'nouveau456'))
    expect(await region('Sécurité').findByText('Mot de passe modifié.')).toBeInTheDocument()
    expect(region('Sécurité').getByLabelText('Mot de passe actuel')).toHaveValue('')
    expect(localStorage.getItem('token')).toBe('nouveau-jeton')
  })

  it('affiche l’erreur du serveur (ancien mot de passe incorrect)', async () => {
    api.changePassword.mockRejectedValue(new Error('Mot de passe actuel incorrect.'))
    await show()
    fill('mauvais123', 'nouveau456', 'nouveau456')
    submit()
    expect(await region('Sécurité').findByRole('alert')).toHaveTextContent('Mot de passe actuel incorrect.')
  })
})