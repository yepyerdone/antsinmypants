import { AudioManager } from './systems/AudioManager.ts';
import { ScoreManager } from './systems/ScoreManager.ts';
import { InputManager } from './systems/InputManager.ts';
import { Bird, BirdState } from './entities/Bird.ts';
import { Dog, DogState } from './entities/Dog.ts';
import { Crosshair } from './entities/Crosshair.ts';

enum GameState {
  START,
  DOG_WALK,
  ROUND_START,
  SPAWNING,
  ACTION,
  ROUND_END,
  CELEBRATION,
  GAME_OVER,
  PAUSED
}

export class Game {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private state: GameState = GameState.START;
  private prevState: GameState = GameState.START;
  
  private audio: AudioManager;
  private score: ScoreManager;
  private input: InputManager;
  
  private birds: Bird[] = [];
  private dog: Dog;
  private crosshair: Crosshair;
  
  private timer: number = 0;
  private birdsInRound: number = 10;
  private birdsSpawned: number = 0;
  private actionTimer: number = 0;
  private flash: number = 0;

  constructor(canvasId: string) {
    this.canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    this.ctx = this.canvas.getContext('2d')!;
    
    this.resize();
    window.addEventListener('resize', this.resize.bind(this));

    this.audio = new AudioManager();
    this.score = new ScoreManager();
    this.input = new InputManager(this.canvas);
    this.dog = new Dog(this.canvas.width, this.canvas.height);
    this.crosshair = new Crosshair();

    this.loop();
  }

  private resize() {
    this.canvas.width = 800;
    this.canvas.height = 600;
  }

  private loop() {
    this.update();
    this.draw();
    requestAnimationFrame(this.loop.bind(this));
  }

  private update() {
    if (this.input.isKeyPressed('p') && this.state !== GameState.PAUSED) {
      this.prevState = this.state;
      this.state = GameState.PAUSED;
    } else if (this.input.isKeyPressed('p') && this.state === GameState.PAUSED) {
      this.state = this.prevState;
    }

    if (this.input.isKeyPressed('m')) {
        this.audio.toggleMute();
    }

    if (this.state === GameState.PAUSED) return;

    this.dog.update();
    this.crosshair.update(this.input.mouseX, this.input.mouseY);

    switch (this.state) {
      case GameState.START:
        this.ctx.textAlign = 'center';

        if (this.input.wasMouseClicked()) {
          this.score.resetGame();
          this.startRound();
        }
        break;

      case GameState.DOG_WALK:
        if (this.dog.getState() === DogState.HIDDEN) {
          this.state = GameState.ROUND_START;
          this.timer = 0;
        }
        break;

      case GameState.ROUND_START:
        this.timer++;
        if (this.timer > 100) {
          this.state = GameState.SPAWNING;
          this.birdsSpawned = 0;
        }
        break;

      case GameState.SPAWNING:
        const round = this.score.getRound();
        const maxBirds = round <= 3 ? 1 : (round <= 6 ? 2 : 3);
        if (this.birds.length < maxBirds && this.birdsSpawned < this.birdsInRound) {
           this.spawnBird();
           this.state = GameState.ACTION;
           this.actionTimer = 0;
           this.score.resetShots();
        } else if (this.birdsSpawned >= this.birdsInRound && this.birds.length === 0) {
           this.state = GameState.ROUND_END;
        }
        break;

      case GameState.ACTION:
        this.actionTimer++;
        
        // Handle input
        if (this.input.wasMouseClicked() && this.score.getShots() > 0) {
          this.flash = 5;
          this.score.useShot();
          this.audio.playGunshot();
          
          let hit = false;
          for (const bird of this.birds) {
            if (bird.isHit(this.input.mouseX, this.input.mouseY)) {
              this.score.recordHit();
              this.dog.retrieveBird();
              this.audio.playHit();
              hit = true;
              break;
            }
          }
          if (!hit) this.audio.playMiss();
        }

        // Update birds
        this.birds = this.birds.filter(b => b.getState() !== BirdState.OFFSCREEN);
        for (const bird of this.birds) {
          bird.update(this.canvas.width, this.canvas.height);
          if (bird.getState() === BirdState.ESCAPING && this.actionTimer % 60 === 0) {
             this.audio.playBirdEscape();
          }
        }

        if (this.birds.length === 0) {
          this.state = GameState.SPAWNING;
        }
        break;

      case GameState.ROUND_END:
        const required = this.score.getMinHitsRequired();
        if (this.score.getBirdsHit() >= required) {
          this.state = GameState.CELEBRATION;
          this.dog.setState(DogState.CELEBRATING);
          this.audio.playDogCelebration();
        } else {
          this.state = GameState.GAME_OVER;
          this.dog.setState(DogState.LAUGHING);
          this.audio.playGameOver();
        }
        break;

      case GameState.CELEBRATION:
        if (this.dog.getState() === DogState.HIDDEN) {
          this.score.nextRound();
          this.startRound();
        }
        break;

      case GameState.GAME_OVER:
        if (this.input.isKeyPressed('r')) {
          this.state = GameState.START;
        }
        break;
    }

    if (this.flash > 0) this.flash--;
    this.input.clear();
  }

