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
    <meshBasicMaterial color={color} transparent opacity={0.2} depthWrite={false} blending={THREE.AdditiveBlending} />
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
      <meshBasicMaterial color="#bae6fd" transparent opacity={0.72} toneMapped={false} />
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
          <meshStandardMaterial color="#8b5cf6" emissive="#4338ca" emissiveIntensity={0.4} roughness={0.78} />
        </mesh>
        <mesh ref={ringsRef} rotation={[1.22, 0.05, 0.42]}>
          <torusGeometry args={[11.5, 0.18, 12, 96]} />
          <meshBasicMaterial color="#67e8f9" transparent opacity={0.44} toneMapped={false} />
        </mesh>
      </group>

      <mesh position={[39, 20, -210]}>
        <sphereGeometry args={[5.4, 36, 24]} />
        <meshStandardMaterial color="#fbbf24" emissive="#b45309" emissiveIntensity={0.34} roughness={0.66} />
      </mesh>

      <mesh position={[22, 42, -260]}>
        <sphereGeometry args={[3, 24, 16]} />
        <meshStandardMaterial color="#67e8f9" emissive="#0891b2" emissiveIntensity={0.42} roughness={0.46} />
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
            <meshStandardMaterial color="#1e3a8a" emissive="#1d4ed8" emissiveIntensity={0.38} roughness={0.4} metalness={0.42} />
          </mesh>

          <mesh position={[0, 0.018, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[platformWidth - 0.5, 0.08]} />
            <meshBasicMaterial color={index % 2 === 0 ? '#22d3ee' : '#f472b6'} transparent opacity={0.68} toneMapped={false} />
          </mesh>

          <mesh position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[platformWidth - 0.3, segmentLength - 0.28]} />
            <meshBasicMaterial
              color={index % 2 === 0 ? '#1d4ed8' : '#7c3aed'}
              transparent
              opacity={0.11}
              toneMapped={false}
            />
          </mesh>

          <mesh
            ref={(node) => {
              if (node) edgeRefs.current[index * 2] = node;
            }}
            position={[-platformWidth / 2, 0.12, 0]}
          >
            <boxGeometry args={[0.12, 0.16, segmentLength - 0.25]} />
            <meshStandardMaterial color="#0f766e" emissive="#22d3ee" emissiveIntensity={1.35} roughness={0.32} metalness={0.68} />
          </mesh>
          <mesh
            ref={(node) => {
              if (node) edgeRefs.current[index * 2 + 1] = node;
            }}
            position={[platformWidth / 2, 0.12, 0]}
          >
            <boxGeometry args={[0.12, 0.16, segmentLength - 0.25]} />
            <meshStandardMaterial color="#0f766e" emissive="#22d3ee" emissiveIntensity={1.35} roughness={0.32} metalness={0.68} />
          </mesh>

          {separators.map((x, lineIndex) => (
            <mesh key={`${index}-${lineIndex}`} position={[x, 0.025, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[0.055, segmentLength - 1.4]} />
              <meshBasicMaterial color={lineIndex % 2 === 0 ? '#7dd3fc' : '#f9a8d4'} transparent opacity={0.72} toneMapped={false} />
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
      <color attach="background" args={['#0b1f43']} />
      <fog attach="fog" args={['#0b1f43', 84, 260]} />

      <ambientLight intensity={0.82} color="#dbeafe" />
      <hemisphereLight args={['#93c5fd', '#f9a8d4', 0.62]} />
      <directionalLight position={[18, 28, 12]} intensity={1.55} color="#f8fafc" castShadow />
      <pointLight position={[-7, 7, 6]} intensity={1.8} color="#22d3ee" distance={38} />
      <pointLight position={[7, 5, -20]} intensity={1.55} color="#f472b6" distance={46} />
      <pointLight position={[0, 10, -52]} intensity={1.2} color="#facc15" distance={58} />

      <NebulaCloud position={[-44, 25, -180]} color="#8b5cf6" scale={[19, 8, 7]} />
      <NebulaCloud position={[40, 18, -150]} color="#06b6d4" scale={[14, 6, 5]} />
      <NebulaCloud position={[0, 36, -230]} color="#ec4899" scale={[24, 8, 8]} />
      <PlanetSet />
      <StarField />
      <SpaceDust />
      <Runway />
    </>
  );
};
