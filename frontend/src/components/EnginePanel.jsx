import { useState } from 'react'
import { fmtAgo, fmtTime } from '../js/homeStats'
import '../css/Engine.css'

export default function EnginePanel({ running, activeCount, lastTradeAt, haltedAt, onStop, onResume }) {
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const run = async (action) => {
    setBusy(true)
    setError('')
    try {
      await action()
      setConfirming(false)
    } catch (e) {
      setError(e.message || 'Action impossible pour le moment.')
    } finally {
      setBusy(false)
    }
  }

  const plural = activeCount > 1 ? 's' : ''

  return (
    <section
      className={`card engine ${running ? 'engine--on' : 'engine--off'}`}
      aria-label="État des algorithmes"
      onKeyDown={(e) => { if (e.key === 'Escape') setConfirming(false) }}
    >
      <span className="engine__dot" aria-hidden="true" />

      <div className="engine__text" role="status">
        {running ? (
          <>
            <p className="engine__title">Algorithmes en marche</p>
            <p className="engine__meta">
              {activeCount} algorithme{plural} actif{plural}
              {lastTradeAt && <> · Dernière activité {fmtAgo(lastTradeAt)}</>}
            </p>
          </>
        ) : (
          <>
            <p className="engine__title">Arrêt d’urgence activé</p>
            <p className="engine__meta">
              Tous les algorithmes sont stoppés{haltedAt && <> depuis {fmtTime(haltedAt)}</>}
            </p>
          </>
        )}
      </div>

      <div className="engine__actions">
        {running && !confirming && (
          <button type="button" className="engine__btn engine__btn--stop" onClick={() => setConfirming(true)}>
            Arrêt d’urgence
          </button>
        )}

        {running && confirming && (
          <>
            <span className="engine__ask">Arrêter tous les algorithmes ?</span>
            <button
              type="button" className="engine__btn engine__btn--danger"
              disabled={busy} onClick={() => run(onStop)}
            >
              Confirmer l’arrêt
            </button>
            <button type="button" className="engine__btn" disabled={busy} autoFocus onClick={() => setConfirming(false)}>
              Annuler
            </button>
          </>
        )}

        {!running && (
          <button type="button" className="engine__btn" disabled={busy} onClick={() => run(onResume)}>
            Reprendre les algorithmes
          </button>
        )}
      </div>

      {error && <p role="alert" className="engine__error">{error}</p>}
    </section>
  )
}