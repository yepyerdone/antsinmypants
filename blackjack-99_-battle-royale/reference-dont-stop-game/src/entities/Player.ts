import * as THREE from "three";
import type { Surface, TunnelGenerator } from "../world/TunnelGenerator";
import type { PhysicsEngine } from "../systems/PhysicsEngine";

export class Player {
  public readonly mesh = new THREE.Group();
  public readonly position = new THREE.Vector3();
  public surface: Surface = "floor";
  public lateral = 0;
  public z = 0;
  public readonly jump = { height: 0, velocity: 0, holdTime: 0, holding: false };
  public falling = false;
  public transition = 0;
  private readonly suitMaterial = new THREE.MeshStandardMaterial({
    color: 0xff9f43,
    emissive: 0x6d2600,
    emissiveIntensity: 0.42,
    roughness: 0.28,
  });
  private readonly accentMaterial = new THREE.MeshStandardMaterial({
    color: 0xffc36b,
    emissive: 0x8a4300,
    emissiveIntensity: 0.4,
    roughness: 0.25,
  });
  private readonly darkMaterial = new THREE.MeshStandardMaterial({
    color: 0x24110b,
    emissive: 0xffe1b3,
    emissiveIntensity: 0.7,
    roughness: 0.18,
  });
  private readonly body: THREE.Mesh;
  private readonly head: THREE.Mesh;
  private readonly leftEye: THREE.Mesh;
  private readonly rightEye: THREE.Mesh;
  private readonly visualRoot = new THREE.Group();
  private readonly leftArmPivot: THREE.Group;
  private readonly rightArmPivot: THREE.Group;
  private readonly leftLegPivot: THREE.Group;
  private readonly rightLegPivot: THREE.Group;
  private readonly targetPosition = new THREE.Vector3();
  private readonly targetOrientation = new THREE.Quaternion();
  private turnAmount = 0;
  private targetTurnAmount = 0;
  private steeringTimer = 0;
  private fallDistance = 0;
  private fallVelocity = 0;
  private supportSinkOffset = 0;
  private edgeGrace = 0;
  private groundGrace = 0;
  private runPhase = 0;

