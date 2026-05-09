/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect } from 'react';
import { BOARD_WIDTH, BOARD_HEIGHT, TETROMINOES } from '../constants';
import { GameState, Particle } from '../types';

interface GameBoardProps {
  state: GameState;
}

export const GameBoard: React.FC<GameBoardProps> = ({ state }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const lastStateLines = useRef(state.lines);

  // Particle creation helper
  const createParticles = (y: number, color: string) => {
    for (let i = 0; i < 20; i++) {
      particlesRef.current.push({
        x: Math.random() * BOARD_WIDTH,
        y: y,
        vx: (Math.random() - 0.5) * 0.2,
        vy: (Math.random() - 0.5) * 0.2,
        life: 1,
        maxLife: 1,
        color: color,
      });
    }
  };

  useEffect(() => {
    if (state.lines > lastStateLines.current) {
        createParticles(BOARD_HEIGHT / 2, '#fff');
        lastStateLines.current = state.lines;
    }
  }, [state.lines]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId: number;

    const render = () => {
      const { width, height } = canvas;
      const cellSize = Math.min(width / BOARD_WIDTH, height / BOARD_HEIGHT);
      const offsetX = (width - BOARD_WIDTH * cellSize) / 2;
      const offsetY = (height - BOARD_HEIGHT * cellSize) / 2;

      ctx.clearRect(0, 0, width, height);

      // Background Grid - even subtler
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.lineWidth = 1;
      for (let x = 0; x <= BOARD_WIDTH; x++) {
        ctx.beginPath();
        ctx.moveTo(offsetX + x * cellSize, offsetY);
        ctx.lineTo(offsetX + x * cellSize, offsetY + BOARD_HEIGHT * cellSize);
        ctx.stroke();
      }
      for (let y = 0; y <= BOARD_HEIGHT; y++) {
        ctx.beginPath();
        ctx.moveTo(offsetX, offsetY + y * cellSize);
        ctx.lineTo(offsetX + BOARD_WIDTH * cellSize, offsetY + y * cellSize);
        ctx.stroke();
      }

      const drawBlock = (x: number, y: number, color: string, glow: string, alpha = 1) => {
        ctx.save();
        ctx.globalAlpha = alpha;
        
        ctx.fillStyle = color;
        const p = 0; // No padding for pixel look
        ctx.fillRect(offsetX + x * cellSize, offsetY + y * cellSize, cellSize, cellSize);
        
        // Pixel Highlight (Top & Left)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.fillRect(offsetX + x * cellSize, offsetY + y * cellSize, cellSize, 4);
        ctx.fillRect(offsetX + x * cellSize, offsetY + y * cellSize, 4, cellSize);

        // Pixel Shadow (Bottom & Right)
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.fillRect(offsetX + x * cellSize, offsetY + (y + 1) * cellSize - 4, cellSize, 4);
        ctx.fillRect(offsetX + (x + 1) * cellSize - 4, offsetY + y * cellSize, 4, cellSize);

        // Inner Block Detail
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.fillRect(offsetX + x * cellSize + 8, offsetY + y * cellSize + 8, cellSize - 16, cellSize - 16);

        ctx.restore();
      };

      // Draw Settled Board
      state.board.forEach((row, y) => {
        row.forEach((type, x) => {
          if (type) {
            const t = TETROMINOES[type as keyof typeof TETROMINOES];
            drawBlock(x, y, t.color, t.glow);
          }
        });
      });

      // Draw Current Piece
      if (state.currentPiece) {
        const t = TETROMINOES[state.currentPiece.type];
        
        let ghostY = 0;
        const checkCollision = (moveY: number): boolean => {
            for (let y = 0; y < state.currentPiece!.shape.length; y++) {
                for (let x = 0; x < state.currentPiece!.shape[y].length; x++) {
                    if (state.currentPiece!.shape[y][x]) {
                        const newX = state.currentPiece!.pos.x + x;
                        const newY = state.currentPiece!.pos.y + y + moveY;
                        if (newX < 0 || newX >= BOARD_WIDTH || newY >= BOARD_HEIGHT || (newY >= 0 && state.board[newY][newX])) {
                            return true;
                        }
                    }
                }
            }
            return false;
        };
        while(!checkCollision(ghostY + 1)) ghostY++;
        
        state.currentPiece.shape.forEach((row, y) => {
          row.forEach((val, x) => {
            if (val) {
              drawBlock(state.currentPiece!.pos.x + x, state.currentPiece!.pos.y + y + ghostY, t.color, t.glow, 0.2);
              drawBlock(state.currentPiece!.pos.x + x, state.currentPiece!.pos.y + y, t.color, t.glow);
            }
          });
        });
      }

      // Draw Particles
      particlesRef.current = particlesRef.current.filter(p => p.life > 0);
      particlesRef.current.forEach(p => {
        ctx.save();
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(offsetX + p.x * cellSize, offsetY + p.y * cellSize, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.02;
      });

      rafId = requestAnimationFrame(render);
    };

    rafId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafId);
  }, [state]);

  return (
      <div className="glass p-2 relative rounded-[20px] w-[340px] h-[660px] bg-black/30 backdrop-blur-xl">
        <canvas
          ref={canvasRef}
          width={320}
          height={640}
          className="w-full h-full rounded-lg [image-rendering:pixelated]"
        />
      </div>
  );
};

