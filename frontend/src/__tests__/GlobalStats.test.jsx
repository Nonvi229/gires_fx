import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import GlobalStats from '../components/GlobalStats'
import { fmtMoney as rawMoney, fmtSigned as rawSigned } from '../js/homeStats'

const norm = (s) => s.replace(/\s+/g, ' ')
const fmtMoney = (n) => norm(rawMoney(n))
const fmtSigned = (n) => norm(rawSigned(n))

describe('GlobalStats', () => {
  it('affiche gains, pertes, total investi et actifs tradés', () => {
    render(
      <GlobalStats
        totals={{ invested: 800, gains: 300, losses: -100, assetsTraded: 3, firstInvestmentAt: '2026-08-12' }}
      />
    )
    expect(screen.getByText(fmtSigned(300))).toBeInTheDocument()
    expect(screen.getByText(fmtSigned(-100))).toBeInTheDocument()
    expect(screen.getByText(fmtMoney(800))).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText(/12 août 2026/)).toBeInTheDocument()
  })
})