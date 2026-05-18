import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function DontStop() {
  const navigate = useNavigate();

  return (
    <div className="dont-stop-page">
      <header className="dont-stop-header">
        <div>
          <p>Stellar tunnel runner</p>
          <h1>Dont Stop</h1>
        </div>

        <button type="button" onClick={() => navigate('/')} className="dont-stop-back">
          <ArrowLeft size={16} />
          Back to Games
        </button>
      </header>

      <main className="dont-stop-stage" aria-label="Dont Stop game">
        <iframe
          title="Dont Stop"
          src="/games/dont-stop/index.html"
          className="dont-stop-frame"
          allow="autoplay"
        />
      </main>
    </div>
  );
}
