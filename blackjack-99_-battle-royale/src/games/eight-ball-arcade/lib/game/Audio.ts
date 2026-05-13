export class AudioManager {
  private ctx: AudioContext | null = null;

  private init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }

  private playTone(freq: number, type: OscillatorType, duration: number, volume: number) {
    this.init();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    
    gain.gain.setValueAtTime(volume, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  playCueHit(power: number) {
    void power;
    // Cue impact is visual-only; the old low-frequency tone was too heavy.
  }

  playBallCollision() {
    this.playTone(200, 'sine', 0.05, 0.1);
  }

  playCushionHit() {
    this.playTone(100, 'square', 0.1, 0.05);
  }

  playPocketed() {
    this.playTone(400, 'sine', 0.3, 0.2);
    setTimeout(() => this.playTone(300, 'sine', 0.2, 0.1), 100);
  }

  playVictory() {
    [523, 659, 783, 1046].forEach((f, i) => {
      setTimeout(() => this.playTone(f, 'triangle', 0.5, 0.2), i * 150);
    });
  }

  playFoul() {
    this.playTone(100, 'sawtooth', 0.4, 0.2);
  }
}

export const audioManager = new AudioManager();
