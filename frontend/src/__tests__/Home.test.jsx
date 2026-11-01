import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Home from '../pages/Home'
import { loadDashboard } from '../js/mockHome'
import { fmtMoney as rawMoney, fmtSigned as rawSigned } from '../js/homeStats'
import { useEngine } from '../js/engine'
vi.mock('../js/engine', () => ({ useEngine: vi.fn() }))

const norm = (s) => s.replace(/\s+/g, ' ')
const fmtMoney = (n) => norm(rawMoney(n))
const fmtSigned = (n) => norm(rawSigned(n))

vi.mock('../components/PerformanceChart', () => ({
  default: ({ balance }) => <div data-testid="chart">{balance}</div>,
}))
vi.mock('../js/mockHome', () => ({ loadDashboard: vi.fn() }))

const FIXTURE = {
  balance: 1000,
  today: { gain: 50, loss: -20 },
  totals: { invested: 800, gains: 300, losses: -100, assetsTraded: 3, firstInvestmentAt: '2026-08-12' },
  algorithms: [
    { id: 'trend', name: 'Tendance', netProfit: 200, winRate: 0.6, profitFactor: 1.5, maxDrawdown: 0.03, trades: 30 },
    { id: 'momentum', name: 'Momentum', netProfit: 500, winRate: 0.7, profitFactor: 2, maxDrawdown: 0.02, trades: 5 },
    { id: 'breakout', name: 'Cassure', netProfit: 100, winRate: 0.5, profitFactor: 1.2, maxDrawdown: 0.05, trades: 25 },
  ],
  assets: [
    { symbol: 'EUR/USD', invested: 500, pnl: 150, dayPnl: 50, algorithms: ['trend'] },
    { symbol: 'ETH/USDT', invested: 300, pnl: -50, dayPnl: -20, algorithms: ['breakout', 'momentum'] },
  ],
}

const renderHome = async () => {
  render(<MemoryRouter><Home /></MemoryRouter>)
  await screen.findByRole('region', { name: 'Solde actuel' })
}
const region = (name) => within(screen.getByRole('region', { name }))

beforeEach(() => {
  useEngine.mockReset()
useEngine.mockReturnValue({ running: true, haltedAt: null, stop: vi.fn(), resume: vi.fn() })
  // pas d'animation : les valeurs finales s'affichent tout de suite
  window.matchMedia = vi.fn().mockReturnValue({
    matches: true, addEventListener() {}, removeEventListener() {},
  })
  loadDashboard.mockReset()
  loadDashboard.mockResolvedValue(structuredClone(FIXTURE))
})

describe('Home', () => {
  it('affiche l’état des algorithmes et le nombre d’algorithmes utilisés', async () => {
  await renderHome()
  const panel = region('État des algorithmes')
  expect(panel.getByText('Algorithmes en marche')).toBeInTheDocument()
  expect(panel.getByText(/3 algorithmes actifs/)).toBeInTheDocument()
})

it('relie l’arrêt d’urgence au moteur, avec confirmation', async () => {
  const stop = vi.fn().mockResolvedValue()
  useEngine.mockReturnValue({ running: true, haltedAt: null, stop, resume: vi.fn() })
  await renderHome()
  const panel = region('État des algorithmes')
  fireEvent.click(panel.getByRole('button', { name: /arrêt d.urgence/i }))
  expect(stop).not.toHaveBeenCalled()
  fireEvent.click(panel.getByRole('button', { name: /confirmer/i }))
  await waitFor(() => expect(stop).toHaveBeenCalledTimes(1))
})
  it('affiche un état de chargement puis le tableau de bord', async () => {
    render(<MemoryRouter><Home /></MemoryRouter>)
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(await screen.findByRole('region', { name: 'Solde actuel' })).toBeInTheDocument()
  })

  it('affiche solde, gain du jour et perte du jour', async () => {
    await renderHome()
    expect(region('Solde actuel').getByText(fmtMoney(1000))).toBeInTheDocument()
    expect(region('Gain du jour').getByText(fmtSigned(50))).toBeInTheDocument()
    expect(region('Perte du jour').getByText(fmtSigned(-20))).toBeInTheDocument()
  })

  it('transmet le solde au graphique', async () => {
    await renderHome()
    expect(screen.getByTestId('chart')).toHaveTextContent('1000')
  })

  it('liste les actifs avec gains/pertes, algorithmes et lien de détail', async () => {
    await renderHome()
    const assets = region('Actifs tradés')
    const eur = assets.getByRole('link', { name: /EUR\/USD/ })
    expect(eur).toHaveAttribute('href', '/assets/EUR%2FUSD')
    expect(within(eur).getByText(fmtSigned(150))).toBeInTheDocument()
    expect(within(eur).getByText('Tendance')).toBeInTheDocument()

    const eth = assets.getByRole('link', { name: /ETH\/USDT/ })
    expect(within(eth).getByText(fmtSigned(-50))).toBeInTheDocument()
    expect(within(eth).getByText('Cassure')).toBeInTheDocument()
    expect(within(eth).getByText('Momentum')).toBeInTheDocument()
  })

  it('montre le meilleur algorithme classé (pas celui qui manque de trades)', async () => {
    await renderHome()
    const best = region('Meilleur algorithme')
    expect(best.getByRole('link', { name: 'Tendance' })).toHaveAttribute('href', '/algorithms/trend')
    expect(best.getByText(fmtSigned(200))).toBeInTheDocument()
    expect(best.queryByText('Momentum')).not.toBeInTheDocument()
    expect(best.getByRole('link', { name: /voir le classement/i })).toHaveAttribute('href', '/algorithms')
  })

  it('indique l’absence de classement si aucun algorithme n’a assez de trades', async () => {
    const data = structuredClone(FIXTURE)
    data.algorithms.forEach((a) => { a.trades = 1 })
    loadDashboard.mockResolvedValue(data)
    await renderHome()
    expect(region('Meilleur algorithme').getByText(/pas encore assez de trades/i)).toBeInTheDocument()
  })

  it('affiche le bilan global avec un lien vers les statistiques', async () => {
    await renderHome()
    const bilan = region('Bilan global')
    expect(bilan.getByText(fmtSigned(300))).toBeInTheDocument()
    expect(bilan.getByText(fmtSigned(-100))).toBeInTheDocument()
    expect(bilan.getByRole('link', { name: /voir les statistiques/i })).toHaveAttribute('href', '/stats')
  })

  it('affiche une erreur si le chargement échoue', async () => {
    loadDashboard.mockRejectedValue(new Error('Serveur injoignable.'))
    render(<MemoryRouter><Home /></MemoryRouter>)
    expect(await screen.findByRole('alert')).toHaveTextContent('Serveur injoignable.')
  })
})