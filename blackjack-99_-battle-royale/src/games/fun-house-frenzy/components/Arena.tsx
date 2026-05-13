/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { RigidBody, CuboidCollider } from '@react-three/rapier';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import { useMemo, useRef, useState, useEffect } from 'react';
import * as THREE from 'three';
import { useGameStore } from '../store';

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    const uaMatch = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
    return uaMatch || coarsePointer || window.innerWidth < 768;
  });

  useEffect(() => {
    const check = () => {
      const uaMatch = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
      setIsMobile(uaMatch || coarsePointer || window.innerWidth < 768);
    };
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  return isMobile;
}

// Seeded PRNG for consistent multiplayer obstacle generation
function mulberry32(a: number) {
  return function() {
    var t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}
const rng = mulberry32(12345);

const OBSTACLES = Array.from({ length: 150 }).map(() => {
  const type = 'box';
  const x = (rng() - 0.5) * 170; // Avoid edges
  const z = (rng() - 0.5) * 170;
  
  // Keep center somewhat clear
  if (Math.abs(x) < 20 && Math.abs(z) < 20) return null;

  const height = rng() * 8 + 6;
  const isHorizontal = rng() > 0.5;
  const width = isHorizontal ? rng() * 25 + 10 : rng() * 3 + 1;
  const depth = isHorizontal ? rng() * 3 + 1 : rng() * 25 + 10;
  const rotation = 0; // Axis aligned for maze feel
  // Circus palette: Red, Yellow, Blue, White
  const colors = ["#ff0000", "#ffd700", "#0000ff", "#ffffff"];
  const color = colors[Math.floor(rng() * colors.length)];

  return { type, position: [x, height / 2 - 0.5, z], size: [width, height, depth], rotation: [0, rotation, 0], color };
}).filter(Boolean);

const CEILING_LIGHTS = [
  [-60, 18.1, -60],
  [0, 18.1, -60],
  [60, 18.1, -60],
  [-60, 18.1, 0],
  [0, 18.1, 0],
  [60, 18.1, 0],
  [-60, 18.1, 60],
  [0, 18.1, 60],
  [60, 18.1, 60],
] as const;

const TUNNEL_CENTER: [number, number, number] = [0, 0, 30];
const TUNNEL_HALF_LENGTH = 30;
const TUNNEL_HALF_WIDTH = 7.5;
const CONCESSIONS_CENTER: [number, number, number] = [52, 0, -91];

function isInsideTunnelFootprint(x: number, z: number) {
  return Math.abs(x - TUNNEL_CENTER[0]) < TUNNEL_HALF_LENGTH + 7
    && Math.abs(z - TUNNEL_CENTER[2]) < TUNNEL_HALF_WIDTH + 7;
}

function isInsideConcessionsFootprint(x: number, z: number) {
  return Math.abs(x - CONCESSIONS_CENTER[0]) < 24
    && Math.abs(z - CONCESSIONS_CENTER[2]) < 13;
}

export function Arena() {
  const isMobile = useIsMobile();
  const spawnDoorOpen = useGameStore(state => state.spawnDoorOpen);
  
  const obstacles = useMemo(() => {
    const count = isMobile ? 40 : 80;
    const rngLocal = mulberry32(12345);
    const colors = ["#ff0000", "#ffd700", "#0000ff", "#ffffff"];
    return Array.from({ length: count }).map(() => {
      const type = 'box';
      const x = (rngLocal() - 0.5) * 170;
      const z = (rngLocal() - 0.5) * 170;
      
      if (Math.abs(x) < 20 && Math.abs(z) < 20) return null;
      if (isInsideTunnelFootprint(x, z)) return null;
      if (isInsideConcessionsFootprint(x, z)) return null;

      const height = rngLocal() * 8 + 6;
      const isHorizontal = rngLocal() > 0.5;
      const width = isHorizontal ? rngLocal() * 25 + 10 : rngLocal() * 3 + 1;
      const depth = isHorizontal ? rngLocal() * 3 + 1 : rngLocal() * 25 + 10;
      const colors = ["#ff0000", "#ffd700", "#0000ff", "#ffffff"];
      const color = colors[Math.floor(rngLocal() * colors.length)];
      return { type, position: [x, height / 2 - 0.5, z], size: [width, height, depth], rotation: [0, 0, 0], color };
    }).filter((obs): obs is { type: string; position: number[]; size: number[]; rotation: number[]; color: string; } => !!obs);
  }, [isMobile]);

  const floorTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;
    const size = 128;
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        ctx.fillStyle = (i + j) % 2 === 0 ? '#ff0000' : '#ffffff';
        ctx.fillRect(i * size, j * size, size, size);
      }
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(10, 10);
    return texture;
  }, []);

  return (
    <group>
      {/* Floor */}
      <RigidBody type="fixed" name="floor" friction={0} colliders={false} position={[0, -5, 0]}>
        <mesh receiveShadow={!isMobile} position={[0, 4.5, 0]}>
          <boxGeometry args={[200, 1, 200]} />
          <meshStandardMaterial map={floorTexture} roughness={1} metalness={0} />
        </mesh>
        <CuboidCollider args={[100, 5, 100]} friction={0} />
      </RigidBody>

      <Ceiling isMobile={isMobile} />

      {/* Atmosphere */}
      {!isMobile && <AmbientParticles />}

      <SpawnRoom doorOpen={spawnDoorOpen} isMobile={isMobile} />
      <CheckeredTunnel isMobile={isMobile} />
      <ConcessionsStand isMobile={isMobile} />
      <Carousel isMobile={isMobile} />

      {/* Walls */}
      <Wall name="wall-n" position={[0, 5, -100]} rotation={[0, 0, 0]} isMobile={isMobile} />
      <Wall name="wall-s" position={[0, 5, 100]} rotation={[0, Math.PI, 0]} isMobile={isMobile} />
      <Wall name="wall-e" position={[100, 5, 0]} rotation={[0, -Math.PI / 2, 0]} isMobile={isMobile} />
      <Wall name="wall-w" position={[-100, 5, 0]} rotation={[0, Math.PI / 2, 0]} isMobile={isMobile} />

      {/* Obstacles */}
      {obstacles.map((obs, i) => {
        if (!obs) return null;
        return (
          <RigidBody 
            key={i} 
            type="fixed" 
            colliders="hull"
            name={`obstacle-${i}`}
            position={obs.position as [number, number, number]}
            rotation={obs.rotation as [number, number, number]}
          >
            <mesh receiveShadow={!isMobile} castShadow={!isMobile}>
              {obs.type === 'box' ? (
                <boxGeometry args={obs.size as [number, number, number]} />
              ) : (
                <cylinderGeometry args={[obs.size[0]/2, obs.size[0]/2, obs.size[1], 16]} />
              )}
              <meshStandardMaterial color={obs.color} roughness={0.8} metalness={0} />
              
              {/* Fun house trim */}
              <mesh position={[0, obs.size[1]/2 - 0.5, 0]}>
                {obs.type === 'box' ? (
                  <boxGeometry args={[obs.size[0] + 0.1, 0.2, obs.size[2] + 0.1]} />
                ) : (
                  <cylinderGeometry args={[obs.size[0]/2 + 0.1, obs.size[0]/2 + 0.1, 0.2, 16]} />
                )}
                <meshBasicMaterial color="#ffff00" toneMapped={false} />
              </mesh>
            </mesh>
          </RigidBody>
        );
      })}
    </group>
  );
}

