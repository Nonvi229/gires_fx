// Cohérent avec mockHome : investi 10 000 = 11 000 déposés − 1 000 retirés ; solde 12 480,55.
// Le module garde son état en mémoire : les opérations restent visibles quand on change de page.

let state = {
  balance: 12480.55,
  movements: [
    { id: 'm3', type: 'withdrawal', amount: 1000, createdAt: '2026-10-05T09:12:00.000Z' },
    { id: 'm2', type: 'deposit', amount: 3000, createdAt: '2026-09-03T14:40:00.000Z' },
    { id: 'm1', type: 'deposit', amount: 8000, createdAt: '2026-08-12T08:05:00.000Z' },
  ],
}
let seq = state.movements.length

export async function loadFunds() {
  // Plus tard : return api.get('/funds')
  return structuredClone(state)
}

export async function createMovement({ type, amount }) {
  // Plus tard : return api.post('/funds/movements', { type, amount }) → { movement, balance }
  const delta = type === 'deposit' ? amount : -amount
  const balance = Math.round((state.balance + delta) * 100) / 100
  if (balance < 0) throw new Error('Solde insuffisant.')

  const movement = { id: `m${++seq}`, type, amount, createdAt: new Date().toISOString() }
  state = { balance, movements: [movement, ...state.movements] }
  return structuredClone({ movement, balance })
}