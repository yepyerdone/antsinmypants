export enum DogState {
  HIDDEN,
  WALKING,
  JUMPING,
  RETRIEVING,
  CELEBRATING,
  LAUGHING,
  IDLE
}

export class Dog {
  private x: number = -100;
  private y: number;
  private state: DogState = DogState.IDLE;
  private animationFrame: number = 0;
  private animationTimer: number = 0;
  private canvasWidth: number;
  private canvasHeight: number;
  private speed: number = 2;
  private jumpVY: number = 0;
  private mouthOpen: boolean = false;

  constructor(canvasWidth: number, canvasHeight: number) {
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
    this.y = canvasHeight - 110;
  }

  setState(state: DogState) {
    this.state = state;
    this.animationTimer = 0;
    this.animationFrame = 0;
    if (state === DogState.WALKING) {
      this.x = -100;
      this.y = this.canvasHeight - 110;
    } else if (state === DogState.JUMPING) {
      this.jumpVY = -8;
    } else if (state === DogState.CELEBRATING || state === DogState.LAUGHING) {
      this.x = this.canvasWidth / 2 - 50;
      this.y = this.canvasHeight - 100;
    } else if (state === DogState.RETRIEVING) {
      this.x = this.canvasWidth / 2 - 72;
      this.y = this.canvasHeight - 56;
    }
  }

  retrieveBird() {
    this.setState(DogState.RETRIEVING);
  }

