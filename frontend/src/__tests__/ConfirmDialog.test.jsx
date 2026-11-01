import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import ConfirmDialog from '../components/ConfirmDialog'

function setup() {
  const onConfirm = vi.fn()
  const onCancel = vi.fn()
  render(
    <ConfirmDialog
      title="Se déconnecter ?" message="Texte d’explication"
      confirmLabel="Valider" cancelLabel="Annuler"
      onConfirm={onConfirm} onCancel={onCancel}
    />
  )
  return { onConfirm, onCancel }
}

describe('ConfirmDialog', () => {
  it('affiche le titre et le message, avec le focus sur « Annuler »', () => {
    setup()
    const dialog = screen.getByRole('alertdialog', { name: 'Se déconnecter ?' })
    expect(dialog).toHaveAccessibleDescription('Texte d’explication')
    expect(screen.getByRole('button', { name: 'Annuler' })).toHaveFocus()
  })

  it('confirme une seule fois', () => {
    const { onConfirm, onCancel } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Valider' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('annule avec le bouton, la touche Échap ou un clic sur le fond', () => {
    const { onConfirm, onCancel } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }))
    fireEvent.keyDown(screen.getByRole('alertdialog'), { key: 'Escape' })
    fireEvent.mouseDown(screen.getByRole('alertdialog').parentElement)
    expect(onCancel).toHaveBeenCalledTimes(3)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('un clic dans la boîte ne l’annule pas', () => {
    const { onCancel } = setup()
    fireEvent.mouseDown(screen.getByRole('alertdialog'))
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('garde le focus dans la boîte avec Tab', () => {
    setup()
    const cancel = screen.getByRole('button', { name: 'Annuler' })
    const confirm = screen.getByRole('button', { name: 'Valider' })

    confirm.focus()
    fireEvent.keyDown(confirm, { key: 'Tab' })
    expect(cancel).toHaveFocus()

    fireEvent.keyDown(cancel, { key: 'Tab', shiftKey: true })
    expect(confirm).toHaveFocus()
  })
})