function Carousel({ isMobile }: { isMobile: boolean }) {
  const carouselRef = useRef<THREE.Group>(null);
  const horseRefs = useRef<(THREE.Group | null)[]>([]);

  useFrame((state) => {
    if (carouselRef.current) {
      carouselRef.current.rotation.y = state.clock.elapsedTime * 0.38;
    }

    horseRefs.current.forEach((horse, index) => {
      if (!horse) return;
      horse.position.y = 1.75 + Math.sin(state.clock.elapsedTime * 2.6 + index * 1.4) * 0.42;
      horse.rotation.z = Math.sin(state.clock.elapsedTime * 2.6 + index) * 0.08;
    });
  });

  return (
    <group position={[-62, 0, 58]}>
      <RigidBody type="fixed" colliders={false} name="carousel-platform" position={[0, -0.12, 0]}>
        <CuboidCollider args={[9.6, 0.28, 9.6]} />
        <mesh receiveShadow={!isMobile} castShadow={!isMobile}>
          <cylinderGeometry args={[10.5, 10.5, 0.55, 64]} />
          <meshStandardMaterial color="#7f1d1d" roughness={0.65} metalness={0.06} />
        </mesh>
      </RigidBody>

      <group ref={carouselRef}>
        <mesh position={[0, 0.24, 0]} receiveShadow={!isMobile}>
          <cylinderGeometry args={[9.2, 9.2, 0.18, 64]} />
          <meshStandardMaterial color="#facc15" roughness={0.5} metalness={0.08} />
        </mesh>
        <mesh position={[0, 0.42, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[8.7, 0.16, 10, 72]} />
          <meshBasicMaterial color="#ffffff" toneMapped={false} />
        </mesh>
        <mesh position={[0, 6.4, 0]}>
          <cylinderGeometry args={[1.0, 1.0, 12.5, 32]} />
          <meshStandardMaterial color="#1d4ed8" roughness={0.42} metalness={0.18} />
        </mesh>
        <mesh position={[0, 12.9, 0]}>
          <coneGeometry args={[10.2, 4.3, 64]} />
          <meshStandardMaterial color="#dc2626" roughness={0.58} />
        </mesh>
        <mesh position={[0, 13.15, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[8.5, 0.2, 10, 72]} />
          <meshBasicMaterial color="#facc15" toneMapped={false} />
        </mesh>

        {Array.from({ length: 6 }, (_, index) => {
          const angle = (index / 6) * Math.PI * 2;
          const x = Math.cos(angle) * 5.9;
          const z = Math.sin(angle) * 5.9;
          const palette = index % 2 === 0
            ? { body: '#f8fafc', saddle: '#2563eb', mane: '#dc2626' }
            : { body: '#fde68a', saddle: '#dc2626', mane: '#1d4ed8' };

          return (
            <group key={index} position={[x, 0.5, z]} rotation={[0, -angle + Math.PI / 2, 0]}>
              <mesh position={[0, 5.6, 0]}>
                <cylinderGeometry args={[0.08, 0.08, 9.8, 10]} />
                <meshStandardMaterial color="#facc15" roughness={0.38} metalness={0.25} />
              </mesh>
              <group ref={(node) => { horseRefs.current[index] = node; }}>
                <mesh castShadow={!isMobile} position={[0, 0.95, 0]} scale={[1.65, 0.72, 0.55]}>
                  <sphereGeometry args={[0.55, 20, 14]} />
                  <meshStandardMaterial color={palette.body} roughness={0.52} />
                </mesh>
                <mesh castShadow={!isMobile} position={[0.82, 1.25, 0]} scale={[0.78, 0.62, 0.55]}>
                  <sphereGeometry args={[0.42, 18, 12]} />
                  <meshStandardMaterial color={palette.body} roughness={0.52} />
                </mesh>
                <mesh position={[0.94, 1.58, 0]} scale={[0.55, 0.42, 0.18]}>
                  <sphereGeometry args={[0.32, 12, 8]} />
                  <meshStandardMaterial color={palette.mane} roughness={0.55} />
                </mesh>
                <mesh position={[0.02, 1.43, 0]} scale={[0.95, 0.22, 0.7]}>
                  <boxGeometry args={[1, 1, 1]} />
                  <meshStandardMaterial color={palette.saddle} roughness={0.45} />
                </mesh>
                {[-0.55, -0.15, 0.35, 0.72].map((legX, legIndex) => (
                  <mesh key={legIndex} castShadow={!isMobile} position={[legX, 0.26, legIndex % 2 === 0 ? -0.22 : 0.22]} rotation={[legIndex % 2 === 0 ? 0.16 : -0.16, 0, 0]}>
                    <capsuleGeometry args={[0.08, 0.75, 6, 8]} />
                    <meshStandardMaterial color={palette.body} roughness={0.58} />
                  </mesh>
                ))}
                <mesh position={[-0.94, 1.12, 0]} rotation={[0, 0, -0.35]}>
                  <coneGeometry args={[0.13, 0.8, 10]} />
                  <meshStandardMaterial color={palette.mane} roughness={0.5} />
                </mesh>
              </group>
            </group>
          );
        })}
      </group>
    </group>
  );
}

function Ceiling({ isMobile }: { isMobile: boolean }) {
  return (
    <group>
      <RigidBody type="fixed" name="ceiling" colliders={false} position={[0, 20.2, 0]}>
        <CuboidCollider args={[100, 1, 100]} />
        <mesh receiveShadow={!isMobile}>
          <boxGeometry args={[200, 2, 200]} />
          <meshStandardMaterial color="#1f2937" roughness={0.92} metalness={0.02} />
        </mesh>
      </RigidBody>

      {[-75, -45, -15, 15, 45, 75].map((z) => (
        <mesh key={`beam-z-${z}`} position={[0, 18.85, z]} receiveShadow={!isMobile}>
          <boxGeometry args={[196, 0.7, 1.2]} />
          <meshStandardMaterial color="#111827" roughness={0.86} />
        </mesh>
      ))}

      {[-75, -45, -15, 15, 45, 75].map((x) => (
        <mesh key={`beam-x-${x}`} position={[x, 18.8, 0]} receiveShadow={!isMobile}>
          <boxGeometry args={[1.2, 0.65, 196]} />
          <meshStandardMaterial color="#111827" roughness={0.86} />
        </mesh>
      ))}

      {CEILING_LIGHTS.map(([x, y, z], index) => (
        <group key={`ceiling-light-${index}`} position={[x, y, z]}>
          <pointLight
            color="#fff2b8"
            intensity={isMobile ? 1.45 : 2.4}
            distance={isMobile ? 42 : 58}
            decay={1.65}
            castShadow={!isMobile && index % 2 === 0}
          />
          <mesh position={[0, 1.08, 0]}>
            <cylinderGeometry args={[0.07, 0.07, 1.55, 10]} />
            <meshStandardMaterial color="#0f172a" roughness={0.62} metalness={0.35} />
          </mesh>
          <mesh position={[0, 1.88, 0]}>
            <cylinderGeometry args={[0.62, 0.62, 0.16, 24]} />
            <meshStandardMaterial color="#111827" roughness={0.55} metalness={0.28} />
          </mesh>
          <mesh position={[0, 0.38, 0]}>
            <cylinderGeometry args={[1.25, 1.55, 0.55, 24]} />
            <meshStandardMaterial color="#991b1b" roughness={0.48} metalness={0.2} />
          </mesh>
          <mesh>
            <sphereGeometry args={[0.8, 24, 18]} />
            <meshStandardMaterial
              color="#fff7cc"
              emissive="#ffd65a"
              emissiveIntensity={isMobile ? 0.85 : 1.35}
              roughness={0.18}
            />
          </mesh>
          <mesh position={[0, -0.45, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[1.18, 0.05, 8, 28]} />
            <meshBasicMaterial color="#facc15" toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function CheckeredTunnel({ isMobile }: { isMobile: boolean }) {
  const checkeredMaterial = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    const size = 64;
    for (let x = 0; x < 4; x += 1) {
      for (let y = 0; y < 4; y += 1) {
        ctx.fillStyle = (x + y) % 2 === 0 ? '#f8fafc' : '#020617';
        ctx.fillRect(x * size, y * size, size, size);
      }
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(6, 2);
    return new THREE.MeshStandardMaterial({ map: texture, roughness: 0.82, metalness: 0.02 });
  }, []);

  const trimMaterial = useMemo(() => (
    <meshBasicMaterial color="#dc2626" toneMapped={false} />
  ), []);

  const [cx, , cz] = TUNNEL_CENTER;
  const tunnelY = 4.45;
  const tunnelHeight = 8.9;
  const length = TUNNEL_HALF_LENGTH * 2;
  const width = TUNNEL_HALF_WIDTH * 2;

  return (
    <group position={[cx, 0, cz]}>
      <RigidBody type="fixed" colliders={false} name="checkered-tunnel-floor" position={[0, 0.08, 0]}>
        <CuboidCollider args={[TUNNEL_HALF_LENGTH, 0.08, TUNNEL_HALF_WIDTH]} />
        <mesh receiveShadow={!isMobile}>
          <boxGeometry args={[length, 0.16, width]} />
          <primitive object={checkeredMaterial} attach="material" />
        </mesh>
      </RigidBody>

      <RigidBody type="fixed" colliders={false} name="checkered-tunnel-ceiling" position={[0, tunnelHeight + 0.8, 0]}>
        <CuboidCollider args={[TUNNEL_HALF_LENGTH, 0.12, TUNNEL_HALF_WIDTH]} />
        <mesh receiveShadow={!isMobile} castShadow={!isMobile}>
          <boxGeometry args={[length, 0.24, width]} />
          <primitive object={checkeredMaterial} attach="material" />
        </mesh>
      </RigidBody>

      {[-TUNNEL_HALF_WIDTH, TUNNEL_HALF_WIDTH].map((z, index) => (
        <RigidBody key={`tunnel-side-${index}`} type="fixed" colliders={false} name={`checkered-tunnel-side-${index}`} position={[0, tunnelY, z]}>
          <CuboidCollider args={[TUNNEL_HALF_LENGTH, tunnelY, 0.28]} />
          <mesh receiveShadow={!isMobile} castShadow={!isMobile}>
            <boxGeometry args={[length, tunnelHeight, 0.56]} />
            <primitive object={checkeredMaterial} attach="material" />
          </mesh>
          <mesh position={[0, tunnelY - 0.3, z > 0 ? -0.32 : 0.32]}>
            <boxGeometry args={[length, 0.24, 0.08]} />
            {trimMaterial}
          </mesh>
        </RigidBody>
      ))}

      {[-TUNNEL_HALF_LENGTH, TUNNEL_HALF_LENGTH].map((x) => (
        <mesh key={`tunnel-open-trim-${x}`} position={[x, tunnelHeight * 0.5, 0]}>
          <boxGeometry args={[0.2, 0.34, width]} />
          {trimMaterial}
        </mesh>
      ))}
    </group>
  );
}

function ConcessionsStand({ isMobile }: { isMobile: boolean }) {
  const reggieRef = useRef<THREE.Group>(null);
  const leftArmRef = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);
  const leftLegRef = useRef<THREE.Mesh>(null);
  const rightLegRef = useRef<THREE.Mesh>(null);
  const ketchupStreamRef = useRef<THREE.Mesh>(null);
  const mustardStreamRef = useRef<THREE.Mesh>(null);
  const bottleTrayRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    const elapsed = state.clock.elapsedTime;
    const cycle = elapsed % 7.5;
    const waving = cycle < 3;
    const squirting = !waving;

    if (reggieRef.current) {
      reggieRef.current.position.y = 0.42 + Math.sin(elapsed * 2.2) * 0.035;
      reggieRef.current.rotation.y = Math.sin(elapsed * 0.7) * 0.08;
    }

    if (leftArmRef.current) {
      leftArmRef.current.rotation.z = waving ? -0.95 + Math.sin(elapsed * 7) * 0.38 : -0.35;
      leftArmRef.current.rotation.x = waving ? -0.15 : -0.72 + Math.sin(elapsed * 12) * 0.1;
    }

    if (rightArmRef.current) {
      rightArmRef.current.rotation.z = squirting ? 0.28 : 0.45;
      rightArmRef.current.rotation.x = squirting ? -0.78 + Math.sin(elapsed * 11 + 1.4) * 0.12 : -0.08;
    }

    if (leftLegRef.current) {
      leftLegRef.current.rotation.x = Math.sin(elapsed * 2.2) * 0.08;
    }

    if (rightLegRef.current) {
      rightLegRef.current.rotation.x = -Math.sin(elapsed * 2.2) * 0.08;
    }

    if (bottleTrayRef.current) {
      bottleTrayRef.current.position.y = squirting ? 2.26 + Math.sin(elapsed * 14) * 0.04 : 2.2;
      bottleTrayRef.current.rotation.x = squirting ? -0.36 : -0.12;
    }

    if (ketchupStreamRef.current) {
      ketchupStreamRef.current.visible = squirting && Math.sin(elapsed * 11) > -0.35;
      ketchupStreamRef.current.scale.y = 0.7 + Math.max(0, Math.sin(elapsed * 12)) * 0.45;
    }

    if (mustardStreamRef.current) {
      mustardStreamRef.current.visible = squirting && Math.sin(elapsed * 10 + 1.2) > -0.25;
      mustardStreamRef.current.scale.y = 0.7 + Math.max(0, Math.sin(elapsed * 13 + 1.2)) * 0.45;
    }
  });

  return (
    <group position={CONCESSIONS_CENTER} rotation={[0, Math.PI, 0]}>
      <RigidBody type="fixed" colliders={false} name="concessions-stand" position={[0, 0.95, 0]}>
        <CuboidCollider args={[9.5, 0.95, 2.75]} position={[0, 0, 0]} />
        <mesh receiveShadow={!isMobile} castShadow={!isMobile} position={[0, 0, 0]}>
          <boxGeometry args={[19, 1.9, 5.5]} />
          <meshStandardMaterial color="#7f1d1d" roughness={0.74} metalness={0.03} />
        </mesh>
        <mesh position={[0, 1.12, -2.9]} receiveShadow={!isMobile} castShadow={!isMobile}>
          <boxGeometry args={[19.8, 0.38, 0.46]} />
          <meshStandardMaterial color="#facc15" roughness={0.48} />
        </mesh>
        <mesh position={[0, 1.16, 2.9]} receiveShadow={!isMobile} castShadow={!isMobile}>
          <boxGeometry args={[19.8, 0.38, 0.46]} />
          <meshStandardMaterial color="#facc15" roughness={0.48} />
        </mesh>
        {[-6.3, 0, 6.3].map((x) => (
          <mesh key={`stand-panel-${x}`} position={[x, 0.08, -3.0]}>
            <boxGeometry args={[3.6, 1.22, 0.16]} />
            <meshStandardMaterial color="#f8fafc" roughness={0.62} />
          </mesh>
        ))}
      </RigidBody>

      <RigidBody type="fixed" colliders={false} name="concessions-back-wall" position={[0, 4.2, 5.2]}>
        <CuboidCollider args={[10.2, 4.2, 0.35]} />
        <mesh receiveShadow={!isMobile} castShadow={!isMobile}>
          <boxGeometry args={[20.4, 8.4, 0.7]} />
          <meshStandardMaterial color="#fef3c7" roughness={0.82} />
        </mesh>
        <mesh position={[0, 1.95, -0.42]}>
          <boxGeometry args={[15.4, 1.65, 0.12]} />
          <meshStandardMaterial color="#dc2626" roughness={0.46} />
        </mesh>
        <Text
          position={[0, 1.96, -0.52]}
          rotation={[0, Math.PI, 0]}
          fontSize={1.05}
          maxWidth={14.2}
          textAlign="center"
          anchorX="center"
          anchorY="middle"
          color="#fef3c7"
          outlineWidth={0.045}
          outlineColor="#7f1d1d"
        >
          CONCESSIONS
        </Text>
        <mesh position={[0, 1.02, -0.54]}>
          <boxGeometry args={[12.4, 0.22, 0.08]} />
          <meshBasicMaterial color="#facc15" toneMapped={false} />
        </mesh>
      </RigidBody>

      <mesh position={[0, 8.85, 0.6]} rotation={[0.08, 0, 0]}>
        <boxGeometry args={[22, 0.6, 9]} />
        <meshStandardMaterial color="#dc2626" roughness={0.7} />
      </mesh>
      <mesh position={[0, 9.2, -0.4]} rotation={[0.08, 0, 0]}>
        <boxGeometry args={[21, 0.2, 7.8]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.55} />
      </mesh>

      <group ref={reggieRef} position={[0, 0.42, 2.15]} userData={{ name: 'reggie' }}>
        <mesh ref={leftLegRef} position={[-0.19, 0.32, 0]} rotation={[0.04, 0, 0.03]} castShadow={!isMobile} userData={{ name: 'reggie' }}>
          <capsuleGeometry args={[0.13, 0.9, 8, 12]} />
          <meshStandardMaterial color="#111827" roughness={0.72} />
        </mesh>
        <mesh ref={rightLegRef} position={[0.19, 0.32, 0]} rotation={[-0.04, 0, -0.03]} castShadow={!isMobile} userData={{ name: 'reggie' }}>
          <capsuleGeometry args={[0.13, 0.9, 8, 12]} />
          <meshStandardMaterial color="#111827" roughness={0.72} />
        </mesh>
        <mesh position={[-0.19, -0.2, -0.06]} scale={[1.15, 0.42, 1.45]} castShadow={!isMobile} userData={{ name: 'reggie' }}>
          <sphereGeometry args={[0.15, 12, 8]} />
          <meshStandardMaterial color="#111111" roughness={0.8} />
        </mesh>
        <mesh position={[0.19, -0.2, -0.06]} scale={[1.15, 0.42, 1.45]} castShadow={!isMobile} userData={{ name: 'reggie' }}>
          <sphereGeometry args={[0.15, 12, 8]} />
          <meshStandardMaterial color="#111111" roughness={0.8} />
        </mesh>
        <mesh position={[0, 0.95, 0]} castShadow={!isMobile} userData={{ name: 'reggie' }}>
          <capsuleGeometry args={[0.42, 1.25, 10, 16]} />
          <meshStandardMaterial color="#f8fafc" roughness={0.7} />
        </mesh>
        <mesh position={[0, 0.4, -0.43]} scale={[0.98, 0.35, 0.16]} userData={{ name: 'reggie' }}>
          <boxGeometry args={[0.62, 0.26, 0.08]} />
          <meshStandardMaterial color="#111827" roughness={0.7} />
        </mesh>
        {[-0.18, 0.18].map((x, index) => (
          <mesh key={`reggie-stripe-${index}`} position={[x, 0.96, -0.42]} userData={{ name: 'reggie' }}>
            <boxGeometry args={[0.13, 1.35, 0.08]} />
            <meshStandardMaterial color="#dc2626" roughness={0.58} />
          </mesh>
        ))}
        <mesh position={[0, 1.38, -0.47]} rotation={[0, 0, Math.PI / 4]} userData={{ name: 'reggie' }}>
          <boxGeometry args={[0.28, 0.28, 0.08]} />
          <meshStandardMaterial color="#dc2626" roughness={0.5} />
        </mesh>
        <mesh position={[0, 2.02, 0]} castShadow={!isMobile} userData={{ name: 'reggie' }}>
          <sphereGeometry args={[0.43, 24, 18]} />
          <meshStandardMaterial color="#fde0bd" roughness={0.62} />
        </mesh>
        <mesh position={[0, 2.36, -0.02]} scale={[1.15, 0.34, 0.78]} userData={{ name: 'reggie' }}>
          <sphereGeometry args={[0.34, 18, 10]} />
          <meshStandardMaterial color="#3f2413" roughness={0.7} />
        </mesh>
        <mesh position={[0, 2.24, -0.24]} scale={[1.2, 0.16, 0.24]} userData={{ name: 'reggie' }}>
          <boxGeometry args={[0.52, 0.18, 0.08]} />
          <meshStandardMaterial color="#3f2413" roughness={0.68} />
        </mesh>
        {[-0.16, 0.16].map((x) => (
          <group key={`reggie-glasses-${x}`} position={[x, 2.05, -0.39]} userData={{ name: 'reggie' }}>
            <mesh>
              <torusGeometry args={[0.105, 0.012, 6, 18]} />
              <meshStandardMaterial color="#111827" roughness={0.35} metalness={0.2} />
            </mesh>
            <mesh position={[0, 0, -0.01]}>
              <sphereGeometry args={[0.045, 10, 8]} />
              <meshStandardMaterial color="#111827" roughness={0.4} />
            </mesh>
          </group>
        ))}
        <mesh position={[0, 2.04, -0.4]} userData={{ name: 'reggie' }}>
          <boxGeometry args={[0.13, 0.02, 0.03]} />
          <meshStandardMaterial color="#111827" roughness={0.4} />
        </mesh>

        <group ref={leftArmRef} position={[-0.5, 1.35, -0.04]} userData={{ name: 'reggie' }}>
          <mesh position={[-0.28, -0.34, 0]} rotation={[0, 0, -0.18]} castShadow={!isMobile}>
            <capsuleGeometry args={[0.11, 0.8, 8, 12]} />
            <meshStandardMaterial color="#f8fafc" roughness={0.7} />
          </mesh>
          <mesh position={[-0.5, -0.78, 0]}>
            <sphereGeometry args={[0.13, 12, 10]} />
            <meshStandardMaterial color="#fde0bd" roughness={0.6} />
          </mesh>
        </group>

        <group ref={rightArmRef} position={[0.5, 1.34, -0.04]} userData={{ name: 'reggie' }}>
          <mesh position={[0.28, -0.34, 0]} rotation={[0, 0, 0.18]} castShadow={!isMobile}>
            <capsuleGeometry args={[0.11, 0.8, 8, 12]} />
            <meshStandardMaterial color="#f8fafc" roughness={0.7} />
          </mesh>
          <mesh position={[0.5, -0.78, 0]}>
            <sphereGeometry args={[0.13, 12, 10]} />
            <meshStandardMaterial color="#fde0bd" roughness={0.6} />
          </mesh>
        </group>
      </group>

      <group ref={bottleTrayRef} position={[0.75, 2.2, -3.35]}>
        <mesh position={[-0.34, 0, 0]} rotation={[0, 0, -0.08]}>
          <cylinderGeometry args={[0.13, 0.16, 0.78, 14]} />
          <meshStandardMaterial color="#dc2626" roughness={0.36} />
        </mesh>
        <mesh position={[0.12, 0, 0]} rotation={[0, 0, 0.08]}>
          <cylinderGeometry args={[0.13, 0.16, 0.78, 14]} />
          <meshStandardMaterial color="#facc15" roughness={0.36} />
        </mesh>
      </group>

      {[-2.7, -1.4, -0.1, 1.2, 2.5].map((x, index) => (
        <group key={`hotdog-${index}`} position={[x, 2.35, -3.54]} rotation={[0, Math.PI / 2, 0]}>
          <mesh scale={[1.25, 0.34, 0.42]}>
            <sphereGeometry args={[0.28, 14, 10]} />
            <meshStandardMaterial color="#fbbf24" roughness={0.62} />
          </mesh>
          <mesh position={[0, 0.03, 0]} scale={[1.1, 0.16, 0.22]}>
            <capsuleGeometry args={[0.18, 0.92, 8, 12]} />
            <meshStandardMaterial color="#7f1d1d" roughness={0.54} />
          </mesh>
        </group>
      ))}

      <mesh ref={ketchupStreamRef} position={[0.4, 2.52, -3.55]} rotation={[Math.PI / 2, 0, 0.1]}>
        <cylinderGeometry args={[0.035, 0.05, 1.35, 8]} />
        <meshBasicMaterial color="#dc2626" toneMapped={false} transparent opacity={0.9} />
      </mesh>
      <mesh ref={mustardStreamRef} position={[0.88, 2.52, -3.55]} rotation={[Math.PI / 2, 0, -0.1]}>
        <cylinderGeometry args={[0.035, 0.05, 1.35, 8]} />
        <meshBasicMaterial color="#facc15" toneMapped={false} transparent opacity={0.9} />
      </mesh>

      <pointLight position={[0, 7.6, -1.2]} color="#fff0c2" intensity={isMobile ? 1.3 : 2.1} distance={24} decay={1.6} />
    </group>
  );
}

function SpawnRoom({ doorOpen, isMobile }: { doorOpen: boolean; isMobile: boolean }) {
  const wallMaterial = useMemo(() => (
    <meshStandardMaterial color="#b91c1c" roughness={0.78} metalness={0.05} />
  ), []);
  const trimMaterial = useMemo(() => (
    <meshBasicMaterial color="#facc15" toneMapped={false} />
  ), []);

  return (
    <group>
      <RigidBody type="fixed" colliders={false} name="spawn-room-back" position={[0, 2.5, 8]}>
        <CuboidCollider args={[8.5, 2.5, 0.35]} />
        <mesh receiveShadow={!isMobile} castShadow={!isMobile}>
          <boxGeometry args={[17, 5, 0.7]} />
          {wallMaterial}
        </mesh>
        <mesh position={[0, 2.45, -0.38]}>
          <boxGeometry args={[17.4, 0.28, 0.08]} />
          {trimMaterial}
        </mesh>
      </RigidBody>

      <RigidBody type="fixed" colliders={false} name="spawn-room-left" position={[-8, 2.5, 0]}>
        <CuboidCollider args={[0.35, 2.5, 8.5]} />
        <mesh receiveShadow={!isMobile} castShadow={!isMobile}>
          <boxGeometry args={[0.7, 5, 17]} />
          {wallMaterial}
        </mesh>
        <mesh position={[0.38, 2.45, 0]}>
          <boxGeometry args={[0.08, 0.28, 17.4]} />
          {trimMaterial}
        </mesh>
      </RigidBody>

      <RigidBody type="fixed" colliders={false} name="spawn-room-right" position={[8, 2.5, 0]}>
        <CuboidCollider args={[0.35, 2.5, 8.5]} />
        <mesh receiveShadow={!isMobile} castShadow={!isMobile}>
          <boxGeometry args={[0.7, 5, 17]} />
          {wallMaterial}
        </mesh>
        <mesh position={[-0.38, 2.45, 0]}>
          <boxGeometry args={[0.08, 0.28, 17.4]} />
          {trimMaterial}
        </mesh>
      </RigidBody>

      <RigidBody type="fixed" colliders={false} name="spawn-room-front-left" position={[-5.35, 2.5, -8]}>
        <CuboidCollider args={[3.15, 2.5, 0.35]} />
        <mesh receiveShadow={!isMobile} castShadow={!isMobile}>
          <boxGeometry args={[6.3, 5, 0.7]} />
          {wallMaterial}
        </mesh>
      </RigidBody>

      <RigidBody type="fixed" colliders={false} name="spawn-room-front-right" position={[5.35, 2.5, -8]}>
        <CuboidCollider args={[3.15, 2.5, 0.35]} />
        <mesh receiveShadow={!isMobile} castShadow={!isMobile}>
          <boxGeometry args={[6.3, 5, 0.7]} />
          {wallMaterial}
        </mesh>
      </RigidBody>

      {!doorOpen && (
        <RigidBody type="fixed" colliders={false} name="spawn-door" userData={{ name: 'spawn-door' }} position={[0, 2.35, -8]}>
          <CuboidCollider args={[2.05, 2.35, 0.4]} />
          <mesh receiveShadow={!isMobile} castShadow={!isMobile}>
            <boxGeometry args={[4.1, 4.7, 0.8]} />
            <meshStandardMaterial color="#1d4ed8" roughness={0.45} metalness={0.12} />
          </mesh>
          <mesh position={[1.25, 0.05, -0.48]}>
            <sphereGeometry args={[0.18, 16, 12]} />
            <meshStandardMaterial color="#facc15" roughness={0.25} metalness={0.25} />
          </mesh>
        </RigidBody>
      )}

      {doorOpen && (
        <group position={[-2.8, 2.35, -8.85]} rotation={[0, -0.75, 0]}>
          <mesh receiveShadow={!isMobile} castShadow={!isMobile}>
            <boxGeometry args={[4.1, 4.7, 0.35]} />
            <meshStandardMaterial color="#1d4ed8" roughness={0.45} metalness={0.12} />
          </mesh>
        </group>
      )}

      <mesh position={[0, 5.2, -8.05]}>
        <boxGeometry args={[4.8, 0.36, 0.2]} />
        {trimMaterial}
      </mesh>
    </group>
  );
}

function Wall({ name, position, rotation, isMobile }: { name: string, position: [number, number, number], rotation: [number, number, number], isMobile: boolean }) {
  // Striped wall texture
  const stripeTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = '#ffff00';
    ctx.fillRect(0, 0, 64, 128);
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(20, 1);
    return texture;
  }, []);

  return (
    <RigidBody type="fixed" name={name} position={position} rotation={rotation}>
      {/* Striped Wall */}
      <mesh>
        <boxGeometry args={[200, 28.4, 1]} />
        <meshStandardMaterial map={stripeTexture} roughness={1} metalness={0} />
      </mesh>
      {/* Decorative Trim */}
      <mesh position={[0, -13.95, 0.51]}>
        <planeGeometry args={[200, 0.5]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      <mesh position={[0, 13.95, 0.51]}>
        <planeGeometry args={[200, 0.5]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      <mesh position={[0, 5.1, 0.52]}>
        <boxGeometry args={[200, 0.24, 0.08]} />
        <meshBasicMaterial color="#facc15" toneMapped={false} />
      </mesh>
      {[-72, -36, 0, 36, 72].map((x, index) => (
        <group key={`wall-detail-${name}-${index}`} position={[x, 3.5, 0.56]}>
          <mesh>
            <boxGeometry args={[14, 7, 0.12]} />
            <meshStandardMaterial color={index % 2 === 0 ? '#1d4ed8' : '#7f1d1d'} roughness={0.6} />
          </mesh>
          <mesh position={[0, 0, 0.08]}>
            <boxGeometry args={[12.4, 5.4, 0.08]} />
            <meshStandardMaterial color={index % 2 === 0 ? '#fef3c7' : '#facc15'} roughness={0.5} />
          </mesh>
          <mesh position={[0, 0.75, 0.14]} rotation={[0, 0, Math.PI / 4]}>
            <boxGeometry args={[3.2, 3.2, 0.08]} />
            <meshStandardMaterial color={index % 2 === 0 ? '#dc2626' : '#2563eb'} roughness={0.55} />
          </mesh>
          <mesh position={[0, -1.9, 0.15]}>
            <boxGeometry args={[8.2, 0.38, 0.08]} />
            <meshBasicMaterial color="#111827" toneMapped={false} />
          </mesh>
        </group>
      ))}
      {[-90, -54, -18, 18, 54, 90].map((x, index) => (
        <group key={`wall-bulb-${name}-${index}`} position={[x, 9.8, 0.62]}>
          <mesh>
            <sphereGeometry args={[0.46, 16, 12]} />
            <meshStandardMaterial color="#fff7cc" emissive="#facc15" emissiveIntensity={0.5} roughness={0.25} />
          </mesh>
          <mesh position={[0, -0.42, 0]}>
            <cylinderGeometry args={[0.08, 0.08, 0.8, 8]} />
            <meshStandardMaterial color="#111827" roughness={0.55} metalness={0.15} />
          </mesh>
        </group>
      ))}
    </RigidBody>
  );
}

function AmbientParticles() {
  const count = 1500;
  const pointsRef = useRef<THREE.Points>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const [positions, sizes, colors] = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const colors = new Float32Array(count * 3);
    const circusPalette = [
      new THREE.Color('#ff0000'),
      new THREE.Color('#ffd700'),
      new THREE.Color('#0000ff'),
      new THREE.Color('#ffffff'),
      new THREE.Color('#ff00ff'),
    ];

    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 200;
      positions[i * 3 + 1] = Math.random() * 40;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 200;
      sizes[i] = Math.random() * 1.5 + 0.5;
      
      const col = circusPalette[Math.floor(Math.random() * circusPalette.length)];
      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;
    }
    return [positions, sizes, colors];
  }, []);

  const uniforms = useMemo(() => ({
    uTime: { value: 0 }
  }), []);

  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-aSize"
          count={count}
          array={sizes}
          itemSize={1}
        />
        <bufferAttribute
          attach="attributes-color"
          count={count}
          array={colors}
          itemSize={3}
        />
      </bufferGeometry>
      <shaderMaterial
        ref={materialRef}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        uniforms={uniforms}
        vertexShader={`
          uniform float uTime;
          attribute float aSize;
          attribute vec3 color;
          varying float vAlpha;
          varying vec3 vColor;
          void main() {
            vColor = color;
            vec3 pos = position;
            // Slow falling confetti effect
            pos.y -= uTime * 2.0;
            pos.x += sin(uTime * 0.5 + pos.y) * 1.0;
            pos.z += cos(uTime * 0.5 + pos.y) * 1.0;
            
            // Wrap around Y (from top 40 to bottom 0)
            pos.y = mod(pos.y, 40.0);
            
            vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
            gl_Position = projectionMatrix * mvPosition;
            
            gl_PointSize = aSize * (300.0 / -mvPosition.z);
            vAlpha = smoothstep(0.0, 5.0, pos.y) * smoothstep(40.0, 35.0, pos.y);
          }
        `}
        fragmentShader={`
          varying float vAlpha;
          varying vec3 vColor;
          void main() {
            float d = length(gl_PointCoord - vec2(0.5));
            float alpha = smoothstep(0.5, 0.2, d) * vAlpha;
            if (alpha < 0.01) discard;
            gl_FragColor = vec4(vColor, alpha);
          }
        `}
      />
    </points>
  );
}
