import { useEffect, useMemo, useState } from 'react'
import ConfirmDialog from '../components/ConfirmDialog'
import { createMovement, loadFunds } from '../js/mockFunds'
import { fmtMoney, fmtSigned, fmtTime } from '../js/homeStats'
import { HISTORY_LIMIT, groupByDay, summarizeMovements, validateAmount } from '../js/fundsStats'
import '../css/Funds.css'

const NONE = { type: '', text: '' }
const TYPES = [
  { value: 'deposit', label: 'Dépôt' },
  { value: 'withdrawal', label: 'Retrait' },
]
const FILTERS = [
  { key: 'all', label: 'Tous' },
  { key: 'deposit', label: 'Dépôts' },
  { key: 'withdrawal', label: 'Retraits' },
]
const QUICK_DEPOSITS = [500, 1000, 5000]

function Icon({ d }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  )
}

function Feedback({ status }) {
  if (!status.text) return null
  return status.type === 'error'
    ? <p role="alert" className="msg error">{status.text}</p>
    : <p role="status" className="msg ok">{status.text}</p>
}

function StatCard({ label, value, index }) {
  return (
    <section className="card funds-stat" style={{ '--i': index }} aria-label={label}>
      <h3>{label}</h3>
      <div className="funds-stat__value">{fmtMoney(value)}</div>
    </section>
  )
}

