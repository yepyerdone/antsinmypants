import { levelDefinitions, type GameMode } from "../world/TunnelGenerator";

export interface HudState {
  score: number;
  best: number;
  distance: number;
  speedMultiplier: number;
  paused: boolean;
  mode: GameMode;
  collectiblesCollected?: number;
  collectiblesTotal?: number;
}

export class UIManager {
  private readonly root: HTMLDivElement;
  private readonly hud: HTMLDivElement;
  private readonly score: HTMLSpanElement;
  private readonly best: HTMLSpanElement;
  private readonly distance: HTMLSpanElement;
  private readonly speed: HTMLSpanElement;
  private readonly scorePanel: HTMLDivElement;
  private readonly bestPanel: HTMLDivElement;
  private readonly collectiblePanel: HTMLDivElement;
  private readonly collectibleCount: HTMLSpanElement;
  private readonly pauseFlag: HTMLSpanElement;
  private readonly overlay: HTMLDivElement;
  private readonly title: HTMLHeadingElement;
  private readonly body: HTMLDivElement;
  private readonly levelToast: HTMLDivElement;

  public constructor(container: HTMLElement) {
    this.root = document.createElement("div");
    this.root.className = "ui";
    this.root.innerHTML = `
      <div class="hud">
        <div data-score-panel><span>Score</span><strong data-score>0</strong></div>
        <div data-best-panel><span>Best</span><strong data-best>0</strong></div>
        <div><span>Distance</span><strong data-distance>0m</strong></div>
        <div><span>Speed</span><strong data-speed>x1.0</strong></div>
        <div class="hidden" data-collectible-panel><span>Relics</span><strong data-collectibles>0/3</strong></div>
        <em data-pause></em>
      </div>
      <div class="overlay">
        <section>
          <h1></h1>
          <div class="overlay-body"></div>
        </section>
      </div>
      <div class="level-toast hidden" data-level-toast></div>
    `;
    container.append(this.root);
    this.hud = this.root.querySelector(".hud") as HTMLDivElement;
    this.score = this.root.querySelector("[data-score]") as HTMLSpanElement;
    this.best = this.root.querySelector("[data-best]") as HTMLSpanElement;
    this.distance = this.root.querySelector("[data-distance]") as HTMLSpanElement;
    this.speed = this.root.querySelector("[data-speed]") as HTMLSpanElement;
    this.scorePanel = this.root.querySelector("[data-score-panel]") as HTMLDivElement;
    this.bestPanel = this.root.querySelector("[data-best-panel]") as HTMLDivElement;
    this.collectiblePanel = this.root.querySelector("[data-collectible-panel]") as HTMLDivElement;
    this.collectibleCount = this.root.querySelector("[data-collectibles]") as HTMLSpanElement;
    this.pauseFlag = this.root.querySelector("[data-pause]") as HTMLSpanElement;
    this.overlay = this.root.querySelector(".overlay") as HTMLDivElement;
    this.title = this.root.querySelector("h1") as HTMLHeadingElement;
    this.body = this.root.querySelector(".overlay-body") as HTMLDivElement;
    this.levelToast = this.root.querySelector("[data-level-toast]") as HTMLDivElement;
  }

  public updateHud(state: HudState): void {
    this.score.textContent = Math.floor(state.score).toString();
    this.best.textContent = Math.floor(state.best).toString();
    this.distance.textContent = `${Math.floor(state.distance)}m`;
    this.speed.textContent = `x${state.speedMultiplier.toFixed(1)}`;
    const levelMode = state.mode === "level";
    this.scorePanel.classList.toggle("hidden", levelMode);
    this.bestPanel.classList.toggle("hidden", levelMode);
    this.collectiblePanel.classList.toggle("hidden", !levelMode);
    this.collectibleCount.textContent = `${state.collectiblesCollected ?? 0}/${state.collectiblesTotal ?? 3}`;
    this.pauseFlag.textContent = state.paused ? "Paused" : state.mode === "practice" ? "Practice" : "";
  }

  public showMainMenu(onSelect: (mode: GameMode | "scores" | "settings" | "levels") => void): void {
    this.hud.classList.add("hidden");
    this.overlay.classList.remove("hidden");
    this.title.textContent = "Don't Stop";
    this.body.innerHTML = `
      <div class="menu-buttons">
        <button data-mode="endless">Play Endless</button>
        <button data-mode="levels">Level Map</button>
        <button data-mode="settings">Settings</button>
      </div>
    `;
    this.bindButtons(onSelect);
  }

  public showPause(onSelect: (action: "resume" | "restart-level" | "settings" | "menu") => void): void {
    this.overlay.classList.remove("hidden");
    this.title.textContent = "Paused";
    this.body.innerHTML = `
      <div class="menu-buttons">
        <button data-action="resume">Resume</button>
        <button data-action="restart-level">Restart Level</button>
        <button data-action="settings">Settings</button>
        <button data-action="menu">Main Menu</button>
      </div>
    `;
    this.body.querySelectorAll<HTMLButtonElement>("button").forEach((button) => {
      button.addEventListener("click", () => onSelect(button.dataset.action as "resume" | "restart-level" | "settings" | "menu"));
    });
  }

