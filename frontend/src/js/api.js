const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'

async function request(path, { method = 'GET', body } = {}) {
  const token = localStorage.getItem('token')
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.message || data.detail || 'Une erreur est survenue')
  return data
}

export const api = {
  login: (email, password) => request('/auth/login', { method: 'POST', body: { email, password } }),
  register: (name, email, password) => request('/auth/register', { method: 'POST', body: { name, email, password } }),
  forgot: (email) => request('/auth/forgot-password', { method: 'POST', body: { email } }),
  reset: (token, password) => request('/auth/reset-password', { method: 'POST', body: { token, password } }),
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body }),
  verifyCode: (email, code) => request('/auth/verify-code', { method: 'POST', body: { email, code } }),
}