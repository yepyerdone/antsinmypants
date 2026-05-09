import { Ball, GameState, PlayerGroup, TABLE_CONFIG, GamePlayer } from './types';

export class Engine {
  static createBalls(): Ball[] {
    const balls: Ball[] = [];
    const r = TABLE_CONFIG.ballRadius;
    const rackX = TABLE_CONFIG.width * 0.75;
    const rackY = TABLE_CONFIG.height / 2;

    // Cue ball
    balls.push({
      id: 0,
      x: TABLE_CONFIG.width * 0.25,
      y: rackY,
      vx: 0,
      vy: 0,
      type: 'cue',
      number: 0,
      isPocketed: false,
    });

    // 8 ball index in triangle
    const numbers = [1, 9, 2, 10, 8, 3, 11, 4, 12, 5, 13, 6, 14, 7, 15];
    let idx = 0;
    for (let row = 0; row < 5; row++) {
      for (let i = 0; i <= row; i++) {
        const num = numbers[idx++];
        const type = num === 8 ? 'black' : num <= 7 ? 'solid' : 'stripe';
        balls.push({
          id: num,
          x: rackX + row * r * 1.75,
          y: rackY - (row * r) + (i * r * 2),
          vx: 0,
          vy: 0,
          type,
          number: num,
          isPocketed: false,
        });
      }
    }

    return balls;
  }

  static getValidBalls(player: GamePlayer, balls: Ball[]): Ball[] {
    // Rule change: Any active ball is a valid first hit at any stage of the game.
    // This removes "must hit solids/stripes first" and "must hit 8-ball first" fouls.
    return balls.filter(b => !b.isPocketed && b.type !== 'cue');
  }

  static checkRules(state: GameState): GameState {
    const newState = { ...state };
    const currentPlayer = newState.players[newState.turnIndex];
    const otherPlayer = newState.players[1 - newState.turnIndex];

    const cueBall = newState.balls.find(b => b.type === 'cue')!;
    const isCuePocketed = cueBall.isPocketed;

    // Foul detection
    let isFoul = false;
    let foulReason: string | null = null;

    if (isCuePocketed) {
      isFoul = true;
      foulReason = 'Cue ball pocketed';
      // Standard 8-ball: reposition cue ball
      cueBall.isPocketed = false;
      cueBall.x = TABLE_CONFIG.width * 0.25;
      cueBall.y = TABLE_CONFIG.height / 2;
      cueBall.vx = 0;
      cueBall.vy = 0;
    } else if (!newState.firstBallHit) {
      isFoul = true;
      foulReason = 'No ball hit';
    } 
    // "Wrong ball hit" foul check removed as per user request to allow hitting any ball first

    // 8-ball win/loss condition
    const eightBall = newState.balls.find(b => b.type === 'black')!;
    if (eightBall.isPocketed) {
      const targetType = currentPlayer.group === 'solids' ? 'solid' : 'stripe';
      const remainingInGroup = newState.balls.filter(b => b.type === targetType && !b.isPocketed);
      
      // Winning: 8-ball pocketed legally (no balls left and no foul)
      const inCorrectPocket = newState.nominatedPocket && 
                              eightBall.pocketedIn && 
                              Math.abs(eightBall.pocketedIn.x - newState.nominatedPocket.x) < 5 && 
                              Math.abs(eightBall.pocketedIn.y - newState.nominatedPocket.y) < 5;

      if (remainingInGroup.length === 0 && !isFoul && inCorrectPocket) {
        newState.winner = currentPlayer.uid;
      } else {
        // Losing: 8-ball pocketed early, on a foul, or in the wrong pocket
        newState.winner = otherPlayer.uid;
        if (remainingInGroup.length > 0) {
          newState.foulReason = '8-ball pocketed early';
        } else if (isFoul) {
          newState.foulReason = 'Foul when pocketing 8-ball';
        } else if (!inCorrectPocket) {
          newState.foulReason = '8-ball pocketed in wrong pocket';
        }
      }
      newState.status = 'finished';
      return newState;
    }

    // Group assignment
    if (!currentPlayer.group && newState.ballsPocketedThisTurn.length > 0) {
      const firstPocketed = newState.ballsPocketedThisTurn.find(b => b.type === 'solid' || b.type === 'stripe');
      if (firstPocketed) {
        currentPlayer.group = firstPocketed.type === 'solid' ? 'solids' : 'stripes';
        otherPlayer.group = currentPlayer.group === 'solids' ? 'stripes' : 'solids';
      }
    }

    // Turn transition
    const targetType = currentPlayer.group === 'solids' ? 'solid' : 'stripe';
    const pocketedOwn = newState.ballsPocketedThisTurn.some(b => b.type === targetType);
    const shouldKeepTurn = (pocketedOwn || !currentPlayer.group) && newState.ballsPocketedThisTurn.length > 0 && !isFoul;

    if (isFoul) {
      newState.isFoul = true;
      newState.foulReason = foulReason;
      newState.isBallInHand = true;
      newState.turnIndex = 1 - newState.turnIndex;
    } else if (!shouldKeepTurn) {
      newState.turnIndex = 1 - newState.turnIndex;
    }

    // Reset turn-specific state
    newState.firstBallHit = null;
    newState.ballsPocketedThisTurn = [];
    newState.nominatedPocket = null; // Reset pocket nomination for next turn
    
    // Start the timer for the next turn
    newState.turnStartTime = Date.now();
    
    return newState;
  }

  static forfeitTurn(state: GameState): GameState {
    const newState = { ...state };
    const currentPlayer = newState.players[newState.turnIndex];
    
    // Increment violations
    currentPlayer.violations = (currentPlayer.violations || 0) + 1;
    
    if (currentPlayer.violations >= 3) {
      newState.winner = newState.players[1 - newState.turnIndex].uid;
      newState.status = 'finished';
      newState.foulReason = `${currentPlayer.name} disqualified (3 time violations)`;
    } else {
      // Basic foul and turn change
      newState.isFoul = true;
      newState.foulReason = 'Time violation';
      newState.isBallInHand = true;
      newState.turnIndex = 1 - newState.turnIndex;
      newState.turnStartTime = Date.now();
    }
    
    return newState;
  }
}
