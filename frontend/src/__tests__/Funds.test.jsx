import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Funds from '../pages/Funds'
import { createMovement, loadFunds } from '../js/mockFunds'
import { fmtMoney as rawMoney } from '../js/homeStats'

vi.mock('../js/mockFunds', () => ({ loadFunds: vi.fn(), createMovement: vi.fn() }))

// Intl insère des espaces insécables ; Testing Library les normalise dans le DOM
const fmtMoney = (n) => rawMoney(n).replace(/\s+/g, ' ')

const DATA = {
  balance: 1500,
  movements: [
    { id: 'm3', type: 'withdrawal', amount: 200, createdAt: '2026-10-05T09:00:00.000Z' },
    { id: 'm2', type: 'deposit', amount: 500, createdAt: '2026-09-03T09:00:00.000Z' },
    { id: 'm1', type: 'deposit', amount: 1000, createdAt: '2026-08-12T09:00:00.000Z' },
  ],
}

const region = (name) => within(screen.getByRole('region', { name }))
const amountField = () => region('Nouvelle opération').getByLabelText(/montant/i)
const submitBtn = () => region('Nouvelle opération').getByRole('button', { name: /effectuer le (dépôt|retrait)/i })

async function show() {
  render(<Funds />)
  await screen.findByRole('region', { name: 'Solde disponible' })
}

beforeEach(() => {
  loadFunds.mockReset()
  createMovement.mockReset()
  loadFunds.mockResolvedValue(structuredClone(DATA))
})

