import { useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { api } from './js/api'
import LogIn from './authentication/LogIn'
import SignIn from './authentication/SignIn'
import ForgotPassword from './authentication/ForgotPassword'
import ResetPassword from './authentication/ResetPassword'
import VerifyCode from './authentication/VerifyCode'
import Layout from './components/Layout'
import Home from './pages/Home'
import {
  Assets, AssetDetail, Algorithms, AlgorithmDetail, Trades, Stats, Funds, Settings,
} from './pages/PlaceHolders'

function Private({ children }) {
  const [state, setState] = useState(localStorage.getItem('token') ? 'checking' : 'denied')

  useEffect(() => {
    if (state !== 'checking') return
    api.me()
      .then(() => setState('ok'))
      .catch(() => { localStorage.removeItem('token'); setState('denied') })
  }, [state])

  if (state === 'checking') return null
  return state === 'ok' ? children : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LogIn />} />
      <Route path="/signin" element={<SignIn />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/verify-code" element={<VerifyCode />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      <Route element={<Private><Layout /></Private>}>
        <Route index element={<Home />} />
        <Route path="assets" element={<Assets />} />
        <Route path="assets/:symbol" element={<AssetDetail />} />
        <Route path="algorithms" element={<Algorithms />} />
        <Route path="algorithms/:id" element={<AlgorithmDetail />} />
        <Route path="trades" element={<Trades />} />
        <Route path="stats" element={<Stats />} />
        <Route path="funds" element={<Funds />} />
        <Route path="settings" element={<Settings />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}