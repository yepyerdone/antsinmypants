import * as THREE from "three";
import type { Player } from "../entities/Player";

export class CameraController {
  private readonly desiredPosition = new THREE.Vector3();
  private readonly target = new THREE.Vector3();
  private readonly centeredAnchor = new THREE.Vector3();
  private readonly desiredAnchor = new THREE.Vector3();
  private readonly lateralOffset = new THREE.Vector3();
  private initialized = false;
  private snapNextUpdate = true;
  private shake = 0;

  public constructor(private readonly camera: THREE.PerspectiveCamera) {}

  public landShake(): void {
    this.shake = 0.18;
  }

  public reset(): void {
    this.initialized = false;
    this.snapNextUpdate = true;
    this.shake = 0;
    this.camera.up.set(0, 1, 0);
  }

  public update(player: Player, speedRatio: number, delta: number): void {
    const up = player.getUpVector();
    this.desiredAnchor.copy(player.getCameraAnchor());
    if (!this.initialized) {
      this.centeredAnchor.copy(this.desiredAnchor);
      this.initialized = true;
    } else {
      this.centeredAnchor.lerp(this.desiredAnchor, 1 - Math.exp(-delta * 7));
    }
    this.lateralOffset.copy(player.position).sub(this.centeredAnchor).multiplyScalar(0.18);

    this.desiredPosition.copy(this.centeredAnchor)
      .add(this.lateralOffset)
      .add(new THREE.Vector3(0, 0, 7.8))
      .addScaledVector(up, 4.1);
    if (this.snapNextUpdate) {
      this.camera.position.copy(this.desiredPosition);
      this.snapNextUpdate = false;
    } else {
      this.camera.position.lerp(this.desiredPosition, 1 - Math.exp(-delta * 4.2));
    }

    this.target.copy(this.centeredAnchor)
      .addScaledVector(this.lateralOffset, 0.7)
      .add(new THREE.Vector3(0, 0, -8));
    this.camera.up.lerp(up, 1 - Math.exp(-delta * 8)).normalize();
    this.camera.lookAt(this.target);

    this.camera.fov += ((62 + speedRatio * 10) - this.camera.fov) * (1 - Math.exp(-delta * 4));
    this.camera.updateProjectionMatrix();

    if (this.shake > 0) {
      this.camera.position.x += (Math.random() - 0.5) * this.shake;
      this.camera.position.y += (Math.random() - 0.5) * this.shake;
      this.shake = Math.max(0, this.shake - delta * 1.2);
    }
  }
}
