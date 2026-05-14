export class InputManager {
  public mouseX: number = 0;
  public mouseY: number = 0;
  private canvas: HTMLCanvasElement;
  private keys: Set<string> = new Set();
  private mouseClicked: boolean = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    window.addEventListener('mousemove', this.onMouseMove.bind(this));
    window.addEventListener('mousedown', this.onMouseDown.bind(this));
    window.addEventListener('keydown', this.onKeyDown.bind(this));
    window.addEventListener('keyup', this.onKeyUp.bind(this));
  }

  private onMouseMove(e: MouseEvent) {
    const rect = this.canvas.getBoundingClientRect();
    this.mouseX = e.clientX - rect.left;
    this.mouseY = e.clientY - rect.top;
  }

  private onMouseDown(_e: MouseEvent) {
    this.mouseClicked = true;
  }

  private onKeyDown(e: KeyboardEvent) {
    this.keys.add(e.key.toLowerCase());
  }

  private onKeyUp(e: KeyboardEvent) {
    this.keys.delete(e.key.toLowerCase());
  }

  isKeyPressed(key: string): boolean {
    return this.keys.has(key.toLowerCase());
  }

  wasMouseClicked(): boolean {
    if (this.mouseClicked) {
      this.mouseClicked = false;
      return true;
    }
    return false;
  }

  clear() {
    this.mouseClicked = false;
  }
}
