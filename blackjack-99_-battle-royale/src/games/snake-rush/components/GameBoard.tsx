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

      // Draw grid lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;
      for (let i = 0; i <= config.cols; i++) {
        ctx.beginPath();
        ctx.moveTo(i * cellW, 0);
        ctx.lineTo(i * cellW, canvas.height);
        ctx.stroke();
      }
      for (let i = 0; i <= config.rows; i++) {
        ctx.beginPath();
        ctx.moveTo(0, i * cellH);
        ctx.lineTo(canvas.width, i * cellH);
        ctx.stroke();
      }

      // Draw Food
      const pulse = 1 + Math.sin(time / 200) * 0.1;
      const foodX = (food.x + 0.5) * cellW;
      const foodY = (food.y + 0.5) * cellH;
      const foodRadius = (Math.min(cellW, cellH) / 2) * 0.8 * pulse;

      ctx.save();
      ctx.fillStyle = '#ef4444';
      ctx.shadowColor = '#ef4444';
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.arc(foodX, foodY, foodRadius, 0, Math.PI * 2);
      ctx.fill();
      
      // Food Sparkle
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.arc(foodX - foodRadius * 0.3, foodY - foodRadius * 0.3, foodRadius * 0.25, 0, Math.PI * 2);
      ctx.fill();
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

          ctx.beginPath();
          ctx.moveTo((p1.x + 0.5) * cellW, (p1.y + 0.5) * cellH);
          ctx.lineTo((p2.x + 0.5) * cellW, (p2.y + 0.5) * cellH);
          
          const thicknessFactor = 1 - (i / currentSnakePositions.length);
          ctx.lineWidth = Math.min(cellW, cellH) * (0.5 + 0.4 * thicknessFactor);
          
          if (isGameOver) {
            ctx.strokeStyle = `rgba(180, 180, 180, ${1 - gameOverPulse * 0.5})`;
          } else {
             // Gradient effect dependent on index
             ctx.strokeStyle = i < 4 ? '#34d399' : '#10b981';
          }
          ctx.stroke();
        }

        // Draw Head
        const head = currentSnakePositions[0];
        const hx = (head.x + 0.5) * cellW;
        const hy = (head.y + 0.5) * cellH;
        
        ctx.fillStyle = isGameOver ? '#d1d5db' : '#34d399';
        ctx.beginPath();
        
        let eatingPopScale = 1;
        if (!isGameOver && time - eatPopTimeRef.current < 200) {
          eatingPopScale = 1.2 - ((time - eatPopTimeRef.current) / 200) * 0.2;
        }
        
        const headSize = Math.min(cellW, cellH) * 0.45 * eatingPopScale;
        ctx.arc(hx, hy, headSize * 1.1, 0, Math.PI * 2);
        ctx.fill();

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
  
  // Need to handle resizing
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        const rect = canvas.parentElement!.getBoundingClientRect();
        // Multiply by window.devicePixelRatio for sharp canvas rendering
        const dpr = window.devicePixelRatio || 1;
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        
        // Also set css size to fit element
        canvas.style.width = `${rect.width}px`;
        canvas.style.height = `${rect.height}px`;
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="relative glass-panel p-1 rounded-[16px] shadow-2xl mx-auto w-full max-w-[500px]">
       <div className="w-full h-full relative rounded-[12px] overflow-hidden bg-black/40">
           {/* Aspect ratio wrapper mapping to grid proportions */}
           <div style={{ aspectRatio: `${config.cols} / ${config.rows}` }}>
              <canvas
                ref={canvasRef}
                className="absolute inset-0 block"
              />
           </div>
       </div>
    </div>
  );
};
