import { useSyncExternalStore } from 'react'

// Simulation locale. Plus tard : GET /engine/status, POST /engine/emergency-stop, POST /engine/resume.
const INITIAL = { running: true, haltedAt: null }
let state = INITIAL
const listeners = new Set()
const emit = () => listeners.forEach((l) => l())
const subscribe = (l) => { listeners.add(l); return () => listeners.delete(l) }
const getSnapshot = () => state

export async function emergencyStop() {
  state = { running: false, haltedAt: new Date().toISOString() }
  emit()
}

export async function resume() {
  state = INITIAL
  emit()
}

export function resetEngine() {
  state = INITIAL
  emit()
}

export function useEngine() {
  const s = useSyncExternalStore(subscribe, getSnapshot)
  return { ...s, stop: emergencyStop, resume }
}