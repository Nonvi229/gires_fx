import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Background, { Logo } from '../components/Background'
import { api } from '../js/api'
import PasswordField from '../components/PasswordField'

export default function SignIn() {
  const nav = useNavigate()
  const [form, setForm] = useState({ name: '', surname: '', email: '', password: '', confirm: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  async function onSubmit(e) {
    e.preventDefault()
    if (form.password.length < 8) return setError('Le mot de passe doit contenir au moins 8 caractères')
    if (form.password !== form.confirm) return setError('Les mots de passe ne correspondent pas')
    setError(''); setLoading(true)
    try {
      await api.register(form.name, form.surname, form.email, form.password)
      console.log('Inscription OK, redirection vers la vérification')
      nav(`/verify-code?email=${encodeURIComponent(form.email)}&purpose=signup`, {
        state: { message: 'Compte créé ! Un code à 5 chiffres vous a été envoyé par email.' },
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Background />
      <div className="auth-page">
        <form className="auth-card" onSubmit={onSubmit}>
          <Logo title="Inscrivez-vous" />
          <p className="sub">Automatisez votre trading dès aujourd'hui</p>
          {error && <div className="msg error">{error}</div>}

          <div className="field-row">
            <div className="field">
              <label htmlFor="name">Prénom</label>
              <input id="name" name="name" autoComplete="given-name" required
                     value={form.name} onChange={onChange} />
            </div>
            <div className="field">
              <label htmlFor="surname">Nom</label>
              <input id="surname" name="surname" autoComplete="family-name" required
                     value={form.surname} onChange={onChange} />
            </div>
          </div>

          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" autoComplete="email" required
                   value={form.email} onChange={onChange} />
          </div>

          <PasswordField
            label="Mot de passe"
            name="password"
            value={form.password}
            onChange={onChange}
            autoComplete="new-password"
            minLength={8}
            required
          />
          <PasswordField
            label="Confirmer le mot de passe"
            name="confirm"
            value={form.confirm}
            onChange={onChange}
            autoComplete="new-password"
            required
          />

          <button className="btn-gold" disabled={loading}>
            {loading ? <span className="spinner" /> : "S'inscrire"}
          </button>
          <div className="auth-links">
            <span>Déjà inscrit ?</span>
            <Link to="/login">Se connecter</Link>
          </div>
        </form>
      </div>
    </>
  )
}