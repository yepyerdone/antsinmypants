export enum BirdState {
  FLYING,
  HIT,
  FALLING,
  ESCAPING,
  OFFSCREEN
}

export class Bird {
  private x: number;
  private y: number;
  private vx: number;
  private vy: number;
  private size: number = 44;
  private state: BirdState = BirdState.FLYING;
  private animationFrame: number = 0;
  private animationTimer: number = 0;
  private fallSpeed: number = 5;
  private escapeSpeed: number = 7;
  private id: string;

  constructor(canvasWidth: number, canvasHeight: number, speedMultiplier: number) {
    this.id = Math.random().toString(36).substr(2, 9);
    this.x = canvasWidth / 2;
    this.y = canvasHeight - 50;
    
    const angle = (Math.random() * Math.PI / 2) + Math.PI * 1.25; // Upwards arcs
    const speed = (Math.random() * 2 + 3) * speedMultiplier;
    
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
  }

  update(canvasWidth: number, canvasHeight: number) {
    if (this.state === BirdState.FLYING) {
      this.x += this.vx;
      this.y += this.vy;

      // Random direction change
      if (Math.random() < 0.05) {
        this.vx += (Math.random() - 0.5) * 3;
        this.vy += (Math.random() - 0.5) * 2;
        
        // Limit speed
        const maxSpeed = 8;
        const currentSpeed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        if (currentSpeed > maxSpeed) {
          this.vx = (this.vx / currentSpeed) * maxSpeed;
          this.vy = (this.vy / currentSpeed) * maxSpeed;
        }
        
        // Ensure they generally move upwards
        if (this.vy > 0 && Math.random() < 0.3) this.vy *= -1;
      }

      // Bounce off walls
      if (this.x < 0) {
        this.x = 0;
        this.vx *= -1;
      } else if (this.x > canvasWidth - this.size) {
        this.x = canvasWidth - this.size;
        this.vx *= -1;
      }

      // Bounce off bottom (if they drop too low)
      if (this.y > canvasHeight - 150) {
        this.y = canvasHeight - 150;
        this.vy *= -1;
      }

      // Escape off top
      if (this.y < -this.size) {
        this.state = BirdState.OFFSCREEN;
      }

      // Animation
      this.animationTimer++;
      if (this.animationTimer > 10) {
        this.animationFrame = (this.animationFrame + 1) % 2;
        this.animationTimer = 0;
      }
    } else if (this.state === BirdState.HIT) {
      // Small pause before falling
      this.animationTimer++;
      if (this.animationTimer > 20) {
        this.state = BirdState.FALLING;
      }
    } else if (this.state === BirdState.FALLING) {
      this.y += this.fallSpeed;
      if (this.y > canvasHeight) {
        this.state = BirdState.OFFSCREEN;
      }
    } else if (this.state === BirdState.ESCAPING) {
      this.y -= this.escapeSpeed;
      if (this.y < -this.size) {
        this.state = BirdState.OFFSCREEN;
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    if (this.state === BirdState.OFFSCREEN) return;

    ctx.save();
    ctx.translate(this.x + this.size / 2, this.y + this.size / 2);
    if (this.vx < 0) ctx.scale(-1, 1);
    ctx.imageSmoothingEnabled = false;

    const stunned = this.state === BirdState.HIT || this.state === BirdState.FALLING;

    // Tail feathers
    ctx.fillStyle = stunned ? '#b71c1c' : '#3e2723';
    ctx.fillRect(-28, -8, 12, 6);
    ctx.fillRect(-30, 2, 14, 6);

    // Body
    ctx.fillStyle = stunned ? '#c62828' : '#6d4c41';
    ctx.fillRect(-18, -10, 30, 20);
    ctx.fillStyle = stunned ? '#ff7043' : '#a1887f';
    ctx.fillRect(-12, -4, 22, 10);
    ctx.fillStyle = stunned ? '#ffcdd2' : '#efebe9';
    ctx.fillRect(-4, -1, 10, 5);

    // Head
    ctx.fillStyle = stunned ? '#e53935' : '#2e7d32';
    ctx.fillRect(8, -15, 16, 16);
    ctx.fillStyle = stunned ? '#ff8a80' : '#66bb6a';
    ctx.fillRect(10, -13, 10, 5);
    
    // Beak
    ctx.fillStyle = '#ffb300';
    ctx.fillRect(24, -10, 9, 5);
    ctx.fillStyle = '#f57f17';
    ctx.fillRect(25, -5, 6, 3);

    // Eye
    ctx.fillStyle = '#fff';
    ctx.fillRect(16, -12, 4, 4);
    ctx.fillStyle = '#111';
    ctx.fillRect(stunned ? 17 : 18, -11, 2, 2);

    // Wings
    if (this.state === BirdState.FLYING) {
      ctx.fillStyle = '#8d6e63';
      if (this.animationFrame === 0) {
        ctx.fillRect(-12, -28, 22, 14); // Up
        ctx.fillStyle = '#bcaaa4';
        ctx.fillRect(-8, -24, 14, 5);
      } else {
        ctx.fillRect(-12, 10, 22, 14); // Down
        ctx.fillStyle = '#bcaaa4';
        ctx.fillRect(-8, 14, 14, 5);
      }
    } else if (this.state === BirdState.HIT || this.state === BirdState.FALLING) {
       ctx.fillStyle = '#8d6e63';
       ctx.fillRect(-13, -3, 24, 8); // Closed
    }

    ctx.restore();
  }

  isHit(mx: number, my: number): boolean {
    if (this.state !== BirdState.FLYING) return false;
    const hit = mx > this.x && mx < this.x + this.size &&
                my > this.y && my < this.y + this.size;
    if (hit) {
      this.state = BirdState.HIT;
      this.animationTimer = 0;
    }
    return hit;
  }

  getState() { return this.state; }
}
