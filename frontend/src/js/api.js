const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'

async function request(path, { method = 'GET', body } = {}) {
  const token = localStorage.getItem('token')

  let res
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new Error('Serveur injoignable. Réessayez dans un instant.')
  }

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    const d = data.detail
    const message = Array.isArray(d)
      ? d.map((e) => (e.msg || '').replace('Value error, ', '')).join(' · ')
      : d || data.message
    throw new Error(message || 'Une erreur est survenue')
  }

  return data
}

export const api = {
  // Authentification
  login: (email, password) =>
    request('/auth/login', { method: 'POST', body: { email, password } }),
  register: (name, surname, email, password) =>
    request('/auth/register', { method: 'POST', body: { name, surname, email, password } }),

  // Vérification par code (inscription)
  verifyEmail: (email, code) =>
    request('/auth/verify-email', { method: 'POST', body: { email, code } }),
  resendCode: (email) =>
    request('/auth/resend-code', { method: 'POST', body: { email } }),

  // Mot de passe oublié
  forgot: (email) =>
    request('/auth/forgot-password', { method: 'POST', body: { email } }),
  verifyCode: (email, code) =>
    request('/auth/verify-code', { method: 'POST', body: { email, code } }),
  reset: (token, password) =>
    request('/auth/reset-password', { method: 'POST', body: { token, password } }),

  // Appels génériques
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body }),
}