import { describe, expect, it } from 'vitest'
import { fmtAgo, fmtMoney, fmtSigned, rankAlgorithms, tone } from '../js/homeStats'

const algos = [
  { id: 'a', netProfit: 100, trades: 30 },
  { id: 'b', netProfit: 900, trades: 5 },
  { id: 'c', netProfit: 400, trades: 25 },
]

describe('rankAlgorithms', () => {
  it('classe par profit net décroissant', () => {
    const r = rankAlgorithms(algos)
    expect(r.map((a) => a.id)).toEqual(['c', 'a', 'b'])
    expect(r.map((a) => a.rank)).toEqual([1, 2, null])
  })

  it('ne classe pas les algorithmes sous le minimum de trades, même très rentables', () => {
    expect(rankAlgorithms(algos).find((a) => a.id === 'b').rank).toBeNull()
  })

  it('respecte un minimum personnalisé', () => {
    expect(rankAlgorithms(algos, 1).every((a) => a.rank)).toBe(true)
  })

  it('ne modifie pas le tableau d’entrée', () => {
    const copy = structuredClone(algos)
    rankAlgorithms(algos)
    expect(algos).toEqual(copy)
  })
})

describe('formats', () => {
  it('tone selon le signe', () => {
    expect(tone(1)).toBe('up')
    expect(tone(-1)).toBe('down')
    expect(tone(0)).toBe('')
  })

  it('fmtSigned n’ajoute aucun signe à zéro', () => {
    expect(fmtSigned(0)).toBe(fmtMoney(0))
    expect(fmtSigned(5)).not.toBe(fmtMoney(5))
  })
})

describe('fmtAgo', () => {
  const now = new Date('2026-11-01T12:00:00Z').getTime()
  const ago = (ms) => new Date(now - ms).toISOString()

  it('« à l’instant » sous 45 secondes', () => {
    expect(fmtAgo(ago(10_000), now)).toBe('à l’instant')
  })
  it('minutes et heures', () => {
    expect(fmtAgo(ago(4 * 60_000), now)).toMatch(/4 minutes/)
    expect(fmtAgo(ago(2 * 3_600_000), now)).toMatch(/2 heures/)
  })
  it('jamais dans le futur', () => {
    expect(fmtAgo(new Date(now + 5 * 60_000).toISOString(), now)).toBe('à l’instant')
  })
})