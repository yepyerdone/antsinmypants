import { useNavigate } from 'react-router-dom';
import { ExternalLink, Gamepad2, Play, Sparkles } from 'lucide-react';
import { getGamesForSiteSection, siteSections, type GameCardData, type SiteSectionId } from '../data/siteGames';
import GamePreview from '../components/GamePreview';

type GameSectionPageProps = {
  sectionId: SiteSectionId;
};

function SectionGameCard({ game, onLaunch }: { game: GameCardData; onLaunch: (game: GameCardData) => void }) {
  return (
    <button type="button" className="site-section-game-card" onClick={() => onLaunch(game)}>
      <GamePreview type={game.preview} title={game.title} coverImage={game.coverImage} />

      <span className="site-section-game-card__body">
        <span className="site-section-game-card__meta">
          <span>{game.category}</span>
          <span>{game.meta}</span>
        </span>
        <strong>{game.title}</strong>
        <span>{game.description}</span>
        <span className="site-section-game-card__cta">
          {game.externalUrl ? (
            <>
              Open External Game
              <ExternalLink size={15} />
            </>
          ) : (
            <>
              Play Now
              <Play size={15} fill="currentColor" />
            </>
          )}
        </span>
      </span>
    </button>
  );
}

export function GameSectionPage({ sectionId }: GameSectionPageProps) {
  const navigate = useNavigate();
  const section = siteSections.find((item) => item.id === sectionId);
  const games = getGamesForSiteSection(sectionId);

  if (!section) {
    return null;
  }

  const launchGame = (game: GameCardData) => {
    if (game.externalUrl) {
      window.location.href = game.externalUrl;
      return;
    }

    if (game.internalPath) {
      navigate(game.internalPath);
    }
  };

  return (
    <main className="site-section-page">
      <section className="site-section-hero" aria-labelledby={`${section.id}-section-title`}>
        <div className="site-home-pill">
          {section.comingSoon ? <Sparkles size={16} /> : <Gamepad2 size={16} />}
          <span>{section.comingSoon ? 'Coming Soon' : 'Game section'}</span>
        </div>
        <h1 id={`${section.id}-section-title`}>{section.title}</h1>
        <p>{section.description}</p>
      </section>

      {section.comingSoon ? (
        <section className="site-section-empty" aria-label="Casino coming soon">
          <Sparkles size={34} />
          <h2>Coming Soon</h2>
          <p>Casino is a placeholder section for now. No gambling, betting, or money mechanics are available here.</p>
        </section>
      ) : games.length > 0 ? (
        <section className="site-section-grid" aria-label={`${section.title} games`}>
          {games.map((game) => (
            <SectionGameCard key={game.id} game={game} onLaunch={launchGame} />
          ))}
        </section>
      ) : (
        <section className="site-section-empty" aria-label={`${section.title} empty state`}>
          <Gamepad2 size={34} />
          <h2>No games here yet</h2>
          <p>This section is ready for the next drop.</p>
        </section>
      )}
    </main>
  );
}
