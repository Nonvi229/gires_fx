import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Background, { Logo } from '../components/Background'
import { api } from '../js/api'

export default function LogIn() {
  const nav = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  async function onSubmit(e) {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      const { token } = await api.login(form.email, form.password)
      localStorage.setItem('token', token)
      nav('/')
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
          <Logo title="Connectez-vous"/>
          {error && <div className="msg error">{error}</div>}
          <div className="field">
            <label>Email</label>
            <input name="email" type="email" required value={form.email} onChange={onChange} />
          </div>
          <div className="field">
            <label>Mot de passe</label>
            <input name="password" type="password" required value={form.password} onChange={onChange} />
          </div>
          <button className="btn-gold" disabled={loading}>
            {loading ? <span className="spinner" /> : 'Se connecter'}
          </button>
          <div className="auth-links">
            <Link to="/forgot-password">Mot de passe oublié ?</Link>
            <Link to="/signin">Créer un compte</Link>
          </div>
        </form>
      </div>
    </>
  )
}