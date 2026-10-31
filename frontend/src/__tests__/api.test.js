import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from '../js/api'

function mockFetch(status = 200, body = {}) {
  const fn = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  })
  vi.stubGlobal('fetch', fn)
  return fn
}

function lastCall(fn) {
  const [url, opts] = fn.mock.calls.at(-1)
  return { url, method: opts.method, headers: opts.headers, body: opts.body ? JSON.parse(opts.body) : undefined }
}

afterEach(() => vi.unstubAllGlobals())

const CASES = [
  ['login', ['a@b.c', 'pw'], '/auth/login', { email: 'a@b.c', password: 'pw' }],
  ['register', ['Alice', 'Martin', 'a@b.c', 'pw12345678'], '/auth/register',
    { name: 'Alice', surname: 'Martin', email: 'a@b.c', password: 'pw12345678' }],
  ['verifyEmail', ['a@b.c', '12345'], '/auth/verify-email', { email: 'a@b.c', code: '12345' }],
  ['resendCode', ['a@b.c'], '/auth/resend-code', { email: 'a@b.c' }],
  ['forgot', ['a@b.c'], '/auth/forgot-password', { email: 'a@b.c' }],
  ['verifyResetCode', ['a@b.c', '12345'], '/auth/verify-reset-code', { email: 'a@b.c', code: '12345' }],
  ['resetPassword', ['tok', 'NewPass123'], '/auth/reset-password', { token: 'tok', new_password: 'NewPass123' }],
]

describe('contrat avec le backend', () => {
  it.each(CASES)('api.%s envoie le bon POST', async (name, args, path, body) => {
    const fetchMock = mockFetch()
    await api[name](...args)
    const call = lastCall(fetchMock)
    expect(call.url.endsWith(path)).toBe(true)
    expect(call.method).toBe('POST')
    expect(call.body).toEqual(body)
  })

  it('api.me envoie un GET sans corps', async () => {
    const fetchMock = mockFetch(200, { email: 'a@b.c' })
    expect(await api.me()).toEqual({ email: 'a@b.c' })
    const call = lastCall(fetchMock)
    expect(call.url.endsWith('/auth/me')).toBe(true)
    expect(call.method).toBe('GET')
    expect(call.body).toBeUndefined()
  })

  it('api.verifyResetCode renvoie le jeton du serveur', async () => {
    mockFetch(200, { token: 'abc' })
    expect(await api.verifyResetCode('a@b.c', '12345')).toEqual({ token: 'abc' })
  })
})

describe('en-tête Authorization', () => {
  it('est absent sans jeton', async () => {
    const fetchMock = mockFetch()
    await api.forgot('a@b.c')
    expect(lastCall(fetchMock).headers.Authorization).toBeUndefined()
    expect(lastCall(fetchMock).headers['Content-Type']).toBe('application/json')
  })

  it('est présent avec un jeton', async () => {
    localStorage.setItem('token', 'abc')
    const fetchMock = mockFetch()
    await api.me()
    expect(lastCall(fetchMock).headers.Authorization).toBe('Bearer abc')
  })
})

describe('gestion des erreurs', () => {
  it('utilise detail quand c’est un texte', async () => {
    mockFetch(400, { detail: 'Code invalide ou expiré.' })
    await expect(api.verifyResetCode('a@b.c', '12345')).rejects.toThrow('Code invalide ou expiré.')
  })

  it('assemble les erreurs 422 et retire « Value error, »', async () => {
    mockFetch(422, { detail: [{ msg: 'Value error, Trop court' }, { msg: 'Email invalide' }] })
    await expect(api.register('A', 'B', 'x', 'y')).rejects.toThrow('Trop court · Email invalide')
  })

  it('retombe sur message', async () => {
    mockFetch(500, { message: 'Oups' })
    await expect(api.me()).rejects.toThrow('Oups')
  })

  it('a un message par défaut si la réponse n’est pas du JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false, status: 502, json: () => Promise.reject(new Error('pas du json')),
    }))
    await expect(api.me()).rejects.toThrow('Une erreur est survenue')
  })

  it('signale un serveur injoignable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    await expect(api.me()).rejects.toThrow('Serveur injoignable. Réessayez dans un instant.')
  })
})