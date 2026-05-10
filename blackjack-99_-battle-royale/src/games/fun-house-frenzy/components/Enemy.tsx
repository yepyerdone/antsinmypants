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

export function Enemy({ data }: { data: EnemyData }) {
  const body = useRef<RapierRigidBody>(null);
  const { camera } = useThree();
  
  const gameState = useGameStore(state => state.gameState);
  const playerState = useGameStore(state => state.playerState);
  const hitPlayer = useGameStore(state => state.hitPlayer);
  const addParticles = useGameStore(state => state.addParticles);

  const lastMeleeTime = useRef(0);
  const patrolTarget = useRef(new THREE.Vector3());
  const lastPatrolChange = useRef(0);
  const state = useRef<'patrol' | 'chase'>('patrol');

  const groupRef = useRef<THREE.Group>(null);

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
    
    let closestTargetPos: THREE.Vector3 | null = null;
    let closestDist = CHASE_DIST;

    // Check player
    if (playerState === 'active') {
      const playerPos = camera.position.clone();
      playerPos.y = pos.y; // Ignore height difference for distance
      const distToPlayer = currentPos.distanceTo(playerPos);
      // Enemies will always chase the player if within range, no more bot-on-bot violence
      if (distToPlayer < CHASE_DIST * 2) { // Increased detection range
        closestDist = distToPlayer;
        closestTargetPos = playerPos;
      }
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
      const now = Date.now();
      if (closestDist < MELEE_DIST && now - lastMeleeTime.current > MELEE_COOLDOWN) {
        hitPlayer();
        addParticles([camera.position.x, camera.position.y, camera.position.z], '#ff0000');
        lastMeleeTime.current = now;
      }
    } else {
      // Patrol
      const now = Date.now();
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

    // Apply movement
    const velocity = body.current.linvel();
    body.current.setLinvel({
      x: direction.x * ENEMY_SPEED,
      y: velocity.y,
      z: direction.z * ENEMY_SPEED
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

      const runBob = Math.sin(state_fiber.clock.elapsedTime * 9) * 0.08;
      groupRef.current.position.y = runBob;
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
        <mesh castShadow position={[-0.28, 0.18, 0.12]} scale={[1.45, 0.55, 1.8]}>
          <sphereGeometry args={[0.2, 16, 10]} />
          <meshStandardMaterial color="#111111" roughness={0.9} />
        </mesh>
        <mesh castShadow position={[0.28, 0.18, 0.12]} scale={[1.45, 0.55, 1.8]}>
          <sphereGeometry args={[0.2, 16, 10]} />
          <meshStandardMaterial color="#111111" roughness={0.9} />
        </mesh>

        {/* Legs */}
        <mesh castShadow position={[-0.22, 0.85, 0]} rotation={[0, 0, 0.08]}>
          <capsuleGeometry args={[0.16, 1.1, 8, 12]} />
          <meshStandardMaterial color={accentColor} roughness={0.75} />
        </mesh>
        <mesh castShadow position={[0.22, 0.85, 0]} rotation={[0, 0, -0.08]}>
          <capsuleGeometry args={[0.16, 1.1, 8, 12]} />
          <meshStandardMaterial color={color} roughness={0.8} />
        </mesh>

        {/* Tall striped torso */}
        <mesh castShadow position={[0, 2.0, 0]}>
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
        <mesh castShadow position={[-0.72, 2.15, 0]} rotation={[0.25, 0, 0.55]}>
          <capsuleGeometry args={[0.13, 1.15, 8, 12]} />
          <meshStandardMaterial color={accentColor} roughness={0.7} />
        </mesh>
        <mesh castShadow position={[0.72, 2.15, 0]} rotation={[0.25, 0, -0.55]}>
          <capsuleGeometry args={[0.13, 1.15, 8, 12]} />
          <meshStandardMaterial color="#ffd700" roughness={0.7} />
        </mesh>
        <mesh castShadow position={[-1.05, 1.55, 0.12]}>
          <sphereGeometry args={[0.18, 16, 12]} />
          <meshStandardMaterial color="#ffffff" roughness={0.55} />
        </mesh>
        <mesh castShadow position={[1.05, 1.55, 0.12]}>
          <sphereGeometry args={[0.18, 16, 12]} />
          <meshStandardMaterial color="#ffffff" roughness={0.55} />
        </mesh>

        {/* Head and face */}
        <mesh castShadow position={[0, 3.35, 0]}>
          <sphereGeometry args={[0.46, 24, 18]} />
          <meshStandardMaterial color="#fff2df" roughness={0.65} />
        </mesh>
        
        <mesh position={[0, 3.32, 0.43]}>
          <sphereGeometry args={[0.15, 16, 16]} />
          <meshStandardMaterial color={accentColor} roughness={0.2} />
        </mesh>
        <mesh position={[-0.16, 3.45, 0.4]}>
          <sphereGeometry args={[0.055, 12, 8]} />
          <meshStandardMaterial color="#050505" roughness={0.35} />
        </mesh>
        <mesh position={[0.16, 3.45, 0.4]}>
          <sphereGeometry args={[0.055, 12, 8]} />
          <meshStandardMaterial color="#050505" roughness={0.35} />
        </mesh>
        <mesh position={[-0.16, 3.55, 0.41]} rotation={[0, 0, -0.25]}>
          <boxGeometry args={[0.18, 0.035, 0.025]} />
          <meshStandardMaterial color="#0000ff" roughness={0.5} />
        </mesh>
        <mesh position={[0.16, 3.55, 0.41]} rotation={[0, 0, 0.25]}>
          <boxGeometry args={[0.18, 0.035, 0.025]} />
          <meshStandardMaterial color="#0000ff" roughness={0.5} />
        </mesh>
        <mesh position={[0, 3.16, 0.42]} rotation={[0, 0, 0]}>
          <torusGeometry args={[0.18, 0.025, 8, 24, Math.PI]} />
          <meshStandardMaterial color="#ff0000" roughness={0.35} />
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
        <mesh position={[0, 4.18, 0]}>
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
