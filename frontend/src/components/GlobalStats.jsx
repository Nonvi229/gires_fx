import { fmtDate, fmtMoney, fmtSigned } from '../js/homeStats'
import '../css/kpis.css'

export default function GlobalStats({ totals }) {
  return (
    <dl className="kpis">
      <div><dt>Gains totaux</dt><dd className="up">{fmtSigned(totals.gains)}</dd></div>
      <div><dt>Pertes totales</dt><dd className="down">{fmtSigned(totals.losses)}</dd></div>
      <div><dt>Total investi</dt><dd>{fmtMoney(totals.invested)}</dd></div>
      <div>
        <dt>Actifs tradés</dt>
        <dd>{totals.assetsTraded}</dd>
        <dd className="sub">depuis le {fmtDate(totals.firstInvestmentAt)}</dd>
      </div>
    </dl>
  )
}