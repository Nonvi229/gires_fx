export const MIN_TRADES = 20

const money = { style: 'currency', currency: 'USD', currencyDisplay: 'narrowSymbol' }
const F_MONEY = new Intl.NumberFormat('fr-FR', money)
const F_SIGNED = new Intl.NumberFormat('fr-FR', { ...money, signDisplay: 'exceptZero' })
const F_PCT = new Intl.NumberFormat('fr-FR', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 })
const F_PCT_SIGNED = new Intl.NumberFormat('fr-FR', {
  style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1, signDisplay: 'exceptZero',
})
const F_RATIO = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const F_DATE = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

export const fmtMoney = (n) => F_MONEY.format(n)
export const fmtSigned = (n) => F_SIGNED.format(n)
export const fmtPct = (ratio) => F_PCT.format(ratio)
export const fmtPctSigned = (ratio) => F_PCT_SIGNED.format(ratio)
export const fmtRatio = (n) => F_RATIO.format(n)
export const fmtDate = (iso) => F_DATE.format(new Date(iso))

/** Classe CSS selon le signe. */
export const tone = (n) => (n > 0 ? 'up' : n < 0 ? 'down' : '')

/**
 * Classement par profit net décroissant.
 * Les algorithmes sous `minTrades` ne sont pas classés (rank = null) et passent en fin de liste.
 */
export function rankAlgorithms(algorithms, minTrades = MIN_TRADES) {
  const byProfit = (a, b) => b.netProfit - a.netProfit
  const eligible = algorithms.filter((a) => a.trades >= minTrades).sort(byProfit)
  const others = algorithms.filter((a) => a.trades < minTrades).sort(byProfit)
  return [
    ...eligible.map((a, i) => ({ ...a, rank: i + 1 })),
    ...others.map((a) => ({ ...a, rank: null })),
  ]
}

const F_RTF = new Intl.RelativeTimeFormat('fr', { numeric: 'auto' })
const F_TIME = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' })

export const fmtTime = (iso) => F_TIME.format(new Date(iso))

/** « il y a 4 minutes », « il y a 2 heures »… (jamais dans le futur). */
export function fmtAgo(iso, now = Date.now()) {
  const s = Math.round((new Date(iso).getTime() - now) / 1000) // négatif = passé
  const abs = Math.abs(s)
  if (s > 0 || abs < 45) return 'à l’instant'
  if (abs < 3600) return F_RTF.format(Math.round(s / 60), 'minute')
  if (abs < 86400) return F_RTF.format(Math.round(s / 3600), 'hour')
  return F_RTF.format(Math.round(s / 86400), 'day')
}