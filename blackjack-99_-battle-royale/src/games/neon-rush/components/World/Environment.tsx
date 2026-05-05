/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore } from '../../store';
import { LANE_WIDTH } from '../../types';

const STAR_COUNT = 900;
const DUST_COUNT = 180;
const RUNWAY_SEGMENTS = 32;

const NebulaCloud: React.FC<{ position: [number, number, number]; color: string; scale: [number, number, number] }> = ({
  position,
  color,
  scale,
}) => (
  <mesh position={position} scale={scale} rotation={[0.2, 0.3, -0.18]}>
    <sphereGeometry args={[1, 32, 16]} />
    <meshBasicMaterial color={color} transparent opacity={0.13} depthWrite={false} blending={THREE.AdditiveBlending} />
  </mesh>
);

const StarField: React.FC = () => {
  const speed = useStore((state) => state.speed);
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const stars = useMemo(
    () =>
      Array.from({ length: STAR_COUNT }, () => {
        const radius = 35 + Math.random() * 105;
        const theta = Math.random() * Math.PI * 2;
        return {
          x: Math.cos(theta) * radius,
          y: -5 + Math.random() * 70,
          z: -260 + Math.random() * 340,
          scale: 0.035 + Math.random() * 0.14,
          twinkle: Math.random() * Math.PI * 2,
        };
      }),
    [],
  );

  useFrame((state, delta) => {
    if (!meshRef.current) return;
    const drift = (speed * 0.22 + 3.5) * delta;

    stars.forEach((star, index) => {
      star.z += drift;
      if (star.z > 35) {
        star.z = -270 - Math.random() * 60;
      }

      const pulse = 0.72 + Math.sin(state.clock.elapsedTime * 1.9 + star.twinkle) * 0.28;
      dummy.position.set(star.x, star.y, star.z);
      dummy.scale.setScalar(star.scale * pulse);
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(index, dummy.matrix);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, STAR_COUNT]}>
      <sphereGeometry args={[1, 6, 6]} />
      <meshBasicMaterial color="#e0f7ff" toneMapped={false} />
    </instancedMesh>
  );
};

const SpaceDust: React.FC = () => {
  const speed = useStore((state) => state.speed);
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const dust = useMemo(
    () =>
      Array.from({ length: DUST_COUNT }, () => ({
        x: -14 + Math.random() * 28,
        y: 1 + Math.random() * 9,
        z: -150 + Math.random() * 170,
        scale: 0.025 + Math.random() * 0.08,
      })),
    [],
  );

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    const drift = (speed * 1.25 + 12) * delta;

    dust.forEach((speck, index) => {
      speck.z += drift;
      if (speck.z > 12) {
        speck.z = -160 - Math.random() * 50;
        speck.x = -14 + Math.random() * 28;
        speck.y = 1 + Math.random() * 9;
      }

      dummy.position.set(speck.x, speck.y, speck.z);
      dummy.scale.setScalar(speck.scale);
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(index, dummy.matrix);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, DUST_COUNT]}>
      <sphereGeometry args={[1, 6, 6]} />
      <meshBasicMaterial color="#67e8f9" transparent opacity={0.58} toneMapped={false} />
    </instancedMesh>
  );
};

const PlanetSet: React.FC = () => {
  const ringsRef = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (ringsRef.current) ringsRef.current.rotation.z += delta * 0.06;
  });

  return (
    <group>
      <group position={[-34, 26, -145]}>
        <mesh>
          <sphereGeometry args={[8.5, 48, 32]} />
          <meshStandardMaterial color="#7c3aed" emissive="#312e81" emissiveIntensity={0.22} roughness={0.85} />
        </mesh>
        <mesh ref={ringsRef} rotation={[1.22, 0.05, 0.42]}>
          <torusGeometry args={[11.5, 0.18, 12, 96]} />
          <meshBasicMaterial color="#67e8f9" transparent opacity={0.44} toneMapped={false} />
        </mesh>
      </group>

      <mesh position={[39, 20, -210]}>
        <sphereGeometry args={[5.4, 36, 24]} />
        <meshStandardMaterial color="#f59e0b" emissive="#7c2d12" emissiveIntensity={0.18} roughness={0.7} />
      </mesh>

      <mesh position={[22, 42, -260]}>
        <sphereGeometry args={[3, 24, 16]} />
        <meshStandardMaterial color="#22d3ee" emissive="#155e75" emissiveIntensity={0.25} roughness={0.5} />
      </mesh>
    </group>
  );
};

