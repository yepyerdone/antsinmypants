export type Action = "left" | "right" | "jump" | "pause" | "restart" | "mute";

const keyMap: Record<string, Action> = {
  KeyA: "left",
  ArrowLeft: "left",
  KeyD: "right",
  ArrowRight: "right",
  Space: "jump",
  ArrowUp: "jump",
  KeyP: "pause",
  Escape: "pause",
  KeyR: "restart",
  KeyM: "mute",
};

export class InputManager {
  private readonly pressed = new Set<Action>();
  private readonly queued = new Set<Action>();

  public constructor() {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
  }

  public consume(action: Action): boolean {
    const active = this.queued.has(action);
    this.queued.delete(action);
    return active;
  }

  public isPressed(action: Action): boolean {
    return this.pressed.has(action);
  }

  public dispose(): void {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    const action = keyMap[event.code];
    if (!action) {
      return;
    }
    event.preventDefault();
    if (!this.pressed.has(action)) {
      this.queued.add(action);
    }
    this.pressed.add(action);
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    const action = keyMap[event.code];
    if (!action) {
      return;
    }
    this.pressed.delete(action);
  };
}