  public showGameOver(score: number, distance: number, best: number, newBest: boolean, onSelect: (action: "again" | "menu") => void, mode: GameMode = "endless", collectiblesCollected = 0): void {
    this.overlay.classList.remove("hidden");
    this.title.textContent = "Run Complete";
    this.body.innerHTML = `
      <dl class="results">
        ${mode === "level"
          ? `<div><dt>Relics</dt><dd>${collectiblesCollected}/3</dd></div>`
          : `<div><dt>Final Score</dt><dd>${Math.floor(score)}</dd></div>`}
        <div><dt>Distance</dt><dd>${Math.floor(distance)}m</dd></div>
        ${mode === "level" ? "" : `<div><dt>Best</dt><dd>${Math.floor(best)}</dd></div>`}
      </dl>
      ${newBest ? `<p class="new-best">New high score</p>` : ""}
      <div class="menu-buttons">
        <button data-action="again">Play Again</button>
        <button data-action="menu">Main Menu</button>
      </div>
    `;
    this.body.querySelectorAll<HTMLButtonElement>("button").forEach((button) => {
      button.addEventListener("click", () => onSelect(button.dataset.action as "again" | "menu"));
    });
  }

  public showScores(best: number, onBack: () => void): void {
    this.title.textContent = "High Scores";
    this.body.innerHTML = `
      <p class="single-stat">${Math.floor(best)}</p>
      <div class="menu-buttons"><button data-back>Back</button></div>
    `;
    this.body.querySelector<HTMLButtonElement>("[data-back]")?.addEventListener("click", onBack);
  }

  public showSettings(muted: boolean, onToggle: () => void, onBack: () => void): void {
    this.title.textContent = "Settings";
    this.body.innerHTML = `
      <label class="setting-row">
        <span>Audio</span>
        <button data-toggle>${muted ? "Muted" : "On"}</button>
      </label>
      <div class="menu-buttons"><button data-back>Back</button></div>
    `;
    this.body.querySelector<HTMLButtonElement>("[data-toggle]")?.addEventListener("click", onToggle);
    this.body.querySelector<HTMLButtonElement>("[data-back]")?.addEventListener("click", onBack);
  }

  public showLevelMap(unlocked: Set<string>, relicProgress: Record<string, number>, onSelect: (levelId: string) => void, onBack: () => void): void {
    this.title.textContent = "Level Map";
    this.body.innerHTML = `
      <div class="space-map">
        ${levelDefinitions.flatMap((level) => level.next.map((nextId) => {
          const next = levelDefinitions.find((candidate) => candidate.id === nextId);
          return next ? `<i style="--x1:${level.mapX};--y1:${level.mapY};--x2:${next.mapX};--y2:${next.mapY}"></i>` : "";
        })).join("")}
        ${levelDefinitions.map((level) => `
          <button class="${unlocked.has(level.id) ? "unlocked" : "locked"}" data-level="${level.id}" ${unlocked.has(level.id) ? "" : "disabled"} style="--x:${level.mapX};--y:${level.mapY}">
            <strong>${level.id}</strong>
            <span>${unlocked.has(level.id) ? level.name : "Locked"}</span>
            <small>${unlocked.has(level.id) ? `${relicProgress[level.id] ?? 0}/3 relics` : ""}</small>
          </button>
        `).join("")}
      </div>
      <div class="menu-buttons"><button data-back>Back</button></div>
    `;
    this.body.querySelectorAll<HTMLButtonElement>("[data-level]").forEach((button) => {
      button.addEventListener("click", () => onSelect(button.dataset.level ?? "1"));
    });
    this.body.querySelector<HTMLButtonElement>("[data-back]")?.addEventListener("click", onBack);
  }

  public showLevelToast(levelNumber: string, levelName: string): void {
    this.levelToast.textContent = `Level ${levelNumber}: ${levelName}`;
    this.levelToast.classList.remove("hidden");
    window.setTimeout(() => this.levelToast.classList.add("hidden"), 2200);
  }

  public showBranchChoice(levelName: string, options: Array<{ id: string; name: string }>, onSelect: (levelId: string) => void): void {
    this.overlay.classList.remove("hidden");
    this.title.textContent = `${levelName} Complete`;
    this.body.innerHTML = `
      <div class="menu-buttons">
        ${options.map((option) => `<button data-branch="${option.id}">Enter Tunnel ${option.id}<span>${option.name}</span></button>`).join("")}
      </div>
    `;
    this.body.querySelectorAll<HTMLButtonElement>("[data-branch]").forEach((button) => {
      button.addEventListener("click", () => onSelect(button.dataset.branch ?? options[0].id));
    });
  }

  public beginRun(): void {
    this.hud.classList.remove("hidden");
    this.overlay.classList.add("hidden");
  }

  private bindButtons(onSelect: (mode: GameMode | "scores" | "settings" | "levels") => void): void {
    this.body.querySelectorAll<HTMLButtonElement>("button").forEach((button) => {
      button.addEventListener("click", () => onSelect(button.dataset.mode as GameMode | "scores" | "settings" | "levels"));
    });
  }
}