  private startRound() {
    this.state = GameState.DOG_WALK;
    this.dog.setState(DogState.WALKING);
    this.birdsSpawned = 0;
    this.birds = [];
    this.audio.playStartRound();
  }

  private spawnBird() {
    const speedMult = 1 + (this.score.getRound() - 1) * 0.1;
    this.birds.push(new Bird(this.canvas.width, this.canvas.height, speedMult));
    this.birdsSpawned++;
    this.audio.playBirdLaunch();
  }

  private draw() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Background (Sky Gradient)
    const skyGradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height - 120);
    skyGradient.addColorStop(0, '#5aa9e6');
    skyGradient.addColorStop(0.5, '#8dd7ff');
    skyGradient.addColorStop(1, '#f1d492');
    this.ctx.fillStyle = this.state === GameState.GAME_OVER ? '#2a0808' : skyGradient;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Scanlines for arcade CRT flavor
    this.ctx.fillStyle = 'rgba(255,255,255,0.05)';
    for (let y = 0; y < this.canvas.height; y += 4) {
      this.ctx.fillRect(0, y, this.canvas.width, 1);
    }

    // Sun
    this.ctx.fillStyle = '#ffcf57';
    this.ctx.fillRect(632, 52, 58, 58);
    this.ctx.fillStyle = '#ffe082';
    this.ctx.fillRect(646, 66, 30, 30);

    // Clouds
    this.ctx.fillStyle = '#fff8e1';
    const clouds = [
      { x: 150, y: 100, w: 40, h: 12 },
      { x: 600, y: 180, w: 30, h: 10 },
      { x: 350, y: 80, w: 50, h: 15 },
      { x: 42, y: 190, w: 34, h: 10 },
      { x: 494, y: 118, w: 44, h: 12 }
    ];
    clouds.forEach(c => {
      this.ctx.fillRect(c.x, c.y, c.w, c.h);
      this.ctx.fillRect(c.x + 12, c.y + 12, c.w, c.h);
      this.ctx.fillRect(c.x + 24, c.y + 8, c.w, c.h);
      this.ctx.fillStyle = '#d7ecf3';
      this.ctx.fillRect(c.x + 8, c.y + c.h + 14, c.w + 20, 3);
      this.ctx.fillStyle = '#fff8e1';
    });

    // Mountains
    this.ctx.globalAlpha = 0.5;
    this.ctx.fillStyle = '#4e6f68';
    for (let i = 0; i < 3; i++) {
        this.ctx.beginPath();
        this.ctx.moveTo(i * 300 - 100, this.canvas.height - 120);
        this.ctx.lineTo(i * 300 + 150 - 100, this.canvas.height - 270);
        this.ctx.lineTo(i * 300 + 300 - 100, this.canvas.height - 120);
        this.ctx.fill();
        this.ctx.fillStyle = '#dce8df';
        this.ctx.beginPath();
        this.ctx.moveTo(i * 300 + 116 - 100, this.canvas.height - 236);
        this.ctx.lineTo(i * 300 + 150 - 100, this.canvas.height - 270);
        this.ctx.lineTo(i * 300 + 184 - 100, this.canvas.height - 236);
        this.ctx.fill();
        this.ctx.fillStyle = '#4e6f68';
    }
    this.ctx.globalAlpha = 1.0;

    // Distant tree line
    this.ctx.fillStyle = '#1f6f43';
    for (let x = 0; x < this.canvas.width; x += 28) {
      const h = 22 + ((x * 7) % 30);
      this.ctx.fillRect(x, this.canvas.height - 142 - h, 18, h);
      this.ctx.fillRect(x - 4, this.canvas.height - 132 - h, 26, 14);
    }

    // Grass & Bushes
    this.ctx.fillStyle = '#2f8f38';
    this.ctx.fillRect(0, this.canvas.height - 150, this.canvas.width, 150);
    this.ctx.fillStyle = '#17612d';
    this.ctx.fillRect(0, this.canvas.height - 150, this.canvas.width, 10); // Top edge
    
    // Draw bushes
    for (let i = 0; i < 2; i++) {
        this.ctx.beginPath();
        if (i === 0) this.ctx.arc(150, this.canvas.height - 145, 82, Math.PI, 0);
        else this.ctx.arc(650, this.canvas.height - 145, 104, Math.PI, 0);
        this.ctx.fill();
    }

    // Entities
    this.dog.draw(this.ctx);
    for (const bird of this.birds) {
      bird.draw(this.ctx);
    }

    // Foreground tall grass
    this.ctx.fillStyle = '#104f24';
    for (let x = 0; x < this.canvas.width; x += 10) {
      const bladeHeight = 28 + ((x * 13) % 38);
      this.ctx.fillRect(x, this.canvas.height - 100 - bladeHeight, 5, bladeHeight);
      this.ctx.fillRect(x + 4, this.canvas.height - 88 - bladeHeight * 0.7, 3, bladeHeight * 0.7);
    }

    // HUD
    this.drawHUD();

    // Overlays
    this.drawOverlays();

    // Crosshair
    this.crosshair.draw(this.ctx);

    // Recoil flash
    if (this.flash > 0) {
      this.ctx.fillStyle = `rgba(255, 255, 255, ${this.flash / 10})`;
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  private drawHUD() {
    const hudHeight = 104;
    this.ctx.fillStyle = '#111015';
    this.ctx.fillRect(0, this.canvas.height - hudHeight, this.canvas.width, hudHeight);
    this.ctx.fillStyle = '#5c2d91';
    this.ctx.fillRect(0, this.canvas.height - hudHeight, this.canvas.width, 8);
    this.ctx.fillStyle = '#ffcc29';
    this.ctx.fillRect(0, this.canvas.height - hudHeight + 8, this.canvas.width, 4);
    this.ctx.strokeStyle = '#29f1ff';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(18, this.canvas.height - hudHeight + 18, this.canvas.width - 36, hudHeight - 32);

    // Shots Indicator (Bullets)
    this.ctx.textAlign = 'left';
    this.ctx.fillStyle = '#29f1ff';
    this.ctx.font = '12px "Courier New", Courier, monospace';
    this.ctx.fillText('SHOTS', 40, this.canvas.height - 65);
    for (let i = 0; i < 3; i++) {
      this.ctx.strokeStyle = '#fff';
      this.ctx.lineWidth = 1;
      this.ctx.strokeRect(40 + i * 20, this.canvas.height - 50, 14, 30);
      if (i < this.score.getShots()) {
        this.ctx.fillStyle = '#ffab00';
        this.ctx.fillRect(40 + i * 20 + 2, this.canvas.height - 48, 10, 26);
      }
    }

    // Accuracy (next to shots)
    this.ctx.fillStyle = '#29f1ff';
    this.ctx.font = '12px "Courier New", Courier, monospace';
    this.ctx.fillText('ACCURACY', 130, this.canvas.height - 65);
    this.ctx.fillStyle = '#ffcc29';
    this.ctx.font = '20px "Courier New", Courier, monospace';
    this.ctx.fillText(`${this.score.getShotAccuracy()}%`, 130, this.canvas.height - 35);

    // Hit Track
    this.ctx.fillStyle = '#29f1ff';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('GOOD BOY TRACKER', this.canvas.width / 2, this.canvas.height - 65);
    const totalBirds = 10;
    const boxSize = 20;
    const startX = this.canvas.width / 2 - (totalBirds * (boxSize + 4)) / 2;
    for (let i = 0; i < totalBirds; i++) {
      this.ctx.strokeStyle = '#fff';
      this.ctx.strokeRect(startX + i * (boxSize + 4), this.canvas.height - 45, boxSize, boxSize);
      if (i < this.score.getBirdsHit()) {
        this.ctx.fillStyle = '#ff3d71';
        this.ctx.fillRect(startX + i * (boxSize + 4) + 2, this.canvas.height - 43, boxSize - 4, boxSize - 4);
      } else if (i < (this.score.getBirdsHit() + this.score.getBirdsMissed())) {
        this.ctx.fillStyle = '#333';
        this.ctx.fillRect(startX + i * (boxSize + 4) + 2, this.canvas.height - 43, boxSize - 4, boxSize - 4);
      }
    }

    // Score
    this.ctx.textAlign = 'right';
    this.ctx.fillStyle = '#29f1ff';
    this.ctx.fillText('SCORE', this.canvas.width - 40, this.canvas.height - 65);
    this.ctx.fillStyle = '#ffcc29';
    this.ctx.font = '24px "Courier New", Courier, monospace';
    this.ctx.fillText(this.score.getScore().toString().padStart(7, '0'), this.canvas.width - 40, this.canvas.height - 35);
    
    // Round display
    this.ctx.font = '14px "Courier New", Courier, monospace';
    this.ctx.fillText(`R: ${this.score.getRound()}`, this.canvas.width - 40, this.canvas.height - 15);
    
    this.ctx.textAlign = 'left';
  }

  private drawOverlays() {
    if (this.state === GameState.ACTION || this.state === GameState.DOG_WALK || this.state === GameState.SPAWNING || this.state === GameState.CELEBRATION) return;

    this.ctx.save();
    
    // Center of screen relative to canvas
    const cx = this.canvas.width / 2;
    const cy = this.canvas.height / 2 - 50;

    if (this.state === GameState.START || this.state === GameState.ROUND_START || this.state === GameState.GAME_OVER || this.state === GameState.PAUSED) {
        this.ctx.fillStyle = 'rgba(17, 16, 21, 0.92)';
        this.ctx.strokeStyle = '#29f1ff';
        this.ctx.lineWidth = 4;
        const ow = 450;
        const oh = 250;
        this.ctx.fillRect(cx - ow / 2, cy - oh / 2, ow, oh);
        this.ctx.strokeRect(cx - ow / 2, cy - oh / 2, ow, oh);
    }

    this.ctx.textAlign = 'center';
    this.ctx.fillStyle = '#fff6d5';
    
    if (this.state === GameState.START) {
      this.ctx.font = '48px "Courier New", Courier, monospace';
      this.ctx.fillStyle = '#ffcc29';
      this.ctx.fillText('GOOD BOY', cx, cy - 42);
      this.ctx.fillStyle = '#ff3d71';
      this.ctx.font = '18px Courier';
      this.ctx.fillText('ARCADE RETRIEVER', cx, cy - 12);
      
      this.ctx.fillStyle = '#29f1ff';
      this.ctx.font = '22px Courier';
      this.ctx.fillText('CLICK TO START', cx, cy + 30);
      this.ctx.fillStyle = '#fff6d5';
      this.ctx.font = '14px Courier';
      this.ctx.fillText(`RECORD: ${this.score.getHighScore()}`, cx, cy + 70);
    } else if (this.state === GameState.ROUND_START) {
      this.ctx.font = '48px "Courier New", Courier, monospace';
      this.ctx.fillText(`ROUND ${this.score.getRound().toString().padStart(2, '0')}`, cx, cy - 10);
      this.ctx.font = '18px Courier';
      this.ctx.fillStyle = '#29f1ff';
      this.ctx.fillText(`HIT ${this.score.getMinHitsRequired()} BIRDS TO ADVANCE`, cx, cy + 40);
    } else if (this.state === GameState.GAME_OVER) {
      this.ctx.font = '48px "Courier New", Courier, monospace';
      this.ctx.fillStyle = '#d32f2f';
      this.ctx.fillText('GAME OVER', cx, cy - 20);
      this.ctx.fillStyle = '#fff';
      this.ctx.font = '24px Courier';
      this.ctx.fillText(`SCORE: ${this.score.getScore()}`, cx, cy + 30);
      this.ctx.fillStyle = '#29f1ff';
      this.ctx.font = '18px Courier';
      this.ctx.fillText('PRESS [R] TO RESTART', cx, cy + 80);
    } else if (this.state === GameState.PAUSED) {
       this.ctx.font = '48px "Courier New", Courier, monospace';
       this.ctx.fillText('PAUSED', cx, cy);
       this.ctx.font = '18px Courier';
       this.ctx.fillText('PRESS [P] TO RESUME', cx, cy + 50);
    }

    this.ctx.restore();
  }
}
