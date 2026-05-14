import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronLeft, ChevronRight, ExternalLink, Flame, Gamepad2, Gauge, Play, Sparkles, Trophy, Users } from 'lucide-react';
import {
  getSectionGames,
  homeGameSections as gameSections,
  siteGames as games,
  type GameCardData,
} from '../data/siteGames';
import GamePreview from './GamePreview';

interface IntroScreenProps {
  onLaunchGame: (gameId: string) => void;
}

export const IntroScreen: React.FC<IntroScreenProps> = ({ onLaunchGame }) => {
  const navigate = useNavigate();
  const [showFeaturedBackButton, setShowFeaturedBackButton] = useState(false);
  const [showArcadeBackButton, setShowArcadeBackButton] = useState(false);
  const [showMultiplayerBackButton, setShowMultiplayerBackButton] = useState(false);
  const [heroSlide, setHeroSlide] = useState<'arcade' | 'events'>('arcade');
  const featuredScrollerRef = useRef<HTMLDivElement>(null);
  const arcadeScrollerRef = useRef<HTMLDivElement>(null);
  const multiplayerScrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setHeroSlide((currentSlide) => currentSlide === 'arcade' ? 'events' : 'arcade');
    }, 5200);

    return () => window.clearInterval(interval);
  }, []);

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

  const scrollFeaturedToMoleMania = () => {
    featuredScrollerRef.current?.scrollTo({
      left: featuredScrollerRef.current.scrollWidth,
      behavior: 'smooth',
    });
    setShowFeaturedBackButton(true);
  };

  const scrollFeaturedToStart = () => {
    featuredScrollerRef.current?.scrollTo({
      left: 0,
      behavior: 'smooth',
    });
    setShowFeaturedBackButton(false);
  };

  const handleFeaturedScroll = () => {
    const featuredScroller = featuredScrollerRef.current;
    if (!featuredScroller) {
      return;
    }
    setShowFeaturedBackButton(featuredScroller.scrollLeft > 12);
  };

  const scrollArcadeToTachymetry = () => {
    arcadeScrollerRef.current?.scrollTo({
      left: arcadeScrollerRef.current.scrollWidth,
      behavior: 'smooth',
    });
    setShowArcadeBackButton(true);
  };

  const scrollArcadeToStart = () => {
    arcadeScrollerRef.current?.scrollTo({
      left: 0,
      behavior: 'smooth',
    });
    setShowArcadeBackButton(false);
  };

  const handleArcadeScroll = () => {
    const arcadeScroller = arcadeScrollerRef.current;
    if (!arcadeScroller) {
      return;
    }
    setShowArcadeBackButton(arcadeScroller.scrollLeft > 12);
  };

  const scrollMultiplayerToEightBall = () => {
    multiplayerScrollerRef.current?.scrollTo({
      left: multiplayerScrollerRef.current.scrollWidth,
      behavior: 'smooth',
    });
    setShowMultiplayerBackButton(true);
  };

  const scrollMultiplayerToStart = () => {
    multiplayerScrollerRef.current?.scrollTo({
      left: 0,
      behavior: 'smooth',
    });
    setShowMultiplayerBackButton(false);
  };

  const handleMultiplayerScroll = () => {
    const multiplayerScroller = multiplayerScrollerRef.current;
    if (!multiplayerScroller) {
      return;
    }
    setShowMultiplayerBackButton(multiplayerScroller.scrollLeft > 12);
  };

  const renderGameCard = (game: GameCardData) => (
    <motion.button
      key={game.id}
      type="button"
      onClick={() => launchGame(game)}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28 }}
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
  );

  return (
    <div className="site-home">
      <main className="site-home-main">
        <section className="site-home-hero" aria-labelledby="site-home-title">
          <AnimatePresence mode="wait" initial={false}>
            {heroSlide === 'arcade' ? (
              <motion.div
                key="arcade-hero"
                initial={{ opacity: 0, x: 80 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -80 }}
                transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                className="site-home-hero__slide"
              >
                <div className="site-home-hero__copy">
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
                </div>

                <div className="site-home-stats" aria-label="Arcade highlights">
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
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="events-hero"
                initial={{ opacity: 0, x: 80 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -80 }}
                transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                className="site-home-hero__slide"
              >
                <div className="site-home-hero__copy site-home-hero__copy--events">
                  <div className="site-home-pill site-home-pill--events">
                    <Trophy size={16} />
                    <span>Events coming soon</span>
                  </div>
                  <h1 id="site-home-title">Events Coming Soon.</h1>
                  <p>Chase highscores. Earn real money.</p>
                  <div className="site-home-actions">
                    <a href="#games" className="site-home-primary">
                      <Play size={18} fill="currentColor" />
                      <span>Train Now</span>
                    </a>
                    <span className="site-home-secondary">
                      <Sparkles size={17} />
                      Competitive score events are on deck
                    </span>
                  </div>
                </div>

                <div className="site-home-stats site-home-stats--events" aria-label="Upcoming event highlights">
                  <div className="site-home-stat">
                    <Trophy size={20} />
                    <strong>Events</strong>
                    <span>Coming soon</span>
                  </div>
                  <div className="site-home-stat">
                    <Flame size={20} />
                    <strong>Cash</strong>
                    <span>Real rewards</span>
                  </div>
                  <div className="site-home-stat">
                    <Gamepad2 size={20} />
                    <strong>Scores</strong>
                    <span>High-score races</span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
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
            {gameSections.map((section) => {
              const isFeatured = section.title === 'Featured Games';
              const isArcadeClassics = section.title === 'Arcade Classics';
              const isMultiplayer = section.title === 'Multiplayer';
              const sectionTitleId = isFeatured ? 'site-games-title' : `site-games-${section.title.toLowerCase().replace(/\s+/g, '-')}`;
              const sectionGames = getSectionGames(section.gameIds);

              return (
                <section key={section.title} className="site-game-row" aria-labelledby={sectionTitleId}>
                  {!isFeatured && <h3 id={sectionTitleId}>{section.title}</h3>}

                  {isFeatured ? (
                    <div className="site-featured-carousel">
                      <div
                        ref={featuredScrollerRef}
                        className="site-games-grid site-games-grid--featured"
                        onScroll={handleFeaturedScroll}
                      >
                        {sectionGames.map(renderGameCard)}
                      </div>
                      {showFeaturedBackButton && (
                        <button
                          type="button"
                          className="site-featured-scroll-button site-featured-scroll-button--back"
                          onClick={scrollFeaturedToStart}
                          aria-label="Scroll back to first featured game"
                        >
                          <ChevronLeft size={28} strokeWidth={3} />
                        </button>
                      )}
                      <button
                        type="button"
                        className="site-featured-scroll-button"
                        onClick={scrollFeaturedToMoleMania}
                        aria-label="Scroll to more featured games"
                      >
                        <ChevronRight size={28} strokeWidth={3} />
                      </button>
                    </div>
                  ) : isArcadeClassics ? (
                    <div className="site-featured-carousel">
                      <div
                        ref={arcadeScrollerRef}
                        className="site-games-grid site-games-grid--featured"
                        onScroll={handleArcadeScroll}
                      >
                        {sectionGames.map(renderGameCard)}
                      </div>
                      {showArcadeBackButton && (
                        <button
                          type="button"
                          className="site-featured-scroll-button site-featured-scroll-button--back"
                          onClick={scrollArcadeToStart}
                          aria-label="Scroll back to first arcade classic"
                        >
                          <ChevronLeft size={28} strokeWidth={3} />
                        </button>
                      )}
                      <button
                        type="button"
                        className="site-featured-scroll-button"
                        onClick={scrollArcadeToTachymetry}
                        aria-label="Scroll to Tachymetry"
                      >
                        <ChevronRight size={28} strokeWidth={3} />
                      </button>
                    </div>
                  ) : isMultiplayer ? (
                    <div className="site-featured-carousel">
                      <div
                        ref={multiplayerScrollerRef}
                        className="site-games-grid site-games-grid--featured"
                        onScroll={handleMultiplayerScroll}
                      >
                        {sectionGames.map(renderGameCard)}
                      </div>
                      {showMultiplayerBackButton && (
                        <button
                          type="button"
                          className="site-featured-scroll-button site-featured-scroll-button--back"
                          onClick={scrollMultiplayerToStart}
                          aria-label="Scroll back to first multiplayer game"
                        >
                          <ChevronLeft size={28} strokeWidth={3} />
                        </button>
                      )}
                      <button
                        type="button"
                        className="site-featured-scroll-button"
                        onClick={scrollMultiplayerToEightBall}
                        aria-label="Scroll to 8 Ball Arcade"
                      >
                        <ChevronRight size={28} strokeWidth={3} />
                      </button>
                    </div>
                  ) : (
                    <div className="site-games-grid">{sectionGames.map(renderGameCard)}</div>
                  )}
                </section>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
};

export default IntroScreen;
