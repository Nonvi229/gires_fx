import { fmtMoney } from './homeStats'

export const MIN_AMOUNT = 1
export const MAX_DEPOSIT = 1_000_000

export const roundCents = (n) => Math.round(n * 100) / 100

/** « 1 250,50 », « 1250.5 », « 100 » → nombre ; tout le reste → null (2 décimales maximum). */
export function parseAmount(raw) {
  const s = String(raw ?? '').replace(/[\s\u00a0\u202f]/g, '').replace(',', '.')
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null
  return Number(s)
}

export function summarizeMovements(movements) {
  let deposited = 0
  let withdrawn = 0
  for (const m of movements) {
    if (m.type === 'deposit') deposited += m.amount
    else if (m.type === 'withdrawal') withdrawn += m.amount
  }
  deposited = roundCents(deposited)
  withdrawn = roundCents(withdrawn)
  return { deposited, withdrawn, invested: roundCents(deposited - withdrawn) }
}

/** Retourne { amount, error } ; error vaut '' si la saisie est valide. */
export function validateAmount(raw, type, balance) {
  if (!String(raw ?? '').trim()) return { amount: null, error: 'Saisissez un montant.' }

  const amount = parseAmount(raw)
  if (amount === null) {
    return { amount: null, error: 'Montant invalide : chiffres uniquement, 2 décimales maximum.' }
  }
  if (amount < MIN_AMOUNT) {
    return { amount: null, error: `Le montant minimum est de ${fmtMoney(MIN_AMOUNT)}.` }
  }
  if (type === 'deposit' && amount > MAX_DEPOSIT) {
    return { amount: null, error: `Le dépôt maximum est de ${fmtMoney(MAX_DEPOSIT)}.` }
  }
  if (type === 'withdrawal' && amount > balance) {
    return { amount: null, error: `Solde insuffisant : ${fmtMoney(balance)} disponibles.` }
  }
  return { amount, error: '' }
}

export const HISTORY_LIMIT = 10

const pad = (n) => String(n).padStart(2, '0')
const F_DAY = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
})

/** Clé du jour dans le fuseau local : « 2026-11-03 ». */
export function dayKey(date) {
  const d = new Date(date)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function dayLabel(iso, now = new Date()) {
  const key = dayKey(iso)
  if (key === dayKey(now)) return 'Aujourd’hui'
  if (key === dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1))) return 'Hier'
  return F_DAY.format(new Date(iso))
}

/** Regroupe par jour des opérations déjà triées (la plus récente d'abord). */
export function groupByDay(movements, now = new Date()) {
  const groups = []
  for (const m of movements) {
    const key = dayKey(m.createdAt)
    const last = groups[groups.length - 1]
    if (last && last.key === key) last.items.push(m)
    else groups.push({ key, label: dayLabel(m.createdAt, now), items: [m] })
  }
  return groups
}