import * as THREE from "three";
import type { Surface } from "../world/TunnelGenerator";

export interface CollectibleSpawn {
  id: string;
  row: number;
  lane: number;
  surface: Surface;
  z: number;
}

export class Collectible {
  public readonly id: string;
  public readonly row: number;
  public readonly lane: number;
  public readonly surface: Surface;
  public readonly mesh: THREE.Group;
  public collected = false;

  public constructor(spawn: CollectibleSpawn, position: THREE.Vector3) {
    this.id = spawn.id;
    this.row = spawn.row;
    this.lane = spawn.lane;
    this.surface = spawn.surface;

    const group = new THREE.Group();
    const core = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.44, 1),
      new THREE.MeshStandardMaterial({
        color: 0xffd166,
        emissive: 0xff8a00,
        emissiveIntensity: 2.1,
        metalness: 0.15,
        roughness: 0.18,
      }),
    );
    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(0.62, 0.05, 12, 36),
      new THREE.MeshBasicMaterial({
        color: 0xffefb0,
        transparent: true,
        opacity: 0.68,
      }),
    );
    halo.rotation.x = Math.PI / 2;
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, 0.9, 12),
      new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.4 }),
    );
    group.add(core, halo, beam);
    group.position.copy(position);
    this.mesh = group;
  }

  public update(elapsed: number): void {
    this.mesh.rotation.y += 0.03;
    this.mesh.rotation.z += 0.015;
    this.mesh.position.y += Math.sin(elapsed * 4 + this.row) * 0.002;
  }
}
