import { describe, expect, it } from 'vitest'
import { groupByDay, MAX_DEPOSIT, parseAmount, summarizeMovements, validateAmount } from '../js/fundsStats'
describe('parseAmount', () => {
  it.each([
    ['100', 100],
    ['1250,50', 1250.5],
    ['1 250,50', 1250.5],
    ['1250.5', 1250.5],
    [' 12 ', 12],
    ['0,01', 0.01],
  ])('accepte %j', (raw, expected) => {
    expect(parseAmount(raw)).toBe(expected)
  })

  it.each(['', 'abc', '12,345', '-5', '1,2,3', '12.', '.5', '1e3', '10€'])('refuse %j', (raw) => {
    expect(parseAmount(raw)).toBeNull()
  })
})

describe('summarizeMovements', () => {
  it('additionne dépôts et retraits sans erreur d’arrondi', () => {
    const r = summarizeMovements([
      { type: 'deposit', amount: 100.1 },
      { type: 'deposit', amount: 200.2 },
      { type: 'withdrawal', amount: 50.05 },
    ])
    expect(r).toEqual({ deposited: 300.3, withdrawn: 50.05, invested: 250.25 })
  })

  it('renvoie des zéros sans opération', () => {
    expect(summarizeMovements([])).toEqual({ deposited: 0, withdrawn: 0, invested: 0 })
  })
})

describe('validateAmount', () => {
  it('refuse un champ vide', () => {
    expect(validateAmount('  ', 'deposit', 100).error).toMatch(/saisissez/i)
  })
  it('refuse un montant invalide', () => {
    expect(validateAmount('abc', 'deposit', 100).error).toMatch(/invalide/i)
  })
  it('refuse un montant sous le minimum', () => {
    expect(validateAmount('0,5', 'deposit', 100).error).toMatch(/minimum/i)
  })
  it('refuse un dépôt au-dessus du maximum', () => {
    expect(validateAmount(String(MAX_DEPOSIT + 1), 'deposit', 100).error).toMatch(/maximum/i)
  })
  it('refuse un retrait supérieur au solde', () => {
    expect(validateAmount('500', 'withdrawal', 100).error).toMatch(/insuffisant/i)
  })
  it('accepte un retrait égal au solde', () => {
    expect(validateAmount('100', 'withdrawal', 100)).toEqual({ amount: 100, error: '' })
  })
  it('accepte un dépôt valide, virgule comprise', () => {
    expect(validateAmount('250,50', 'deposit', 0)).toEqual({ amount: 250.5, error: '' })
  })
})

describe('groupByDay', () => {
  // dates construites en heure locale : les tests ne dépendent pas du fuseau de la machine
  const at = (y, m, d, h = 12) => new Date(y, m - 1, d, h, 0).toISOString()
  const now = new Date(2026, 10, 3, 15, 0) // 3 novembre 2026

  const items = [
    { id: 'a', createdAt: at(2026, 11, 3, 14) },
    { id: 'b', createdAt: at(2026, 11, 3, 9) },
    { id: 'c', createdAt: at(2026, 11, 2, 18) },
    { id: 'd', createdAt: at(2026, 10, 20) },
  ]

  it('regroupe les opérations d’un même jour, dans l’ordre reçu', () => {
    const groups = groupByDay(items, now)
    expect(groups.map((g) => g.items.map((m) => m.id))).toEqual([['a', 'b'], ['c'], ['d']])
  })

  it('étiquette Aujourd’hui, Hier, puis la date complète', () => {
    const groups = groupByDay(items, now)
    expect(groups[0].label).toBe('Aujourd’hui')
    expect(groups[1].label).toBe('Hier')
    expect(groups[2].label).toMatch(/20 octobre 2026/)
  })

  it('reconnaît « Hier » à cheval sur deux mois', () => {
    const decembre = new Date(2026, 11, 1, 10, 0)
    expect(groupByDay([{ id: 'x', createdAt: at(2026, 11, 30) }], decembre)[0].label).toBe('Hier')
  })

  it('renvoie une liste vide sans opération', () => {
    expect(groupByDay([], now)).toEqual([])
  })
})