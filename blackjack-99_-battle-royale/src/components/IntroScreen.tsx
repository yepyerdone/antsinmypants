import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Bell, ExternalLink, Flame, Gamepad2, Gauge, LogOut, Play, Sparkles, UserRound, Trophy, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ProfileModal } from './ProfileModal';

interface IntroScreenProps {
  onLaunchGame: (gameId: string) => void;
}

type PreviewType = 'blackjack' | 'neon-snake' | 'space-runner' | 'punchy' | 'chess' | 'snake' | 'molar' | 'chairs' | 'ascension';

type GameCardData = {
  id: string;
  title: string;
  description: string;
  category: string;
  meta: string;
  preview: PreviewType;
  internalPath?: string;
  externalUrl?: string;
  coverImage?: string;
};

const games: GameCardData[] = [
  {
    id: 'blackjack-99',
    title: 'Blackjack 99',
    description: 'Survive a fast battle royale table where every hand can knock players out.',
    category: 'Cards',
    meta: 'Solo or online',
    preview: 'blackjack',
    internalPath: '/blackjack-99',
  },
  {
    id: 'neon-snake',
    title: 'Neon Snake',
    description: 'A glowing multiplayer snake arena for quick reflex duels.',
    category: 'Arcade',
    meta: 'External arena',
    preview: 'neon-snake',
    externalUrl: 'https://multiplayer-neon-snake.onrender.com/',
  },
  {
    id: 'punchy',
    title: 'Punchy',
    description: 'A snappy fighting game with quick rounds and arcade action.',
    category: 'Action',
    meta: 'External game',
    preview: 'punchy',
    externalUrl: 'https://fishfolk.github.io/punchy/player/latest/',
  },
  {
    id: 'the-ascension',
    title: 'The Ascension',
    description: 'A cinematic camera challenge with instant rankings and a dedicated top-score board.',
    category: 'Challenge',
    meta: 'Top 10 scores',
    preview: 'ascension',
    internalPath: '/the-ascension',
  },
  {
    id: 'friend-chess',
    title: 'Friend Chess',
    description: 'Create lobby codes, play real-time chess, and review your match history.',
    category: 'Strategy',
    meta: '2 players',
    preview: 'chess',
    internalPath: '/friend-chess',
  },
  {
    id: 'snake-rush',
    title: 'Snake Rush',
    description: 'High-speed snake with modes, board sizes, and online score chasing.',
    category: 'Arcade',
    meta: 'Leaderboard',
    preview: 'snake',
    internalPath: '/snake-rush',
    coverImage: '/snake-rush.png',
  },
  {
    id: 'space-runner',
    title: 'Space Runner',
    description: 'Outrun an alien across glowing orbital lanes, dodging UFO fire and collecting star crystals.',
    category: 'Runner',
    meta: 'Top 10 scores',
    preview: 'space-runner',
    internalPath: '/space-runner',
  },
  {
    id: 'molar-madness',
    title: 'Molar Madness',
    description: 'Dodge, chomp, and defend the enamel in a retro maze challenge.',
    category: 'Arcade',
    meta: 'Score attack',
    preview: 'molar',
    internalPath: '/molar-madness',
    coverImage: '/molar-madness.png',
  },
  {
    id: 'chairs-io',
    title: 'Chairs.io',
    description: 'Real-time musical chairs with private lobbies and tense eliminations.',
    category: 'Party',
    meta: '2-8 players',
    preview: 'chairs',
    internalPath: '/chairs-io',
  },
];

const gameSections = [
  {
    title: 'Featured Games',
    gameIds: ['blackjack-99', 'punchy', 'the-ascension'],
  },
  {
    title: 'Arcade Classics',
    gameIds: ['molar-madness', 'snake-rush', 'space-runner'],
  },
  {
    title: 'Multiplayer',
    gameIds: ['friend-chess', 'neon-snake', 'chairs-io'],
  },
];

const gamesById = new Map(games.map((game) => [game.id, game]));

const getSectionGames = (gameIds: string[]) =>
  gameIds.reduce<GameCardData[]>((sectionGames, gameId) => {
    const game = gamesById.get(gameId);
    return game ? [...sectionGames, game] : sectionGames;
  }, []);

