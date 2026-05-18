import * as THREE from "three";

export type Surface = "floor" | "right" | "ceiling" | "left";
export type GameMode = "endless" | "level" | "practice";

export interface TileInfo {
  surface: Surface;
  lane: number;
  row: number;
  solid: boolean;
  crumbling: boolean;
  collapseGroup?: string;
  sinking?: boolean;
  sinkProgress?: number;
  mesh?: THREE.Mesh;
}

export interface OrbInfo {
  id: string;
  surface: Surface;
  lane: number;
  row: number;
  z: number;
  levelId?: string;
}

export interface ObstacleInfo {
  id: string;
  surface: Surface;
  lane: number;
  row: number;
  z: number;
  mesh: THREE.Mesh;
}

export interface WindZoneInfo {
  id: string;
  surface: Surface;
  lane: number;
  startRow: number;
  endRow: number;
  startZ: number;
  endZ: number;
  strength: number;
}

interface Segment {
  index: number;
  group: THREE.Group;
  tiles: TileInfo[];
  orbs: OrbInfo[];
  obstacles: ObstacleInfo[];
  windZones: WindZoneInfo[];
  windmills: THREE.Group[];
}

const surfaces: Surface[] = ["floor", "right", "ceiling", "left"];
export interface LevelDefinition {
  id: string;
  name: string;
  startRow: number;
  rowCount: number;
  next: string[];
  mapX: number;
  mapY: number;
}

export const levelDefinitions: LevelDefinition[] = [
  { id: "1", name: "Launch Weave", startRow: 0, rowCount: 72, next: ["2"], mapX: 8, mapY: 54 },
  { id: "2", name: "Helix Garden", startRow: 72, rowCount: 76, next: ["3"], mapX: 18, mapY: 48 },
  { id: "3", name: "Fracture Run", startRow: 148, rowCount: 80, next: ["4"], mapX: 28, mapY: 42 },
  { id: "4", name: "Forklight Gate", startRow: 228, rowCount: 84, next: ["5A", "5B"], mapX: 38, mapY: 42 },
  { id: "5A", name: "Hayfield Crosswind", startRow: 312, rowCount: 84, next: ["6A"], mapX: 50, mapY: 24 },
  { id: "5B", name: "Moonlit Spiral", startRow: 396, rowCount: 84, next: ["6B"], mapX: 50, mapY: 60 },
  { id: "6A", name: "Windmill Gauntlet", startRow: 480, rowCount: 88, next: ["7"], mapX: 62, mapY: 18 },
  { id: "6B", name: "Violet Drift", startRow: 568, rowCount: 88, next: ["7"], mapX: 62, mapY: 66 },
  { id: "7", name: "Confluence", startRow: 656, rowCount: 90, next: ["8"], mapX: 74, mapY: 42 },
  { id: "8", name: "Magnet Run", startRow: 746, rowCount: 92, next: ["9A", "9B"], mapX: 86, mapY: 42 },
  { id: "9A", name: "Comet Thread", startRow: 838, rowCount: 94, next: ["10A"], mapX: 98, mapY: 24 },
  { id: "9B", name: "Shadow Thread", startRow: 932, rowCount: 94, next: ["10B"], mapX: 98, mapY: 60 },
  { id: "10A", name: "Aurora Teeth", startRow: 1026, rowCount: 96, next: ["11"], mapX: 110, mapY: 18 },
  { id: "10B", name: "Meteor Teeth", startRow: 1122, rowCount: 96, next: ["11"], mapX: 110, mapY: 66 },
  { id: "11", name: "Twin Return", startRow: 1218, rowCount: 98, next: ["12"], mapX: 122, mapY: 42 },
  { id: "12", name: "Gravity Lace", startRow: 1316, rowCount: 100, next: ["13"], mapX: 134, mapY: 36 },
  { id: "13", name: "Glass Current", startRow: 1416, rowCount: 102, next: ["14"], mapX: 146, mapY: 30 },
  { id: "14", name: "Starfall Steps", startRow: 1518, rowCount: 104, next: ["15"], mapX: 158, mapY: 24 },
  { id: "15", name: "Pulse Furnace", startRow: 1622, rowCount: 108, next: ["16"], mapX: 170, mapY: 18 },
  { id: "16", name: "Final Orbit", startRow: 1730, rowCount: 112, next: [], mapX: 182, mapY: 12 },
];

