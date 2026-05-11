/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { RigidBody, CuboidCollider } from '@react-three/rapier';
import { useFrame } from '@react-three/fiber';
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
