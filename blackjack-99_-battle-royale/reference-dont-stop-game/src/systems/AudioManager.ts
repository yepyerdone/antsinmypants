type ToneKind = "square" | "sine" | "triangle" | "sawtooth";

export class AudioManager {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private ambientOscillator: OscillatorNode | null = null;
  private muted = false;

  public get isMuted(): boolean {
    return this.muted;
  }

  public async unlock(): Promise<void> {
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = 0.16;
      this.master.connect(this.context.destination);
      this.startAmbient();
    }
    if (this.context.state === "suspended") {
      await this.context.resume();
    }
  }

  public toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.master) {
      this.master.gain.value = this.muted ? 0 : 0.16;
    }
    return this.muted;
  }

  public footstep(): void {
    this.blip(115, 0.04, "square", 0.05);
  }

  public jump(): void {
    this.sweep(240, 460, 0.14, "triangle", 0.1);
  }

  public land(): void {
    this.blip(86, 0.08, "sine", 0.12);
  }

  public collect(): void {
    this.sweep(540, 820, 0.12, "sine", 0.12);
  }

  public shift(): void {
    this.sweep(180, 300, 0.1, "triangle", 0.09);
  }

  public fall(): void {
    this.sweep(180, 48, 0.42, "sawtooth", 0.12);
  }

  public gameOver(): void {
    this.sweep(220, 70, 0.55, "triangle", 0.14);
  }

  private startAmbient(): void {
    if (!this.context || !this.master) {
      return;
    }
    const gain = this.context.createGain();
    gain.gain.value = 0.025;
    gain.connect(this.master);
    this.ambientOscillator = this.context.createOscillator();
    this.ambientOscillator.type = "sine";
    this.ambientOscillator.frequency.value = 54;
    this.ambientOscillator.connect(gain);
    this.ambientOscillator.start();
  }

  private blip(frequency: number, duration: number, type: ToneKind, volume: number): void {
    if (!this.context || !this.master || this.muted) {
      return;
    }
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gain.gain.value = volume;
    gain.gain.exponentialRampToValueAtTime(0.0001, this.context.currentTime + duration);
    oscillator.connect(gain);
    gain.connect(this.master);
    oscillator.start();
    oscillator.stop(this.context.currentTime + duration);
  }

  private sweep(start: number, end: number, duration: number, type: ToneKind, volume: number): void {
    if (!this.context || !this.master || this.muted) {
      return;
    }
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(start, this.context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(end, this.context.currentTime + duration);
    gain.gain.value = volume;
    gain.gain.exponentialRampToValueAtTime(0.0001, this.context.currentTime + duration);
    oscillator.connect(gain);
    gain.connect(this.master);
    oscillator.start();
    oscillator.stop(this.context.currentTime + duration);
  }
}
