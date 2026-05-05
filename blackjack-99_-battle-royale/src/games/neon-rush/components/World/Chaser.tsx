import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore } from '../../store';
import { GameStatus } from '../../types';

// Static Geometries for Chaser (Slightly bulkier than player)
const TORSO_GEO = new THREE.CylinderGeometry(0.3, 0.2, 0.7, 8);
const HEAD_GEO = new THREE.BoxGeometry(0.3, 0.35, 0.3);
const HAT_GEO = new THREE.CylinderGeometry(0.35, 0.35, 0.1, 8); // Guard Hat
const HAT_VISOR_GEO = new THREE.BoxGeometry(0.35, 0.05, 0.2);
const ARM_GEO = new THREE.BoxGeometry(0.15, 0.65, 0.15);
const HIPS_GEO = new THREE.CylinderGeometry(0.2, 0.2, 0.25);
const LEG_GEO = new THREE.BoxGeometry(0.18, 0.75, 0.18);
const SHADOW_GEO = new THREE.CircleGeometry(0.6, 32);

export const Chaser: React.FC = () => {
  const groupRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Group>(null);
  const shadowRef = useRef<THREE.Mesh>(null);
  
  // Limb Refs for Animation
  const leftArmRef = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);
  const leftLegRef = useRef<THREE.Group>(null);
  const rightLegRef = useRef<THREE.Group>(null);

  const { status, speed } = useStore();
  
  const targetX = useRef(0);
  const currentZ = useRef(4); // Start behind player
  const catchDelay = useRef(0);
  const prevStatus = useRef(status);

  // Materials
  const { shirtMaterial, pantsMaterial, hatMaterial, skinMaterial, shadowMaterial } = useMemo(() => {
      return {
          shirtMaterial: new THREE.MeshStandardMaterial({ color: '#38bdf8', roughness: 0.9 }), // Light blue shirt
          pantsMaterial: new THREE.MeshStandardMaterial({ color: '#1e3a8a', roughness: 0.9 }), // Dark blue pants
          hatMaterial: new THREE.MeshStandardMaterial({ color: '#1e3a8a', roughness: 0.8 }),   // Hat
          skinMaterial: new THREE.MeshStandardMaterial({ color: '#fcd34d', roughness: 0.6 }),  // Skin tone
          shadowMaterial: new THREE.MeshBasicMaterial({ color: '#000000', opacity: 0.3, transparent: true })
      };
  }, []);

  useEffect(() => {
    if (status === GameStatus.PLAYING && prevStatus.current !== GameStatus.PLAYING) {
        // Reset position on restart
        currentZ.current = 5;
        targetX.current = 0;
        catchDelay.current = 0;
        if (groupRef.current) {
            groupRef.current.position.set(0, 0, currentZ.current);
        }
    }
    prevStatus.current = status;
  }, [status]);

  useFrame((state, delta) => {
    if (!groupRef.current) return;

    // Determine target X from player
    const playerInner = state.scene.getObjectByName('PlayerInnerGroup');
    if (playerInner) {
         targetX.current = playerInner.position.x;
    }

    // 1. Chaser positioned based on status
    let targetZ = 2.5; // Normal distance behind
    const isGameOver = status === GameStatus.GAME_OVER;

    if (isGameOver) {
        // Catch up animation
        catchDelay.current += delta;
        if (catchDelay.current > 0.5) { // Small delay before rushing in
             targetZ = 0.8; // Stand right behind the player
        }
    } else if (status === GameStatus.MENU) {
        targetZ = 1.5; // Lurk closer on menu
    }

    // Dynamic Z distance based on speed
    if (status === GameStatus.PLAYING) {
         // Start closer, fall back slightly with speed but stay visible
         targetZ = 2.0 + (speed * 0.02);
    }

    // Follow Player X (lag slightly behind)
    const lerpSpeedX = isGameOver ? 5 : 3; // Catch up faster horizontally when game over
    
    // Add a slight weaving motion so the chaser peeks out from behind the player
    const time = state.clock.elapsedTime * (speed > 0 ? (speed * 1.5) : 10); 
    const weaveOffset = (status === GameStatus.PLAYING) ? Math.sin(time * 0.3) * 0.6 : 0;

    groupRef.current.position.x = THREE.MathUtils.lerp(
        groupRef.current.position.x, 
        targetX.current + weaveOffset, 
        delta * lerpSpeedX 
    );

    // Follow Player Z
    const lerpSpeedZ = isGameOver && catchDelay.current > 0.5 ? 8 : 2;
    currentZ.current = THREE.MathUtils.lerp(currentZ.current, targetZ, delta * lerpSpeedZ);
    groupRef.current.position.z = currentZ.current;

    // Banking Rotation based on X movement
    const xDiff = targetX.current - groupRef.current.position.x;
    groupRef.current.rotation.z = -xDiff * 0.15; 

    // Handle Animation
    
    if (status === GameStatus.PLAYING) {
        // Running Cycle
        if (leftArmRef.current) leftArmRef.current.rotation.x = Math.sin(time) * 0.8;
        if (rightArmRef.current) rightArmRef.current.rotation.x = Math.sin(time + Math.PI) * 0.8;
        if (leftLegRef.current) leftLegRef.current.rotation.x = Math.sin(time + Math.PI) * 1.0;
        if (rightLegRef.current) rightLegRef.current.rotation.x = Math.sin(time) * 1.0;
        
        if (bodyRef.current) bodyRef.current.position.y = 1.2 + Math.abs(Math.sin(time)) * 0.15;
    } else {
        // Idle / Caught Pose
        const lerpDelta = delta * 5;
        if (leftArmRef.current) leftArmRef.current.rotation.x = THREE.MathUtils.lerp(leftArmRef.current.rotation.x, -0.2, lerpDelta);
        if (rightArmRef.current) rightArmRef.current.rotation.x = THREE.MathUtils.lerp(rightArmRef.current.rotation.x, 0.2, lerpDelta);
        if (leftLegRef.current) leftLegRef.current.rotation.x = THREE.MathUtils.lerp(leftLegRef.current.rotation.x, 0.1, lerpDelta);
        if (rightLegRef.current) rightLegRef.current.rotation.x = THREE.MathUtils.lerp(rightLegRef.current.rotation.x, -0.1, lerpDelta);
        if (bodyRef.current) bodyRef.current.position.y = THREE.MathUtils.lerp(bodyRef.current.position.y, 1.2, lerpDelta);

        // Turn towards camera on game over slightly
        if (isGameOver && currentZ.current < 1.5) {
             groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, 0.5, delta * 2);
             // Raise arms like "caught you!"
             if (rightArmRef.current) rightArmRef.current.rotation.z = THREE.MathUtils.lerp(rightArmRef.current.rotation.z, 0.8, lerpDelta);
             if (rightArmRef.current) rightArmRef.current.rotation.x = THREE.MathUtils.lerp(rightArmRef.current.rotation.x, -1.5, lerpDelta);
        } else {
             groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, 0, delta * 5);
             if (rightArmRef.current) rightArmRef.current.rotation.z = THREE.MathUtils.lerp(rightArmRef.current.rotation.z, 0, lerpDelta);
        }
    }

    // Shadow
    if (shadowRef.current && bodyRef.current) {
        shadowRef.current.scale.set(1, 1, status === GameStatus.PLAYING ? 1 + Math.abs(Math.sin(time)) * 0.2 : 1);
    }
  });

  return (
    <group ref={groupRef} position={[0, 0, 4]}>
      <group ref={bodyRef} position={[0, 1.2, 0]}> 
        
        {/* Torso */}
        <mesh castShadow position={[0, 0.25, 0]} geometry={TORSO_GEO} material={shirtMaterial} />

        {/* Head */}
        <group position={[0, 0.7, 0]}>
            <mesh castShadow geometry={HEAD_GEO} material={skinMaterial} />
            {/* Hat */}
            <mesh castShadow position={[0, 0.2, 0]} geometry={HAT_GEO} material={hatMaterial} />
            <mesh castShadow position={[0, 0.15, 0.15]} geometry={HAT_VISOR_GEO} material={hatMaterial} />
        </group>

        {/* Arms */}
        <group position={[0.38, 0.45, 0]}>
            <group ref={rightArmRef}>
                <mesh position={[0, -0.25, 0]} castShadow geometry={ARM_GEO} material={shirtMaterial} />
            </group>
        </group>
        <group position={[-0.38, 0.45, 0]}>
            <group ref={leftArmRef}>
                 <mesh position={[0, -0.25, 0]} castShadow geometry={ARM_GEO} material={shirtMaterial} />
            </group>
        </group>

        {/* Hips */}
        <mesh position={[0, -0.15, 0]} geometry={HIPS_GEO} material={pantsMaterial} />

        {/* Legs */}
        <group position={[0.15, -0.28, 0]}>
            <group ref={rightLegRef}>
                 <mesh position={[0, -0.37, 0]} castShadow geometry={LEG_GEO} material={pantsMaterial} />
            </group>
        </group>
        <group position={[-0.15, -0.28, 0]}>
            <group ref={leftLegRef}>
                 <mesh position={[0, -0.37, 0]} castShadow geometry={LEG_GEO} material={pantsMaterial} />
            </group>
        </group>
      </group>
      
      <mesh ref={shadowRef} position={[0, 0.02, 0]} rotation={[-Math.PI/2, 0, 0]} geometry={SHADOW_GEO} material={shadowMaterial} />
    </group>
  );
};
