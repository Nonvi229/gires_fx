import { useNavigate } from 'react-router-dom'

function Home() {
  const navigate = useNavigate()

  return (
    <main className="home">
      <h1 className="home__title">GIRES FX</h1>

      <div className="home__actions">
        <button className="btn btn--primary" onClick={() => navigate('/inscription')}>
          Inscription
        </button>
        <button className="btn btn--secondary" onClick={() => navigate('/connexion')}>
          Connexion
        </button>
      </div>
    </main>
  )
}

export default Home