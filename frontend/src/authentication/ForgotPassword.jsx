import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Background, { Logo } from '../components/Background'
import { api } from '../js/api'

export default function ForgotPassword() {

  const nav = useNavigate()
  
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState({ type: '', text: '' })
  const [loading, setLoading] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    setLoading(true); setStatus({ type: '', text: '' })
    try {
      await api.forgot(email)
      nav(`/verify-code?email=${encodeURIComponent(email)}`)
    } catch (err) {
      setStatus({ type: 'error', text: err.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Background />
      <div className="auth-page">
        <form className="auth-card" onSubmit={onSubmit}>
          <Logo />
          <h1>Mot de passe oublié</h1>
          <p className="sub">Entrez votre email pour recevoir un lien</p>
          {status.text && <div className={`msg ${status.type}`}>{status.text}</div>}
          <div className="field"><label>Email</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <button className="btn-gold" disabled={loading}>
            {loading ? <span className="spinner" /> : 'Envoyer le code'}
          </button>
          <div className="auth-links"><Link to="/login">Retour à la connexion</Link></div>
        </form>
      </div>
    </>
  )
}