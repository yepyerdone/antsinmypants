/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { CuboidCollider, RapierRigidBody, RigidBody } from '@react-three/rapier';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useGameStore } from '../store';

const CAR_ROUTE = [
  new THREE.Vector3(-74, 1, -74),
  new THREE.Vector3(74, 1, -74),
  new THREE.Vector3(74, 1, 74),
  new THREE.Vector3(-74, 1, 74),
];

const CAR_SPEED = 12;
const CLOWN_DROP_MS = 3000;

type SpawnAnimation = {
  id: string;
  startedAt: number;
  position: THREE.Vector3;
  angle: number;
};

function getRoutePosition(distance: number) {
  const segments = CAR_ROUTE.map((point, index) => {
    const next = CAR_ROUTE[(index + 1) % CAR_ROUTE.length];
    return point.distanceTo(next);
  });
  const totalLength = segments.reduce((total, length) => total + length, 0);
  let remaining = ((distance % totalLength) + totalLength) % totalLength;

  for (let index = 0; index < CAR_ROUTE.length; index += 1) {
    const start = CAR_ROUTE[index];
    const end = CAR_ROUTE[(index + 1) % CAR_ROUTE.length];
    const length = segments[index];
    if (remaining <= length) {
      const t = remaining / length;
      const position = start.clone().lerp(end, t);
      const direction = end.clone().sub(start).normalize();
      return {
        position,
        angle: Math.atan2(direction.x, direction.z),
      };
    }
    remaining -= length;
  }

  return { position: CAR_ROUTE[0].clone(), angle: 0 };
}

function offsetPosition(base: THREE.Vector3, angle: number, localX: number, localZ: number) {
  const right = new THREE.Vector3(Math.cos(angle), 0, -Math.sin(angle));
  const forward = new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle));
  return base.clone().add(right.multiplyScalar(localX)).add(forward.multiplyScalar(localZ));
}

