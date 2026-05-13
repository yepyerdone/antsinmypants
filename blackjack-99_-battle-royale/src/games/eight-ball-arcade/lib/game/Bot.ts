import { Ball, GameState, Vector, TABLE_CONFIG } from './types';

export class BotAI {
  static getShot(state: GameState): { angle: number; power: number; pocket: Vector } | null {
    const currentPlayer = state.players[state.turnIndex];
    const validBalls = this.getBotTargets(currentPlayer, state.balls);
    if (validBalls.length === 0) return null;

    const cueBall = state.balls.find(b => b.type === 'cue')!;
    const difficulty = state.difficulty || 'medium';

    const pockets = TABLE_CONFIG.pockets;
    const skill = {
      easy: { error: 0.22, minPower: 5.5, maxPower: 12, powerBoost: 1.2, blockerPenalty: 130, cutPenalty: 90 },
      medium: { error: 0.045, minPower: 8, maxPower: 16, powerBoost: 3.1, blockerPenalty: 260, cutPenalty: 145 },
      hard: { error: 0.012, minPower: 10.5, maxPower: 19, powerBoost: 4.8, blockerPenalty: 520, cutPenalty: 210 },
    }[difficulty];

    let bestShot: { angle: number; power: number; pocket: Vector } | null = null;
    let maxConfidence = -1;

    for (const ball of validBalls) {
      for (const pocket of pockets) {
        const angleToPocket = Math.atan2(pocket.y - ball.y, pocket.x - ball.x);
        const targetDistance = TABLE_CONFIG.ballRadius * 2.05;
        const targetX = ball.x - Math.cos(angleToPocket) * targetDistance;
        const targetY = ball.y - Math.sin(angleToPocket) * targetDistance;
        const targetPoint = { x: targetX, y: targetY };

        if (!this.isPointPlayable(targetPoint)) continue;

        const distToTarget = this.distance(cueBall, targetPoint);
        const distToPocket = this.distance(ball, pocket);
        const angleFromCue = Math.atan2(targetY - cueBall.y, targetX - cueBall.x);
        const cutAngle = this.cutAngle(cueBall, targetPoint, ball, pocket);
        const cueBlockers = this.countBlockers(cueBall, targetPoint, state.balls, [0, ball.id]);
        const pocketBlockers = this.countBlockers(ball, pocket, state.balls, [0, ball.id]);

        const clearShotBonus = cueBlockers === 0 && pocketBlockers === 0 ? 350 : 0;
        const centerPocketBonus = pocket.x === TABLE_CONFIG.width / 2 ? 35 : 0;
        const targetValue = ball.type === 'black' ? 30 : 0;
        const distancePenalty = distToTarget * 0.5 + distToPocket * 0.34;
        const blockerPenalty = (cueBlockers + pocketBlockers * 1.6) * skill.blockerPenalty;
        const cutPenalty = Math.pow(cutAngle / (Math.PI / 2), 2) * skill.cutPenalty;
        const confidence = 900 + clearShotBonus + centerPocketBonus + targetValue - distancePenalty - blockerPenalty - cutPenalty;

        const rawPower = (distToTarget * 0.028) + (distToPocket * 0.017) + skill.powerBoost;
        const finalPower = Math.max(
          skill.minPower,
          Math.min(skill.maxPower, rawPower + (Math.random() * (difficulty === 'easy' ? 3 : 1.4)))
        );
        const finalAngle = angleFromCue + (Math.random() - 0.5) * skill.error;

        if (confidence > maxConfidence) {
          maxConfidence = confidence;
          bestShot = { angle: finalAngle, power: finalPower, pocket };
        }
      }
    }

    return bestShot || {
      angle: Math.atan2(TABLE_CONFIG.height / 2 - cueBall.y, TABLE_CONFIG.width * 0.75 - cueBall.x),
      power: difficulty === 'hard' ? 15 : difficulty === 'medium' ? 12 : 8,
      pocket: pockets[0],
    };
  }

  private static distance(a: Vector, b: Vector) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  private static getBotTargets(player: GameState['players'][number], balls: Ball[]) {
    const activeBalls = balls.filter(ball => !ball.isPocketed && ball.type !== 'cue');

    if (!player.group) {
      return activeBalls.filter(ball => ball.type === 'solid' || ball.type === 'stripe');
    }

    const groupType = player.group === 'solids' ? 'solid' : 'stripe';
    const groupBalls = activeBalls.filter(ball => ball.type === groupType);
    if (groupBalls.length > 0) return groupBalls;

    return activeBalls.filter(ball => ball.type === 'black');
  }

  private static isPointPlayable(point: Vector) {
    const margin = TABLE_CONFIG.cushionWidth + TABLE_CONFIG.ballRadius;
    return point.x >= margin
      && point.x <= TABLE_CONFIG.width - margin
      && point.y >= margin
      && point.y <= TABLE_CONFIG.height - margin;
  }

  private static cutAngle(cueBall: Vector, targetPoint: Vector, objectBall: Vector, pocket: Vector) {
    const cueAngle = Math.atan2(targetPoint.y - cueBall.y, targetPoint.x - cueBall.x);
    const pocketAngle = Math.atan2(pocket.y - objectBall.y, pocket.x - objectBall.x);
    const delta = Math.atan2(Math.sin(cueAngle - pocketAngle), Math.cos(cueAngle - pocketAngle));
    return Math.abs(delta);
  }

  private static countBlockers(start: Vector, end: Vector, balls: Ball[], excludedIds: number[]) {
    return balls.reduce((count, ball) => {
      if (ball.isPocketed || excludedIds.includes(ball.id)) return count;
      const distanceToLine = this.distancePointToSegment(ball, start, end);
      const between = this.isBetween(ball, start, end);
      return distanceToLine < TABLE_CONFIG.ballRadius * 2.15 && between ? count + 1 : count;
    }, 0);
  }

  private static distancePointToSegment(point: Vector, start: Vector, end: Vector) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthSq = dx * dx + dy * dy;
    if (lengthSq === 0) return this.distance(point, start);

    const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSq));
    const projection = {
      x: start.x + t * dx,
      y: start.y + t * dy,
    };
    return this.distance(point, projection);
  }

  private static isBetween(point: Vector, start: Vector, end: Vector) {
    const minX = Math.min(start.x, end.x) - TABLE_CONFIG.ballRadius;
    const maxX = Math.max(start.x, end.x) + TABLE_CONFIG.ballRadius;
    const minY = Math.min(start.y, end.y) - TABLE_CONFIG.ballRadius;
    const maxY = Math.max(start.y, end.y) + TABLE_CONFIG.ballRadius;
    return point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY;
  }
}
