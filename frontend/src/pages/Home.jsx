import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import PerformanceChart from '../components/PerformanceChart'
import { loadDashboard } from '../js/mockHome'
import { fmtMoney, fmtPct, fmtPctSigned, fmtSigned, rankAlgorithms, tone } from '../js/homeStats'
import '../css/Home.css'
import EnginePanel from '../components/EnginePanel'
import { useEngine } from '../js/engine'

const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches

// Compteur animé (désactivé si l'utilisateur réduit les animations)
function useCountUp(target, duration = 1200) {
  const reduced = reducedMotion()
  const [v, setV] = useState(0)
  useEffect(() => {
    if (reduced) return
    let raf, start
    const step = (t) => {
      start ??= t
      const p = Math.min((t - start) / duration, 1)
      setV(target * (1 - Math.pow(1 - p, 3)))
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, duration, reduced])
  return reduced ? target : v
}

function StatCard({ label, value, signed = false, index, className = '' }) {
  const shown = useCountUp(value)
  return (
    <section className={`card stat rise ${className}`} style={{ '--i': index }} aria-label={label}>
      <h3>{label}</h3>
      <div className={`stat__value ${signed ? tone(value) : ''}`}>
        {signed ? fmtSigned(shown) : fmtMoney(shown)}
      </div>
    </section>
  )
}

function AssetRow({ asset, algoNames }) {
  const { symbol, invested, pnl, dayPnl, algorithms } = asset
  return (
    <li>
      <Link className="asset-row" to={`/assets/${encodeURIComponent(symbol)}`}>
        <div>
          <span className="asset-name">{symbol}</span>
          <span className="badges">
            {algorithms.map((id) => (
              <span className="badge" key={id}>{algoNames[id] ?? id}</span>
            ))}
          </span>
        </div>
        <div className="pnl">
          <b className={tone(pnl)}>{fmtSigned(pnl)}</b>
          <small>{invested ? fmtPctSigned(pnl / invested) : '—'}</small>
          <small>Jour : {dayPnl === 0 ? '—' : <span className={tone(dayPnl)}>{fmtSigned(dayPnl)}</span>}</small>
        </div>
      </Link>
    </li>
  )
}

export default function Home() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  const engine = useEngine()
  const activeCount = useMemo(
    () => (data ? new Set(data.assets.flatMap((a) => a.algorithms)).size : 0),
    [data]
  )

  useEffect(() => {
    let alive = true
    loadDashboard()
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e.message || 'Impossible de charger le tableau de bord.'))
    return () => { alive = false }
  }, [])

  const best = useMemo(
    () => (data ? rankAlgorithms(data.algorithms).find((a) => a.rank === 1) : undefined),
    [data]
  )
  const algoNames = useMemo(
    () => Object.fromEntries((data?.algorithms ?? []).map((a) => [a.id, a.name])),
    [data]
  )

  if (error) return <p role="alert" className="home-state down">{error}</p>
  if (!data) return <p role="status" className="home-state">Chargement…</p>

  const { balance, today, totals, assets } = data

  return (
    <div className="dash home">
      <EnginePanel
        running={engine.running}
        haltedAt={engine.haltedAt}
        activeCount={activeCount}
        lastTradeAt={data.lastTradeAt}
        onStop={engine.stop}
        onResume={engine.resume}
      />
      <div className="stat-row">
        <StatCard className="stat--balance" label="Solde actuel" value={balance} index={0} />
        <StatCard label="Gain du jour" value={today.gain} signed index={1} />
        <StatCard label="Perte du jour" value={today.loss} signed index={2} />
      </div>

      <div className="rise" style={{ '--i': 3 }}>
        <PerformanceChart balance={balance} />
      </div>

      <section className="card rise" style={{ '--i': 4 }} aria-label="Actifs tradés">
        <h3>Actifs tradés</h3>
        <ul className="asset-list">
          {assets.map((a) => <AssetRow key={a.symbol} asset={a} algoNames={algoNames} />)}
        </ul>
      </section>

      <div className="home-peek">
        <section className="card peek rise" style={{ '--i': 5 }} aria-label="Meilleur algorithme">
          <h3>Meilleur algorithme</h3>
          {best ? (
            <>
              <Link className="peek__title" to={`/algorithms/${best.id}`}>{best.name}</Link>
              <div className={`stat__value ${tone(best.netProfit)}`}>{fmtSigned(best.netProfit)}</div>
              <div className="peek__hint">Réussite {fmtPct(best.winRate)} · {best.trades} trades</div>
            </>
          ) : (
            <p className="peek__hint">Pas encore assez de trades pour établir un classement.</p>
          )}
          <Link className="peek__more" to="/algorithms">Voir le classement </Link>
        </section>

        <section className="card peek rise" style={{ '--i': 6 }} aria-label="Bilan global">
          <h3>Bilan global</h3>
          <div className="peek__lines">
            <div><span>Gains totaux</span><b className="up">{fmtSigned(totals.gains)}</b></div>
            <div><span>Pertes totales</span><b className="down">{fmtSigned(totals.losses)}</b></div>
          </div>
          <Link className="peek__more" to="/stats">Voir les statistiques </Link>
        </section>
      </div>
    </div>
  )
}