// Étoiles générées une seule fois, avec un générateur déterministe
function rng(seed) {
  let s = seed
  return () => (s = (s * 16807) % 2147483647) / 2147483647
}
const rand = rng(42)
const STARS = Array.from({ length: 110 }, () => ({
  x: rand() * 1400,
  y: rand() * 900,
  r: 0.5 + rand() * 1.5,
  o: 0.25 + rand() * 0.6,
  d: rand() * 6,
}))
const RAYS = Array.from({ length: 36 }, (_, i) => ({
  a: i * 10 + (rand() * 6 - 3),
  w: 1.5 + rand() * 4,
  o: 0.12 + rand() * 0.28,
}))

const CX = 700
const CY = 226

export default function Background() {
  return (
    <div className="bg" aria-hidden="true">
      <svg viewBox="0 0 1400 900" preserveAspectRatio="xMidYMid slice">
        <defs>
          <radialGradient id="gf-sky" cx="50%" cy="25%" r="75%">
            <stop offset="0" stopColor="#14213b" />
            <stop offset="0.45" stopColor="#0a1324" />
            <stop offset="1" stopColor="#03060c" />
          </radialGradient>
          <radialGradient id="gf-halo" cx="50%" cy="50%" r="50%">
            <stop offset="0" stopColor="#ffffff" stopOpacity=".9" />
            <stop offset="0.25" stopColor="#bcd6ff" stopOpacity=".35" />
            <stop offset="1" stopColor="#6c9bff" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="gf-ray" gradientUnits="userSpaceOnUse"
                          x1={CX} y1={CY} x2={CX} y2={CY - 800}>
            <stop offset="0" stopColor="#ffffff" stopOpacity="1" />
            <stop offset="1" stopColor="#9fc4ff" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="gf-beam" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="0.55" stopColor="#ffffff" stopOpacity=".95" />
            <stop offset="1" stopColor="#bcd6ff" stopOpacity="0" />
          </linearGradient>
          <filter id="gf-blur-lg" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="22" />
          </filter>
          <filter id="gf-blur-sm" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="7" />
          </filter>
          <filter id="gf-fog" x="-30%" y="-100%" width="160%" height="300%">
            <feGaussianBlur stdDeviation="40" />
          </filter>
        </defs>

        <rect width="1400" height="900" fill="url(#gf-sky)" />

        {STARS.map((s, i) => (
          <circle key={i} className="star" cx={s.x} cy={s.y} r={s.r}
                  fill="#dbe9ff" opacity={s.o} style={{ animationDelay: `${s.d}s` }} />
        ))}

        {/* Brume */}
        <g filter="url(#gf-fog)" fill="#6f87b0">
          <ellipse className="fog fog--a" cx="260" cy="700" rx="330" ry="70" opacity=".22" />
          <ellipse className="fog fog--b" cx="1150" cy="660" rx="380" ry="80" opacity=".2" />
          <ellipse className="fog fog--a" cx="700" cy="820" rx="560" ry="70" opacity=".18" />
        </g>

        {/* Halo et rayons */}
        <circle cx={CX} cy={CY} r="430" fill="url(#gf-halo)" opacity=".55" />
        <g className="rays">
          {RAYS.map((r, i) => (
            <polygon key={i} fill="url(#gf-ray)" opacity={r.o}
                     points={`${CX},${CY} ${CX - r.w},${CY - 800} ${CX + r.w},${CY - 800}`}
                     transform={`rotate(${r.a} ${CX} ${CY})`} />
          ))}
        </g>

        {/* Croix : copie floue pour le rayonnement, puis la croix nette */}
        <g filter="url(#gf-blur-lg)" opacity=".85">
          <rect x={CX - 22} y="90" width="44" height="420" fill="url(#gf-beam)" />
          <rect x={CX - 150} y={CY - 20} width="300" height="40" fill="#fff" />
        </g>
        <g className="cross" filter="url(#gf-blur-sm)" opacity=".9">
          <rect x={CX - 12} y="100" width="24" height="400" fill="url(#gf-beam)" />
          <rect x={CX - 140} y={CY - 11} width="280" height="22" fill="#fff" />
        </g>
        <g className="cross">
          <rect x={CX - 12} y="100" width="24" height="400" fill="url(#gf-beam)" />
          <rect x={CX - 140} y={CY - 11} width="280" height="22" fill="#fff" />
        </g>
      </svg>
    </div>
  )
}

export function Logo({ title = 'GIRES FX' }) {
  return (
    <div className="logo">
      <svg className="logo__cross" viewBox="0 0 64 64" aria-hidden="true">
        <defs>
          <radialGradient id="gf-logo-halo">
            <stop offset="0" stopColor="#fff" stopOpacity=".95" />
            <stop offset="0.35" stopColor="#bcd6ff" stopOpacity=".4" />
            <stop offset="1" stopColor="#6c9bff" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="32" cy="26" r="31" fill="url(#gf-logo-halo)" />
        <rect x="29" y="5" width="6" height="52" rx="1.2" fill="#fff" />
        <rect x="16" y="20" width="32" height="6" rx="1.2" fill="#fff" />
      </svg>
      <span>{title}</span>
    </div>
  )
}