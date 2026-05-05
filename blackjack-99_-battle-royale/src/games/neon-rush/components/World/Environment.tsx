/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/


import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore } from '../../store';
import { LANE_WIDTH } from '../../types';
import { Sky, Cloud } from '@react-three/drei';

const Scenery: React.FC = () => {
    const speed = useStore(state => state.speed);
    const count = 40; // Number of trees/bushes
    const meshRef = useRef<THREE.InstancedMesh>(null);
    
    // Create random positions for trees on the sides
    const [positions, scales] = useMemo(() => {
        const _positions = [];
        const _scales = [];
        for (let i = 0; i < count; i++) {
            // Place randomly on either left or right side of tracks
            const side = Math.random() > 0.5 ? 1 : -1;
            const x = side * (15 + Math.random() * 30);
            const z = -200 + Math.random() * 250;
            const y = 0;
            _positions.push([x, y, z]);
            
            // Random scales
            const scale = 1 + Math.random() * 2;
            _scales.push([scale, scale + Math.random(), scale]);
        }
        return [_positions, _scales];
    }, []);

    const dummy = useMemo(() => new THREE.Object3D(), []);

    useFrame((state, delta) => {
        if (!meshRef.current) return;
        
        const activeSpeed = speed > 0 ? speed : 0;
        
        for (let i = 0; i < count; i++) {
            let [x, y, z] = positions[i];
            
            z += activeSpeed * delta;
            
            if (z > 20) {
                z = -200 - Math.random() * 50;
            }
            
            positions[i][2] = z;
            
            dummy.position.set(x, y, z);
            const s = scales[i];
            dummy.scale.set(s[0], s[1], s[2]);
            dummy.updateMatrix();
            meshRef.current.setMatrixAt(i, dummy.matrix);
        }
        meshRef.current.instanceMatrix.needsUpdate = true;
    });

    return (
        <group>
            {/* Tree trunks */}
            <instancedMesh ref={meshRef} args={[undefined, undefined, count]} position={[0, 2, 0]}>
                <sphereGeometry args={[2, 8, 8]} />
                <meshStandardMaterial color="#4ade80" />
            </instancedMesh>
            {/* Ground Grass */}
            <mesh position={[0, -0.5, -50]} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[200, 300]} />
                <meshStandardMaterial color="#a3e635" />
            </mesh>
        </group>
    );
};

const LaneGuides: React.FC = () => {
    const { laneCount } = useStore();
    
    const separators = useMemo(() => {
        const lines: number[] = [];
        const startX = -(laneCount * LANE_WIDTH) / 2;
        
        for (let i = 0; i <= laneCount; i++) {
            lines.push(startX + (i * LANE_WIDTH));
        }
        return lines;
    }, [laneCount]);

    return (
        <group position={[0, 0.0, 0]}>
            {/* Lane Path - Light gray/paved look */}
            <mesh position={[0, -0.01, -50]} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[laneCount * LANE_WIDTH, 200]} />
                <meshStandardMaterial color="#d4d4d8" roughness={0.8} />
            </mesh>

            {/* Lane Separators - White lines */}
            {separators.map((x, i) => (
                <mesh key={`sep-${i}`} position={[x, 0.01, -50]} rotation={[-Math.PI / 2, 0, 0]}>
                    <planeGeometry args={[0.2, 200]} /> 
                    <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.2} />
                </mesh>
            ))}
        </group>
    );
};

export const Environment: React.FC = () => {
  return (
    <>
      {/* Bright Sky */}
      <Sky distance={450000} sunPosition={[0, 1, -1]} inclination={0} azimuth={0.25} />
      <color attach="background" args={['#87CEEB']} />
      <fog attach="fog" args={['#87CEEB', 50, 150]} />
      
      {/* Sunlight */}
      <ambientLight intensity={1.0} color="#ffffff" />
      <directionalLight 
          position={[20, 50, 20]} 
          intensity={2.5} 
          color="#ffffff" 
          castShadow 
          shadow-mapSize-width={1024} 
          shadow-mapSize-height={1024} 
      />
      
      <Scenery />
      <LaneGuides />
      
      {/* Simple Clouds */}
      <group position={[0, 30, -100]}>
         <Cloud position={[-30, 0, 0]} speed={0.2} opacity={0.5} />
         <Cloud position={[30, 10, -50]} speed={0.2} opacity={0.5} />
         <Cloud position={[0, -10, -80]} speed={0.2} opacity={0.5} />
      </group>
    </>
  );
};