export class TunnelGenerator {
  public readonly tileSize = 2.5;
  public readonly laneCount = 6;
  public readonly cellWidth = 1.25;
  public readonly segmentRows = 16;
  public readonly halfWidth = (this.laneCount * this.cellWidth) / 2;
  private readonly segments = new Map<number, Segment>();
  private readonly chapterMaterials = [
    { tile: 0x091326, glow: 0x1e7cff, edge: 0xff4fd8 },
    { tile: 0x18102b, glow: 0x9d7bff, edge: 0x7cf6ff },
    { tile: 0x10251f, glow: 0x36e69a, edge: 0xffd166 },
    { tile: 0x28130f, glow: 0xff7a45, edge: 0xffef8a },
  ].map((palette) => ({
    tile: new THREE.MeshStandardMaterial({
      color: palette.tile,
      emissive: palette.glow,
      emissiveIntensity: 0.35,
      metalness: 0.12,
      roughness: 0.32,
    }),
    edge: new THREE.MeshStandardMaterial({
      color: 0x07111f,
      emissive: palette.edge,
      emissiveIntensity: 1.2,
    }),
  }));
  private readonly crumbleMaterial = new THREE.MeshStandardMaterial({
    color: 0x251326,
    emissive: 0xff8bd4,
    emissiveIntensity: 0.95,
    metalness: 0.08,
    roughness: 0.36,
  });
  private readonly hayMaterial = new THREE.MeshStandardMaterial({
    color: 0xc9972f,
    emissive: 0x6b4310,
    emissiveIntensity: 0.34,
    metalness: 0.02,
    roughness: 0.88,
  });
  private finishPortal: THREE.Group | null = null;
  private startLevel = "1";

  public constructor(private readonly scene: THREE.Scene, private mode: GameMode) {}

  public reset(mode: GameMode, startLevel = "1"): void {
    this.mode = mode;
    this.startLevel = startLevel;
    for (const segment of this.segments.values()) {
      this.scene.remove(segment.group);
    }
    if (this.finishPortal) {
      this.scene.remove(this.finishPortal);
      this.finishPortal = null;
    }
    this.segments.clear();
    for (let index = 0; index < 8; index += 1) {
      this.ensureSegment(index);
    }
    if (mode === "level") {
      this.finishPortal = this.createFinishPortal();
      this.scene.add(this.finishPortal);
    }
  }

  public update(playerZ: number): void {
    const currentIndex = Math.floor(-playerZ / (this.segmentRows * this.tileSize));
    for (let index = currentIndex; index <= currentIndex + 7; index += 1) {
      this.ensureSegment(index);
    }
    for (const [index, segment] of this.segments.entries()) {
      if (index < currentIndex - 2) {
        this.scene.remove(segment.group);
        this.segments.delete(index);
      }
    }
  }

  public getTile(surface: Surface, lane: number, row: number): TileInfo | undefined {
    const segmentIndex = Math.floor(row / this.segmentRows);
    const localRow = row % this.segmentRows;
    return this.segments.get(segmentIndex)?.tiles.find((tile) =>
      tile.surface === surface && tile.lane === lane && tile.row === localRow,
    );
  }

  public getTileAtLateral(surface: Surface, lateral: number, row: number): TileInfo | undefined {
    return this.getTile(surface, this.lateralToLane(lateral), row);
  }

  public getActiveOrbs(): OrbInfo[] {
    return [...this.segments.values()].flatMap((segment) => segment.orbs);
  }

  public removeOrb(id: string): void {
    for (const segment of this.segments.values()) {
      segment.orbs = segment.orbs.filter((orb) => orb.id !== id);
    }
  }

  public getActiveObstacles(): ObstacleInfo[] {
    return [...this.segments.values()].flatMap((segment) => segment.obstacles);
  }

  public getActiveWindZones(): WindZoneInfo[] {
    return [...this.segments.values()].flatMap((segment) => segment.windZones);
  }

  public getActiveWindmills(): THREE.Group[] {
    return [...this.segments.values()].flatMap((segment) => segment.windmills);
  }

  public surfacePosition(surface: Surface, lane: number, z: number, inwardOffset = 0): THREE.Vector3 {
    const lateral = this.laneToLateral(lane);
    return this.surfacePoint(surface, lateral, z, inwardOffset);
  }

