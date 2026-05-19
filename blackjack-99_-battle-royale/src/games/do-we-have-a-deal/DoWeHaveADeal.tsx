import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function DoWeHaveADeal() {
  const navigate = useNavigate();

  return (
    <div className="deal-page">
      <header className="deal-header">
        <div>
          <p>Briefcase game show</p>
          <h1>Do We Have a Deal?</h1>
        </div>

        <button type="button" onClick={() => navigate('/')} className="deal-back">
          <ArrowLeft size={16} />
          Back to Games
        </button>
      </header>

      <main className="deal-stage" aria-label="Do We Have a Deal game">
        <iframe
          title="Do We Have a Deal?"
          src="/games/do-we-have-a-deal/index.html"
          className="deal-frame"
          allow="autoplay"
        />
      </main>
    </div>
  );
}