function GamePreview({ type, title, coverImage }: { type: PreviewType; title: string; coverImage?: string }) {
  if (coverImage) {
    return (
      <div className="site-game-preview site-game-preview--image" aria-label={`${title} preview`}>
        <img src={coverImage} alt={`${title} cover`} className="site-game-preview__image" />
      </div>
    );
  }

  if (type === 'blackjack') {
    return (
      <div className="site-game-preview site-game-preview--blackjack" aria-label={`${title} preview`}>
        <span className="preview-table" />
        <span className="preview-card preview-card--one">A</span>
        <span className="preview-card preview-card--two">9</span>
        <span className="preview-chip preview-chip--one" />
        <span className="preview-chip preview-chip--two" />
        <span className="preview-score">99</span>
      </div>
    );
  }

  if (type === 'snake' || type === 'neon-snake') {
    return (
      <div className={`site-game-preview site-game-preview--${type}`} aria-label={`${title} preview`}>
        <span className="preview-snake-cell preview-snake-cell--head" />
        <span className="preview-snake-cell preview-snake-cell--body-a" />
        <span className="preview-snake-cell preview-snake-cell--body-b" />
        <span className="preview-snake-cell preview-snake-cell--body-c" />
        <span className="preview-food" />
        <span className="preview-score">420</span>
      </div>
    );
  }

  if (type === 'space-runner') {
    return (
      <div className="site-game-preview site-game-preview--space-runner" aria-label={`${title} preview`}>
        <span className="preview-space-planet" />
        <span className="preview-space-road" />
        <span className="preview-space-lane preview-space-lane--left" />
        <span className="preview-space-lane preview-space-lane--right" />
        <span className="preview-astronaut" />
        <span className="preview-alien" />
        <span className="preview-ufo" />
        <span className="preview-crystal preview-crystal--one" />
        <span className="preview-crystal preview-crystal--two" />
        <span className="preview-mine" />
        <span className="preview-score">3D</span>
      </div>
    );
  }

  if (type === 'chess') {
    return (
      <div className="site-game-preview site-game-preview--chess" aria-label={`${title} preview`}>
        <span className="preview-chessboard" />
        <span className="preview-piece preview-piece--king">K</span>
        <span className="preview-piece preview-piece--rook">R</span>
        <span className="preview-piece preview-piece--pawn-a" />
        <span className="preview-piece preview-piece--pawn-b" />
      </div>
    );
  }

  if (type === 'molar') {
    return (
      <div className="site-game-preview site-game-preview--molar" aria-label={`${title} preview`}>
        <span className="preview-maze" />
        <span className="preview-tooth" />
        <span className="preview-candy preview-candy--one" />
        <span className="preview-candy preview-candy--two" />
        <span className="preview-ghost" />
      </div>
    );
  }

  if (type === 'chairs') {
    return (
      <div className="site-game-preview site-game-preview--chairs" aria-label={`${title} preview`}>
        <span className="preview-stage" />
        <span className="preview-chair preview-chair--one" />
        <span className="preview-chair preview-chair--two" />
        <span className="preview-chair preview-chair--three" />
        <span className="preview-player preview-player--one" />
        <span className="preview-player preview-player--two" />
      </div>
    );
  }

  if (type === 'ascension') {
    return (
      <div className="site-game-preview site-game-preview--ascension" aria-label={`${title} preview`}>
        <span className="preview-ascension-scan" />
        <span className="preview-ascension-face" />
        <span className="preview-ascension-ring preview-ascension-ring--one" />
        <span className="preview-ascension-ring preview-ascension-ring--two" />
        <span className="preview-score">9.1</span>
      </div>
    );
  }

  return (
    <div className="site-game-preview site-game-preview--punchy" aria-label={`${title} preview`}>
      <span className="preview-ring" />
      <span className="preview-fighter preview-fighter--one" />
      <span className="preview-fighter preview-fighter--two" />
      <span className="preview-hit" />
      <span className="preview-score">KO</span>
    </div>
  );
}

