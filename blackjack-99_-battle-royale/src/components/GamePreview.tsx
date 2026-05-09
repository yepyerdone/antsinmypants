import React from 'react';
import { MapIcon } from 'lucide-react';

export type PreviewType =
  | 'blackjack'
  | 'neon-snake'
  | 'space-runner'
  | 'punchy'
  | 'chess'
  | 'snake'
  | 'molar'
  | 'chairs'
  | 'ascension'
  | 'mole'
  | 'states'
  | 'tachymetry'
  | 'eight-ball';

interface GamePreviewProps {
  type: PreviewType;
  title: string;
  coverImage?: string;
}

function GamePreview({ type, title, coverImage }: GamePreviewProps) {
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

  if (type === 'mole') {
    return (
      <div className="site-game-preview site-game-preview--mole" aria-label={`${title} preview`}>
        <span className="preview-mole-hole preview-mole-hole--one" />
        <span className="preview-mole-hole preview-mole-hole--two" />
        <span className="preview-mole-hole preview-mole-hole--three" />
        <span className="preview-mole-body" />
        <span className="preview-mole-face" />
        <span className="preview-mole-mallet" />
        <span className="preview-score">BONK</span>
      </div>
    );
  }

  if (type === 'states') {
    return (
      <div className="site-game-preview site-game-preview--states" aria-label={`${title} preview`}>
        <span className="preview-states-map" />
        <span className="preview-states-pin preview-states-pin--one" />
        <span className="preview-states-pin preview-states-pin--two" />
        <span className="preview-states-pin preview-states-pin--three" />
        <span className="preview-states-route" />
        <span className="preview-score">
          <MapIcon size={17} />
          50
        </span>
      </div>
    );
  }

  if (type === 'tachymetry') {
    return (
      <div className="site-game-preview site-game-preview--tachymetry" aria-label={`${title} preview`}>
        <span className="preview-tachy-grid" />
        <span className="preview-tachy-piece preview-tachy-piece--i" />
        <span className="preview-tachy-piece preview-tachy-piece--t" />
        <span className="preview-tachy-piece preview-tachy-piece--o" />
        <span className="preview-tachy-line" />
        <span className="preview-score">TETRIS</span>
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

  if (type === 'eight-ball') {
    return (
      <div className="site-game-preview site-game-preview--eight-ball" aria-label={`${title} preview`}>
        <span className="preview-pool-table" />
        <span className="preview-pool-pocket preview-pool-pocket--one" />
        <span className="preview-pool-pocket preview-pool-pocket--two" />
        <span className="preview-pool-pocket preview-pool-pocket--three" />
        <span className="preview-pool-cue" />
        <span className="preview-pool-ball preview-pool-ball--cue" />
        <span className="preview-pool-ball preview-pool-ball--eight">8</span>
        <span className="preview-pool-ball preview-pool-ball--solid" />
        <span className="preview-pool-ball preview-pool-ball--stripe" />
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
        <span className="preview-score">11/10</span>
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

export default GamePreview;