  public surfacePoint(surface: Surface, lateral: number, z: number, inwardOffset = 0): THREE.Vector3 {
    switch (surface) {
      case "floor":
        return new THREE.Vector3(lateral, -this.halfWidth + inwardOffset, z);
      case "right":
        return new THREE.Vector3(this.halfWidth - inwardOffset, lateral, z);
      case "ceiling":
        return new THREE.Vector3(-lateral, this.halfWidth - inwardOffset, z);
      case "left":
        return new THREE.Vector3(-this.halfWidth + inwardOffset, -lateral, z);
    }
  }

  public laneToLateral(lane: number): number {
    return -this.halfWidth + this.cellWidth / 2 + lane * this.cellWidth;
  }

  public lateralToLane(lateral: number): number {
    const lane = Math.floor((lateral + this.halfWidth) / this.cellWidth);
    return THREE.MathUtils.clamp(lane, 0, this.laneCount - 1);
  }

  public getSurfaceNormal(surface: Surface): THREE.Vector3 {
    switch (surface) {
      case "floor":
        return new THREE.Vector3(0, 1, 0);
      case "right":
        return new THREE.Vector3(-1, 0, 0);
      case "ceiling":
        return new THREE.Vector3(0, -1, 0);
      case "left":
        return new THREE.Vector3(1, 0, 0);
    }
  }

  public getLateral(surface: Surface): THREE.Vector3 {
    switch (surface) {
      case "floor":
        return new THREE.Vector3(1, 0, 0);
      case "right":
        return new THREE.Vector3(0, 1, 0);
      case "ceiling":
        return new THREE.Vector3(-1, 0, 0);
      case "left":
        return new THREE.Vector3(0, -1, 0);
    }
  }

  public isFinished(distance: number): boolean {
    return this.mode === "level" && distance >= this.getCampaignLength();
  }

  public getLevelAtDistance(distance: number): LevelDefinition | undefined {
    const row = Math.floor(distance / this.tileSize);
    return levelDefinitions.find((level) => row >= level.startRow && row < level.startRow + level.rowCount);
  }

  public getLevelStartRow(levelId: string): number {
    return levelDefinitions.find((level) => level.id === levelId)?.startRow ?? 0;
  }

  public getCampaignLength(): number {
    const last = levelDefinitions[levelDefinitions.length - 1];
    return (last.startRow + last.rowCount) * this.tileSize;
  }

  private ensureSegment(index: number): void {
    if (this.segments.has(index)) {
      return;
    }

    const group = new THREE.Group();
    const tiles: TileInfo[] = [];
    const orbs: OrbInfo[] = [];
    const obstacles: ObstacleInfo[] = [];
    const windZones: WindZoneInfo[] = [];
    const windmills: THREE.Group[] = [];
    const startRow = index * this.segmentRows;

    for (let row = 0; row < this.segmentRows; row += 1) {
      const absoluteRow = startRow + row;
      for (const surface of surfaces) {
        const rowTiles: TileInfo[] = [];
        for (let lane = 0; lane < this.laneCount; lane += 1) {
          const solid = this.shouldPlaceTile(index, absoluteRow, surface, lane);
          const crumbling = solid && this.isCrumblingTile(absoluteRow, surface, lane);
          const collapseGroup = solid ? this.getCollapseGroup(absoluteRow, surface, lane) : undefined;
          const tile: TileInfo = { surface, lane, row, solid, crumbling, collapseGroup };
          tiles.push(tile);
          rowTiles.push(tile);
          if (!solid) {
            continue;
          }
          if (this.shouldPlaceOrb(absoluteRow, surface, lane)) {
            orbs.push({
              id: `${index}:${surface}:${lane}:${row}`,
              surface,
              lane,
              row: absoluteRow,
              z: -absoluteRow * this.tileSize,
              levelId: this.mode === "level" ? this.getLevelAtDistance(absoluteRow * this.tileSize)?.id : undefined,
            });
          }
        }
        this.addSurfaceSpans(group, rowTiles, surface, absoluteRow);
      }
    }

    if (this.shouldPlaceObstacle(index)) {
      const row = startRow + 6 + Math.floor(this.hash(index, 11, 13) * 8);
      const surface = surfaces[Math.floor(this.hash(index, 2, 3) * surfaces.length)];
      const lane = Math.floor(this.hash(index, 5, 7) * this.laneCount);
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(1.9, 0.45, 0.45),
        new THREE.MeshStandardMaterial({
          color: 0xff5d8f,
          emissive: 0xff2f72,
          emissiveIntensity: 1.8,
        }),
      );
      mesh.position.copy(this.surfacePosition(surface, lane, -row * this.tileSize, 0.65));
      group.add(mesh);
      obstacles.push({ id: `o:${index}:${row}`, surface, lane, row, z: -row * this.tileSize, mesh });
    }