  public constructor(
    private readonly tunnel: TunnelGenerator,
    private readonly physics: PhysicsEngine,
  ) {
    this.body = new THREE.Mesh(new THREE.SphereGeometry(0.58, 22, 22), this.suitMaterial);
    this.body.scale.set(0.92, 1.08, 0.84);
    this.body.position.y = -0.12;
    this.head = new THREE.Mesh(new THREE.SphereGeometry(0.56, 22, 22), this.suitMaterial);
    this.head.position.y = 0.56;
    this.leftEye = this.makeEye(-1);
    this.rightEye = this.makeEye(1);

    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.34, 18, 18), this.accentMaterial);
    belly.scale.set(1, 1.15, 0.24);
    belly.position.set(0, -0.12, -0.48);

    const leftEar = this.makeEar(-1);
    const rightEar = this.makeEar(1);

    this.leftArmPivot = this.makeArm(-1);
    this.rightArmPivot = this.makeArm(1);
    this.leftLegPivot = this.makeLeg(-1);
    this.rightLegPivot = this.makeLeg(1);

    this.visualRoot.add(
      this.body,
      this.head,
      this.leftEye,
      this.rightEye,
      belly,
      leftEar,
      rightEar,
      this.leftArmPivot,
      this.rightArmPivot,
      this.leftLegPivot,
      this.rightLegPivot,
    );
    this.mesh.add(this.visualRoot);
    this.reset();
  }

  public reset(startZ = 0): void {
    this.surface = "floor";
    this.lateral = 0;
    this.z = startZ;
    this.jump.height = 0;
    this.jump.velocity = 0;
    this.jump.holdTime = 0;
    this.jump.holding = false;
    this.falling = false;
    this.transition = 0;
    this.turnAmount = 0;
    this.targetTurnAmount = 0;
    this.steeringTimer = 0;
    this.fallDistance = 0;
    this.fallVelocity = 0;
    this.supportSinkOffset = 0;
    this.edgeGrace = 0;
    this.groundGrace = 0.18;
    this.mesh.rotation.set(0, 0, 0);
    this.updateTransform(true);
  }

  public steer(direction: -1 | 0 | 1, delta: number): boolean {
    if (this.falling || direction === 0) {
      return false;
    }
    this.lateral += direction * delta * 7.2;
    this.targetTurnAmount = direction * -0.28;
    this.steeringTimer = 0.12;
    let shifted = false;
    const order: Surface[] = ["floor", "right", "ceiling", "left"];
    while (this.lateral > this.tunnel.halfWidth) {
      const overflow = this.lateral - this.tunnel.halfWidth;
      const currentIndex = order.indexOf(this.surface);
      this.surface = order[(currentIndex + 1) % order.length];
      this.lateral = -this.tunnel.halfWidth + overflow;
      shifted = true;
    }
    while (this.lateral < -this.tunnel.halfWidth) {
      const overflow = this.lateral + this.tunnel.halfWidth;
      const currentIndex = order.indexOf(this.surface);
      this.surface = order[(currentIndex - 1 + order.length) % order.length];
      this.lateral = this.tunnel.halfWidth + overflow;
      shifted = true;
    }
    if (shifted) {
      this.transition = 0.34;
      this.edgeGrace = 0.26;
    }
    return shifted;
  }

  public beginJump(): boolean {
    if (this.falling || this.jump.height > 0 || this.groundGrace <= 0) {
      return false;
    }
    this.physics.beginJump(this.jump);
    this.groundGrace = 0;
    return true;
  }

  public update(delta: number, speed: number, jumpHeld: boolean, backwardWind = 0): { landed: boolean } {
    this.z -= Math.max(-7, speed - backwardWind) * delta;
    const wasAirborne = this.jump.height > 0;
    this.physics.updateJump(this.jump, delta, jumpHeld);
    this.transition = Math.max(0, this.transition - delta);
    this.edgeGrace = Math.max(0, this.edgeGrace - delta);
    this.groundGrace = Math.max(0, this.groundGrace - delta);
    this.steeringTimer = Math.max(0, this.steeringTimer - delta);
    if (this.steeringTimer === 0) {
      this.targetTurnAmount = 0;
    }
    if (this.falling) {
      this.fallVelocity += 18 * delta;
      this.fallDistance += this.fallVelocity * delta;
      this.leftArmPivot.rotation.x += (-0.7 - this.leftArmPivot.rotation.x) * (1 - Math.exp(-delta * 8));
      this.rightArmPivot.rotation.x += (-0.7 - this.rightArmPivot.rotation.x) * (1 - Math.exp(-delta * 8));
      this.leftLegPivot.rotation.x += (0.18 - this.leftLegPivot.rotation.x) * (1 - Math.exp(-delta * 8));
      this.rightLegPivot.rotation.x += (-0.18 - this.rightLegPivot.rotation.x) * (1 - Math.exp(-delta * 8));
      this.visualRoot.rotation.x += (-0.08 - this.visualRoot.rotation.x) * (1 - Math.exp(-delta * 6));
    } else {
      this.runPhase += delta * speed * 0.8;
      const stride = Math.sin(this.runPhase) * 0.62;
      const kneeLift = Math.max(0, Math.sin(this.runPhase)) * 0.12;
      this.leftLegPivot.rotation.x = stride;
      this.rightLegPivot.rotation.x = -stride;
      this.leftLegPivot.position.y = -0.48 + kneeLift;
      this.rightLegPivot.position.y = -0.48 + Math.max(0, -Math.sin(this.runPhase)) * 0.12;
      this.leftArmPivot.rotation.x = -stride * 0.7;
      this.rightArmPivot.rotation.x = stride * 0.7;
      this.body.position.y = -0.08 + Math.abs(Math.sin(this.runPhase * 2)) * 0.06;
      this.head.position.y = 0.56 + Math.abs(Math.sin(this.runPhase * 2)) * 0.04;
    }
    this.turnAmount += (this.targetTurnAmount - this.turnAmount) * (1 - Math.exp(-delta * 12));
    this.visualRoot.rotation.y = this.turnAmount;
    this.visualRoot.rotation.z = -this.turnAmount * 0.35;
    this.updateTransform(false, delta);
    return { landed: wasAirborne && this.jump.height === 0 };
  }

  public startFall(): void {
    this.falling = true;
    this.fallDistance = 0;
    this.fallVelocity = 0;
    this.jump.height = 0;
    this.jump.velocity = 0;
    this.jump.holdTime = 0;
    this.jump.holding = false;
  }

  public setSupportSinkOffset(offset: number): void {
    this.supportSinkOffset = offset;
  }

  public hasEdgeGrace(): boolean {
    return this.edgeGrace > 0;
  }

  public refreshGroundGrace(): void {
    this.groundGrace = 0.18;
  }

  public hasGroundGrace(): boolean {
    return this.groundGrace > 0;
  }

  public getUpVector(): THREE.Vector3 {
    return this.tunnel.getSurfaceNormal(this.surface);
  }

  public getCameraAnchor(): THREE.Vector3 {
    const jumpLift = this.jump.height * 0.35 - this.fallDistance * 0.2 - this.supportSinkOffset;
    return this.tunnel.surfacePoint(this.surface, 0, this.z, 0.76 + jumpLift);
  }

  private updateTransform(immediate = false, delta = 0): void {
    const up = this.tunnel.getSurfaceNormal(this.surface);
    const inwardOffset = 0.76 + this.jump.height - this.fallDistance - this.supportSinkOffset;
    this.targetPosition.copy(this.tunnel.surfacePoint(this.surface, this.lateral, this.z, inwardOffset));
    if (immediate) {
      this.position.copy(this.targetPosition);
    } else {
      this.position.lerp(this.targetPosition, 1 - Math.exp(-delta * (this.transition > 0 ? 8 : 13)));
    }
    this.mesh.position.copy(this.position);
    if (!this.falling) {
      this.targetOrientation.setFromUnitVectors(new THREE.Vector3(0, 1, 0), up);
      if (immediate) {
        this.mesh.quaternion.copy(this.targetOrientation);
      } else {
        this.mesh.quaternion.slerp(this.targetOrientation, 1 - Math.exp(-delta * (this.transition > 0 ? 8 : 13)));
      }
    }
  }

  private makeArm(side: -1 | 1): THREE.Group {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.48, 0.08, 0);

    const upperArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.3, 4, 8), this.suitMaterial);
    upperArm.position.y = -0.2;
    upperArm.rotation.z = side * -0.16;

    const glove = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 12), this.accentMaterial);
    glove.position.set(side * 0.06, -0.46, -0.02);
    pivot.add(upperArm, glove);
    return pivot;
  }

  private makeLeg(side: -1 | 1): THREE.Group {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.22, -0.52, 0);

    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.34, 4, 8), this.suitMaterial);
    leg.position.y = -0.25;

    const boot = new THREE.Mesh(new THREE.SphereGeometry(0.19, 12, 12), this.accentMaterial);
    boot.scale.set(1.15, 0.8, 1.25);
    boot.position.set(0, -0.5, -0.08);
    pivot.add(leg, boot);
    return pivot;
  }

  private makeEar(side: -1 | 1): THREE.Group {
    const ear = new THREE.Group();
    ear.position.set(side * 0.34, 1.02, 0.04);
    ear.rotation.z = side * -0.28;

    const stalk = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.22, 4, 8), this.accentMaterial);
    stalk.position.y = 0.08;

    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 12), this.accentMaterial);
    tip.position.y = 0.24;
    ear.add(stalk, tip);
    return ear;
  }

  private makeEye(side: -1 | 1): THREE.Mesh {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 16), this.darkMaterial);
    eye.scale.set(0.9, 1.1, 0.55);
    eye.position.set(side * 0.18, 0.64, -0.48);
    return eye;
  }
}
