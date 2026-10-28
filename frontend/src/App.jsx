import './css/App.css'
import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import SignIn from './authentication/SignIn'
import LogIn from './authentication/LogIn'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/inscription" element={<SignIn />} />
      <Route path="/connexion" element={<LogIn />} />
    </Routes>
  )
}

export default App