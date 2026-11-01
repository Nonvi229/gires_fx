import { useEffect, useId, useRef } from 'react'
import '../css/Confirm.css'

export default function ConfirmDialog({
  title, message, confirmLabel = 'Confirmer', cancelLabel = 'Annuler', onConfirm, onCancel,
}) {
  const titleId = useId()
  const textId = useId()
  const boxRef = useRef(null)
  const cancelRef = useRef(null)

  // Focus sur « Annuler » à l'ouverture, retour au bouton d'origine à la fermeture
  useEffect(() => {
    const opener = document.activeElement
    cancelRef.current?.focus()
    return () => opener?.focus?.()
  }, [])

  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation()
      onCancel()
      return
    }
    if (e.key === 'Tab') {
      // garde le focus dans la boîte
      const buttons = boxRef.current.querySelectorAll('button')
      const first = buttons[0]
      const last = buttons[buttons.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
  }

  return (
    <div
      className="confirm-backdrop"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div
        ref={boxRef}
        className="confirm"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={textId}
        onKeyDown={onKeyDown}
      >
        <h2 id={titleId}>{title}</h2>
        <p id={textId}>{message}</p>
        <div className="confirm__actions">
          <button type="button" className="confirm__btn" ref={cancelRef} onClick={onCancel}>
            {cancelLabel}
          </button>
          <button type="button" className="confirm__btn confirm__btn--danger" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}