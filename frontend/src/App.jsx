import { useEffect, useState } from 'react'

function App() {
  const [status, setStatus] = useState('chargement...')

  useEffect(() => {
    fetch('/api/say_hello/')
      .then((res) => res.json())
      .then((data) => setStatus(data.status))
      .catch(() => setStatus('API injoignable'))
  }, [])

  return <h1>État de l'API : {status}</h1>
}

export default App