    const farmLevel = this.getFarmLevel(startRow);
    if (farmLevel) {
      const farmWind = this.createFarmWind(index, farmLevel);
      if (farmWind) {
        group.add(farmWind.windmill);
        windmills.push(farmWind.windmill);
        windZones.push(farmWind.zone);
        obstacles.push(...farmWind.traps);
        for (const trap of farmWind.traps) group.add(trap.mesh);
      }
    }

    this.scene.add(group);
    this.segments.set(index, { index, group, tiles, orbs, obstacles, windZones, windmills });
  }

  public collapseTile(tile: TileInfo): void {
    tile.solid = false;
    if (tile.mesh) {
      tile.mesh.visible = false;
    }
  }

  public beginSinkTile(tile: TileInfo): void {
    if (!tile.sinking && tile.solid) {
      tile.sinking = true;
      tile.sinkProgress = 0;
    }
  }

  public collapseGroup(groupId: string): void {
    for (const segment of this.segments.values()) {
      for (const tile of segment.tiles) {
        if (tile.collapseGroup === groupId) {
          this.beginSinkTile(tile);
        }
      }
    }
  }

  public collapseGroupThroughRow(groupId: string, maxAbsoluteRow: number): void {
    for (const segment of this.segments.values()) {
      for (const tile of segment.tiles) {
        const absoluteRow = segment.index * this.segmentRows + tile.row;
        if (tile.collapseGroup === groupId && absoluteRow <= maxAbsoluteRow) {
          this.beginSinkTile(tile);
        }
      }
    }
  }

  private createTile(surface: Surface, crumbling: boolean, width: number, row: number): THREE.Mesh {
    const geometry = new THREE.BoxGeometry(width, 0.12, this.tileSize - 0.08);
    const level = this.getLevelAtDistance(row * this.tileSize);
    const chapter = level ? Math.min(Math.floor((Number.parseInt(level.id, 10) - 1) / 5), this.chapterMaterials.length - 1) : 0;
    const farmLevel = level?.id === "5A" || level?.id === "6A";
    const mesh = new THREE.Mesh(
      geometry,
      crumbling ? this.crumbleMaterial : farmLevel && surface === "floor" ? this.hayMaterial : this.chapterMaterials[chapter].tile,
    );
    if (surface === "right" || surface === "left") {
      mesh.rotation.z = Math.PI / 2;
    }
    const edge = new THREE.Mesh(
      new THREE.BoxGeometry(Math.max(0.1, width - 0.1), 0.14, 0.08),
      this.chapterMaterials[chapter].edge,
    );
    edge.position.z = -this.tileSize / 2 + 0.08;
    mesh.add(edge);
    return mesh;
  }

  private addSurfaceSpans(group: THREE.Group, rowTiles: TileInfo[], surface: Surface, absoluteRow: number): void {
    let start = -1;
    let crumbling = false;
    let collapseGroup: string | undefined;
    for (let lane = 0; lane <= rowTiles.length; lane += 1) {
      const tile = rowTiles[lane];
      const continues = tile?.solid
        && (start === -1 || (tile.crumbling === crumbling && tile.collapseGroup === collapseGroup));
      if (continues) {
        if (start === -1) {
          start = lane;
          crumbling = tile.crumbling;
          collapseGroup = tile.collapseGroup;
        }
        continue;
      }
      if (start !== -1) {
        const count = lane - start;
        const width = count * this.cellWidth;
        const centerLateral = this.laneToLateral(start) + ((count - 1) * this.cellWidth) / 2;
        const mesh = this.createTile(surface, crumbling || Boolean(collapseGroup), width, absoluteRow);
        mesh.position.copy(this.surfacePoint(surface, centerLateral, -absoluteRow * this.tileSize));
        group.add(mesh);
        for (let spanLane = start; spanLane < lane; spanLane += 1) {
          rowTiles[spanLane].mesh = mesh;
        }
        start = -1;
      }
      if (tile?.solid) {
        start = lane;
        crumbling = tile.crumbling;
        collapseGroup = tile.collapseGroup;
      }
    }
  }

  private shouldPlaceTile(index: number, absoluteRow: number, surface: Surface, lane: number): boolean {
    if (absoluteRow < 24) {
      return true;
    }
    if (this.mode === "practice") {
      return Math.random() > 0.05;
    }
    if (this.mode === "level") {
      return this.levelTileSolid(absoluteRow, surface, lane);
    }
    const holeChance = Math.min(0.045 + index * 0.011, 0.24);
    return Math.random() > holeChance;
  }

  private levelTileSolid(row: number, surface: Surface, lane: number): boolean {
    const level = this.getLevelAtDistance(row * this.tileSize);
    if (!level) {
      return true;
    }
    const local = row - level.startRow;
    if (local < 10) {
      return true;
    }
    const levelNumber = Number.parseInt(level.id, 10);
    if (level.id === "5A") {
      return this.farmPathSolidA(local, surface, lane);
    }
    if (level.id === "6A") {
      return this.farmPathSolidB(local, surface, lane);
    }
    if (levelNumber <= 4) {
      if (surface === "floor") return !([0, 1].includes(local % 18) && lane < 2)
        && !([8, 9].includes(local % 18) && lane > 3);
      return !(local % 22 === 12 && lane === (surface === "right" ? 4 : 1));
    }
    if (levelNumber >= 5 && levelNumber <= 7) {
      return this.swirlPathSolid(level, local, surface, lane);
    }
    if (levelNumber <= 8) {
      const ribbon = (Math.floor(local / 5) + surfaces.indexOf(surface)) % this.laneCount;
      return lane === ribbon || lane === (ribbon + 1) % this.laneCount || local % 16 < 3;
    }
    if (levelNumber <= 12) {
      const centerGap = local % 20 >= 8 && local % 20 <= 11;
      if (surface === "floor") return !(centerGap && lane >= 2 && lane <= 3);
      return !(local % 15 >= 5 && local % 15 <= 7 && lane === (local % this.laneCount));
    }
    if (surface === "floor") {
      return !(local % 24 >= 10 && local % 24 <= 15 && lane >= 1 && lane <= 4);
    }
    return !(local % 18 >= 8 && local % 18 <= 10 && lane >= 2 && lane <= 3);
  }

  private farmPathSolidA(local: number, surface: Surface, lane: number): boolean {
    if (surface !== "floor") return local % 20 < 4;
    const blockedSide = Math.floor(local / 12) % 2 === 0 ? 0 : this.laneCount - 1;
    const windCorridor = local % 24 >= 8 && local % 24 <= 14;
    if (windCorridor) return lane !== blockedSide;
    return !(local % 18 >= 4 && local % 18 <= 6 && lane === blockedSide);
  }

  private farmPathSolidB(local: number, surface: Surface, lane: number): boolean {
    if (surface !== "floor") return local % 16 < 3;
    const center = 1 + (Math.floor(local / 8) % 4);
    const pathLane = Math.abs(lane - center) <= 1;
    return pathLane || local % 22 < 4;
  }

  private swirlPathSolid(level: LevelDefinition, local: number, surface: Surface, lane: number): boolean {
    const levelNumber = Number.parseInt(level.id, 10);
    const branchOffset = level.id.endsWith("B") ? 1 : 0;
    const turnSpan = Math.max(9, 13 - levelNumber);
    const phase = Math.floor((local - 10) / turnSpan);
    const phaseRow = (local - 10) % turnSpan;
    const direction = level.id.endsWith("B") ? -1 : 1;
    const routeSurfaceIndex = (direction * phase + branchOffset + surfaces.length * 8) % surfaces.length;
    const routeSurface = surfaces[routeSurfaceIndex];
    const nextSurface = surfaces[(routeSurfaceIndex + direction + surfaces.length) % surfaces.length];
    const progress = phaseRow / Math.max(1, turnSpan - 1);
    const center = direction === 1
      ? 1 + Math.round(progress * 4)
      : 4 - Math.round(progress * 4);
    const onPathLane = Math.abs(lane - center) <= 1;

    if (surface === routeSurface && onPathLane) {
      return true;
    }

    // Carry the same ribbon over the seam so the path remains physically connected onto the next wall.
    const seamRows = 3;
    if (phaseRow >= turnSpan - seamRows && surface === nextSurface) {
      const nextCenter = direction === 1
        ? Math.max(0, phaseRow - (turnSpan - seamRows) - 1)
        : this.laneCount - 1 - Math.max(0, phaseRow - (turnSpan - seamRows) - 1);
      return Math.abs(lane - nextCenter) <= 1;
    }

    return false;
  }

  private isCrumblingTile(row: number, surface: Surface, lane: number): boolean {
    if (this.mode === "practice") return false;
    if (this.mode === "level") {
      const level = this.getLevelAtDistance(row * this.tileSize);
      return Boolean(level && Number.parseInt(level.id, 10) >= 3 && row % 17 === 0 && (lane === 1 || lane === 4));
    }
    return row > 70 && this.hash(row, lane, surfaces.indexOf(surface)) < 0.035;
  }

  private getCollapseGroup(row: number, surface: Surface, lane: number): string | undefined {
    if (this.mode !== "level") return undefined;
    const level = this.getLevelAtDistance(row * this.tileSize);
    if (!level || Number.parseInt(level.id, 10) < 3) return undefined;
    const local = row - level.startRow;
    const levelNumber = Number.parseInt(level.id, 10);
    const width = Math.min(2 + Math.floor(levelNumber / 4), this.laneCount);
    const snakeStart = 18 + (levelNumber % 5) * 3;
    const snakeLength = Math.min(18 + levelNumber * 2, level.rowCount - snakeStart - 8);
    if (local >= snakeStart && local < snakeStart + snakeLength) {
      const phase = Math.floor((local - snakeStart) / 4);
      const surfaceIndex = (phase + levelNumber) % surfaces.length;
      const snakeSurface = surfaces[surfaceIndex];
      const center = (phase * 2 + levelNumber) % this.laneCount;
      const laneDistance = Math.min(
        Math.abs(lane - center),
        this.laneCount - Math.abs(lane - center),
      );
      if (surface === snakeSurface && laneDistance < width / 2) {
        return `snake-${level.id}-1`;
      }
    }
    if (levelNumber >= 8 && local >= 58 && local < 58 + Math.min(10 + Math.floor(levelNumber / 2), 22)) {
      if ((surface === "floor" || surface === "right") && lane >= Math.max(0, 3 - Math.floor(levelNumber / 6))) {
        return `sheet-${level.id}-2`;
      }
    }
    return undefined;
  }

  private shouldPlaceOrb(row: number, surface: Surface, lane: number): boolean {
    if (row <= 5) return false;
    if (this.mode === "level") {
      return this.isLevelCollectible(row, surface, lane);
    }
    return this.hash(row, lane, surfaces.indexOf(surface)) < 0.026;
  }

  private isLevelCollectible(row: number, surface: Surface, lane: number): boolean {
    const level = this.getLevelAtDistance(row * this.tileSize);
    if (!level) {
      return false;
    }
    const span = Math.max(24, level.rowCount - 12);
    const seed = level.id.charCodeAt(level.id.length - 1);
    const picks: Array<[number, Surface, number]> = [
      [Math.min(18 + (seed % 7), span - 18), "floor", (seed + 1) % this.laneCount],
      [Math.min(Math.floor(level.rowCount * 0.48), span - 10), surfaces[(seed + 1) % surfaces.length], (seed + 3) % this.laneCount],
      [Math.min(Math.floor(level.rowCount * 0.78), span - 4), surfaces[(seed + 2) % surfaces.length], (seed + 5) % this.laneCount],
    ];
    const local = row - level.startRow;
    return picks.some(([pickRow, pickSurface, pickLane]) =>
      local === pickRow && surface === pickSurface && lane === pickLane,
    );
  }

  private shouldPlaceObstacle(index: number): boolean {
    if (this.mode === "practice") return false;
    if (this.mode === "level") {
      return index > 5 && index % 3 === 0;
    }
    return index > 2 && this.hash(index, 7, 11) < Math.min(0.12 + index * 0.015, 0.42);
  }

  private getFarmLevel(startRow: number): LevelDefinition | undefined {
    const level = this.getLevelAtDistance(startRow * this.tileSize);
    return level?.id === "5A" || level?.id === "6A" ? level : undefined;
  }

  private createFarmWind(index: number, level: LevelDefinition): {
    windmill: THREE.Group;
    zone: WindZoneInfo;
    traps: ObstacleInfo[];
  } | undefined {
    const localSegment = index * this.segmentRows - level.startRow;
    const cadence = level.id === "5A" ? 2 : 1;
    if (localSegment < 10 || index % cadence !== 0) return undefined;

    const lane = level.id === "5A"
      ? (Math.floor(localSegment / this.segmentRows) % 2 === 0 ? 1 : 4)
      : 1 + (Math.floor(localSegment / this.segmentRows) % 4);
    const row = index * this.segmentRows + 3;
    const zoneLength = level.id === "5A" ? 10 : 13;
    const windmill = this.createWindmill(lane, row);
    const zone: WindZoneInfo = {
      id: `w:${index}`,
      surface: "floor",
      lane,
      startRow: row,
      endRow: row + zoneLength,
      startZ: -row * this.tileSize,
      endZ: -(row + zoneLength) * this.tileSize,
      strength: level.id === "5A" ? 15 : 18,
    };
    const trapRows = level.id === "5A" ? [row + 5] : [row + 4, row + 9];
    const traps = trapRows.map((trapRow, trapIndex) => {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(1.5, 0.55, 0.52),
        new THREE.MeshStandardMaterial({
          color: 0x7f1d1d,
          emissive: 0xff6b35,
          emissiveIntensity: 1.3,
        }),
      );
      mesh.position.copy(this.surfacePosition("floor", lane, -trapRow * this.tileSize, 0.68));
      return { id: `farm-trap:${index}:${trapIndex}`, surface: "floor" as const, lane, row: trapRow, z: -trapRow * this.tileSize, mesh };
    });
    return { windmill, zone, traps };
  }

  private createWindmill(lane: number, row: number): THREE.Group {
    const group = new THREE.Group();
    const towerMaterial = new THREE.MeshStandardMaterial({ color: 0xe7d3a5, roughness: 0.76 });
    const bladeMaterial = new THREE.MeshStandardMaterial({ color: 0xf8fafc, emissive: 0xfff4cf, emissiveIntensity: 0.22 });
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.45, 2.2, 8), towerMaterial);
    tower.position.y = 1.1;
    const hub = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 12), bladeMaterial);
    hub.position.set(0, 2.12, 0);
    const blades = new THREE.Group();
    blades.position.copy(hub.position);
    for (let i = 0; i < 4; i += 1) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.35, 0.08), bladeMaterial);
      blade.position.y = 0.68;
      blade.rotation.z = i * Math.PI / 2;
      blades.add(blade);
    }
    group.add(tower, hub, blades);
    const windRibbon = new THREE.Mesh(
      new THREE.BoxGeometry(0.82, 0.08, this.tileSize * 10),
      new THREE.MeshBasicMaterial({
        color: 0xdbeafe,
        transparent: true,
        opacity: 0.22,
      }),
    );
    windRibbon.position.set(0, 0.12, this.tileSize * 5);
    group.add(windRibbon);
    group.position.copy(this.surfacePosition("floor", lane, -row * this.tileSize, 0));
    group.userData.blades = blades;
    return group;
  }

  private hash(a: number, b: number, c: number): number {
    const value = Math.sin(a * 12.9898 + b * 78.233 + c * 37.719) * 43758.5453;
    return value - Math.floor(value);
  }

  private createFinishPortal(): THREE.Group {
    const group = new THREE.Group();
    const outer = new THREE.Mesh(
      new THREE.TorusGeometry(this.halfWidth * 1.34, 0.2, 18, 64),
      new THREE.MeshStandardMaterial({
        color: 0x7cf6ff,
        emissive: 0x7cf6ff,
        emissiveIntensity: 1.6,
      }),
    );
    const inner = new THREE.Mesh(
      new THREE.RingGeometry(this.halfWidth * 0.9, this.halfWidth * 1.16, 64),
      new THREE.MeshBasicMaterial({
        color: 0xff8bd4,
        transparent: true,
        opacity: 0.32,
        side: THREE.DoubleSide,
      }),
    );
    group.add(outer, inner);
    group.position.z = -this.getCampaignLength();
    return group;
  }
}
