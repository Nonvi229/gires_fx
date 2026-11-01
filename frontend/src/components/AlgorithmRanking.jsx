import { Link } from 'react-router-dom'
import { fmtPct, fmtRatio, fmtSigned, rankAlgorithms, tone } from '../js/homeStats'
import '../css/Ranking.css'
import '../css/Kpis.css'
export default function AlgorithmRanking({ algorithms, limit }) {
  const ranking = rankAlgorithms(algorithms)
  const shown = limit ? ranking.slice(0, limit) : ranking

  return (
    <ol className="ranking">
      {shown.map((a) => (
        <li key={a.id} className={`rank-item${a.rank ? '' : ' rank-item--off'}`}>
          <span
            className={`rank-pos${a.rank === 1 ? ' rank-pos--1' : ''}`}
            aria-label={a.rank ? `Rang ${a.rank}` : 'Non classé'}
          >
            {a.rank ?? '—'}
          </span>
          <Link className="rank-name" to={`/algorithms/${a.id}`}>{a.name}</Link>
          <b className={`rank-pnl ${tone(a.netProfit)}`}>{fmtSigned(a.netProfit)}</b>
          <span className="rank-meta">
            Réussite {fmtPct(a.winRate)} · Facteur de profit {fmtRatio(a.profitFactor)} ·
            Drawdown {fmtPct(a.maxDrawdown)} · {a.trades} trades
            {!a.rank && ' · Non classé (trades insuffisants)'}
          </span>
        </li>
      ))}
    </ol>
  )
}