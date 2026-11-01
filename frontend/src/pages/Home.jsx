import { useEffect, useState } from 'react'
import PerformanceChart from '../components/PerformanceChart'

// Compteur animé
function useCountUp(target, duration = 1500) {
  const [v, setV] = useState(0)
  useEffect(() => {
    let raf, start
    const step = (t) => {
      start ??= t
      const p = Math.min((t - start) / duration, 1)
      setV(target * (1 - Math.pow(1 - p, 3)))
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])
  return v
}

const pairs = [
  ['BTC/USDT', '67 420', 1.8], ['ETH/USDT', '3 215', -0.6], ['EUR/USD', '1.0842', 0.2],
  ['XAU/USD', '2 391', 0.9], ['SOL/USDT', '172', 3.1], ['NAS100', '18 240', -0.3],
]

const trades = [
  { pair: 'BTC/USDT', side: 'BUY', pnl: 124.5, time: '10:42' },
  { pair: 'XAU/USD', side: 'SELL', pnl: -32.1, time: '10:15' },
  { pair: 'ETH/USDT', side: 'BUY', pnl: 58.9, time: '09:50' },
  { pair: 'EUR/USD', side: 'BUY', pnl: 21.3, time: '09:12' },
]

const BALANCE = 12480.55
export default function Home() {
  const [botOn, setBotOn] = useState(true)
  const balance = useCountUp(BALANCE)
  const profit = useCountUp(1832.4)
  const winrate = useCountUp(68.4)

  const ticker = [...pairs, ...pairs]

  return (
    <>
      <div className="ticker">
        <div className="ticker-track">
          {ticker.map(([p, price, ch], i) => (
            <span key={i}>
              {p} <b>{price}</b>{' '}
              <span className={ch >= 0 ? 'up' : 'down'}>{ch >= 0 ? '▲' : '▼'} {Math.abs(ch)}%</span>
            </span>
          ))}
        </div>
      </div>

      <main className="dash">
        <div className="grid">
          <div className="card" style={{ animationDelay: '.05s' }}>
            <h3>Solde</h3>
            <div className="big">${balance.toLocaleString('fr-FR', { maximumFractionDigits: 2 })}</div>
          </div>
          <div className="card" style={{ animationDelay: '.15s' }}>
            <h3>Profit du mois</h3>
            <div className="big up">+${profit.toLocaleString('fr-FR', { maximumFractionDigits: 2 })}</div>
          </div>
          <div className="card" style={{ animationDelay: '.25s' }}>
            <h3>Taux de réussite</h3>
            <div className="big">{winrate.toFixed(1)}%</div>
          </div>
          <div className="card" style={{ animationDelay: '.35s' }}>
            <h3>Algorithme</h3>
            <div className="bot-status">
              <span className={`dot ${botOn ? 'on' : ''}`} />
              <span>{botOn ? 'Actif' : 'À l’arrêt'}</span>
            </div>
            <button className="btn-gold" style={{ marginTop: 14 }} onClick={() => setBotOn(!botOn)}>
              {botOn ? 'Arrêter' : 'Démarrer'}
            </button>
          </div>
        </div>

        <div className="card chart-card" style={{ animationDelay: '.45s' }}>
          <h3>Performance</h3>
          <PerformanceChart balance={BALANCE} />
        </div>

        <div className="card" style={{ animationDelay: '.55s' }}>
          <h3>Derniers trades</h3>
          <table>
            <thead><tr><th>Paire</th><th>Sens</th><th>P&amp;L</th><th>Heure</th></tr></thead>
            <tbody>
              {trades.map((t, i) => (
                <tr key={i}>
                  <td>{t.pair}</td>
                  <td className={t.side === 'BUY' ? 'up' : 'down'}>{t.side}</td>
                  <td className={t.pnl >= 0 ? 'up' : 'down'}>{t.pnl >= 0 ? '+' : ''}{t.pnl}</td>
                  <td>{t.time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </>
  )
}