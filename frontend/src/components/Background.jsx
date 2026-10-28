// Fond animé (bougies, courbe, halos) + logo réutilisable
const candles = Array.from({ length: 18 }, (_, i) => ({
  x: 40 + i * 75,
  y: 420 - ((i * 53) % 220),
  h: 30 + ((i * 37) % 90),
  up: i % 3 !== 0,
  delay: (i % 6) * 0.5,
}))

export function Logo({ size = 42, title }) {
  return (
    <div className="logo">
      <span>{title || 'GIRES FX'}</span>
    </div>
  )
}

export default function Background() {
  return (
    <div className="bg">
      <svg viewBox="0 0 1400 700" preserveAspectRatio="xMidYMid slice">
        <defs>
          <pattern id="grid" width="70" height="70" patternUnits="userSpaceOnUse">
            <path d="M70 0H0V70" fill="none" stroke="rgba(212,175,55,.06)" />
          </pattern>
          <radialGradient id="orb">
            <stop offset="0" stopColor="#d4af37" stopOpacity=".35" />
            <stop offset="1" stopColor="#d4af37" stopOpacity="0" />
          </radialGradient>
        </defs>

        <rect width="1400" height="700" fill="url(#grid)" />
        <circle className="orb" cx="250" cy="150" r="260" fill="url(#orb)" />
        <circle className="orb" cx="1150" cy="520" r="300" fill="url(#orb)" style={{ animationDelay: '2s' }} />

        {candles.map((c, i) => (
          <g key={i} className="candle" style={{ animationDelay: `${c.delay}s`, opacity: .35 }}>
            <line x1={c.x + 10} x2={c.x + 10} y1={c.y - 20} y2={c.y + c.h + 20}
                  stroke={c.up ? '#2ecc8f' : '#ff5c6c'} strokeWidth="2" />
            <rect x={c.x} y={c.y} width="20" height={c.h} rx="3"
                  fill={c.up ? '#2ecc8f' : '#ff5c6c'} />
          </g>
        ))}

        <path className="line" fill="none" stroke="#d4af37" strokeWidth="3" strokeLinecap="round"
              d="M0 560 C150 520 220 600 360 480 S560 420 700 360 S940 300 1080 200 S1300 120 1400 60" />
      </svg>
    </div>
  )
}