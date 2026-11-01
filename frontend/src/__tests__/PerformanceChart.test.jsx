import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import PerformanceChart from '../components/PerformanceChart'
import { buildSeries, summarize } from '../js/mockSeries'

const NOW = new Date(2026, 10, 1, 14, 10)
const BALANCE = 12480.55
const show = () => render(<PerformanceChart balance={BALANCE} now={NOW} />)

describe('PerformanceChart', () => {
  it('propose les 4 périodes, « Jour » sélectionnée par défaut', () => {
    show()
    const tabs = screen.getAllByRole('tab').map((t) => t.textContent)
    expect(tabs).toEqual(['Jour', 'Semaine', 'Mois', 'Année'])
    expect(screen.getByRole('tab', { name: 'Jour' })).toHaveAttribute('aria-selected', 'true')
  })

  it('change de période au clic, une seule sélectionnée à la fois', async () => {
    const user = userEvent.setup()
    show()
    await user.click(screen.getByRole('tab', { name: 'Semaine' }))
    expect(screen.getByRole('tab', { name: 'Semaine' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Jour' })).toHaveAttribute('aria-selected', 'false')
  })

  it('affiche le solde actuel', () => {
    show()
    expect(screen.getByText(/12\s?480,55/)).toBeInTheDocument()
  })

  it.each([['Jour', 'day'], ['Semaine', 'week'], ['Mois', 'month'], ['Année', 'year']])(
    'la variation de « %s » suit le signe de la série', async (label, key) => {
      const user = userEvent.setup()
      show()
      await user.click(screen.getByRole('tab', { name: label }))
      const { delta } = summarize(buildSeries(key, BALANCE, NOW))
      expect(screen.getByTestId('perf-delta')).toHaveClass(delta >= 0 ? 'up' : 'down')
    }
  )
})