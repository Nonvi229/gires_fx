import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import EnginePanel from '../components/EnginePanel'

const BASE = {
  running: true,
  activeCount: 3,
  lastTradeAt: new Date(Date.now() - 4 * 60000).toISOString(),
  haltedAt: null,
}

function setup(props = {}) {
  const onStop = vi.fn().mockResolvedValue()
  const onResume = vi.fn().mockResolvedValue()
  render(<EnginePanel {...BASE} onStop={onStop} onResume={onResume} {...props} />)
  return { onStop, onResume }
}

const stopBtn = () => screen.getByRole('button', { name: /arrêt d.urgence/i })

describe('EnginePanel : en marche', () => {
  it('indique que les algorithmes tournent, leur nombre et la dernière activité', () => {
    setup()
    expect(screen.getByText('Algorithmes en marche')).toBeInTheDocument()
    expect(screen.getByText(/3 algorithmes actifs/)).toBeInTheDocument()
    expect(screen.getByText(/dernière activité il y a 4 minutes/i)).toBeInTheDocument()
  })

  it('accorde au singulier', () => {
    setup({ activeCount: 1 })
    expect(screen.getByText(/1 algorithme actif(?!s)/)).toBeInTheDocument()
  })

  it('demande une confirmation avant d’arrêter', () => {
    const { onStop } = setup()
    fireEvent.click(stopBtn())
    expect(screen.getByText(/arrêter tous les algorithmes/i)).toBeInTheDocument()
    expect(onStop).not.toHaveBeenCalled()
  })

  it('annule sans rien arrêter (bouton Annuler puis touche Échap)', () => {
    const { onStop } = setup()
    fireEvent.click(stopBtn())
    fireEvent.click(screen.getByRole('button', { name: /annuler/i }))
    expect(stopBtn()).toBeInTheDocument()

    fireEvent.click(stopBtn())
    fireEvent.keyDown(screen.getByRole('button', { name: /annuler/i }), { key: 'Escape' })
    expect(stopBtn()).toBeInTheDocument()
    expect(onStop).not.toHaveBeenCalled()
  })

  it('arrête une seule fois après confirmation', async () => {
    const { onStop } = setup()
    fireEvent.click(stopBtn())
    fireEvent.click(screen.getByRole('button', { name: /confirmer/i }))
    await waitFor(() => expect(onStop).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.queryByRole('button', { name: /confirmer/i })).not.toBeInTheDocument())
  })

  it('affiche l’erreur et garde la confirmation si l’arrêt échoue', async () => {
    const onStop = vi.fn().mockRejectedValue(new Error('Serveur injoignable.'))
    setup({ onStop })
    fireEvent.click(stopBtn())
    fireEvent.click(screen.getByRole('button', { name: /confirmer/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Serveur injoignable.')
    expect(screen.getByRole('button', { name: /confirmer/i })).toBeInTheDocument()
  })
})

describe('EnginePanel : arrêt d’urgence actif', () => {
  const stopped = { running: false, haltedAt: '2026-11-01T14:32:00' }

  it('indique l’arrêt et ne propose plus d’arrêter', () => {
    setup(stopped)
    expect(screen.getByText('Arrêt d’urgence activé')).toBeInTheDocument()
    expect(screen.getByText(/tous les algorithmes sont stoppés depuis/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /arrêt d.urgence/i })).not.toBeInTheDocument()
  })

  it('permet de reprendre', async () => {
    const { onResume } = setup(stopped)
    fireEvent.click(screen.getByRole('button', { name: /reprendre/i }))
    await waitFor(() => expect(onResume).toHaveBeenCalledTimes(1))
  })
})