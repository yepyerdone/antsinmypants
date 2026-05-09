import { Ball, Vector, TableConfig, TABLE_CONFIG } from './types';

export class Physics {
  static updateBall(ball: Ball, config: TableConfig, dt: number = 1) {
    if (ball.isPocketed) return;

    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    // Friction applied over dt
    const velocityFriction = Math.pow(config.friction, dt);
    ball.vx *= velocityFriction;
    ball.vy *= velocityFriction;

    // Refined Physics: Spin influence
    const spinX = ball.spinX || 0;
    const spinY = ball.spinY || 0;
    
    // Apply spin to velocity (acceleration due to spin)
    // Spin effect is also scaled by dt
    const spinEffect = 0.025 * dt; 
    ball.vx += spinX * spinEffect;
    ball.vy += spinY * spinEffect;

    // Spin decay (friction with cloth) over dt
    const spinDecay = Math.pow(0.95, dt); 
    ball.spinX = spinX * spinDecay;
    ball.spinY = spinY * spinDecay;

    // Side spin (rotation) decay and visual rolling
    if (ball.rotation !== undefined) {
      const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
      if (speed > 0.01) {
        ball.rotation += speed * 0.15 * dt;
      }
      ball.rotation *= Math.pow(0.99, dt);
    } else {
      ball.rotation = 0;
    }

    // Stop if very slow (checks only once per frame ideally, but okay here)
    if (Math.abs(ball.vx) < 0.05) ball.vx = 0;
    if (Math.abs(ball.vy) < 0.05) ball.vy = 0;
    if (Math.abs(ball.spinX) < 0.01) ball.spinX = 0;
    if (Math.abs(ball.spinY) < 0.01) ball.spinY = 0;

    if (this.checkPocket(ball, config)) return;
    this.checkWallCollisions(ball, config);
  }

  static checkWallCollisions(ball: Ball, config: TableConfig) {
    const minX = config.cushionWidth + config.ballRadius;
    const maxX = config.width - config.cushionWidth - config.ballRadius;
    const minY = config.cushionWidth + config.ballRadius;
    const maxY = config.height - config.cushionWidth - config.ballRadius;

    let hitWall = false;

    if (ball.x < minX) {
      ball.x = minX;
      ball.vx *= -config.wallBounce;
      hitWall = true;
      // English (side spin) affects bounce reflection
      if (ball.spinY) ball.vy += ball.spinY * 0.3;
    } else if (ball.x > maxX) {
      ball.x = maxX;
      ball.vx *= -config.wallBounce;
      hitWall = true;
      if (ball.spinY) ball.vy -= ball.spinY * 0.3;
    }

    if (ball.y < minY) {
      ball.y = minY;
      ball.vy *= -config.wallBounce;
      hitWall = true;
      // English (side spin) affects bounce reflection
      if (ball.spinX) ball.vx -= ball.spinX * 0.3;
    } else if (ball.y > maxY) {
      ball.y = maxY;
      ball.vy *= -config.wallBounce;
      hitWall = true;
      if (ball.spinX) ball.vx += ball.spinX * 0.3;
    }

    // When hitting a wall, some vertical spin can be converted to other types or lost
    if (hitWall) {
      if (ball.spinX) ball.spinX *= 0.8;
      if (ball.spinY) ball.spinY *= 0.8;
    }
  }

  static checkPocket(ball: Ball, config: TableConfig) {
    for (const pocket of config.pockets) {
      const dx = ball.x - pocket.x;
      const dy = ball.y - pocket.y;
      const distSq = dx * dx + dy * dy;

      const threshold = Math.pow(config.pocketRadius * 1.1, 2); 

      if (distSq < threshold) {
        ball.isPocketed = true;
        ball.pocketedIn = { ...pocket };
        ball.vx = 0;
        ball.vy = 0;
        ball.spinX = 0;
        ball.spinY = 0;
        return true;
      }
    }
    return false;
  }

  static resolveBallCollision(b1: Ball, b2: Ball) {
    if (b1.isPocketed || b2.isPocketed) return false;

    const dx = b2.x - b1.x;
    const dy = b2.y - b1.y;
    const distSq = dx * dx + dy * dy;
    const minDist = TABLE_CONFIG.ballRadius * 2;
    const minDistSq = minDist * minDist;

    if (distSq < minDistSq) {
      const dist = Math.sqrt(distSq);
      // Collision detected
      // 1. Position correction
      const angle = Math.atan2(dy, dx);
      const targetX = b1.x + Math.cos(angle) * minDist;
      const targetY = b1.y + Math.sin(angle) * minDist;
      const ax = (targetX - b2.x) * 0.5;
      const ay = (targetY - b2.y) * 0.5;
      
      b1.x -= ax;
      b1.y -= ay;
      b2.x += ax;
      b2.y += ay;

      // 2. Velocity resolution (elastic collision)
      const nx = dx / dist;
      const ny = dy / dist;

      // Relative velocity
      const rvx = b1.vx - b2.vx;
      const rvy = b1.vy - b2.vy;
      
      // Velocity along the normal
      const velAlongNormal = rvx * nx + rvy * ny;
      
      // If velocities are already separating, skip
      if (velAlongNormal < 0) return true;

      // Impulse
      const p = velAlongNormal;

      b1.vx -= p * nx;
      b1.vy -= p * ny;
      b2.vx += p * nx;
      b2.vy += p * ny;

      // 3. Advanced Effects: Throw and Spin Transfer (Very Subtle)
      // Friction coefficient between balls
      const ballFriction = 0.005; 
      
      // Tangential velocity (velocity perpendicular to collision normal)
      const tx = -ny;
      const ty = nx;
      const velAlongTangent = rvx * tx + rvy * ty;
      
      // Throw effect: some tangential momentum is transferred
      const throwImpulse = velAlongTangent * ballFriction;
      b1.vx -= throwImpulse * tx;
      b1.vy -= throwImpulse * ty;
      b2.vx += throwImpulse * tx;
      b2.vy += throwImpulse * ty;

      // Spin transfer: some spin is transferred to the other ball
      const spinTransfer = 0.05;
      const b1SpinX = b1.spinX || 0;
      const b1SpinY = b1.spinY || 0;
      
      b2.spinX = (b2.spinX || 0) + b1SpinX * spinTransfer;
      b2.spinY = (b2.spinY || 0) + b1SpinY * spinTransfer;
      b1.spinX = b1SpinX * (1 - spinTransfer);
      b1.spinY = b1SpinY * (1 - spinTransfer);

      return true;
    }
    return false;
  }
}
