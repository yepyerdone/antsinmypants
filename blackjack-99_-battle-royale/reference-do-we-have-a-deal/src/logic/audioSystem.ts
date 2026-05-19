/**
 * Web Audio API synthesizer for game sounds
 */
class AudioManager {
  private ctx: AudioContext | null = null;
  private masterVolume: GainNode | null = null;
  private muted: boolean = false;

  constructor() {
    // Context is created on first interaction to comply with browser policies
  }

  private init() {
    if (this.ctx) return;
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) {
        console.warn("AudioContext not supported");
        return;
      }
      this.ctx = new AudioContextClass();
      this.masterVolume = this.ctx.createGain();
      this.masterVolume.connect(this.ctx.destination);
      this.masterVolume.gain.value = this.muted ? 0 : 0.5;
    } catch (e) {
      console.error("Failed to initialize AudioContext", e);
    }
  }

  setMute(mute: boolean) {
    try {
      this.muted = mute;
      if (this.masterVolume) {
        this.masterVolume.gain.value = mute ? 0 : 0.5;
      }
    } catch (e) {
      console.error("Error setting mute", e);
    }
  }

  isMuted() { return this.muted; }

  private playTone(freq: number, type: OscillatorType, duration: number, volume: number = 0.5) {
    try {
      this.init();
      if (!this.ctx || !this.masterVolume || this.ctx.state === 'suspended') {
        if (this.ctx?.state === 'suspended') this.ctx.resume();
        if (!this.ctx || !this.masterVolume) return;
      }

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      
      gain.gain.setValueAtTime(volume, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.masterVolume);

      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {
      console.error("Error playing tone", e);
    }
  }

  private playNoise(duration: number, volume: number, type: 'cheer' | 'aww') {
    try {
      this.init();
      if (!this.ctx || !this.masterVolume) return;

      const bufferSize = this.ctx.sampleRate * duration;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);

      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const source = this.ctx.createBufferSource();
      source.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      if (type === 'cheer') {
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(1000, this.ctx.currentTime);
        filter.Q.setValueAtTime(1, this.ctx.currentTime);
        filter.frequency.exponentialRampToValueAtTime(3000, this.ctx.currentTime + duration);
      } else {
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(800, this.ctx.currentTime);
        filter.frequency.exponentialRampToValueAtTime(200, this.ctx.currentTime + duration);
      }

      gain.gain.setValueAtTime(0, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(volume, this.ctx.currentTime + 0.1);
      gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + duration);

      source.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterVolume);

      source.start();
    } catch (e) {
      console.error("Error playing noise", e);
    }
  }

  playCheer() {
    this.playNoise(1.5, 0.3, 'cheer');
    // Add some higher frequency "whistles"
    setTimeout(() => this.playTone(1200, 'sine', 0.5, 0.1), 100);
    setTimeout(() => this.playTone(1500, 'sine', 0.5, 0.05), 300);
  }

  playDisappointment() {
    this.playNoise(2.0, 0.4, 'aww');
  }

  playClick() {
    this.playTone(800, 'sine', 0.1, 0.2);
  }

  playCaseOpen() {
    this.playTone(400, 'square', 0.2, 0.3);
    setTimeout(() => this.playTone(600, 'square', 0.3, 0.2), 50);
  }

  playOfferReveal() {
    this.playTone(200, 'sawtooth', 0.5, 0.4);
    this.playTone(250, 'sawtooth', 0.5, 0.4);
  }

  playWin() {
    const notes = [440, 554.37, 659.25, 880];
    notes.forEach((note, i) => {
      setTimeout(() => this.playTone(note, 'sine', 0.8, 0.3), i * 150);
    });
  }

  playLose() {
    this.playTone(200, 'sine', 1.0, 0.3);
    setTimeout(() => this.playTone(150, 'sine', 1.0, 0.3), 500);
  }

  playSuspense() {
    // Low drone
    this.playTone(100, 'triangle', 2.0, 0.1);
  }
}

export const audioManager = new AudioManager();
