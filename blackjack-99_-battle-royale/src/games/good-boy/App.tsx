import { useEffect, useRef } from 'react';
import { Game } from './game.ts';
import './good-boy.css';

export default function GoodBoy() {
  const gameRef = useRef<Game | null>(null);

  useEffect(() => {
    if (!gameRef.current) {
      gameRef.current = new Game('game-canvas');
    }
  }, []);

  return (
    <div className="good-boy-page">
      <div id="game-container">
        <canvas id="game-canvas" />
      </div>
    </div>
  );
}
