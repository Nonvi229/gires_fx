import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Background, { Logo } from '../components/Background'
import { api } from '../js/api'

export default function SignIn() {
  const nav = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  async function onSubmit(e) {
    e.preventDefault()
    if (form.password !== form.confirm) return setError('Les mots de passe ne correspondent pas')
    setError(''); setLoading(true)
    try {
      await api.register(form.name, form.email, form.password)
      nav('/login')
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
          <Logo title="Inscrivez-vous"/>
          <p className="sub">Automatisez votre trading dès aujourd'hui</p>
          {error && <div className="msg error">{error}</div>}
          <div className="field"><label>Nom</label>
            <input name="name" required value={form.name} onChange={onChange} /></div>
          <div className="field"><label>Email</label>
            <input name="email" type="email" required value={form.email} onChange={onChange} /></div>
          <div className="field"><label>Mot de passe</label>
            <input name="password" type="password" minLength={8} required value={form.password} onChange={onChange} /></div>
          <div className="field"><label>Confirmer</label>
            <input name="confirm" type="password" required value={form.confirm} onChange={onChange} /></div>
          <button className="btn-gold" disabled={loading}>
            {loading ? <span className="spinner" /> : "S'inscrire"}
          </button>
          <div className="auth-links"><span>Déjà inscrit ?</span><Link to="/login">Se connecter</Link></div>
        </form>
      </div>
    </>
  )
}