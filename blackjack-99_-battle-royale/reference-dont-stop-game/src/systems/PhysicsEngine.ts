export interface JumpState {
  height: number;
  velocity: number;
  holdTime: number;
  holding: boolean;
}

export class PhysicsEngine {
  public readonly gravity = 24;
  public readonly jumpVelocity = 7.9;
  public readonly holdBoost = 20;
  public readonly maxHoldTime = 0.22;
  public readonly maxJumpHeight = 2.8;

  public beginJump(state: JumpState): void {
    state.velocity = this.jumpVelocity;
    state.holdTime = 0;
    state.holding = true;
  }

  public updateJump(state: JumpState, delta: number, jumpHeld: boolean): boolean {
    if (state.height <= 0 && state.velocity <= 0) {
      state.height = 0;
      state.velocity = 0;
      return false;
    }

    if (jumpHeld && state.holding && state.holdTime < this.maxHoldTime && state.height < this.maxJumpHeight) {
      state.velocity += this.holdBoost * delta;
      state.holdTime += delta;
    } else {
      state.holding = false;
    }

    if (!jumpHeld && state.velocity > 0) {
      state.velocity *= Math.max(0, 1 - delta * 10);
    }

    state.velocity -= this.gravity * delta;
    state.height += state.velocity * delta;
    if (state.height >= this.maxJumpHeight) {
      state.height = this.maxJumpHeight;
      state.velocity = Math.min(0, state.velocity);
      state.holding = false;
    }
    if (state.height <= 0) {
      state.height = 0;
      state.velocity = 0;
      state.holdTime = 0;
      state.holding = false;
      return false;
    }
    return true;
  }
}
