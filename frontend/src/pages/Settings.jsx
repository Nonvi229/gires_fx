import { useEffect, useState } from 'react'
import PasswordField from '../components/PasswordField'
import { api } from '../js/api'
import '../css/Settings.css'

const NONE = { type: '', text: '' }

function Feedback({ status }) {
  if (!status.text) return null
  return status.type === 'error'
    ? <p role="alert" className="msg error">{status.text}</p>
    : <p role="status" className="msg ok">{status.text}</p>
}

function ProfileSection() {
  const [initial, setInitial] = useState(null)
  const [form, setForm] = useState({ name: '', surname: '' })
  const [status, setStatus] = useState(NONE)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let alive = true
    api.me()
      .then((me) => {
        if (!alive) return
        setInitial(me)
        setForm({ name: me.name ?? '', surname: me.surname ?? '' })
      })
      .catch((e) => alive && setStatus({ type: 'error', text: e.message }))
    return () => { alive = false }
  }, [])

  const edit = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }))
    setStatus(NONE)
  }

  const dirty = !!initial &&
    (form.name.trim() !== (initial.name ?? '') || form.surname.trim() !== (initial.surname ?? ''))

  const submit = async (e) => {
    e.preventDefault()
    const name = form.name.trim()
    const surname = form.surname.trim()
    if (name.length < 2 || surname.length < 2) {
      setStatus({ type: 'error', text: 'Le prénom et le nom doivent contenir au moins 2 caractères.' })
      return
    }
    setBusy(true)
    setStatus(NONE)
    try {
      const me = await api.updateProfile({ name, surname })
      setInitial(me)
      setForm({ name: me.name ?? name, surname: me.surname ?? surname })
      setStatus({ type: 'ok', text: 'Profil mis à jour.' })
    } catch (err) {
      setStatus({ type: 'error', text: err.message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card settings__section" aria-labelledby="profile-title">
      <h2 id="profile-title">Profil</h2>
      <p className="settings__hint">Les informations associées à votre compte.</p>
      <form className="settings__form" onSubmit={submit} noValidate>
        <div className="settings__grid">
          <div className="field">
            <label htmlFor="profile-name">Prénom</label>
            <input id="profile-name" value={form.name} onChange={edit('name')} autoComplete="given-name" maxLength={100} />
          </div>
          <div className="field">
            <label htmlFor="profile-surname">Nom</label>
            <input id="profile-surname" value={form.surname} onChange={edit('surname')} autoComplete="family-name" maxLength={100} />
          </div>
        </div>
        <div className="field">
          <label htmlFor="profile-email">Adresse e-mail</label>
          <input id="profile-email" type="email" value={initial?.email ?? ''} readOnly />
        </div>
        <p className="settings__hint">L’adresse e-mail ne peut pas être modifiée pour le moment.</p>
        <Feedback status={status} />
        <button type="submit" className="btn-gold" disabled={!dirty || busy}>
          {busy ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </form>
    </section>
  )
}

function PasswordSection() {
  const [f, setF] = useState({ current: '', next: '', confirm: '' })
  const [status, setStatus] = useState(NONE)
  const [busy, setBusy] = useState(false)

  const edit = (key) => (e) => {
    setF((v) => ({ ...v, [key]: e.target.value }))
    setStatus(NONE)
  }

  const submit = async (e) => {
    e.preventDefault()
    if (f.next.length < 8) {
      setStatus({ type: 'error', text: 'Le nouveau mot de passe doit contenir au moins 8 caractères.' })
      return
    }
    if (f.next !== f.confirm) {
      setStatus({ type: 'error', text: 'Les mots de passe ne correspondent pas.' })
      return
    }
    if (f.next === f.current) {
      setStatus({ type: 'error', text: 'Le nouveau mot de passe doit être différent de l’actuel.' })
      return
    }
    setBusy(true)
    setStatus(NONE)
    try {
      const res = await api.changePassword(f.current, f.next)
      // le jeton est lié au mot de passe : le backend en émet un nouveau
      if (res?.token) localStorage.setItem('token', res.token)
      setF({ current: '', next: '', confirm: '' })
      setStatus({ type: 'ok', text: 'Mot de passe modifié.' })
    } catch (err) {
      setStatus({ type: 'error', text: err.message })
    } finally {
      setBusy(false)
    }
  }

  const incomplete = !f.current || !f.next || !f.confirm

  return (
    <section className="card settings__section" aria-labelledby="security-title">
      <h2 id="security-title">Sécurité</h2>
      <p className="settings__hint">Choisissez un mot de passe d’au moins 8 caractères.</p>
      <form className="settings__form" onSubmit={submit} noValidate>
        <PasswordField label="Mot de passe actuel" value={f.current} onChange={edit('current')} autoComplete="current-password" />
        <PasswordField label="Nouveau mot de passe" value={f.next} onChange={edit('next')} autoComplete="new-password" />
        <PasswordField label="Confirmer le nouveau mot de passe" value={f.confirm} onChange={edit('confirm')} autoComplete="new-password" />
        <Feedback status={status} />
        <button type="submit" className="btn-gold" disabled={incomplete || busy}>
          {busy ? 'Enregistrement…' : 'Changer le mot de passe'}
        </button>
      </form>
    </section>
  )
}

export default function Settings() {
  return (
    <div className="dash settings">
      <ProfileSection />
      <PasswordSection />
    </div>
  )
}