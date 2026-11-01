export const PERIODS = [
  { key: 'day', label: 'Jour' },
  { key: 'week', label: 'Semaine' },
  { key: 'month', label: 'Mois' },
  { key: 'year', label: 'Année' },
]

const VOLATILITY = { day: 0.0015, week: 0.006, month: 0.008, year: 0.012 }
const SEEDS = { day: 11, week: 23, month: 37, year: 53 }

function rng(seed) {
  let s = seed
  return () => (s = (s * 16807) % 2147483647) / 2147483647
}

function midnight(d) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

const DAY = 86400000

/** Dates des points, du début de la période jusqu'à `now` (dernier point = now). */
function buckets(period, now) {
  let start, step
  if (period === 'day') { start = midnight(now); step = 30 * 60000 }
  else if (period === 'week') { start = new Date(midnight(now).getTime() - 6 * DAY); step = DAY }
  else if (period === 'month') { start = new Date(now.getFullYear(), now.getMonth(), 1); step = DAY }
  else { start = new Date(now.getFullYear(), 0, 1); step = 7 * DAY }

  const out = []
  for (let t = start.getTime(); t <= now.getTime(); t += step) out.push(new Date(t))

  if (period === 'day') {
    if (out.at(-1).getTime() !== now.getTime()) out.push(new Date(now))
  } else {
    out[out.length - 1] = new Date(now)        // le dernier point est « maintenant »
  }
  if (out.length < 2) out.unshift(new Date(out[0].getTime() - step))
  return out
}

const fmtTime = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' })
const fmtDay = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' })
const fmtFullDay = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
const fmtFullTime = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
})

/** Évolution du solde, reproductible, qui se termine exactement sur `balance`. */
export function buildSeries(period, balance, now = new Date()) {
  const dates = buckets(period, now)
  const rand = rng(SEEDS[period])
  const vol = VOLATILITY[period] * balance

  let acc = 0
  const raw = dates.map((_, i) => (i === 0 ? 0 : (acc += (rand() - 0.47) * vol)))
  const shift = balance - raw.at(-1)

  return dates.map((d, i) => ({
    t: d.getTime(),
    label: period === 'day' ? fmtTime.format(d) : fmtDay.format(d),
    full: period === 'day' ? fmtFullTime.format(d) : fmtFullDay.format(d),
    value: Math.round((raw[i] + shift) * 100) / 100,
  }))
}

export function summarize(series) {
  const first = series[0].value
  const last = series.at(-1).value
  const delta = last - first
  return { first, last, delta, pct: first ? (delta / first) * 100 : 0 }
}