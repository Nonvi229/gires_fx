import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import AlgorithmRanking from '../components/AlgorithmRanking'

const ALGOS = [
  { id: 'trend', name: 'Tendance', netProfit: 200, winRate: 0.6, profitFactor: 1.5, maxDrawdown: 0.03, trades: 30 },
  { id: 'momentum', name: 'Momentum', netProfit: 500, winRate: 0.7, profitFactor: 2, maxDrawdown: 0.02, trades: 5 },
  { id: 'breakout', name: 'Cassure', netProfit: 100, winRate: 0.5, profitFactor: 1.2, maxDrawdown: 0.05, trades: 25 },
]
const renderRanking = (props) =>
  render(<MemoryRouter><AlgorithmRanking algorithms={ALGOS} {...props} /></MemoryRouter>)

describe('AlgorithmRanking', () => {
  it('classe par profit net et place les algorithmes non classés en fin de liste', () => {
    renderRanking()
    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(3)
    expect(items[0]).toHaveTextContent('Tendance')
    expect(items[1]).toHaveTextContent('Cassure')
    expect(items[2]).toHaveTextContent('Momentum')
    expect(items[2]).toHaveTextContent(/non classé/i)
    expect(items[0]).not.toHaveTextContent(/non classé/i)
  })

  it('limite le nombre de lignes', () => {
    renderRanking({ limit: 2 })
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
  })

  it('lie chaque algorithme à sa page', () => {
    renderRanking()
    expect(screen.getByRole('link', { name: 'Cassure' })).toHaveAttribute('href', '/algorithms/breakout')
  })
})