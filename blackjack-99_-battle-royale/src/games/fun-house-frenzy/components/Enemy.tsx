/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { RigidBody, RapierRigidBody, CapsuleCollider } from '@react-three/rapier';
import * as THREE from 'three';
import { useGameStore, EnemyData } from '../store';

const ENEMY_SPEED = 5;
const CHASE_DIST = 120;
const MELEE_DIST = 2.4;
const MELEE_COOLDOWN = 1400;
const FINAL_CLOWN_SPEED = 7.5;
const FINAL_CLOWN_REPOSITION_DISTANCE = 62;
const FINAL_CLOWN_STUCK_TIME = 2600;

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
      finalClownPressure &&
      closestTargetPos &&
      closestDist > FINAL_CLOWN_REPOSITION_DISTANCE &&
      now - lastProgressTime.current > FINAL_CLOWN_STUCK_TIME
    ) {
      const angle = Math.random() * Math.PI * 2;
      const distance = 34 + Math.random() * 10;
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

    if (state.current === 'chase' && closestTargetPos) {
      direction.subVectors(closestTargetPos, currentPos).normalize();
      
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

  const color = data.state === 'disabled' ? '#444' : '#ffffff';
  const accentColor = data.state === 'disabled' ? '#222' : '#ff0000';
  const hairColor = data.state === 'disabled' ? '#111' : '#0000ff';

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
      <group ref={groupRef} position={[0, 0, 0]}>
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
          <meshStandardMaterial color="#ffd700" roughness={0.75} />
        </mesh>

        {/* Ruffled collar and buttons */}
        <mesh position={[0, 2.95, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.55, 0.08, 8, 24]} />
          <meshStandardMaterial color="#ffd700" roughness={0.6} />
        </mesh>
        {[1.6, 2.0, 2.4].map((y) => (
          <mesh key={y} position={[0, y, 0.52]}>
            <sphereGeometry args={[0.07, 12, 8]} />
            <meshStandardMaterial color="#0000ff" roughness={0.4} />
          </mesh>
        ))}

        {/* Long arms and gloves */}
        <mesh ref={leftArmRef} castShadow position={[-0.72, 2.15, 0]} rotation={[0.25, 0, 0.55]}>
          <capsuleGeometry args={[0.13, 1.15, 8, 12]} />
          <meshStandardMaterial color={accentColor} roughness={0.7} />
        </mesh>
        <mesh ref={rightArmRef} castShadow position={[0.72, 2.15, 0]} rotation={[0.25, 0, -0.55]}>
          <capsuleGeometry args={[0.13, 1.15, 8, 12]} />
          <meshStandardMaterial color="#ffd700" roughness={0.7} />
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
        <mesh ref={headRef} castShadow position={[0, 3.35, 0]}>
          <sphereGeometry args={[0.46, 24, 18]} />
          <meshStandardMaterial color="#fff2df" roughness={0.65} />
        </mesh>
        
        <mesh ref={noseRef} position={[0, 3.32, 0.43]}>
          <sphereGeometry args={[0.15, 16, 16]} />
          <meshStandardMaterial color={accentColor} roughness={0.2} />
        </mesh>
        <mesh ref={leftEyeRef} position={[-0.16, 3.45, 0.4]}>
          <sphereGeometry args={[0.055, 12, 8]} />
          <meshStandardMaterial color="#050505" roughness={0.35} />
        </mesh>
        <mesh ref={rightEyeRef} position={[0.16, 3.45, 0.4]}>
          <sphereGeometry args={[0.055, 12, 8]} />
          <meshStandardMaterial color="#050505" roughness={0.35} />
        </mesh>
        <mesh ref={leftBrowRef} position={[-0.16, 3.55, 0.41]} rotation={[0, 0, -0.25]}>
          <boxGeometry args={[0.18, 0.035, 0.025]} />
          <meshStandardMaterial color="#0000ff" roughness={0.5} />
        </mesh>
        <mesh ref={rightBrowRef} position={[0.16, 3.55, 0.41]} rotation={[0, 0, 0.25]}>
          <boxGeometry args={[0.18, 0.035, 0.025]} />
          <meshStandardMaterial color="#0000ff" roughness={0.5} />
        </mesh>
        <mesh ref={mouthRef} position={[0, 3.16, 0.42]} rotation={[0, 0, 0]}>
          <torusGeometry args={[0.18, 0.025, 8, 24, Math.PI]} />
          <meshStandardMaterial color="#ff0000" roughness={0.35} />
        </mesh>
        <mesh position={[-0.16, 3.2, 0.45]} scale={[1.35, 0.8, 0.35]}>
          <sphereGeometry args={[0.07, 12, 8]} />
          <meshStandardMaterial color="#ff9fb3" roughness={0.45} />
        </mesh>
        <mesh position={[0.16, 3.2, 0.45]} scale={[1.35, 0.8, 0.35]}>
          <sphereGeometry args={[0.07, 12, 8]} />
          <meshStandardMaterial color="#ff9fb3" roughness={0.45} />
        </mesh>
        <mesh position={[0, 3.08, 0.43]}>
          <boxGeometry args={[0.18, 0.05, 0.02]} />
          <meshStandardMaterial color="#ffffff" roughness={0.3} />
        </mesh>

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
          <meshStandardMaterial color="#ffd700" roughness={0.5} />
        </mesh>
      </group>
    </RigidBody>
  );
}
