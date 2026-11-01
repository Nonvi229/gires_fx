import { describe, expect, it } from 'vitest'
import { buildSeries, summarize } from '../js/mockSeries'

const NOW = new Date(2026, 10, 1, 14, 10)   // dimanche 1er novembre 2026, 14:10
const BALANCE = 12480.55

describe('buildSeries', () => {
  it.each(['day', 'week', 'month', 'year'])('%s : se termine sur le solde et sur « maintenant »', (p) => {
    const s = buildSeries(p, BALANCE, NOW)
    expect(s.length).toBeGreaterThanOrEqual(2)
    expect(s.at(-1).value).toBe(BALANCE)
    expect(s.at(-1).t).toBe(NOW.getTime())
  })

  it.each(['day', 'week', 'month', 'year'])('%s : dates strictement croissantes', (p) => {
    const t = buildSeries(p, BALANCE, NOW).map((x) => x.t)
    t.forEach((v, i) => i && expect(v).toBeGreaterThan(t[i - 1]))
  })

  it('jour : commence à minuit', () => {
    const s = buildSeries('day', BALANCE, NOW)
    expect(s[0].t).toBe(new Date(2026, 10, 1).getTime())
    expect(s[0].label).toBe('00:00')
  })

  it('semaine : 7 jours', () => expect(buildSeries('week', BALANCE, NOW)).toHaveLength(7))
  it('mois : un point par jour depuis le 1er', () => expect(buildSeries('month', BALANCE, NOW).length).toBe(1 + 1))
  it('année : commence le 1er janvier', () => {
    expect(buildSeries('year', BALANCE, NOW)[0].t).toBe(new Date(2026, 0, 1).getTime())
  })

  it('est reproductible', () => {
    expect(buildSeries('week', BALANCE, NOW)).toEqual(buildSeries('week', BALANCE, NOW))
  })

  it('le 1er du mois, la série mensuelle reste tracée (au moins 2 points)', () => {
    expect(buildSeries('month', BALANCE, new Date(2026, 10, 1, 0, 0)).length).toBeGreaterThanOrEqual(2)
  })
})

describe('summarize', () => {
  it('calcule écart et pourcentage', () => {
    const r = summarize([{ value: 100 }, { value: 110 }])
    expect(r.delta).toBe(10)
    expect(r.pct).toBe(10)
  })
  it('gère une perte', () => expect(summarize([{ value: 200 }, { value: 150 }]).delta).toBe(-50))
  it('évite la division par zéro', () => expect(summarize([{ value: 0 }, { value: 5 }]).pct).toBe(0))
})