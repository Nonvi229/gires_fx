import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { resetEngine, useEngine } from '../js/engine'

beforeEach(() => resetEngine())

describe('engine', () => {
  it('démarre en marche', () => {
    const { result } = renderHook(() => useEngine())
    expect(result.current.running).toBe(true)
    expect(result.current.haltedAt).toBeNull()
  })

  it('arrêt d’urgence puis reprise', async () => {
    const { result } = renderHook(() => useEngine())
    await act(async () => { await result.current.stop() })
    expect(result.current.running).toBe(false)
    expect(typeof result.current.haltedAt).toBe('string')

    await act(async () => { await result.current.resume() })
    expect(result.current.running).toBe(true)
    expect(result.current.haltedAt).toBeNull()
  })

  it('partage l’état entre plusieurs consommateurs', async () => {
    const a = renderHook(() => useEngine())
    const b = renderHook(() => useEngine())
    await act(async () => { await a.result.current.stop() })
    expect(b.result.current.running).toBe(false)
  })
})