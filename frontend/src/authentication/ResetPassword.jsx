import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import Background, { Logo } from '../components/Background'
import { api } from '../js/api'
import PasswordField from '../components/PasswordField'

export default function ResetPassword() {
  const location = useLocation()
  const nav = useNavigate()
  const token = location.state?.token

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [status, setStatus] = useState({ type: '', text: '' })
  const [loading, setLoading] = useState(false)

  // Accès direct sans passer par la vérification du code
  if (!token) return <Navigate to="/forgot-password" replace />

  async function onSubmit(e) {
    e.preventDefault()
    if (password !== confirm) return setStatus({ type: 'error', text: 'Les mots de passe ne correspondent pas' })
    setLoading(true)
    setStatus({ type: '', text: '' })
    try {
      await api.resetPassword(token, password)
      setStatus({ type: 'ok', text: 'Mot de passe modifié. Redirection…' })
      setTimeout(() => nav('/login', {
        replace: true,
        state: { message: 'Votre mot de passe a été changé. Vous pouvez vous connecter.' },
      }), 1500)
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
          <Logo title="Nouveau mot de passe" />
          <p className="sub">Choisissez un mot de passe sécurisé</p>
          {status.text && <div className={`msg ${status.type}`}>{status.text}</div>}
          <PasswordField label="Nouveau mot de passe" value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password" minLength={8} required />
          <PasswordField label="Confirmer" value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password" required />
          <button className="btn-gold" disabled={loading}>
            {loading ? <span className="spinner" /> : 'Réinitialiser'}
          </button>
          <div className="auth-links">
            <Link to="/forgot-password">Recommencer</Link>
            <Link to="/login">Retour à la connexion</Link>
          </div>
        </form>
      </div>
    </>
  )
}