import { Link, useParams } from 'react-router-dom'

function Soon({ title, text, back }) {
  return (
    <section className="card page-soon">
      {back && <Link to={back.to}> {back.label}</Link>}
      <h2>{title}</h2>
      <p className="sub">{text}</p>
    </section>
  )
}

export const Assets = () => <Soon title="Actifs" text="Actifs tradés, gains, pertes et algorithmes actifs." />
export const AssetDetail = () => {
  const { symbol } = useParams()
  return <Soon title={symbol} text="Graphique, trades et choix des algorithmes pour cet actif." back={{ to: '/assets', label: 'Actifs' }} />
}
export const Algorithms = () => <Soon title="Algorithmes" text="Catalogue et classement par performance." />
export const AlgorithmDetail = () => {
  const { id } = useParams()
  return <Soon title={`Algorithme ${id}`} text="Statistiques, actifs et trades générés." back={{ to: '/algorithms', label: 'Algorithmes' }} />
}
export const Trades = () => <Soon title="Trades" text="Historique complet, filtres et export." />
export const Stats = () => <Soon title="Statistiques" text="Gains, pertes, investissement et actifs tradés depuis le début." />
export const Funds = () => <Soon title="Fonds" text="Dépôts, retraits et capital investi." />