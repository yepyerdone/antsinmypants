import { Ball, GameState, Vector, TABLE_CONFIG } from './types';
import { Engine } from './Engine';

export class BotAI {
  static getShot(state: GameState): { angle: number; power: number; pocket: Vector } | null {
    const currentPlayer = state.players[state.turnIndex];
    const validBalls = Engine.getValidBalls(currentPlayer, state.balls);
    if (validBalls.length === 0) return null;

    const cueBall = state.balls.find(b => b.type === 'cue')!;
    const difficulty = state.difficulty || 'medium';

    const pockets = [
      { x: TABLE_CONFIG.cushionWidth, y: TABLE_CONFIG.cushionWidth },
      { x: TABLE_CONFIG.width / 2, y: TABLE_CONFIG.cushionWidth / 2 },
      { x: TABLE_CONFIG.width - TABLE_CONFIG.cushionWidth, y: TABLE_CONFIG.cushionWidth },
      { x: TABLE_CONFIG.cushionWidth, y: TABLE_CONFIG.height - TABLE_CONFIG.cushionWidth },
      { x: TABLE_CONFIG.width / 2, y: TABLE_CONFIG.height - TABLE_CONFIG.cushionWidth / 2 },
      { x: TABLE_CONFIG.width - TABLE_CONFIG.cushionWidth, y: TABLE_CONFIG.height - TABLE_CONFIG.cushionWidth },
    ];

    let bestShot = null;
    let maxConfidence = -1;

    for (const ball of validBalls) {
      for (const pocket of pockets) {
        // Simple geometry: aim to hit the ball so it goes into the pocket
        const angleToPocket = Math.atan2(pocket.y - ball.y, pocket.x - ball.x);
        
        // Target point on the ball opposite to the pocket
        const d = TABLE_CONFIG.ballRadius * 2;
        const targetX = ball.x - Math.cos(angleToPocket) * d;
        const targetY = ball.y - Math.sin(angleToPocket) * d;

        const angleFromCue = Math.atan2(targetY - cueBall.y, targetX - cueBall.x);
        const distToBall = Math.sqrt(Math.pow(targetX - cueBall.x, 2) + Math.pow(targetY - cueBall.y, 2));

        let confidence = 1 / distToBall; // Prefer closer targets
        
        // Add error based on difficulty
        const errorRange = difficulty === 'easy' ? 0.2 : difficulty === 'medium' ? 0.05 : 0.01;
        const finalAngle = angleFromCue + (Math.random() - 0.5) * errorRange;
        const finalPower = Math.min(10, (distToBall * 0.05) + Math.random() * (difficulty === 'easy' ? 5 : 2));

        if (confidence > maxConfidence) {
          maxConfidence = confidence;
          bestShot = { angle: finalAngle, power: finalPower, pocket };
        }
      }
    }

    return bestShot || { angle: Math.random() * Math.PI * 2, power: 5, pocket: pockets[0] };
  }
}
