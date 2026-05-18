import * as THREE from "three";
import { CameraController } from "./systems/CameraController";
import { InputManager } from "./systems/InputManager";
import { PhysicsEngine } from "./systems/PhysicsEngine";
import { AudioManager } from "./systems/AudioManager";
import { UIManager } from "./systems/UIManager";
import { Player } from "./entities/Player";
import { Collectible } from "./entities/Collectible";
import { TunnelGenerator, levelDefinitions, type GameMode, type LevelDefinition, type TileInfo } from "./world/TunnelGenerator";

type GameState = "menu" | "running" | "paused" | "over";

export class Game {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1600);
  private readonly renderer = new THREE.WebGLRenderer({ antialias: true });
  private readonly clock = new THREE.Clock();
  private readonly input = new InputManager();
  private readonly physics = new PhysicsEngine();
  private readonly audio = new AudioManager();
  private readonly ui: UIManager;
  private readonly tunnel: TunnelGenerator;
  private readonly player: Player;
  private readonly cameraController: CameraController;
  private readonly collectibles = new Map<string, Collectible>();
  private readonly particles = new THREE.Points();
  private state: GameState = "menu";
  private mode: GameMode = "endless";
  private score = 0;
  private best = Number(localStorage.getItem("stellar-drift-best") ?? 0);
  private distance = 0;
  private speed = 11;
  private elapsed = 0;
  private footstepTimer = 0;
  private fallTimer = 0;
  private readonly crumbleTimers = new Map<string, number>();
  private readonly collapseTimers = new Map<string, { elapsed: number; originRow: number }>();
  private readonly sinkingTiles = new Set<TileInfo>();
  private selectedLevel = "1";
  private currentLevel: LevelDefinition | undefined;
  private levelCollectiblesCollected = 0;
  private readonly unlockedLevels = new Set<string>(JSON.parse(localStorage.getItem("stellar-drift-levels") ?? '["1"]') as string[]);
  private readonly relicProgress = this.loadRelicProgress();
  private readonly collectedRelicIds = this.loadCollectedRelicIds();

  public constructor(private readonly container: HTMLElement) {
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.container.append(this.renderer.domElement);

    this.scene.fog = new THREE.FogExp2(0x020611, 0.018);
    this.scene.add(new THREE.AmbientLight(0x7aa2ff, 0.7));
    const key = new THREE.DirectionalLight(0xffffff, 1.25);
    key.position.set(6, 8, 10);
    this.scene.add(key);

    this.makeBackdrop();
    this.tunnel = new TunnelGenerator(this.scene, this.mode);
    this.player = new Player(this.tunnel, this.physics);
    this.scene.add(this.player.mesh);
    this.cameraController = new CameraController(this.camera);
    this.ui = new UIManager(container);

    window.addEventListener("resize", this.onResize);
    window.addEventListener("pointerdown", () => void this.audio.unlock(), { once: true });
    this.ui.showMainMenu((choice) => this.handleMenu(choice));
  }

  public start(): void {
    this.renderer.setAnimationLoop(this.animate);
  }

  private readonly animate = (): void => {
    const delta = Math.min(this.clock.getDelta(), 0.05);
    this.elapsed += delta;
    this.handleGlobalInput();

    if (this.state === "running") {
      this.updateRunning(delta);
    }

    this.updateBackdrop(delta);
    this.renderer.render(this.scene, this.camera);
  };

  private handleGlobalInput(): void {
    if (this.input.consume("mute")) {
      this.audio.toggleMute();
    }
    if (this.input.consume("restart") && this.state !== "menu") {
      this.startRun(this.mode);
    }
    if (this.input.consume("pause") && this.state === "running") {
      this.pause();
    } else if (this.input.consume("pause") && this.state === "paused") {
      this.resume();
    }
  }

  private updateRunning(delta: number): void {
    const horizontal = Number(this.input.isPressed("right")) - Number(this.input.isPressed("left"));
    if (this.player.steer(horizontal as -1 | 0 | 1, delta)) {
      this.audio.shift();
    }
    if (this.input.consume("jump") && this.player.beginJump()) {
      this.audio.jump();
    }

    this.speed = Math.min((this.mode === "practice" ? 8.5 : 11) + this.distance / 180, this.mode === "practice" ? 12 : 24);
    const backwardWind = this.getBackwardWind();
    const update = this.player.update(delta, this.speed, this.input.isPressed("jump"), backwardWind);
    this.distance = -this.player.z;
    if (this.mode === "endless") {
      this.score += delta * this.speed * 4;
    }

    this.tunnel.update(this.player.z);
    this.syncCollectibles();
    this.updateCollectibles();
    this.updateObstacles(delta);
    this.checkGround();
    this.updateCrumblingTiles(delta);
    this.updateLevelProgress();
    this.cameraController.update(this.player, (this.speed - 11) / 13, delta);

    if (update.landed) {
      this.audio.land();
      this.cameraController.landShake();
    }
    if (!this.player.falling) {
      this.footstepTimer -= delta;
      if (this.player.jump.height === 0 && this.footstepTimer <= 0) {
        this.audio.footstep();
        this.footstepTimer = Math.max(0.18, 0.42 - this.speed * 0.012);
      }
    } else {
      this.fallTimer += delta;
      if (this.fallTimer > 1.2) {
        this.endRun();
      }
    }

    if (this.tunnel.isFinished(this.distance)) {
      this.score += 500;
      this.endRun();
    }

    this.ui.updateHud({
      score: this.score,
      best: this.best,
      distance: this.distance,
      speedMultiplier: this.speed / 11,
      paused: false,
      mode: this.mode,
      collectiblesCollected: this.levelCollectiblesCollected,
      collectiblesTotal: 3,
    });
  }

  private checkGround(): void {
    if (this.player.falling) {
      return;
    }
    if (this.player.jump.height > 0) {
      this.player.setSupportSinkOffset(0);
      return;
    }
    const row = Math.round(-this.player.z / this.tunnel.tileSize);
    const tile = this.tunnel.getTileAtLateral(this.player.surface, this.player.lateral, row);
    if (!tile?.solid) {
      if (this.player.hasEdgeGrace() || this.player.hasGroundGrace()) {
        return;
      }
      this.player.setSupportSinkOffset(0);
      this.player.startFall();
      this.audio.fall();
      return;
    }
    this.player.refreshGroundGrace();
    this.player.setSupportSinkOffset((tile.sinkProgress ?? 0) * 1.05);
    if (tile.collapseGroup) {
      if (!this.collapseTimers.has(tile.collapseGroup)) {
        this.collapseTimers.set(tile.collapseGroup, { elapsed: 0, originRow: row });
      }
    } else if (tile.crumbling) {
      const lane = this.tunnel.lateralToLane(this.player.lateral);
      const key = `${this.player.surface}:${lane}:${row}`;
      if (!this.crumbleTimers.has(key)) {
        this.crumbleTimers.set(key, 0.22);
      }
    }
  }

  private updateCrumblingTiles(delta: number): void {
    for (const [key, time] of this.crumbleTimers.entries()) {
      const next = time - delta;
      if (next > 0) {
        this.crumbleTimers.set(key, next);
        continue;
      }
      const [surface, laneText, rowText] = key.split(":");
      const tile = this.tunnel.getTile(surface as "floor" | "right" | "ceiling" | "left", Number(laneText), Number(rowText));
      if (tile) {
        this.tunnel.beginSinkTile(tile);
      }
      this.crumbleTimers.delete(key);
    }
    for (const [groupId, collapse] of this.collapseTimers.entries()) {
      collapse.elapsed += delta;
      const levelNumber = Number.parseInt(this.currentLevel?.id ?? "3", 10);
      const collapseRowsPerSecond = 5.2 + levelNumber * 0.18;
      const maxRow = collapse.originRow + Math.floor(collapse.elapsed * collapseRowsPerSecond);
      this.tunnel.collapseGroupThroughRow(groupId, maxRow);
    }
    this.updateSinkingTiles(delta);
  }

  private updateSinkingTiles(delta: number): void {
    for (const segmentTile of this.getVisibleSinkingTiles()) {
      this.sinkingTiles.add(segmentTile);
    }
    const movedMeshes = new Set<string>();
    for (const tile of this.sinkingTiles) {
      tile.sinkProgress = Math.min(1, (tile.sinkProgress ?? 0) + delta / 0.48);
      if (tile.mesh && !movedMeshes.has(tile.mesh.uuid)) {
        tile.mesh.position.addScaledVector(this.tunnel.getSurfaceNormal(tile.surface), -delta * 2.1);
        movedMeshes.add(tile.mesh.uuid);
      }
      if ((tile.sinkProgress ?? 0) >= 1) {
        this.tunnel.collapseTile(tile);
        this.sinkingTiles.delete(tile);
      }
    }
  }

  private getVisibleSinkingTiles(): TileInfo[] {
    const row = Math.round(-this.player.z / this.tunnel.tileSize);
    const tiles: TileInfo[] = [];
    for (let scanRow = row - 12; scanRow <= row + 36; scanRow += 1) {
      for (const surface of ["floor", "right", "ceiling", "left"] as const) {
        for (let lane = 0; lane < this.tunnel.laneCount; lane += 1) {
          const tile = this.tunnel.getTile(surface, lane, scanRow);
          if (tile?.sinking) {
            tiles.push(tile);
          }
        }
      }
    }
    return tiles;
  }

  private syncCollectibles(): void {
    const active = new Set<string>();
    for (const orb of this.tunnel.getActiveOrbs()) {
      if (this.mode === "level" && orb.levelId && this.hasCollectedRelic(orb.levelId, orb.id)) {
        this.tunnel.removeOrb(orb.id);
        continue;
      }
      active.add(orb.id);
      if (!this.collectibles.has(orb.id)) {
        const collectible = new Collectible(
          orb,
          this.tunnel.surfacePosition(orb.surface, orb.lane, orb.z, 1.15),
        );
        this.collectibles.set(orb.id, collectible);
        this.scene.add(collectible.mesh);
      }
    }
    for (const [id, collectible] of this.collectibles.entries()) {
      if (!active.has(id)) {
        this.scene.remove(collectible.mesh);
        this.collectibles.delete(id);
      }
    }
  }

  private updateCollectibles(): void {
    for (const collectible of this.collectibles.values()) {
      collectible.update(this.elapsed);
      const sameTrack = collectible.surface === this.player.surface
        && Math.abs(this.tunnel.laneToLateral(collectible.lane) - this.player.lateral) < 0.95;
      if (!sameTrack || Math.abs(collectible.mesh.position.z - this.player.z) > 1.35) {
        continue;
      }
      this.scene.remove(collectible.mesh);
      this.collectibles.delete(collectible.id);
      this.tunnel.removeOrb(collectible.id);
      if (this.mode === "level") {
        const levelId = this.tunnel.getLevelAtDistance(collectible.row * this.tunnel.tileSize)?.id ?? this.currentLevel?.id;
        if (levelId && this.recordRelicCollection(levelId, collectible.id)) {
          this.levelCollectiblesCollected = this.getRelicCount(levelId);
        }
      } else {
        this.score += 125;
      }
      this.audio.collect();
    }
  }

  private updateObstacles(delta: number): void {
    for (const windmill of this.tunnel.getActiveWindmills()) {
      const blades = windmill.userData.blades as THREE.Group | undefined;
      if (blades) blades.rotation.z += delta * 4.2;
    }
    for (const obstacle of this.tunnel.getActiveObstacles()) {
      const offset = Math.sin(this.elapsed * 2.2 + obstacle.row) * 0.8;
      const lateral = this.tunnel.getLateral(obstacle.surface);
      obstacle.mesh.position.copy(
        this.tunnel.surfacePosition(obstacle.surface, obstacle.lane, obstacle.z, 0.68),
      ).addScaledVector(lateral, offset);
      obstacle.mesh.rotation.z += delta;
      const closeZ = Math.abs(obstacle.z - this.player.z) < 0.65;
      const closeLane = obstacle.surface === this.player.surface
        && Math.abs(this.tunnel.laneToLateral(obstacle.lane) - this.player.lateral) < 0.78;
      if (closeZ && closeLane && this.player.jump.height < 0.65 && !this.player.falling) {
        this.player.startFall();
        this.audio.fall();
      }
    }
    for (const zone of this.tunnel.getActiveWindZones()) {
      const sameLane = zone.surface === this.player.surface
        && Math.abs(this.tunnel.laneToLateral(zone.lane) - this.player.lateral) < 0.72;
      const insideZ = this.player.z <= zone.startZ && this.player.z >= zone.endZ;
      if (sameLane && insideZ) {
        this.cameraController.landShake();
      }
    }
  }

  private getBackwardWind(): number {
    for (const zone of this.tunnel.getActiveWindZones()) {
      const sameLane = zone.surface === this.player.surface
        && Math.abs(this.tunnel.laneToLateral(zone.lane) - this.player.lateral) < 0.72;
      const insideZ = this.player.z <= zone.startZ && this.player.z >= zone.endZ;
      if (sameLane && insideZ) {
        return zone.strength;
      }
    }
    return 0;
  }

  private startRun(mode: GameMode, levelId = this.selectedLevel): void {
    void this.audio.unlock();
    this.mode = mode;
    this.state = "running";
    this.score = 0;
    this.distance = 0;
    this.speed = mode === "practice" ? 8.5 : 11;
    this.fallTimer = 0;
    this.crumbleTimers.clear();
    this.collapseTimers.clear();
    this.sinkingTiles.clear();
    this.levelCollectiblesCollected = 0;
    this.selectedLevel = levelId;
    const startRow = mode === "level" ? this.tunnel.getLevelStartRow(levelId) : 0;
    this.player.reset(-startRow * this.tunnel.tileSize);
    this.cameraController.reset();
    this.tunnel.reset(mode, levelId);
    for (const collectible of this.collectibles.values()) {
      this.scene.remove(collectible.mesh);
    }
    this.collectibles.clear();
    this.syncCollectibles();
    this.ui.beginRun();
    this.currentLevel = mode === "level" ? this.tunnel.getLevelAtDistance(-this.player.z) : undefined;
    this.levelCollectiblesCollected = this.currentLevel ? this.getRelicCount(this.currentLevel.id) : 0;
    if (this.currentLevel) {
      this.ui.showLevelToast(this.currentLevel.id, this.currentLevel.name);
    }
  }

  private pause(): void {
    this.state = "paused";
    this.ui.updateHud({
      score: this.score,
      best: this.best,
      distance: this.distance,
      speedMultiplier: this.speed / 11,
      paused: true,
      mode: this.mode,
      collectiblesCollected: this.levelCollectiblesCollected,
      collectiblesTotal: 3,
    });
    this.ui.showPause((action) => {
      if (action === "resume") {
        this.resume();
      } else if (action === "restart-level") {
        this.startRun(this.mode, this.currentLevel?.id ?? this.selectedLevel);
      } else if (action === "settings") {
        this.ui.showSettings(this.audio.isMuted, () => {
          this.audio.toggleMute();
          this.pause();
        }, () => this.pause());
      } else {
        this.state = "menu";
        this.ui.showMainMenu((choice) => this.handleMenu(choice));
      }
    });
  }

  private resume(): void {
    this.state = "running";
    this.ui.beginRun();
  }

  private endRun(): void {
    if (this.state !== "running") {
      return;
    }
    this.state = "over";
    const previousBest = this.best;
    if (this.mode === "endless") {
      this.best = Math.max(this.best, this.score);
      localStorage.setItem("stellar-drift-best", this.best.toString());
    }
    this.audio.gameOver();
    this.ui.showGameOver(this.mode === "level" ? 0 : this.score, this.distance, this.best, this.mode === "endless" && this.best > previousBest, (action) => {
      if (action === "again") {
        this.startRun(this.mode, this.mode === "level" ? (this.currentLevel?.id ?? this.selectedLevel) : this.selectedLevel);
      } else {
        this.state = "menu";
        this.ui.showMainMenu((choice) => this.handleMenu(choice));
      }
    }, this.mode, this.levelCollectiblesCollected);
  }

  private handleMenu(choice: GameMode | "scores" | "settings" | "levels"): void {
    if (choice === "scores") {
      this.ui.showScores(this.best, () => this.ui.showMainMenu((next) => this.handleMenu(next)));
    } else if (choice === "settings") {
      this.ui.showSettings(this.audio.isMuted, () => {
        this.audio.toggleMute();
        this.handleMenu("settings");
      }, () => this.ui.showMainMenu((next) => this.handleMenu(next)));
    } else if (choice === "levels") {
      this.ui.showLevelMap(
        this.unlockedLevels,
        Object.fromEntries(this.relicProgress),
        (levelId) => this.startRun("level", levelId),
        () => this.ui.showMainMenu((next) => this.handleMenu(next)),
      );
    } else {
      this.startRun(choice);
    }
  }

  private updateLevelProgress(): void {
    if (this.mode !== "level") {
      return;
    }
    const nextLevel = this.tunnel.getLevelAtDistance(this.distance);
    if (nextLevel && nextLevel.id !== this.currentLevel?.id) {
      this.currentLevel = nextLevel;
      this.unlockLevel(nextLevel.id);
      this.levelCollectiblesCollected = this.getRelicCount(nextLevel.id);
      this.ui.showLevelToast(nextLevel.id, nextLevel.name);
    }
    if (this.currentLevel) {
      const levelEnd = (this.currentLevel.startRow + this.currentLevel.rowCount) * this.tunnel.tileSize;
      if (this.distance >= levelEnd) {
        if (this.currentLevel.next.length === 1) {
          this.unlockLevel(this.currentLevel.next[0]);
        } else if (this.currentLevel.next.length > 1) {
          this.state = "paused";
          const options = this.currentLevel.next
            .map((id) => levelDefinitions.find((level) => level.id === id))
            .filter((level): level is LevelDefinition => Boolean(level));
          this.ui.showBranchChoice(this.currentLevel.name, options, (id) => {
            this.unlockLevel(id);
            this.startRun("level", id);
          });
        }
      }
    }
  }

  private unlockLevel(levelId: string): void {
    this.unlockedLevels.add(levelId);
    localStorage.setItem("stellar-drift-levels", JSON.stringify([...this.unlockedLevels]));
  }

  private loadRelicProgress(): Map<string, number> {
    const stored = JSON.parse(localStorage.getItem("stellar-drift-relics") ?? "{}") as Record<string, number>;
    const normalized = Object.entries(stored).map(([levelId, count]) => [
      levelId,
      THREE.MathUtils.clamp(Math.floor(Number(count) || 0), 0, 3),
    ] as const);
    const progress = new Map<string, number>(normalized);
    localStorage.setItem("stellar-drift-relics", JSON.stringify(Object.fromEntries(progress)));
    return progress;
  }

  private loadCollectedRelicIds(): Map<string, Set<string>> {
    const stored = JSON.parse(localStorage.getItem("stellar-drift-relic-ids") ?? "{}") as Record<string, string[]>;
    return new Map(Object.entries(stored).map(([levelId, ids]) => [levelId, new Set(ids)]));
  }

  private getRelicCount(levelId: string): number {
    return THREE.MathUtils.clamp(this.relicProgress.get(levelId) ?? 0, 0, 3);
  }

  private hasCollectedRelic(levelId: string, relicId: string): boolean {
    return this.collectedRelicIds.get(levelId)?.has(relicId) ?? false;
  }

  private recordRelicCollection(levelId: string, relicId: string): boolean {
    const ids = this.collectedRelicIds.get(levelId) ?? new Set<string>();
    if (ids.has(relicId)) {
      return false;
    }
    ids.add(relicId);
    this.collectedRelicIds.set(levelId, ids);
    this.relicProgress.set(levelId, Math.min(3, Math.max(this.getRelicCount(levelId), ids.size)));
    localStorage.setItem("stellar-drift-relics", JSON.stringify(Object.fromEntries(this.relicProgress)));
    localStorage.setItem(
      "stellar-drift-relic-ids",
      JSON.stringify(Object.fromEntries([...this.collectedRelicIds.entries()].map(([id, relicIds]) => [id, [...relicIds]]))),
    );
    return true;
  }

  private makeBackdrop(): void {
    const stars = new Float32Array(1800 * 3);
    for (let index = 0; index < stars.length; index += 3) {
      stars[index] = (Math.random() - 0.5) * 220;
      stars[index + 1] = (Math.random() - 0.5) * 220;
      stars[index + 2] = -Math.random() * 1200;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(stars, 3));
    this.particles.geometry = geometry;
    this.particles.material = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.42,
      transparent: true,
      opacity: 0.9,
    });
    this.scene.add(this.particles);

    const planet = new THREE.Mesh(
      new THREE.SphereGeometry(18, 40, 40),
      new THREE.MeshStandardMaterial({
        color: 0x6c4dff,
        emissive: 0x251261,
        emissiveIntensity: 0.8,
        roughness: 0.8,
      }),
    );
    planet.position.set(-52, 34, -180);
    this.scene.add(planet);

    const nebula = new THREE.Mesh(
      new THREE.PlaneGeometry(240, 120),
      new THREE.MeshBasicMaterial({
        color: 0x35135f,
        transparent: true,
        opacity: 0.22,
      }),
    );
    nebula.position.set(0, 10, -260);
    this.scene.add(nebula);
  }

  private updateBackdrop(delta: number): void {
    this.particles.rotation.z += delta * 0.004;
  }

  private readonly onResize = (): void => {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  };
}
