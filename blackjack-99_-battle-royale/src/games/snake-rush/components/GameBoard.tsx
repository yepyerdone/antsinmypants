import React, { useEffect, useRef } from 'react';
import { Position, GameState, Direction } from '../hooks/useSnakeGame';
import { BOARD_CONFIG, BoardSize } from '../lib/constants';

interface GameBoardProps {
  snake: Position[];
  food: Position;
  boardSize: BoardSize;
  gameState: GameState;
  currentSpeed: number;
  direction: Direction;
  score: number;
}

export const GameBoard: React.FC<GameBoardProps> = ({ 
  snake, 
  food, 
  boardSize, 
  gameState, 
  currentSpeed, 
  direction,
  score
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const config = BOARD_CONFIG[boardSize];
  
  const prevSnakeRef = useRef<Position[]>(snake);
  const lastSnakeRef = useRef<Position[]>(snake);
  const lastTickTimeRef = useRef<number>(performance.now());
  const animationRef = useRef<number>();
  const eatPopTimeRef = useRef<number>(0);
  const prevScoreRef = useRef<number>(score);

  if (snake !== lastSnakeRef.current) {
    prevSnakeRef.current = lastSnakeRef.current;
    lastSnakeRef.current = snake;
    lastTickTimeRef.current = performance.now();
  }

  if (score > prevScoreRef.current) {
    prevScoreRef.current = score;
    eatPopTimeRef.current = performance.now();
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = (time: number) => {
      // Calculate interpolation progress (0 to 1)
      let progress = 0;
      if (gameState === 'PLAYING') {
        progress = (time - lastTickTimeRef.current) / currentSpeed;
        if (progress > 1) progress = 1;
        if (progress < 0) progress = 0;
      } else if (gameState === 'GAMEOVER' || gameState === 'PAUSED') {
        progress = 1;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const cellW = canvas.width / config.cols;
      const cellH = canvas.height / config.rows;
      const minCell = Math.min(cellW, cellH);

      const boardGradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      boardGradient.addColorStop(0, '#06150f');
      boardGradient.addColorStop(0.52, '#020617');
      boardGradient.addColorStop(1, '#07111f');
      ctx.fillStyle = boardGradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const boardGlow = ctx.createRadialGradient(
        canvas.width * 0.52,
        canvas.height * 0.36,
        0,
        canvas.width * 0.52,
        canvas.height * 0.36,
        canvas.width * 0.78
      );
      boardGlow.addColorStop(0, 'rgba(52, 211, 153, 0.14)');
      boardGlow.addColorStop(0.48, 'rgba(14, 165, 233, 0.055)');
      boardGlow.addColorStop(1, 'rgba(2, 6, 23, 0)');
      ctx.fillStyle = boardGlow;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw the arcade grid in canvas coordinates so it stays crisp at any DPR.
      for (let i = 0; i <= config.cols; i++) {
        ctx.beginPath();
        ctx.strokeStyle = i % 5 === 0 ? 'rgba(103, 232, 249, 0.13)' : 'rgba(148, 163, 184, 0.055)';
        ctx.lineWidth = i % 5 === 0 ? Math.max(1, minCell * 0.035) : Math.max(0.75, minCell * 0.018);
        ctx.moveTo(i * cellW, 0);
        ctx.lineTo(i * cellW, canvas.height);
        ctx.stroke();
      }
      for (let i = 0; i <= config.rows; i++) {
        ctx.beginPath();
        ctx.strokeStyle = i % 5 === 0 ? 'rgba(52, 211, 153, 0.12)' : 'rgba(148, 163, 184, 0.052)';
        ctx.lineWidth = i % 5 === 0 ? Math.max(1, minCell * 0.035) : Math.max(0.75, minCell * 0.018);
        ctx.moveTo(0, i * cellH);
        ctx.lineTo(canvas.width, i * cellH);
        ctx.stroke();
      }

      // Draw Food
      const pulse = 1 + Math.sin(time / 180) * 0.12;
      const foodX = (food.x + 0.5) * cellW;
      const foodY = (food.y + 0.5) * cellH;
      const foodRadius = (minCell / 2) * 0.7 * pulse;
      const foodGradient = ctx.createRadialGradient(
        foodX - foodRadius * 0.35,
        foodY - foodRadius * 0.35,
        foodRadius * 0.08,
        foodX,
        foodY,
        foodRadius * 1.15
      );
      foodGradient.addColorStop(0, '#fff7ed');
      foodGradient.addColorStop(0.34, '#fb7185');
      foodGradient.addColorStop(0.72, '#ef4444');
      foodGradient.addColorStop(1, '#7f1d1d');

      ctx.save();
      ctx.fillStyle = 'rgba(239, 68, 68, 0.18)';
      ctx.beginPath();
      ctx.arc(foodX, foodY, foodRadius * 1.95, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = `rgba(251, 113, 133, ${0.3 + Math.sin(time / 180) * 0.12})`;
      ctx.lineWidth = Math.max(1, minCell * 0.08);
      ctx.beginPath();
      ctx.arc(foodX, foodY, foodRadius * 1.35, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = foodGradient;
      ctx.shadowColor = '#fb7185';
      ctx.shadowBlur = minCell * 0.85;
      ctx.beginPath();
      ctx.arc(foodX, foodY, foodRadius, 0, Math.PI * 2);
      ctx.fill();
      
      // Food Sparkle
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.arc(foodX - foodRadius * 0.28, foodY - foodRadius * 0.28, foodRadius * 0.22, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
      ctx.lineWidth = Math.max(1, minCell * 0.04);
      ctx.beginPath();
      ctx.moveTo(foodX + foodRadius * 0.2, foodY - foodRadius * 0.72);
      ctx.lineTo(foodX + foodRadius * 0.48, foodY - foodRadius * 0.22);
      ctx.lineTo(foodX + foodRadius * 0.1, foodY - foodRadius * 0.18);
      ctx.stroke();
      ctx.restore();

      // Ensure snake interpolates correctly even if it grew
      const prevSnake = prevSnakeRef.current;
      const prevLen = prevSnake.length;
      
      const currentSnakePositions = snake.map((seg, i) => {
        const prevSeg = i < prevLen ? prevSnake[i] : prevSnake[prevLen - 1] || seg;
        
        let dx = seg.x - prevSeg.x;
        let dy = seg.y - prevSeg.y;
        
        // Handle wrapping distance logic
        if (dx > 1) dx = -1;
        else if (dx < -1) dx = 1;
        
        if (dy > 1) dy = -1;
        else if (dy < -1) dy = 1;

        const interpX = prevSeg.x + dx * progress;
        const interpY = prevSeg.y + dy * progress;

        return { x: interpX, y: interpY };
      });

      if (currentSnakePositions.length > 0) {
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        // Check game over effect
        const isGameOver = gameState === 'GAMEOVER';
        const gameOverPulse = isGameOver ? (Math.sin(time / 100) * 0.5 + 0.5) : 0;
        
        // Draw Snake Body
        for (let i = currentSnakePositions.length - 1; i > 0; i--) {
          const p1 = currentSnakePositions[i];
          const p2 = currentSnakePositions[i - 1];

          // Skip drawing connection line if wrapped
          const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
          if (dist > 1.5) continue;

          const x1 = (p1.x + 0.5) * cellW;
          const y1 = (p1.y + 0.5) * cellH;
          const x2 = (p2.x + 0.5) * cellW;
          const y2 = (p2.y + 0.5) * cellH;
          const thicknessFactor = 1 - (i / currentSnakePositions.length);
          const bodyWidth = minCell * (0.52 + 0.36 * thicknessFactor);

          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);

          ctx.lineWidth = bodyWidth * 1.45;
          
          if (isGameOver) {
            ctx.strokeStyle = `rgba(148, 163, 184, ${0.28 - gameOverPulse * 0.1})`;
            ctx.shadowBlur = 0;
          } else {
            ctx.strokeStyle = 'rgba(52, 211, 153, 0.2)';
            ctx.shadowColor = '#34d399';
            ctx.shadowBlur = minCell * 0.65;
          }
          ctx.stroke();

          ctx.shadowBlur = 0;
          const bodyGradient = ctx.createLinearGradient(x1, y1, x2, y2);
          if (isGameOver) {
            bodyGradient.addColorStop(0, `rgba(226, 232, 240, ${0.72 - gameOverPulse * 0.2})`);
            bodyGradient.addColorStop(1, `rgba(100, 116, 139, ${0.7 - gameOverPulse * 0.2})`);
          } else {
            bodyGradient.addColorStop(0, i < 4 ? '#8cffc2' : '#34d399');
            bodyGradient.addColorStop(0.45, '#22c55e');
            bodyGradient.addColorStop(1, '#0f9f73');
          }

          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.lineWidth = bodyWidth;
          ctx.strokeStyle = bodyGradient;
          ctx.stroke();

          ctx.fillStyle = isGameOver ? 'rgba(255, 255, 255, 0.14)' : 'rgba(236, 253, 245, 0.18)';
          ctx.beginPath();
          ctx.arc(x2 - (x2 - x1) * 0.18, y2 - (y2 - y1) * 0.18, bodyWidth * 0.23, 0, Math.PI * 2);
          ctx.fill();
        }

        // Draw Head
        const head = currentSnakePositions[0];
        const hx = (head.x + 0.5) * cellW;
        const hy = (head.y + 0.5) * cellH;

        ctx.beginPath();
        
        let eatingPopScale = 1;
        if (!isGameOver && time - eatPopTimeRef.current < 200) {
          eatingPopScale = 1.2 - ((time - eatPopTimeRef.current) / 200) * 0.2;
        }
        
        const headSize = minCell * 0.48 * eatingPopScale;
        const headGradient = ctx.createRadialGradient(
          hx - headSize * 0.38,
          hy - headSize * 0.38,
          headSize * 0.08,
          hx,
          hy,
          headSize * 1.3
        );
        if (isGameOver) {
          headGradient.addColorStop(0, '#f8fafc');
          headGradient.addColorStop(1, '#94a3b8');
        } else {
          headGradient.addColorStop(0, '#dcffe9');
          headGradient.addColorStop(0.42, '#41ff9d');
          headGradient.addColorStop(1, '#059669');
        }

        ctx.fillStyle = isGameOver ? 'rgba(148, 163, 184, 0.2)' : 'rgba(52, 211, 153, 0.24)';
        ctx.shadowColor = isGameOver ? 'rgba(148, 163, 184, 0.4)' : '#41ff9d';
        ctx.shadowBlur = minCell;
        ctx.beginPath();
        ctx.arc(hx, hy, headSize * 1.7, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = headGradient;
        ctx.shadowBlur = minCell * 0.45;
        ctx.beginPath();
        ctx.arc(hx, hy, headSize * 1.1, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Eyes
        ctx.fillStyle = isGameOver ? 'rgba(0, 0, 0, 0.4)' : 'white';
        const eyeOffset = headSize * 0.45;
        const eyeSize = headSize * 0.35;
        const pupilSize = eyeSize * 0.5;

        ctx.translate(hx, hy);
        ctx.rotate(
            direction === 'UP' ? 0 :
            direction === 'RIGHT' ? Math.PI / 2 :
            direction === 'DOWN' ? Math.PI :
            -Math.PI / 2
        );

        if (!isGameOver) {
          ctx.strokeStyle = 'rgba(2, 6, 23, 0.28)';
          ctx.lineWidth = Math.max(1, headSize * 0.12);
          ctx.beginPath();
          ctx.moveTo(0, -headSize * 1.08);
          ctx.lineTo(0, -headSize * 0.58);
          ctx.stroke();
        }

        ctx.beginPath();
        ctx.arc(-eyeOffset, -eyeOffset, eyeSize, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(eyeOffset, -eyeOffset, eyeSize, 0, Math.PI * 2);
        ctx.fill();

        // Pupils
        if (!isGameOver) {
          ctx.fillStyle = 'black';
          ctx.beginPath();
          ctx.arc(-eyeOffset, -eyeOffset - eyeSize * 0.2, pupilSize, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(eyeOffset, -eyeOffset - eyeSize * 0.2, pupilSize, 0, Math.PI * 2);
          ctx.fill();
        }
        
        // Dead 'X' eyes
        if (isGameOver) {
          ctx.strokeStyle = 'white';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(-eyeOffset - eyeSize*0.5, -eyeOffset - eyeSize*0.5);
          ctx.lineTo(-eyeOffset + eyeSize*0.5, -eyeOffset + eyeSize*0.5);
          ctx.moveTo(-eyeOffset + eyeSize*0.5, -eyeOffset - eyeSize*0.5);
          ctx.lineTo(-eyeOffset - eyeSize*0.5, -eyeOffset + eyeSize*0.5);
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(eyeOffset - eyeSize*0.5, -eyeOffset - eyeSize*0.5);
          ctx.lineTo(eyeOffset + eyeSize*0.5, -eyeOffset + eyeSize*0.5);
          ctx.moveTo(eyeOffset + eyeSize*0.5, -eyeOffset - eyeSize*0.5);
          ctx.lineTo(eyeOffset - eyeSize*0.5, -eyeOffset + eyeSize*0.5);
          ctx.stroke();
        }

        ctx.restore();
      }

      animationRef.current = requestAnimationFrame(render);
    };

    animationRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationRef.current!);
  }, [snake, food, config, gameState, currentSpeed, direction]);
  
  // Keep the high-DPI canvas aligned with the responsive frame.
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        const rect = canvas.parentElement?.getBoundingClientRect();
        if (!rect) return;
        // Multiply by window.devicePixelRatio for sharp canvas rendering
        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.max(1, rect.width * dpr);
        canvas.height = Math.max(1, rect.height * dpr);
        
        // Also set css size to fit element
        canvas.style.width = `${rect.width}px`;
        canvas.style.height = `${rect.height}px`;
      }
    };

    handleResize();
    const parent = canvasRef.current?.parentElement;
    const resizeObserver = parent ? new ResizeObserver(handleResize) : null;
    if (parent) resizeObserver?.observe(parent);
    window.addEventListener('resize', handleResize);
    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <div className="snake-game-board">
      <div className="snake-game-board__inner">
        <div className="snake-game-canvas-wrap" style={{ aspectRatio: `${config.cols} / ${config.rows}` }}>
          <canvas
            ref={canvasRef}
            className="snake-game-canvas"
          />
        </div>
      </div>
    </div>
  );
};