describe('Funds : résumé et historique', () => {
  it('affiche un état de chargement puis les cartes', async () => {
    render(<Funds />)
    expect(screen.getByRole('status')).toBeInTheDocument()
    await screen.findByRole('region', { name: 'Solde disponible' })
    expect(region('Solde disponible').getByText(fmtMoney(1500))).toBeInTheDocument()
    expect(region('Capital investi').getByText(fmtMoney(1300))).toBeInTheDocument()
    expect(region('Total déposé').getByText(fmtMoney(1500))).toBeInTheDocument()
    expect(region('Total retiré').getByText(fmtMoney(200))).toBeInTheDocument()
  })

  it('liste les opérations, la plus récente d’abord', async () => {
    await show()
    const items = region('Historique').getAllByRole('listitem')
    expect(items).toHaveLength(3)
    expect(items[0]).toHaveTextContent('Retrait')
    expect(items[1]).toHaveTextContent('Dépôt')
    expect(items[2]).toHaveTextContent('Dépôt')
  })

  it('filtre par type d’opération', async () => {
    await show()
    const histo = region('Historique')
    fireEvent.click(histo.getByRole('button', { name: 'Retraits' }))
    expect(histo.getByRole('button', { name: 'Retraits' })).toHaveAttribute('aria-pressed', 'true')
    expect(histo.getAllByRole('listitem')).toHaveLength(1)

    fireEvent.click(histo.getByRole('button', { name: 'Dépôts' }))
    expect(histo.getAllByRole('listitem')).toHaveLength(2)

    fireEvent.click(histo.getByRole('button', { name: 'Tous' }))
    expect(histo.getAllByRole('listitem')).toHaveLength(3)
  })

  it('affiche une erreur si le chargement échoue', async () => {
    loadFunds.mockRejectedValue(new Error('Serveur injoignable.'))
    render(<Funds />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Serveur injoignable.')
  })
})

describe('Funds : dépôt', () => {
  it('dépose, met à jour le solde et l’historique, vide le champ', async () => {
    createMovement.mockResolvedValue({
      movement: { id: 'm4', type: 'deposit', amount: 250.5, createdAt: '2026-11-01T10:00:00.000Z' },
      balance: 1750.5,
    })
    await show()
    fireEvent.change(amountField(), { target: { value: '250,50' } })
    fireEvent.click(submitBtn())

    await waitFor(() => expect(createMovement).toHaveBeenCalledWith({ type: 'deposit', amount: 250.5 }))
    expect(await region('Nouvelle opération').findByText(/dépôt de .* effectué/i)).toBeInTheDocument()
    await waitFor(() =>
      expect(region('Solde disponible').getByText(fmtMoney(1750.5))).toBeInTheDocument())
    expect(region('Historique').getAllByRole('listitem')).toHaveLength(4)
    expect(amountField()).toHaveValue('')
  })

  it('refuse un champ vide ou invalide sans appeler l’API', async () => {
    await show()
    fireEvent.click(submitBtn())
    expect(region('Nouvelle opération').getByRole('alert')).toHaveTextContent('Saisissez un montant.')

    fireEvent.change(amountField(), { target: { value: 'abc' } })
    fireEvent.click(submitBtn())
    expect(region('Nouvelle opération').getByRole('alert')).toHaveTextContent(/invalide/i)
    expect(createMovement).not.toHaveBeenCalled()
  })

  it('remplit le champ avec un montant rapide', async () => {
    await show()
    fireEvent.click(
      region('Nouvelle opération').getByRole('button', {
        name: (n) => n.replace(/\s+/g, ' ') === fmtMoney(1000),
      })
    )
    expect(amountField()).toHaveValue('1000')
  })

  it('affiche l’erreur du serveur', async () => {
    createMovement.mockRejectedValue(new Error('Serveur injoignable.'))
    await show()
    fireEvent.change(amountField(), { target: { value: '100' } })
    fireEvent.click(submitBtn())
    expect(await region('Nouvelle opération').findByRole('alert')).toHaveTextContent('Serveur injoignable.')
  })
})

describe('Funds : retrait', () => {
  const chooseWithdrawal = () => fireEvent.click(screen.getByRole('radio', { name: 'Retrait' }))

  it('demande confirmation avant de retirer', async () => {
    createMovement.mockResolvedValue({
      movement: { id: 'm4', type: 'withdrawal', amount: 300, createdAt: '2026-11-01T10:00:00.000Z' },
      balance: 1200,
    })
    await show()
    chooseWithdrawal()
    fireEvent.change(amountField(), { target: { value: '300' } })
    fireEvent.click(submitBtn())

    expect(screen.getByRole('alertdialog', { name: 'Confirmer le retrait ?' })).toBeInTheDocument()
    expect(createMovement).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Retirer' }))
    await waitFor(() => expect(createMovement).toHaveBeenCalledWith({ type: 'withdrawal', amount: 300 }))
    await waitFor(() =>
      expect(region('Solde disponible').getByText(fmtMoney(1200))).toBeInTheDocument())
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('annuler la confirmation ne retire rien', async () => {
    await show()
    chooseWithdrawal()
    fireEvent.change(amountField(), { target: { value: '300' } })
    fireEvent.click(submitBtn())
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(createMovement).not.toHaveBeenCalled()
  })

  it('refuse un retrait supérieur au solde, sans confirmation', async () => {
    await show()
    chooseWithdrawal()
    fireEvent.change(amountField(), { target: { value: '5000' } })
    fireEvent.click(submitBtn())
    expect(region('Nouvelle opération').getByRole('alert')).toHaveTextContent(/insuffisant/i)
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(createMovement).not.toHaveBeenCalled()
  })

  it('« Tout retirer » remplit le solde disponible', async () => {
    await show()
    chooseWithdrawal()
    fireEvent.click(region('Nouvelle opération').getByRole('button', { name: 'Tout retirer' }))
    expect(amountField()).toHaveValue('1500')
  })
})

const at = (y, m, d, h = 12) => new Date(y, m - 1, d, h, 0).toISOString()
const many = (n) =>
  Array.from({ length: n }, (_, i) => ({
    id: `x${i}`,
    type: i % 2 ? 'withdrawal' : 'deposit',
    amount: 10 + i,
    createdAt: new Date(2026, 9, 28 - i, 10, 0).toISOString(), // un jour de moins à chaque fois
  }))

describe('Funds : historique groupé par date', () => {
  it('regroupe les opérations d’un même jour sous un titre de date', async () => {
    loadFunds.mockResolvedValue({
      balance: 1000,
      movements: [
        { id: 'a', type: 'deposit', amount: 100, createdAt: at(2026, 10, 5, 18) },
        { id: 'b', type: 'withdrawal', amount: 50, createdAt: at(2026, 10, 5, 9) },
        { id: 'c', type: 'deposit', amount: 200, createdAt: at(2026, 9, 3, 9) },
      ],
    })
    await show()
    const histo = region('Historique')
    const titles = histo.getAllByRole('heading', { level: 4 })
    expect(titles).toHaveLength(2)
    expect(titles[0]).toHaveTextContent(/5 octobre 2026/)
    expect(titles[1]).toHaveTextContent(/3 septembre 2026/)
    expect(histo.getAllByRole('list')).toHaveLength(2)
    expect(histo.getAllByRole('listitem')).toHaveLength(3)
  })

  it('affiche 10 opérations au maximum, avec un bouton pour voir le reste', async () => {
    loadFunds.mockResolvedValue({ balance: 1000, movements: many(14) })
    await show()
    const histo = region('Historique')
    expect(histo.getAllByRole('listitem')).toHaveLength(10)

    fireEvent.click(histo.getByRole('button', { name: 'Voir les 4 autres opérations' }))
    expect(histo.getAllByRole('listitem')).toHaveLength(14)
    expect(histo.getByRole('button', { name: 'Réduire' })).toHaveAttribute('aria-expanded', 'true')

    fireEvent.click(histo.getByRole('button', { name: 'Réduire' }))
    expect(histo.getAllByRole('listitem')).toHaveLength(10)
  })

  it('accorde le bouton au singulier', async () => {
    loadFunds.mockResolvedValue({ balance: 1000, movements: many(11) })
    await show()
    expect(region('Historique').getByRole('button', { name: 'Voir l’opération restante' })).toBeInTheDocument()
  })

  it('n’affiche pas de bouton quand tout tient dans la limite', async () => {
    await show() // 3 opérations
    expect(region('Historique').queryByRole('button', { name: /voir/i })).not.toBeInTheDocument()
  })

  it('revient à 10 opérations quand on change de filtre', async () => {
    loadFunds.mockResolvedValue({ balance: 1000, movements: many(30) })
    await show()
    const histo = region('Historique')
    fireEvent.click(histo.getByRole('button', { name: 'Voir les 20 autres opérations' }))
    expect(histo.getAllByRole('listitem')).toHaveLength(30)

    fireEvent.click(histo.getByRole('button', { name: 'Dépôts' })) // 15 dépôts
    expect(histo.getAllByRole('listitem')).toHaveLength(10)
    expect(histo.getByRole('button', { name: 'Voir les 5 autres opérations' })).toBeInTheDocument()
  })
})