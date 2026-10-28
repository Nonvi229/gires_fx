import { Routes, Route, Navigate } from 'react-router-dom'
import LogIn from './authentication/LogIn'
import SignIn from './authentication/SignIn'
import ForgotPassword from './authentication/ForgotPassword'
import ResetPassword from './authentication/ResetPassword'
import VerifyCode from './authentication/VerifyCode'
import Home from './pages/Home'

function Private({ children }) {
  return localStorage.getItem('token') ? children : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LogIn />} />
      <Route path="/signin" element={<SignIn />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/" element={<Home />}/>
      <Route path="*" element={<Navigate to="/" replace />} />
      <Route path="/verify-code" element={<VerifyCode />} />
    </Routes>
  )
}