export default function Funds() {
  const [data, setData] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [type, setType] = useState('deposit')
  const [raw, setRaw] = useState('')
  const [status, setStatus] = useState(NONE)
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState(null) // montant du retrait en attente de confirmation
  const [filter, setFilter] = useState('all')
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    let alive = true
    loadFunds()
      .then((d) => alive && setData(d))
      .catch((e) => alive && setLoadError(e.message || 'Impossible de charger vos fonds.'))
    return () => { alive = false }
  }, [])

  const totals = useMemo(() => summarizeMovements(data?.movements ?? []), [data])

  const shown = useMemo(() => {
    const list = [...(data?.movements ?? [])].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    )
    return filter === 'all' ? list : list.filter((m) => m.type === filter)
  }, [data, filter])

  const groups = useMemo(
    () => groupByDay(expanded ? shown : shown.slice(0, HISTORY_LIMIT)),
    [shown, expanded]
  )
  const hidden = Math.max(0, shown.length - HISTORY_LIMIT)

  if (loadError) return <p role="alert" className="funds-state down">{loadError}</p>
  if (!data) return <p role="status" className="funds-state">Chargement…</p>

  const run = async (kind, amount) => {
    setBusy(true)
    setStatus(NONE)
    try {
      const res = await createMovement({ type: kind, amount })
      setData((d) => ({ balance: res.balance, movements: [res.movement, ...d.movements] }))
      setRaw('')
      setStatus({
        type: 'ok',
        text: `${kind === 'deposit' ? 'Dépôt' : 'Retrait'} de ${fmtMoney(amount)} effectué.`,
      })
    } catch (e) {
      setStatus({ type: 'error', text: e.message || 'Opération impossible pour le moment.' })
    } finally {
      setBusy(false)
    }
  }

  const submit = (e) => {
    e.preventDefault()
    const { amount, error } = validateAmount(raw, type, data.balance)
    if (error) {
      setStatus({ type: 'error', text: error })
      return
    }
    if (type === 'withdrawal') setPending(amount) // un retrait demande confirmation
    else run('deposit', amount)
  }

  const changeType = (e) => {
    setType(e.target.value)
    setStatus(NONE)
  }

  const confirmWithdrawal = () => {
    const amount = pending
    setPending(null)
    run('withdrawal', amount)
  }

  const chooseFilter = (key) => {
    setFilter(key)
    setExpanded(false)
  }

  return (
    <div className="dash funds">
      <div className="funds-stats">
        <StatCard label="Solde disponible" value={data.balance} index={0} />
        <StatCard label="Capital investi" value={totals.invested} index={1} />
        <StatCard label="Total déposé" value={totals.deposited} index={2} />
        <StatCard label="Total retiré" value={totals.withdrawn} index={3} />
      </div>

      <div className="funds-cols">
        <section className="card" aria-label="Nouvelle opération">
          <h3>Nouvelle opération</h3>
          <form className="funds-form" onSubmit={submit} noValidate>
            <div className="seg" role="radiogroup" aria-label="Type d’opération">
              {TYPES.map((t) => (
                <label key={t.value}>
                  <input
                    type="radio" name="funds-type" value={t.value}
                    checked={type === t.value} onChange={changeType}
                  />
                  <span>{t.label}</span>
                </label>
              ))}
            </div>

            <div className="field">
              <label htmlFor="funds-amount">Montant (USD)</label>
              <input
                id="funds-amount" inputMode="decimal" autoComplete="off" placeholder="0,00"
                value={raw}
                onChange={(e) => { setRaw(e.target.value); setStatus(NONE) }}
              />
            </div>

            <div className="chips">
              {type === 'deposit'
                ? QUICK_DEPOSITS.map((v) => (
                  <button key={v} type="button" className="chip" onClick={() => setRaw(String(v))}>
                    {fmtMoney(v)}
                  </button>
                ))
                : (
                  <button
                    type="button" className="chip" disabled={data.balance <= 0}
                    onClick={() => setRaw(String(data.balance))}
                  >
                    Tout retirer
                  </button>
                )}
            </div>

            <p className="funds-hint">
              {type === 'deposit'
                ? 'Dépôt simulé : aucun argent réel n’est utilisé.'
                : `Disponible : ${fmtMoney(data.balance)}`}
            </p>

            <Feedback status={status} />
            <button type="submit" className="btn-gold" disabled={busy}>
              {busy ? 'Traitement…' : type === 'deposit' ? 'Effectuer le dépôt' : 'Effectuer le retrait'}
            </button>
          </form>
        </section>

        <section className="card" aria-label="Historique">
          <h3>Historique</h3>
          <div className="filters">
            {FILTERS.map((f) => (
              <button
                key={f.key} type="button" className="filter"
                aria-pressed={filter === f.key} onClick={() => chooseFilter(f.key)}
              >
                {f.label}
              </button>
            ))}
          </div>

          {shown.length === 0 ? (
            <p className="funds-hint">Aucune opération à afficher.</p>
          ) : (
            <>
              {groups.map((g) => (
                <div key={g.key} className="day">
                  <h4 className="day__title">{g.label}</h4>
                  <ul className="movements">
                    {g.items.map((m) => {
                      const isDeposit = m.type === 'deposit'
                      return (
                        <li key={m.id} className={`movement movement--${m.type}`}>
                          <span className="movement__icon" aria-hidden="true">
                            <Icon d={isDeposit ? 'M12 5v14M5 12l7 7 7-7' : 'M12 19V5M5 12l7-7 7 7'} />
                          </span>
                          <div>
                            <div className="movement__title">{isDeposit ? 'Dépôt' : 'Retrait'}</div>
                            <time className="movement__date" dateTime={m.createdAt}>
                              {fmtTime(m.createdAt)}
                            </time>
                          </div>
                          <b className={`movement__amount ${isDeposit ? 'up' : 'down'}`}>
                            {fmtSigned(isDeposit ? m.amount : -m.amount)}
                          </b>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ))}

              {hidden > 0 && (
                <button
                  type="button" className="more" aria-expanded={expanded}
                  onClick={() => setExpanded((v) => !v)}
                >
                  <span>
                    {expanded
                      ? 'Réduire'
                      : hidden === 1
                        ? 'Voir l’opération restante'
                        : `Voir les ${hidden} autres opérations`}
                  </span>
                  <svg className="more__chevron" width="16" height="16" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    aria-hidden="true">
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>
              )}
            </>
          )}
        </section>
      </div>

      {pending !== null && (
        <ConfirmDialog
          title="Confirmer le retrait ?"
          message={`Vous allez retirer ${fmtMoney(pending)} de votre solde disponible.`}
          confirmLabel="Retirer"
          cancelLabel="Annuler"
          onConfirm={confirmWithdrawal}
          onCancel={() => setPending(null)}
        />
      )}
    </div>
  )
}