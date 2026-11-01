// Forme volontairement identique à la future réponse de GET /dashboard.
// Pertes : nombres négatifs. Taux et drawdown : fractions (0.642 = 64,2 %).
// Cohérence : investi + gains + pertes = solde.

const dashboard = {
  balance: 12480.55,
  today: { gain: 245.3, loss: -62.75 },
  totals: {
    invested: 10000,
    gains: 3120.8,
    losses: -640.25,
    assetsTraded: 7,
    firstInvestmentAt: '2026-08-12',
  },
  algorithms: [
    { id: 'trend', name: 'Tendance', netProfit: 1105.6, winRate: 0.642, profitFactor: 1.94, maxDrawdown: 0.028, trades: 58 },
    { id: 'mean-reversion', name: 'Retour à la moyenne', netProfit: 722.15, winRate: 0.713, profitFactor: 1.61, maxDrawdown: 0.035, trades: 74 },
    { id: 'breakout', name: 'Cassure', netProfit: 389.3, winRate: 0.487, profitFactor: 1.38, maxDrawdown: 0.052, trades: 31 },
    { id: 'momentum', name: 'Momentum', netProfit: 263.5, winRate: 0.571, profitFactor: 2.1, maxDrawdown: 0.019, trades: 14 },
  ],
  assets: [
    { symbol: 'BTC/USDT', invested: 2500, pnl: 1020.35, dayPnl: 84.8, algorithms: ['trend', 'momentum'] },
    { symbol: 'XAU/USD', invested: 2500, pnl: 845.1, dayPnl: 118.4, algorithms: ['trend', 'breakout'] },
    { symbol: 'NAS100', invested: 1500, pnl: 395.15, dayPnl: 0, algorithms: ['trend', 'mean-reversion'] },
    { symbol: 'EUR/USD', invested: 2000, pnl: 312.4, dayPnl: 42.1, algorithms: ['mean-reversion'] },
    { symbol: 'ETH/USDT', invested: 1500, pnl: -92.45, dayPnl: -62.75, algorithms: ['breakout'] },
  ],
}

export async function loadDashboard() {
  // Plus tard : return api.get('/dashboard')
  return {
    ...structuredClone(dashboard),
    lastTradeAt: new Date(Date.now() - 4 * 60000).toISOString(),
  }
}