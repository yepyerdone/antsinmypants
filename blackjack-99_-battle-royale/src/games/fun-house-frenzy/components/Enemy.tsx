/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { RigidBody, RapierRigidBody, CapsuleCollider } from '@react-three/rapier';
import * as THREE from 'three';
import { useGameStore, EnemyData } from '../store';

const ENEMY_SPEED = 6.35;
const CHASE_DIST = 120;
const MELEE_DIST = 2.4;
const MELEE_COOLDOWN = 1400;
const FINAL_CLOWN_SPEED = 8.8;
const FINAL_CLOWN_REPOSITION_DISTANCE = 62;
const FINAL_CLOWN_STUCK_TIME = 2600;
const STUCK_SIDESTEP_TIME = 1450;
const STUCK_REPOSITION_TIME = 4300;
const WALL_LIMIT = 90;
const WALL_AVOID_MARGIN = 15;
const OBSTACLE_AVOID_PADDING = 6.5;
const AVOIDANCE_PROBE_DISTANCE = 6;
const CONCESSIONS_AVOID_CENTER = { x: 58, z: -52, halfWidth: 22, halfDepth: 17 };

type AvoidObstacle = {
  x: number;
  z: number;
  halfWidth: number;
  halfDepth: number;
};

function mulberry32(seed: number) {
  return function random() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createAvoidObstacles(): AvoidObstacle[] {
  const random = mulberry32(12345);
  const obstacles: AvoidObstacle[] = [
    { x: 0, z: 0, halfWidth: 24, halfDepth: 24 },
    { x: -62, z: 58, halfWidth: 20, halfDepth: 20 },
    CONCESSIONS_AVOID_CENTER,
  ];

  for (let index = 0; index < 80; index += 1) {
    const x = (random() - 0.5) * 170;
    const z = (random() - 0.5) * 170;

    if (Math.abs(x) < 20 && Math.abs(z) < 20) {
      continue;
    }
    if (Math.abs(x) < 37 && Math.abs(z - 30) < 14) {
      continue;
    }
    if (Math.abs(x - CONCESSIONS_AVOID_CENTER.x) < CONCESSIONS_AVOID_CENTER.halfWidth && Math.abs(z - CONCESSIONS_AVOID_CENTER.z) < CONCESSIONS_AVOID_CENTER.halfDepth) {
      continue;
    }

    random();
    const isHorizontal = random() > 0.5;
    const width = isHorizontal ? random() * 25 + 10 : random() * 3 + 1;
    const depth = isHorizontal ? random() * 3 + 1 : random() * 25 + 10;
    random();

    obstacles.push({
      x,
      z,
      halfWidth: width / 2,
      halfDepth: depth / 2,
    });
  }

  return obstacles;
}

const AVOID_OBSTACLES = createAvoidObstacles();

function applyArenaAvoidance(position: THREE.Vector3, desiredDirection: THREE.Vector3, isStuck: boolean) {
  if (desiredDirection.lengthSq() < 0.001) return desiredDirection;

  const direction = desiredDirection.clone().normalize();
  const probe = position.clone().add(direction.clone().multiplyScalar(AVOIDANCE_PROBE_DISTANCE));
  const steering = direction.clone();
  let avoidancePressure = 0;

  AVOID_OBSTACLES.forEach((obstacle) => {
    const dx = probe.x - obstacle.x;
    const dz = probe.z - obstacle.z;
    const paddedWidth = obstacle.halfWidth + OBSTACLE_AVOID_PADDING;
    const paddedDepth = obstacle.halfDepth + OBSTACLE_AVOID_PADDING;

    if (Math.abs(dx) < paddedWidth && Math.abs(dz) < paddedDepth) {
      const pushX = dx / Math.max(1, paddedWidth);
      const pushZ = dz / Math.max(1, paddedDepth);
      const repulsion = new THREE.Vector3(pushX, 0, pushZ);
      if (repulsion.lengthSq() > 0.001) {
        const depth = 1 - Math.min(0.92, Math.max(Math.abs(pushX), Math.abs(pushZ)));
        const strength = 0.5 + depth * 0.95;
        avoidancePressure = Math.max(avoidancePressure, strength);
        steering.add(repulsion.normalize().multiplyScalar(strength));
      }
    }
  });

  if (position.x > WALL_LIMIT - WALL_AVOID_MARGIN) {
    const pressure = (position.x - (WALL_LIMIT - WALL_AVOID_MARGIN)) / WALL_AVOID_MARGIN;
    steering.x -= pressure;
    avoidancePressure = Math.max(avoidancePressure, pressure);
  }
  if (position.x < -WALL_LIMIT + WALL_AVOID_MARGIN) {
    const pressure = ((-WALL_LIMIT + WALL_AVOID_MARGIN) - position.x) / WALL_AVOID_MARGIN;
    steering.x += pressure;
    avoidancePressure = Math.max(avoidancePressure, pressure);
  }
  if (position.z > WALL_LIMIT - WALL_AVOID_MARGIN) {
    const pressure = (position.z - (WALL_LIMIT - WALL_AVOID_MARGIN)) / WALL_AVOID_MARGIN;
    steering.z -= pressure;
    avoidancePressure = Math.max(avoidancePressure, pressure);
  }
  if (position.z < -WALL_LIMIT + WALL_AVOID_MARGIN) {
    const pressure = ((-WALL_LIMIT + WALL_AVOID_MARGIN) - position.z) / WALL_AVOID_MARGIN;
    steering.z += pressure;
    avoidancePressure = Math.max(avoidancePressure, pressure);
  }

  if (steering.lengthSq() < 0.001) return direction;
  if (avoidancePressure <= 0) return direction;

  const avoidanceDirection = steering.normalize();
  const blend = THREE.MathUtils.clamp((isStuck ? 0.48 : 0.26) + avoidancePressure * 0.18, 0.24, isStuck ? 0.74 : 0.58);
  return direction.lerp(avoidanceDirection, blend).normalize();
}

const CLOWN_VARIANTS = [
  {
    suit: '#ffffff',
    accent: '#ff0000',
    trim: '#ffd700',
    hair: '#0000ff',
    face: '#fff2df',
    cheek: '#ff9fb3',
    eye: '#050505',
    brow: '#0000ff',
    bodyScale: [1, 1, 1] as [number, number, number],
    headScale: [1, 1, 1] as [number, number, number],
    noseScale: 1,
    mouthColor: '#ff0000',
  },
  {
    suit: '#7dd3fc',
    accent: '#7c3aed',
    trim: '#f472b6',
    hair: '#22c55e',
    face: '#fde68a',
    cheek: '#fb7185',
    eye: '#111827',
    brow: '#7c3aed',
    bodyScale: [0.9, 1.18, 0.95] as [number, number, number],
    headScale: [0.9, 1.16, 0.9] as [number, number, number],
    noseScale: 0.78,
    mouthColor: '#7c3aed',
  },
  {
    suit: '#fef08a',
    accent: '#f97316',
    trim: '#38bdf8',
    hair: '#ef4444',
    face: '#fce7f3',
    cheek: '#f97316',
    eye: '#020617',
    brow: '#ef4444',
    bodyScale: [1.16, 0.92, 1.08] as [number, number, number],
    headScale: [1.18, 0.88, 1] as [number, number, number],
    noseScale: 1.22,
    mouthColor: '#020617',
  },
];

function getVariantIndex(id: string) {
  return id.split('').reduce((total, char) => total + char.charCodeAt(0), 0) % CLOWN_VARIANTS.length;
}

export function Enemy({ data }: { data: EnemyData }) {
  const body = useRef<RapierRigidBody>(null);
  const { camera } = useThree();
  
  const gameState = useGameStore(state => state.gameState);
  const enemiesRemaining = useGameStore(state => state.enemiesRemaining);
  const playerState = useGameStore(state => state.playerState);
  const hitPlayer = useGameStore(state => state.hitPlayer);
  const addParticles = useGameStore(state => state.addParticles);

  const lastMeleeTime = useRef(0);
  const patrolTarget = useRef(new THREE.Vector3());
  const lastPatrolChange = useRef(0);
  const state = useRef<'patrol' | 'chase'>('patrol');
  const lastProgressPosition = useRef(new THREE.Vector3(data.position[0], data.position[1], data.position[2]));
  const lastProgressTime = useRef(Date.now());

  const groupRef = useRef<THREE.Group>(null);
  const torsoRef = useRef<THREE.Mesh>(null);
  const leftLegRef = useRef<THREE.Mesh>(null);
  const rightLegRef = useRef<THREE.Mesh>(null);
  const leftShoeRef = useRef<THREE.Mesh>(null);
  const rightShoeRef = useRef<THREE.Mesh>(null);
  const leftArmRef = useRef<THREE.Mesh>(null);
  const rightArmRef = useRef<THREE.Mesh>(null);
  const leftGloveRef = useRef<THREE.Mesh>(null);
  const rightGloveRef = useRef<THREE.Mesh>(null);
  const headRef = useRef<THREE.Mesh>(null);
  const noseRef = useRef<THREE.Mesh>(null);
  const leftEyeRef = useRef<THREE.Mesh>(null);
  const rightEyeRef = useRef<THREE.Mesh>(null);
  const leftBrowRef = useRef<THREE.Mesh>(null);
  const rightBrowRef = useRef<THREE.Mesh>(null);
  const mouthRef = useRef<THREE.Mesh>(null);
  const hatRef = useRef<THREE.Mesh>(null);
  const variant = useMemo(() => CLOWN_VARIANTS[getVariantIndex(data.id)], [data.id]);

  // Initialize patrol target
  useMemo(() => {
    patrolTarget.current.set(
      data.position[0] + (Math.random() - 0.5) * 10,
      data.position[1],
      data.position[2] + (Math.random() - 0.5) * 10
    );
  }, [data.position]);

  useFrame((state_fiber) => {
    if (!body.current || gameState !== 'playing' || data.state === 'disabled') {
      if (body.current) {
        body.current.setLinvel({ x: 0, y: body.current.linvel().y, z: 0 }, true);
      }
      return;
    }

    const pos = body.current.translation();
    const currentPos = new THREE.Vector3(pos.x, pos.y, pos.z);
    const finalClownPressure = enemiesRemaining <= 2;

    if (Math.abs(pos.x) > 94 || Math.abs(pos.z) > 94 || pos.y < -8) {
      body.current.setTranslation({ x: data.position[0], y: data.position[1], z: data.position[2] }, true);
      body.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
      return;
    }
    
    let closestTargetPos: THREE.Vector3 | null = null;
    let closestDist = CHASE_DIST;

    // Check player
    if (playerState === 'active') {
      const playerPos = camera.position.clone();
      playerPos.y = pos.y; // Ignore height difference for distance
      const distToPlayer = currentPos.distanceTo(playerPos);
      if (finalClownPressure || distToPlayer < CHASE_DIST * 2) {
        closestDist = distToPlayer;
        closestTargetPos = playerPos;
      }
    }

    const now = Date.now();
    if (currentPos.distanceTo(lastProgressPosition.current) > 1.5) {
      lastProgressPosition.current.copy(currentPos);
      lastProgressTime.current = now;
    } else if (
      closestTargetPos &&
      (
        (finalClownPressure && closestDist > FINAL_CLOWN_REPOSITION_DISTANCE && now - lastProgressTime.current > FINAL_CLOWN_STUCK_TIME)
        || now - lastProgressTime.current > STUCK_REPOSITION_TIME
      )
    ) {
      const angle = Math.random() * Math.PI * 2;
      const distance = finalClownPressure ? 34 + Math.random() * 10 : 46 + Math.random() * 14;
      const nextX = THREE.MathUtils.clamp(closestTargetPos.x + Math.cos(angle) * distance, -82, 82);
      const nextZ = THREE.MathUtils.clamp(closestTargetPos.z + Math.sin(angle) * distance, -82, 82);
      body.current.setTranslation({ x: nextX, y: data.position[1], z: nextZ }, true);
      body.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
      lastProgressPosition.current.set(nextX, data.position[1], nextZ);
      lastProgressTime.current = now;
      patrolTarget.current.copy(closestTargetPos);
      state.current = 'chase';
      return;
    }

    // AI Logic
    if (closestTargetPos) {
      state.current = 'chase';
    } else if (state.current === 'chase') {
      state.current = 'patrol';
      patrolTarget.current.set(
        currentPos.x + (Math.random() - 0.5) * 40,
        currentPos.y,
        currentPos.z + (Math.random() - 0.5) * 40
      );
      lastPatrolChange.current = Date.now();
    }

    const direction = new THREE.Vector3();
    const isStuckChasing = Boolean(
      closestTargetPos &&
      now - lastProgressTime.current > STUCK_SIDESTEP_TIME &&
      closestDist > MELEE_DIST * 2.5
    );

    if (state.current === 'chase' && closestTargetPos) {
      direction.subVectors(closestTargetPos, currentPos).normalize();
      if (isStuckChasing) {
        const side = new THREE.Vector3(-direction.z, 0, direction.x);
        direction.add(side.multiplyScalar(Math.sin(now * 0.006 + data.position[0]) > 0 ? 0.38 : -0.38)).normalize();
      }
      
      // Melee attack only. Clowns must reach the player before tagging them.
      if (closestDist < MELEE_DIST && now - lastMeleeTime.current > MELEE_COOLDOWN) {
        hitPlayer();
        addParticles([camera.position.x, camera.position.y, camera.position.z], '#ff0000');
        lastMeleeTime.current = now;
      }
    } else {
      // Patrol
      // Change target if reached or if stuck for 4 seconds
      if (currentPos.distanceTo(patrolTarget.current) < 2 || now - lastPatrolChange.current > 4000) {
        patrolTarget.current.set(
          currentPos.x + (Math.random() - 0.5) * 60,
          currentPos.y,
          currentPos.z + (Math.random() - 0.5) * 60
        );
        lastPatrolChange.current = now;
      }
      direction.subVectors(patrolTarget.current, currentPos).normalize();
    }

    direction.copy(applyArenaAvoidance(currentPos, direction, isStuckChasing));

    const elapsed = state_fiber.clock.elapsedTime;
    const isMoving = direction.lengthSq() > 0.1;
    const isAttacking = closestDist < MELEE_DIST * 2.15;
    const runCycle = elapsed * (finalClownPressure ? 12 : 9);
    const stride = isMoving ? Math.sin(runCycle) : Math.sin(elapsed * 2) * 0.18;
    const armSwing = isAttacking ? 1.25 : stride * 0.75;
    const bodyBob = isMoving ? Math.abs(Math.sin(runCycle)) * 0.12 : Math.sin(elapsed * 2.2) * 0.03;
    const expressionCycle = Math.sin(elapsed * 5 + data.position[0]);

    if (groupRef.current) {
      groupRef.current.position.y = bodyBob;
      groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, isAttacking ? -0.14 : 0, 0.18);
    }
    if (torsoRef.current) {
      torsoRef.current.rotation.z = stride * 0.055;
      torsoRef.current.scale.set(1 + bodyBob * 0.04, 1 - bodyBob * 0.025, 1);
    }
    if (leftLegRef.current) leftLegRef.current.rotation.x = stride * 0.7;
    if (rightLegRef.current) rightLegRef.current.rotation.x = -stride * 0.7;
    if (leftShoeRef.current) leftShoeRef.current.position.z = 0.12 + Math.max(0, stride) * 0.34;
    if (rightShoeRef.current) rightShoeRef.current.position.z = 0.12 + Math.max(0, -stride) * 0.34;
    if (leftArmRef.current) {
      leftArmRef.current.rotation.x = isAttacking ? -1.15 : 0.25 - armSwing;
      leftArmRef.current.rotation.z = isAttacking ? 0.28 : 0.55;
    }
    if (rightArmRef.current) {
      rightArmRef.current.rotation.x = isAttacking ? -1.15 : 0.25 + armSwing;
      rightArmRef.current.rotation.z = isAttacking ? -0.28 : -0.55;
    }
    if (leftGloveRef.current) leftGloveRef.current.position.z = 0.12 + (isAttacking ? 0.75 : -stride * 0.22);
    if (rightGloveRef.current) rightGloveRef.current.position.z = 0.12 + (isAttacking ? 0.75 : stride * 0.22);
    if (headRef.current) {
      headRef.current.rotation.z = expressionCycle * 0.05;
      headRef.current.position.y = 3.35 + (isAttacking ? 0.05 : bodyBob * 0.65);
    }
    if (noseRef.current) {
      const nosePulse = 1 + Math.max(0, expressionCycle) * 0.16 + (isAttacking ? 0.12 : 0);
      noseRef.current.scale.setScalar(nosePulse);
    }
    if (leftEyeRef.current) leftEyeRef.current.scale.y = isAttacking ? 1.45 : 1 + Math.max(0, expressionCycle) * 0.35;
    if (rightEyeRef.current) rightEyeRef.current.scale.y = isAttacking ? 1.45 : 1 + Math.max(0, -expressionCycle) * 0.35;
    if (leftBrowRef.current) leftBrowRef.current.rotation.z = isAttacking ? -0.62 : -0.25 - expressionCycle * 0.18;
    if (rightBrowRef.current) rightBrowRef.current.rotation.z = isAttacking ? 0.62 : 0.25 + expressionCycle * 0.18;
    if (mouthRef.current) {
      mouthRef.current.rotation.z = isAttacking ? Math.PI : 0;
      mouthRef.current.scale.set(1 + (isAttacking ? 0.25 : 0), isAttacking ? 1.45 : 1 + Math.abs(expressionCycle) * 0.22, 1);
    }
    if (hatRef.current) {
      hatRef.current.rotation.z = stride * 0.18;
      hatRef.current.position.y = 4.18 + bodyBob * 0.75;
    }

    // Apply movement
    const velocity = body.current.linvel();
    const speed = finalClownPressure ? FINAL_CLOWN_SPEED : ENEMY_SPEED;
    body.current.setLinvel({
      x: direction.x * speed,
      y: velocity.y,
      z: direction.z * speed
    }, true);

    // Rotate to face direction
    if (groupRef.current && direction.lengthSq() > 0.1) {
      const targetRotation = Math.atan2(direction.x, direction.z);
      // Simple lerp for rotation
      const currentRotation = groupRef.current.rotation.y;
      // Handle angle wrap-around
      let diff = targetRotation - currentRotation;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      groupRef.current.rotation.y += diff * 0.1;

    }
  });

  const color = data.state === 'disabled' ? '#444' : variant.suit;
  const accentColor = data.state === 'disabled' ? '#222' : variant.accent;
  const trimColor = data.state === 'disabled' ? '#222' : variant.trim;
  const hairColor = data.state === 'disabled' ? '#111' : variant.hair;
  const faceColor = data.state === 'disabled' ? '#333' : variant.face;
  const cheekColor = data.state === 'disabled' ? '#222' : variant.cheek;
  const eyeColor = data.state === 'disabled' ? '#111' : variant.eye;
  const browColor = data.state === 'disabled' ? '#111' : variant.brow;
  const mouthColor = data.state === 'disabled' ? '#111' : variant.mouthColor;

  return (
    <RigidBody
      ref={body}
      colliders={false}
      mass={1}
      type="dynamic"
      position={data.position}
      enabledRotations={[false, false, false]}
      userData={{ name: data.id }}
    >
      <CapsuleCollider args={[1.65, 0.45]} position={[0, 2.15, 0]} />
      <group ref={groupRef} position={[0, 0, 0]} scale={variant.bodyScale}>
        {/* Shoes */}
        <mesh ref={leftShoeRef} castShadow position={[-0.28, 0.18, 0.12]} scale={[1.45, 0.55, 1.8]}>
          <sphereGeometry args={[0.2, 16, 10]} />
          <meshStandardMaterial color="#111111" roughness={0.9} />
        </mesh>
        <mesh ref={rightShoeRef} castShadow position={[0.28, 0.18, 0.12]} scale={[1.45, 0.55, 1.8]}>
          <sphereGeometry args={[0.2, 16, 10]} />
          <meshStandardMaterial color="#111111" roughness={0.9} />
        </mesh>

        {/* Legs */}
        <mesh ref={leftLegRef} castShadow position={[-0.22, 0.85, 0]} rotation={[0, 0, 0.08]}>
          <capsuleGeometry args={[0.16, 1.1, 8, 12]} />
          <meshStandardMaterial color={accentColor} roughness={0.75} />
        </mesh>
        <mesh ref={rightLegRef} castShadow position={[0.22, 0.85, 0]} rotation={[0, 0, -0.08]}>
          <capsuleGeometry args={[0.16, 1.1, 8, 12]} />
          <meshStandardMaterial color={color} roughness={0.8} />
        </mesh>

        {/* Tall striped torso */}
        <mesh ref={torsoRef} castShadow position={[0, 2.0, 0]}>
          <capsuleGeometry args={[0.52, 1.75, 12, 18]} />
          <meshStandardMaterial color={color} roughness={0.8} />
        </mesh>
        <mesh castShadow position={[-0.19, 2.0, 0.015]}>
          <boxGeometry args={[0.2, 1.9, 0.96]} />
          <meshStandardMaterial color={accentColor} roughness={0.75} />
        </mesh>
        <mesh castShadow position={[0.19, 2.0, 0.02]}>
          <boxGeometry args={[0.16, 1.9, 0.98]} />
          <meshStandardMaterial color={trimColor} roughness={0.75} />
        </mesh>

        {/* Ruffled collar and buttons */}
        <mesh position={[0, 2.95, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.55, 0.08, 8, 24]} />
          <meshStandardMaterial color={trimColor} roughness={0.6} />
        </mesh>
        {[1.6, 2.0, 2.4].map((y) => (
          <mesh key={y} position={[0, y, 0.52]}>
            <sphereGeometry args={[0.07, 12, 8]} />
            <meshStandardMaterial color={browColor} roughness={0.4} />
          </mesh>
        ))}

        {/* Long arms and gloves */}
        <mesh ref={leftArmRef} castShadow position={[-0.72, 2.15, 0]} rotation={[0.25, 0, 0.55]}>
          <capsuleGeometry args={[0.13, 1.15, 8, 12]} />
          <meshStandardMaterial color={accentColor} roughness={0.7} />
        </mesh>
        <mesh ref={rightArmRef} castShadow position={[0.72, 2.15, 0]} rotation={[0.25, 0, -0.55]}>
          <capsuleGeometry args={[0.13, 1.15, 8, 12]} />
          <meshStandardMaterial color={trimColor} roughness={0.7} />
        </mesh>
        <mesh ref={leftGloveRef} castShadow position={[-1.05, 1.55, 0.12]}>
          <sphereGeometry args={[0.18, 16, 12]} />
          <meshStandardMaterial color="#ffffff" roughness={0.55} />
        </mesh>
        <mesh ref={rightGloveRef} castShadow position={[1.05, 1.55, 0.12]}>
          <sphereGeometry args={[0.18, 16, 12]} />
          <meshStandardMaterial color="#ffffff" roughness={0.55} />
        </mesh>

        {/* Head and face */}
        <mesh
          ref={headRef}
          castShadow
          position={[0, 3.35, 0]}
          scale={variant.headScale}
          userData={{ enemyId: data.id, hitZone: 'head' }}
        >
          <sphereGeometry args={[0.46, 24, 18]} />
          <meshStandardMaterial color={faceColor} roughness={0.65} />
        </mesh>
        
        <mesh ref={noseRef} position={[0, 3.32, 0.43]} scale={[variant.noseScale, variant.noseScale, variant.noseScale]}>
          <sphereGeometry args={[0.15, 16, 16]} />
          <meshStandardMaterial color={accentColor} roughness={0.2} />
        </mesh>
        <mesh ref={leftEyeRef} position={[-0.16, 3.45, 0.4]}>
          <sphereGeometry args={[0.055, 12, 8]} />
          <meshStandardMaterial color={eyeColor} roughness={0.35} />
        </mesh>
        <mesh ref={rightEyeRef} position={[0.16, 3.45, 0.4]}>
          <sphereGeometry args={[0.055, 12, 8]} />
          <meshStandardMaterial color={eyeColor} roughness={0.35} />
        </mesh>
        <mesh ref={leftBrowRef} position={[-0.16, 3.55, 0.41]} rotation={[0, 0, -0.25]}>
          <boxGeometry args={[0.18, 0.035, 0.025]} />
          <meshStandardMaterial color={browColor} roughness={0.5} />
        </mesh>
        <mesh ref={rightBrowRef} position={[0.16, 3.55, 0.41]} rotation={[0, 0, 0.25]}>
          <boxGeometry args={[0.18, 0.035, 0.025]} />
          <meshStandardMaterial color={browColor} roughness={0.5} />
        </mesh>
        <mesh ref={mouthRef} position={[0, 3.16, 0.42]} rotation={[0, 0, 0]}>
          <torusGeometry args={[0.18, 0.025, 8, 24, Math.PI]} />
          <meshStandardMaterial color={mouthColor} roughness={0.35} />
        </mesh>
        <mesh position={[-0.16, 3.2, 0.45]} scale={[1.35, 0.8, 0.35]}>
          <sphereGeometry args={[0.07, 12, 8]} />
          <meshStandardMaterial color={cheekColor} roughness={0.45} />
        </mesh>
        <mesh position={[0.16, 3.2, 0.45]} scale={[1.35, 0.8, 0.35]}>
          <sphereGeometry args={[0.07, 12, 8]} />
          <meshStandardMaterial color={cheekColor} roughness={0.45} />
        </mesh>
        <mesh position={[0, 3.08, 0.43]}>
          <boxGeometry args={[0.18, 0.05, 0.02]} />
          <meshStandardMaterial color="#ffffff" roughness={0.3} />
        </mesh>
        {getVariantIndex(data.id) === 1 && (
          <>
            <mesh position={[-0.09, 3.02, 0.45]}>
              <boxGeometry args={[0.07, 0.16, 0.025]} />
              <meshStandardMaterial color="#ffffff" roughness={0.32} />
            </mesh>
            <mesh position={[0.09, 3.02, 0.45]}>
              <boxGeometry args={[0.07, 0.16, 0.025]} />
              <meshStandardMaterial color="#ffffff" roughness={0.32} />
            </mesh>
          </>
        )}
        {getVariantIndex(data.id) === 2 && (
          <mesh position={[0, 3.58, 0.45]}>
            <coneGeometry args={[0.12, 0.28, 3]} />
            <meshStandardMaterial color={trimColor} roughness={0.46} />
          </mesh>
        )}

        {/* Clown Hair (Sides) */}
        <mesh position={[0.42, 3.48, 0]} scale={[1, 1.25, 1]}>
          <sphereGeometry args={[0.23, 16, 12]} />
          <meshStandardMaterial color={hairColor} />
        </mesh>
        <mesh position={[-0.42, 3.48, 0]} scale={[1, 1.25, 1]}>
          <sphereGeometry args={[0.23, 16, 12]} />
          <meshStandardMaterial color={hairColor} />
        </mesh>
        <mesh position={[0, 3.78, -0.03]}>
          <sphereGeometry args={[0.24, 16, 12]} />
          <meshStandardMaterial color={hairColor} />
        </mesh>

        {/* Hat */}
        <mesh ref={hatRef} position={[0, 4.18, 0]}>
          <coneGeometry args={[0.36, 0.75, 18]} />
          <meshStandardMaterial color={accentColor} />
        </mesh>
        <mesh position={[0, 3.82, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.34, 0.05, 8, 24]} />
          <meshStandardMaterial color={trimColor} roughness={0.5} />
        </mesh>
      </group>
    </RigidBody>
  );
}
