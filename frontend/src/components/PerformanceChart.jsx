import { useMemo, useState } from 'react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { PERIODS, buildSeries, summarize } from '../js/mockSeries'
import '../css/Chart.css'

const money = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'USD' })
const moneyShort = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 })

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div className="perf-tip">
      <span>{p.full}</span>
      <b>{money.format(p.value)}</b>
    </div>
  )
}

export default function PerformanceChart({ balance, now }) {
  const [period, setPeriod] = useState('day')
  const series = useMemo(
    () => buildSeries(period, balance, now),
    [period, balance, now?.getTime()]   // eslint-disable-line react-hooks/exhaustive-deps
  )
  const { delta, pct } = summarize(series)
  const up = delta >= 0

  return (
    <section className="card perf-card" aria-label="Évolution du solde">
      <div className="perf-head">
        <div>
          <h3>Évolution du solde</h3>
          <div className="perf-value">{money.format(balance)}</div>
          <div data-testid="perf-delta" className={`perf-delta ${up ? 'up' : 'down'}`}>
            {up ? '▲ +' : '▼ '}{money.format(delta)} ({up ? '+' : ''}{pct.toFixed(2)} %)
          </div>
        </div>

        <div className="perf-tabs" role="tablist" aria-label="Période">
          {PERIODS.map((p) => (
            <button
              key={p.key} type="button" role="tab"
              aria-selected={period === p.key}
              className={period === p.key ? 'active' : ''}
              onClick={() => setPeriod(p.key)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="perf-plot">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={series} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="perf-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#9fc4ff" stopOpacity=".42" />
                <stop offset="1" stopColor="#9fc4ff" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="perf-stroke" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor="#9fc4ff" />
                <stop offset="1" stopColor="#ffffff" />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(190,215,255,.08)" vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={36}
                   tick={{ fill: '#8d9bb3', fontSize: 12 }} />
            <YAxis domain={['auto', 'auto']} width={58} tickLine={false} axisLine={false}
                   tickFormatter={(v) => moneyShort.format(v)}
                   tick={{ fill: '#8d9bb3', fontSize: 12 }} />
            <Tooltip content={<ChartTooltip />}
                     cursor={{ stroke: 'rgba(207,226,255,.4)', strokeDasharray: '4 4' }} />
            <Area type="monotone" dataKey="value" stroke="url(#perf-stroke)" strokeWidth={2.5}
                  fill="url(#perf-fill)" dot={false}
                  activeDot={{ r: 5, fill: '#fff', stroke: '#9fc4ff', strokeWidth: 2 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}