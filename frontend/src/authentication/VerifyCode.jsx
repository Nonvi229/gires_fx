import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import Background, { Logo } from '../components/Background'
import { api } from '../js/api'

const LENGTH = 5

export default function VerifyCode() {
  const nav = useNavigate()
  const [params] = useSearchParams()
  const email = params.get('email') || ''

  const [digits, setDigits] = useState(Array(LENGTH).fill(''))
  const [status, setStatus] = useState({ type: '', text: '' })
  const [loading, setLoading] = useState(false)
  const [shake, setShake] = useState(false)
  const [cooldown, setCooldown] = useState(30)
  const refs = useRef([])

  const code = digits.join('')

  useEffect(() => { refs.current[0]?.focus() }, [])

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  // Envoi automatique quand les 5 chiffres sont saisis
  useEffect(() => {
    if (code.length === LENGTH) submit()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code])

  function onChange(i, value) {
    const d = value.replace(/\D/g, '').slice(-1)
    const next = [...digits]
    next[i] = d
    setDigits(next)
    if (d && i < LENGTH - 1) refs.current[i + 1].focus()
  }

  function onKeyDown(i, e) {
    if (e.key === 'Backspace' && !digits[i] && i > 0) refs.current[i - 1].focus()
    if (e.key === 'ArrowLeft' && i > 0) refs.current[i - 1].focus()
    if (e.key === 'ArrowRight' && i < LENGTH - 1) refs.current[i + 1].focus()
  }

  function onPaste(e) {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, LENGTH)
    if (!text) return
    e.preventDefault()
    setDigits(Array.from({ length: LENGTH }, (_, i) => text[i] || ''))
    refs.current[Math.min(text.length, LENGTH - 1)].focus()
  }

  async function submit(e) {
    e?.preventDefault()
    if (code.length < LENGTH || loading) return
    setLoading(true)
    setStatus({ type: '', text: '' })
    try {
      const { token } = await api.verifyCode(email, code)
      nav(`/reset-password?token=${encodeURIComponent(token)}`)
    } catch (err) {
      setStatus({ type: 'error', text: err.message || 'Code invalide' })
      setShake(true)
      setTimeout(() => setShake(false), 500)
      setDigits(Array(LENGTH).fill(''))
      refs.current[0]?.focus()
    } finally {
      setLoading(false)
    }
  }

  async function resend() {
    if (cooldown > 0) return
    try {
      await api.forgot(email)
      setStatus({ type: 'ok', text: 'Un nouveau code vient d’être envoyé.' })
      setCooldown(30)
    } catch (err) {
      setStatus({ type: 'error', text: err.message })
    }
  }

  return (
    <>
      <Background />
      <div className="auth-page">
        <form className="auth-card" onSubmit={submit}>
          <Logo title="Validation du code" />
          <p className="sub">
            Entrez le code à 5 chiffres envoyé à<br />
            <b style={{ color: 'var(--gold-light)' }}>{email || 'votre adresse email'}</b>
          </p>

          {status.text && <div className={`msg ${status.type}`}>{status.text}</div>}

          <div className={`otp ${shake ? 'shake' : ''}`} onPaste={onPaste}>
            {digits.map((d, i) => (
              <input
                key={i}
                ref={(el) => (refs.current[i] = el)}
                value={d}
                inputMode="numeric"
                autoComplete={i === 0 ? 'one-time-code' : 'off'}
                maxLength={1}
                onChange={(e) => onChange(i, e.target.value)}
                onKeyDown={(e) => onKeyDown(i, e)}
                onFocus={(e) => e.target.select()}
                aria-label={`Chiffre ${i + 1}`}
              />
            ))}
          </div>

          <button className="btn-gold" disabled={loading || code.length < LENGTH}>
            {loading ? <span className="spinner" /> : 'Valider le code'}
          </button>

          <div className="auth-links">
            <button type="button" className="link-btn" onClick={resend} disabled={cooldown > 0}>
              {cooldown > 0 ? `Renvoyer le code (${cooldown}s)` : 'Renvoyer le code'}
            </button>
            <Link to="/forgot-password">Changer d’email</Link>
          </div>
        </form>
      </div>
    </>
  )
}