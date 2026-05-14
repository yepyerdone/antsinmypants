export class AudioManager {
  private ctx: AudioContext | null = null;
  private muted: boolean = false;

  constructor() {
    // Initialize lazily to avoid browser autoplay restrictions
  }

  private initCtx() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }

  toggleMute() {
    this.muted = !this.muted;
  }

  isMuted() {
    return this.muted;
  }

  private playTone(freq: number, duration: number, type: OscillatorType = 'square', volume: number = 0.1) {
    if (this.muted) return;
    this.initCtx();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(freq / 2, this.ctx.currentTime + duration);

    gain.gain.setValueAtTime(volume, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  playStartRound() {
    this.playTone(440, 0.5, 'square', 0.1);
    setTimeout(() => this.playTone(554, 0.5, 'square', 0.1), 100);
    setTimeout(() => this.playTone(659, 0.5, 'square', 0.1), 200);
  }

  playBirdLaunch() {
    this.playTone(200, 0.2, 'sine', 0.05);
  }

  playGunshot() {
    if (this.muted) return;
    this.initCtx();
    if (!this.ctx) return;

    const noiseBuffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.1, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseBuffer.length; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1000, this.ctx.currentTime);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    noise.start();
  }

  playHit() {
    this.playTone(880, 0.2, 'triangle', 0.1);
  }

  playMiss() {
    this.playTone(110, 0.3, 'square', 0.1);
  }

  playBirdEscape() {
    this.playTone(330, 0.4, 'sine', 0.05);
  }

  playDogCelebration() {
    this.playTone(523, 0.1, 'square', 0.1);
    setTimeout(() => this.playTone(659, 0.1, 'square', 0.1), 50);
    setTimeout(() => this.playTone(783, 0.2, 'square', 0.1), 100);
  }

  playGameOver() {
    this.playTone(220, 0.5, 'sawtooth', 0.1);
    setTimeout(() => this.playTone(196, 0.5, 'sawtooth', 0.1), 300);
    setTimeout(() => this.playTone(174, 1.0, 'sawtooth', 0.1), 600);
  }
}