const Runway: React.FC = () => {
  const { laneCount, speed } = useStore();
  const platformWidth = laneCount * LANE_WIDTH + 1.2;
  const segmentRefs = useRef<THREE.Group[]>([]);
  const edgeRefs = useRef<THREE.Mesh[]>([]);
  const segmentLength = 10;

  const separators = useMemo(() => {
    const lines: number[] = [];
    const startX = -(laneCount * LANE_WIDTH) / 2;

    for (let i = 0; i <= laneCount; i++) {
      lines.push(startX + i * LANE_WIDTH);
    }
    return lines;
  }, [laneCount]);

  useFrame((state, delta) => {
    const drift = speed * delta;
    segmentRefs.current.forEach((segment, index) => {
      segment.position.z += drift;
      if (segment.position.z > 18) {
        segment.position.z -= RUNWAY_SEGMENTS * segmentLength;
      }
      segment.position.y = Math.sin(state.clock.elapsedTime * 1.4 + index * 0.37) * 0.015;
    });

    edgeRefs.current.forEach((edge, index) => {
      const material = edge.material as THREE.MeshStandardMaterial;
      material.emissiveIntensity = 0.85 + Math.sin(state.clock.elapsedTime * 4 + index) * 0.24;
    });
  });

  return (
    <group>
      {Array.from({ length: RUNWAY_SEGMENTS }).map((_, index) => (
        <group
          key={index}
          ref={(node) => {
            if (node) segmentRefs.current[index] = node;
          }}
          position={[0, 0, -index * segmentLength + 8]}
        >
          <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[platformWidth, segmentLength - 0.08]} />
            <meshStandardMaterial color="#0b1120" roughness={0.48} metalness={0.55} />
          </mesh>

          <mesh position={[0, 0.018, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[platformWidth - 0.5, 0.08]} />
            <meshBasicMaterial color={index % 2 === 0 ? '#22d3ee' : '#a78bfa'} transparent opacity={0.42} toneMapped={false} />
          </mesh>

          <mesh
            ref={(node) => {
              if (node) edgeRefs.current[index * 2] = node;
            }}
            position={[-platformWidth / 2, 0.12, 0]}
          >
            <boxGeometry args={[0.12, 0.16, segmentLength - 0.25]} />
            <meshStandardMaterial color="#164e63" emissive="#22d3ee" emissiveIntensity={1.1} roughness={0.35} metalness={0.7} />
          </mesh>
          <mesh
            ref={(node) => {
              if (node) edgeRefs.current[index * 2 + 1] = node;
            }}
            position={[platformWidth / 2, 0.12, 0]}
          >
            <boxGeometry args={[0.12, 0.16, segmentLength - 0.25]} />
            <meshStandardMaterial color="#164e63" emissive="#22d3ee" emissiveIntensity={1.1} roughness={0.35} metalness={0.7} />
          </mesh>

          {separators.map((x, lineIndex) => (
            <mesh key={`${index}-${lineIndex}`} position={[x, 0.025, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[0.055, segmentLength - 1.4]} />
              <meshBasicMaterial color="#60a5fa" transparent opacity={0.5} toneMapped={false} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
};

export const Environment: React.FC = () => {
  return (
    <>
      <color attach="background" args={['#020617']} />
      <fog attach="fog" args={['#020617', 65, 240]} />

      <ambientLight intensity={0.55} color="#c4b5fd" />
      <directionalLight position={[18, 28, 12]} intensity={1.25} color="#e0f2fe" castShadow />
      <pointLight position={[-7, 7, 6]} intensity={1.4} color="#22d3ee" distance={35} />
      <pointLight position={[7, 5, -20]} intensity={1.15} color="#f472b6" distance={42} />

      <NebulaCloud position={[-44, 25, -180]} color="#7c3aed" scale={[19, 8, 7]} />
      <NebulaCloud position={[40, 18, -150]} color="#0891b2" scale={[14, 6, 5]} />
      <NebulaCloud position={[0, 36, -230]} color="#db2777" scale={[24, 8, 8]} />
      <PlanetSet />
      <StarField />
      <SpaceDust />
      <Runway />
    </>
  );
};