  update() {
    this.animationTimer++;
    if (this.state === DogState.WALKING) {
      this.x += this.speed;
      if (this.animationTimer % 10 === 0) {
        this.animationFrame = (this.animationFrame + 1) % 4;
      }
      if (this.x > this.canvasWidth * 0.3) {
        this.setState(DogState.JUMPING);
      }
    } else if (this.state === DogState.JUMPING) {
      this.y += this.jumpVY;
      this.jumpVY += 0.4;
      this.x += this.speed;
      if (this.y > this.canvasHeight - 50) {
        this.state = DogState.HIDDEN;
      }
    } else if (this.state === DogState.RETRIEVING) {
      this.mouthOpen = Math.floor(this.animationTimer / 8) % 2 === 0;
      if (this.animationFrame === 0) {
        this.y -= 3;
        if (this.y < this.canvasHeight - 210) this.animationFrame = 1;
      } else if (this.animationFrame === 1) {
        if (this.animationTimer > 92) this.animationFrame = 2;
      } else if (this.animationFrame === 2) {
        this.y += 3;
        if (this.y >= this.canvasHeight - 56) this.state = DogState.HIDDEN;
      }
    } else if (this.state === DogState.CELEBRATING) {
      if (this.animationFrame === 0) {
        this.y -= 2;
        if (this.y < this.canvasHeight - 180) this.animationFrame = 1;
      } else if (this.animationFrame === 1) {
        if (this.animationTimer > 120) {
          this.y += 2;
          if (this.y >= this.canvasHeight - 100) this.state = DogState.HIDDEN;
        }
      }
    } else if (this.state === DogState.LAUGHING) {
      if (this.animationFrame === 0) {
        this.y -= 2;
        if (this.y < this.canvasHeight - 160) this.animationFrame = 1;
      } else if (this.animationFrame === 1) {
        if (this.animationTimer % 8 === 0) {
          this.y += (this.animationTimer % 16 === 0 ? -4 : 4);
        }
        if (this.animationTimer > 120) {
          this.y += 2;
          if (this.y >= this.canvasHeight - 100) this.state = DogState.HIDDEN;
        }
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    if (this.state === DogState.HIDDEN) return;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.imageSmoothingEnabled = false;

    if (this.state === DogState.RETRIEVING) {
      this.drawFrontRetrieveDog(ctx);
      ctx.restore();
      return;
    }

    const isHappy = this.state === DogState.CELEBRATING;

    // Tail
    ctx.fillStyle = '#4e2a18';
    const wag = Math.sin(this.animationTimer * 0.24) * 8;
    ctx.fillRect(0, 32 + wag * 0.2, 18, 10);
    ctx.fillRect(-8, 24 + wag, 12, 10);
    
    // Body
    ctx.fillStyle = '#8a5832';
    ctx.fillRect(10, 30, 82, 50);
    ctx.strokeStyle = '#3e2723';
    ctx.lineWidth = 2;
    ctx.strokeRect(10, 30, 82, 50);

    // Back spots and collar
    ctx.fillStyle = '#4e2a18';
    ctx.fillRect(22, 36, 22, 16);
    ctx.fillRect(54, 56, 20, 14);
    ctx.fillStyle = '#e53935';
    ctx.fillRect(76, 30, 6, 50);
    ctx.fillStyle = '#ffd54f';
    ctx.fillRect(76, 64, 8, 8);
    
    // Legs
    ctx.fillStyle = '#4e2a18';
    if (this.state === DogState.WALKING) {
       const offset = Math.sin(this.animationTimer * 0.2) * 10;
       ctx.fillRect(20, 80, 10, 15 + offset);
       ctx.fillRect(60, 80, 10, 15 - offset);
    } else {
       ctx.fillRect(20, 80, 10, 20);
       ctx.fillRect(60, 80, 10, 20);
    }

    // Head
    ctx.fillStyle = '#8a5832';
    ctx.fillRect(68, 0, 44, 42);
    ctx.strokeRect(70, 0, 40, 40);
    
    // Ears
    ctx.fillStyle = '#4e2a18';
    ctx.fillRect(62, 5, 14, 30);
    ctx.fillRect(106, 5, 14, 30);
    ctx.fillStyle = '#2b150d';
    ctx.fillRect(66, 12, 6, 15);
    ctx.fillRect(110, 12, 6, 15);

    // Snout
    ctx.fillStyle = '#d49a59';
    ctx.fillRect(88, 20, 34, 20);
    ctx.fillStyle = '#f0c27a';
    ctx.fillRect(92, 25, 18, 10);
    
    // Eyes
    ctx.fillStyle = '#000';
    if (this.state === DogState.LAUGHING) {
      ctx.fillRect(95, 10, 8, 2); // Closed eyes
    } else if (isHappy) {
      ctx.fillRect(90, 10, 10, 2);
      ctx.fillRect(104, 10, 10, 2);
      ctx.fillRect(94, 8, 2, 2);
      ctx.fillRect(108, 8, 2, 2);
    } else {
      ctx.fillRect(94, 8, 4, 4);
      ctx.fillRect(102, 8, 4, 4);
    }
    
    // Nose
    ctx.fillRect(115, 25, 6, 6);

    // Smile
    ctx.fillStyle = '#1b0d08';
    if (isHappy) {
      ctx.fillRect(98, 35, 18, this.mouthOpen ? 8 : 4);
      ctx.fillStyle = '#ff8a80';
      if (this.mouthOpen) ctx.fillRect(103, 39, 8, 4);
    } else {
      ctx.fillRect(100, 34, 12, 3);
    }

    // Held bird
    if (this.state === DogState.CELEBRATING) {
      ctx.fillStyle = '#6d4c41';
      ctx.fillRect(34, 6, 42, 18);
      ctx.fillStyle = '#2f7d45';
      ctx.fillRect(66, 3, 14, 14);
      ctx.fillStyle = '#caa35a';
      ctx.fillRect(20, 0, 18, 10);
      ctx.fillRect(22, 21, 18, 8);
      ctx.fillStyle = '#ffca28';
      ctx.fillRect(80, 8, 8, 4);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(72, 6, 3, 3);
      ctx.fillStyle = '#4e342e';
      ctx.fillRect(38, 12, 8, 4);

      ctx.fillStyle = '#8a5832';
      ctx.fillRect(30, 22, 12, 28);
      ctx.fillRect(66, 22, 12, 28);
      ctx.fillStyle = '#4e2a18';
      ctx.fillRect(28, 18, 16, 8);
      ctx.fillRect(64, 18, 16, 8);
    }

    ctx.restore();
  }

  private drawFrontRetrieveDog(ctx: CanvasRenderingContext2D) {
    const bounce = Math.sin(this.animationTimer * 0.18) * 2;

    // Tail behind the seated body
    ctx.fillStyle = '#4e2a18';
    ctx.fillRect(18, 84 + bounce, 22, 12);
    ctx.fillRect(6, 72 + bounce, 18, 12);

    // Seated body and chest
    ctx.fillStyle = '#8a5832';
    ctx.fillRect(38, 62 + bounce, 68, 66);
    ctx.strokeStyle = '#3e2723';
    ctx.lineWidth = 2;
    ctx.strokeRect(38, 62 + bounce, 68, 66);
    ctx.fillStyle = '#d49a59';
    ctx.fillRect(55, 74 + bounce, 34, 46);
    ctx.fillStyle = '#f0c27a';
    ctx.fillRect(61, 82 + bounce, 22, 30);

    // Collar and tag
    ctx.fillStyle = '#e53935';
    ctx.fillRect(43, 62 + bounce, 58, 7);
    ctx.fillStyle = '#ffd54f';
    ctx.fillRect(69, 68 + bounce, 8, 8);

    // Sitting legs and paws
    ctx.fillStyle = '#4e2a18';
    ctx.fillRect(24, 114 + bounce, 32, 20);
    ctx.fillRect(88, 114 + bounce, 32, 20);
    ctx.fillStyle = '#d49a59';
    ctx.fillRect(26, 128 + bounce, 34, 12);
    ctx.fillRect(84, 128 + bounce, 34, 12);
    ctx.fillStyle = '#3e2723';
    ctx.fillRect(32, 134 + bounce, 5, 4);
    ctx.fillRect(44, 134 + bounce, 5, 4);
    ctx.fillRect(96, 134 + bounce, 5, 4);
    ctx.fillRect(108, 134 + bounce, 5, 4);

    // Front-facing head
    ctx.fillStyle = '#8a5832';
    ctx.fillRect(42, 12 + bounce, 60, 54);
    ctx.strokeStyle = '#3e2723';
    ctx.strokeRect(42, 12 + bounce, 60, 54);
    ctx.fillStyle = '#4e2a18';
    ctx.fillRect(28, 18 + bounce, 16, 38);
    ctx.fillRect(100, 18 + bounce, 16, 38);
    ctx.fillStyle = '#2b150d';
    ctx.fillRect(32, 28 + bounce, 7, 20);
    ctx.fillRect(105, 28 + bounce, 7, 20);

    // Face markings and muzzle
    ctx.fillStyle = '#a9653a';
    ctx.fillRect(45, 16 + bounce, 16, 16);
    ctx.fillRect(83, 16 + bounce, 16, 16);
    ctx.fillStyle = '#d49a59';
    ctx.fillRect(54, 38 + bounce, 36, 22);
    ctx.fillStyle = '#f0c27a';
    ctx.fillRect(61, 43 + bounce, 22, 10);

    // Happy eyes, nose, and open smile
    ctx.fillStyle = '#111';
    ctx.fillRect(55, 30 + bounce, 10, 3);
    ctx.fillRect(79, 30 + bounce, 10, 3);
    ctx.fillRect(61, 28 + bounce, 2, 2);
    ctx.fillRect(85, 28 + bounce, 2, 2);
    ctx.fillRect(68, 44 + bounce, 9, 7);
    ctx.fillRect(63, 54 + bounce, 18, this.mouthOpen ? 9 : 5);
    if (this.mouthOpen) {
      ctx.fillStyle = '#ff8a80';
      ctx.fillRect(68, 59 + bounce, 8, 4);
    }

    // Bird held proudly across the front
    ctx.fillStyle = '#8a5832';
    ctx.fillRect(20, 72 + bounce, 18, 42);
    ctx.fillRect(106, 72 + bounce, 18, 42);
    ctx.fillStyle = '#4e2a18';
    ctx.fillRect(16, 70 + bounce, 22, 10);
    ctx.fillRect(106, 70 + bounce, 22, 10);

    ctx.fillStyle = '#6d4c41';
    ctx.fillRect(44, 78 + bounce, 48, 20);
    ctx.fillStyle = '#a1887f';
    ctx.fillRect(54, 84 + bounce, 26, 8);
    ctx.fillStyle = '#2f7d45';
    ctx.fillRect(90, 74 + bounce, 16, 16);
    ctx.fillStyle = '#66bb6a';
    ctx.fillRect(93, 77 + bounce, 8, 5);
    ctx.fillStyle = '#ffca28';
    ctx.fillRect(106, 80 + bounce, 9, 4);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(98, 78 + bounce, 3, 3);
    ctx.fillStyle = '#111';
    ctx.fillRect(99, 79 + bounce, 1, 1);
    ctx.fillStyle = '#caa35a';
    ctx.fillRect(30, 70 + bounce, 18, 10);
    ctx.fillRect(32, 96 + bounce, 18, 8);
    ctx.fillStyle = '#3e2723';
    ctx.fillRect(32, 86 + bounce, 12, 4);
  }

  getState() { return this.state; }
}