export const IntroScreen: React.FC<IntroScreenProps> = ({ onLaunchGame }) => {
  const navigate = useNavigate();
  const { displayName, isGuest, logout } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileView, setProfileView] = useState<'profile' | 'inbox'>('profile');

  const launchGame = (game: GameCardData) => {
    if (game.internalPath) {
      navigate(game.internalPath);
      return;
    }

    if (game.externalUrl) {
      window.location.href = game.externalUrl;
      return;
    }

    onLaunchGame(game.id);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const openProfile = (view: 'profile' | 'inbox') => {
    setProfileView(view);
    setProfileOpen(true);
  };

  return (
    <div className="site-home">
      <header className="site-home-header">
        <Link to="/" className="site-home-logo" aria-label="Honor Roll Arcade home">
          <span>
            <Gamepad2 size={24} />
          </span>
          <strong>Honor Roll Arcade</strong>
        </Link>

        <nav className="site-home-nav" aria-label="Site navigation">
          <Link to="/">Home</Link>
          <a href="#games">Games</a>
        </nav>

        <div className="site-home-account">
          <button type="button" className="site-home-player" onClick={() => openProfile('profile')}>
            <UserRound size={16} />
            <span>{displayName}</span>
            {isGuest && <small>Guest</small>}
          </button>
          <button type="button" className="site-home-icon-button" onClick={() => openProfile('inbox')} aria-label="Open notifications">
            <Bell size={17} />
          </button>
          <button type="button" onClick={handleLogout}>
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      <main className="site-home-main">
        <section className="site-home-hero" aria-labelledby="site-home-title">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="site-home-hero__copy"
          >
            <div className="site-home-pill">
              <Flame size={16} />
              <span>Quick-play arcade</span>
            </div>
            <h1 id="site-home-title">Pick a game. Chase the high score.</h1>
            <p>A growing arcade of fast, simple games built for quick breaks.</p>
            <div className="site-home-actions">
              <a href="#games" className="site-home-primary">
                <Play size={18} fill="currentColor" />
                <span>Browse Games</span>
              </a>
              <span className="site-home-secondary">
                <Sparkles size={17} />
                Guests choose a player name
              </span>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.05 }}
            className="site-home-stats"
            aria-label="Arcade highlights"
          >
            <div className="site-home-stat">
              <Gamepad2 size={20} />
              <strong>{games.length}</strong>
              <span>Games available</span>
            </div>
            <div className="site-home-stat">
              <Trophy size={20} />
              <strong>Live</strong>
              <span>Score chasing</span>
            </div>
            <div className="site-home-stat">
              <Users size={20} />
              <strong>Guest</strong>
              <span>Play supported</span>
            </div>
          </motion.div>
        </section>

        <section id="games" className="site-games-section" aria-labelledby="site-games-title">
          <div className="site-section-heading">
            <div>
              <div className="site-home-pill">
                <Gauge size={16} />
                <span>Game Select</span>
              </div>
              <h2 id="site-games-title">Featured Games</h2>
            </div>
            <p>Tap a card to jump straight into the correct route or game arena.</p>
          </div>

          <div className="site-games-rows">
            {gameSections.map((section) => (
              <section
                key={section.title}
                className="site-game-row"
                aria-labelledby={
                  section.title === 'Featured Games'
                    ? 'site-games-title'
                    : `site-games-${section.title.toLowerCase().replace(/\s+/g, '-')}`
                }
              >
                {section.title !== 'Featured Games' && (
                  <h3 id={`site-games-${section.title.toLowerCase().replace(/\s+/g, '-')}`}>{section.title}</h3>
                )}

                <div className="site-games-grid">
                  {getSectionGames(section.gameIds).map((game, index) => (
                    <motion.button
                      key={game.id}
                      type="button"
                      onClick={() => launchGame(game)}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.28, delay: index * 0.035 }}
                      className="site-game-card"
                    >
                      <GamePreview type={game.preview} title={game.title} coverImage={game.coverImage} />

                      <span className="site-game-card__body">
                        <span className="site-game-card__meta">
                          <span>{game.category}</span>
                          <span>{game.meta}</span>
                        </span>
                        <strong>{game.title}</strong>
                        <span className="site-game-card__description">{game.description}</span>
                        <span className="site-game-card__cta">
                          <span>{game.externalUrl ? 'Open Game' : 'Play Now'}</span>
                          {game.externalUrl ? <ExternalLink size={15} /> : <Play size={15} fill="currentColor" />}
                        </span>
                      </span>
                    </motion.button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </section>
      </main>

      <ProfileModal isOpen={profileOpen} initialView={profileView} onClose={() => setProfileOpen(false)} />
    </div>
  );
};
