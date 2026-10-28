import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import Background, { Logo } from '../components/Background'
import { api } from '../js/api'

export default function ResetPassword() {
  const [params] = useSearchParams()
  const nav = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [status, setStatus] = useState({ type: '', text: '' })
  const [loading, setLoading] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    if (password !== confirm) return setStatus({ type: 'error', text: 'Les mots de passe ne correspondent pas' })
    setLoading(true)
    try {
      await api.reset(params.get('token'), password)
      setStatus({ type: 'ok', text: 'Mot de passe modifié. Redirection…' })
      setTimeout(() => nav('/login'), 1500)
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
          <Logo title="Nouveau mot de passe"/>
          <p className="sub">Choisissez un mot de passe sécurisé</p>
          {status.text && <div className={`msg ${status.type}`}>{status.text}</div>}
          <div className="field"><label>Nouveau mot de passe</label>
            <input type="password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} /></div>
          <div className="field"><label>Confirmer</label>
            <input type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} /></div>
          <button className="btn-gold" disabled={loading}>
            {loading ? <span className="spinner" /> : 'Réinitialiser'}
          </button>
          <div className="auth-links"><Link to="/login">Retour à la connexion</Link></div>
        </form>
      </div>
    </>
  )
}