export function BossCar() {
  const bossCar = useGameStore(state => state.bossCar);
  const spawnBossClown = useGameStore(state => state.spawnBossClown);
  const addParticles = useGameStore(state => state.addParticles);
  const carRef = useRef<THREE.Group>(null);
  const bodyCollider = useRef<RapierRigidBody>(null);
  const frontCollider = useRef<RapierRigidBody>(null);
  const tireColliders = useRef<Record<string, RapierRigidBody | null>>({});
  const distanceRef = useRef(0);
  const lastDropRef = useRef(Date.now());
  const [spawnAnimations, setSpawnAnimations] = useState<SpawnAnimation[]>([]);

  const damageRatio = Math.min(1, bossCar.totalHits / 10);
  const smokePuffs = useMemo(() => Array.from({ length: 10 }, (_, index) => index), []);

  useFrame((state, delta) => {
    if (!bossCar.active || bossCar.destroyed) return;

    distanceRef.current += delta * CAR_SPEED;
    const { position, angle } = getRoutePosition(distanceRef.current);

    if (carRef.current) {
      carRef.current.position.copy(position);
      carRef.current.rotation.y = angle;
      carRef.current.position.y = 1 + Math.sin(state.clock.elapsedTime * 5) * 0.04;
    }

    bodyCollider.current?.setNextKinematicTranslation({ x: position.x, y: 1.4, z: position.z });
    frontCollider.current?.setNextKinematicTranslation(offsetPosition(position, angle, 0, 3.35));

    const tireOffsets: Record<string, [number, number]> = {
      'tire-fl': [-1.85, 2.25],
      'tire-fr': [1.85, 2.25],
      'tire-rl': [-1.85, -2.25],
      'tire-rr': [1.85, -2.25],
    };
    Object.entries(tireOffsets).forEach(([zone, [x, z]]) => {
      const tirePosition = offsetPosition(position, angle, x, z);
      tireColliders.current[zone]?.setNextKinematicTranslation({ x: tirePosition.x, y: 0.9, z: tirePosition.z });
    });

    const now = Date.now();
    if (now - lastDropRef.current >= CLOWN_DROP_MS) {
      lastDropRef.current = now;
      const exitPosition = offsetPosition(position, angle, -2.9, -0.5);
      const spawnPosition = offsetPosition(position, angle, -6.5, -1.8);
      spawnBossClown([spawnPosition.x, 1, spawnPosition.z]);
      addParticles([exitPosition.x, 1.6, exitPosition.z], '#facc15');
      setSpawnAnimations((animations) => [
        ...animations.filter(animation => now - animation.startedAt < 1600),
        { id: `${now}`, startedAt: now, position: exitPosition, angle },
      ]);
    }

    setSpawnAnimations((animations) => animations.filter(animation => now - animation.startedAt < 1700));
  });

  if (!bossCar.active || bossCar.destroyed) return null;

  return (
    <group>
      <group ref={carRef}>
        <mesh castShadow position={[0, 1.1, 0]}>
          <boxGeometry args={[4.4, 1.7, 6.4]} />
          <meshStandardMaterial color="#ef4444" roughness={0.55} metalness={0.15} />
        </mesh>
        <mesh castShadow position={[0, 2.15, -0.35]}>
          <boxGeometry args={[3.5, 1.35, 3.2]} />
          <meshStandardMaterial color="#facc15" roughness={0.5} />
        </mesh>
        <mesh position={[0, 2.18, 1.35]}>
          <boxGeometry args={[3.65, 1.05, 0.12]} />
          <meshBasicMaterial color="#38bdf8" transparent opacity={0.72} />
        </mesh>
        <mesh position={[0, 1.3, 3.35]}>
          <boxGeometry args={[3.2, 1.05, 0.22]} />
          <meshStandardMaterial color="#f97316" emissive="#7c2d12" emissiveIntensity={0.25} />
        </mesh>
        <mesh position={[0, 3.05, -0.25]} rotation={[0, 0, Math.PI / 4]}>
          <coneGeometry args={[0.9, 1.45, 4]} />
          <meshStandardMaterial color="#7c3aed" roughness={0.7} />
        </mesh>
        {[
          [-2.25, 0.55, 2.25],
          [2.25, 0.55, 2.25],
          [-2.25, 0.55, -2.25],
          [2.25, 0.55, -2.25],
        ].map(([x, y, z], index) => (
          <mesh key={index} castShadow position={[x, y, z]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.62, 0.62, 0.55, 20]} />
            <meshStandardMaterial color="#111827" roughness={0.85} />
          </mesh>
        ))}
        <group position={[-2.28, 1.35, -0.45]}>
          <mesh rotation={[0, damageRatio > 0.85 ? -1.15 : -0.45 - damageRatio * 0.55, 0]}>
            <boxGeometry args={[0.12, 1.35, 1.65]} />
            <meshStandardMaterial color="#fbbf24" roughness={0.55} />
          </mesh>
        </group>
        {smokePuffs.slice(0, Math.ceil(damageRatio * smokePuffs.length)).map((index) => {
          const t = (Date.now() / 600 + index * 0.31) % 1;
          return (
            <mesh key={index} position={[(index % 3 - 1) * 0.45, 2.8 + t * 2.1, 2.1 - (index % 2) * 0.55]} scale={0.45 + t * 0.75}>
              <sphereGeometry args={[0.42, 10, 8]} />
              <meshBasicMaterial color={damageRatio > 0.7 ? '#1f2937' : '#9ca3af'} transparent opacity={(0.35 + damageRatio * 0.35) * (1 - t)} />
            </mesh>
          );
        })}
      </group>

      {spawnAnimations.map(animation => (
        <ExitingClown key={animation.id} animation={animation} />
      ))}

      <RigidBody ref={bodyCollider} type="kinematicPosition" colliders={false} userData={{ name: 'boss-car-body' }}>
        <CuboidCollider args={[2.35, 1.3, 3.3]} />
      </RigidBody>
      <RigidBody ref={frontCollider} type="kinematicPosition" colliders={false} userData={{ name: 'boss-car-front' }}>
        <CuboidCollider args={[1.85, 0.8, 0.4]} />
      </RigidBody>
      {(['tire-fl', 'tire-fr', 'tire-rl', 'tire-rr'] as const).map(zone => (
        <RigidBody
          key={zone}
          ref={(body) => {
            tireColliders.current[zone] = body;
          }}
          type="kinematicPosition"
          colliders={false}
          userData={{ name: `boss-car-${zone}` }}
        >
          <CuboidCollider args={[0.75, 0.8, 0.75]} />
        </RigidBody>
      ))}
    </group>
  );
}

function ExitingClown({ animation }: { animation: SpawnAnimation }) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (!groupRef.current) return;
    const t = Math.min(1, (Date.now() - animation.startedAt) / 1400);
    const side = new THREE.Vector3(Math.cos(animation.angle), 0, -Math.sin(animation.angle));
    groupRef.current.position.copy(animation.position.clone().add(side.multiplyScalar(-t * 4)));
    groupRef.current.position.y = 0.55 + Math.sin(t * Math.PI) * 0.25;
    groupRef.current.rotation.y = animation.angle + Math.PI / 2;
    groupRef.current.rotation.z = Math.sin(t * Math.PI * 5) * 0.16;
  });

  return (
    <group ref={groupRef}>
      <mesh castShadow position={[0, 0.85, 0]}>
        <capsuleGeometry args={[0.28, 1.05, 8, 12]} />
        <meshStandardMaterial color="#7dd3fc" roughness={0.75} />
      </mesh>
      <mesh castShadow position={[0, 1.75, 0]}>
        <sphereGeometry args={[0.32, 16, 10]} />
        <meshStandardMaterial color="#fde68a" roughness={0.65} />
      </mesh>
      <mesh position={[0, 1.76, 0.28]}>
        <sphereGeometry args={[0.1, 12, 8]} />
        <meshStandardMaterial color="#ef4444" roughness={0.4} />
      </mesh>
      <mesh position={[-0.16, 1.85, 0.28]}>
        <sphereGeometry args={[0.045, 8, 6]} />
        <meshBasicMaterial color="#111827" />
      </mesh>
      <mesh position={[0.16, 1.85, 0.28]}>
        <sphereGeometry args={[0.045, 8, 6]} />
        <meshBasicMaterial color="#111827" />
      </mesh>
    </group>
  );
}
