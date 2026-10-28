import { useId, useState } from 'react'
import '../css/PasswordField.css'

function EyeIcon({ off }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
      {off && <path d="M4 4l16 16" />}
    </svg>
  )
}

// Même structure que vos autres champs : <div className="field"><label/><input/></div>
function PasswordField({ label, ...inputProps }) {
  const id = useId()
  const [visible, setVisible] = useState(false)

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <span className="pwd">
        <input {...inputProps} id={id} type={visible ? 'text' : 'password'} />
        <button
          type="button"
          className="pwd__toggle"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
          aria-pressed={visible}
        >
          <EyeIcon off={visible} />
        </button>
      </span>
    </div>
  )
}

export default PasswordField