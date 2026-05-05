/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore } from '../../store';
import { GameStatus, LANE_WIDTH } from '../../types';
import { audio } from '../System/Audio';

const GRAVITY = 50;
const JUMP_FORCE = 16;

const TORSO_GEO = new THREE.CapsuleGeometry(0.22, 0.5, 8, 14);
const HELMET_GEO = new THREE.SphereGeometry(0.26, 28, 18);
const VISOR_GEO = new THREE.SphereGeometry(0.205, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.54);
const PACK_GEO = new THREE.BoxGeometry(0.34, 0.55, 0.18);
const TANK_GEO = new THREE.CylinderGeometry(0.06, 0.06, 0.62, 12);
const LIMB_GEO = new THREE.CapsuleGeometry(0.065, 0.43, 6, 10);
const GLOVE_GEO = new THREE.SphereGeometry(0.085, 12, 8);
const BOOT_GEO = new THREE.BoxGeometry(0.15, 0.12, 0.24);
const SHADOW_GEO = new THREE.CircleGeometry(0.5, 32);
const FLAME_GEO = new THREE.ConeGeometry(0.08, 0.34, 12);
const CHEST_GLOW_GEO = new THREE.CircleGeometry(0.075, 18);

const GAMEPLAY_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'Spacebar', 'Enter', 'w', 'W', 'a', 'A', 'd', 'D']);

export const Player: React.FC = () => {
  const groupRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Group>(null);
  const shadowRef = useRef<THREE.Mesh>(null);
  const leftArmRef = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);
  const leftLegRef = useRef<THREE.Group>(null);
  const rightLegRef = useRef<THREE.Group>(null);
  const helmetRef = useRef<THREE.Group>(null);
  const flameRef = useRef<THREE.Group>(null);

  const { status, laneCount, takeDamage, hasDoubleJump, activateImmortality, isImmortalityActive } = useStore();
  const [lane, setLane] = React.useState(0);
  const targetX = useRef(0);
  const isJumping = useRef(false);
  const velocityY = useRef(0);
  const jumpsPerformed = useRef(0);
  const spinRotation = useRef(0);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const isInvincible = useRef(false);
  const lastDamageTime = useRef(0);

  const materials = useMemo(() => {
    const shieldTint = isImmortalityActive ? '#facc15' : '#f8fafc';
    const glowTint = isImmortalityActive ? '#fde047' : '#22d3ee';

    return {
      suit: new THREE.MeshStandardMaterial({ color: shieldTint, roughness: 0.34, metalness: 0.2 }),
      trim: new THREE.MeshStandardMaterial({ color: '#38bdf8', emissive: '#155e75', emissiveIntensity: 0.55, roughness: 0.35, metalness: 0.65 }),
      joints: new THREE.MeshStandardMaterial({ color: '#475569', roughness: 0.44, metalness: 0.45 }),
      visor: new THREE.MeshStandardMaterial({
        color: '#082f49',
        emissive: '#0e7490',
        emissiveIntensity: 0.8,
        roughness: 0.05,
        metalness: 0.75,
        transparent: true,
        opacity: 0.9,
      }),
      glow: new THREE.MeshBasicMaterial({ color: glowTint, transparent: true, opacity: 0.92, toneMapped: false }),
      flame: new THREE.MeshBasicMaterial({ color: isImmortalityActive ? '#fef08a' : '#67e8f9', transparent: true, opacity: 0.78, toneMapped: false }),
      shadow: new THREE.MeshBasicMaterial({ color: '#020617', opacity: 0.42, transparent: true }),
    };
  }, [isImmortalityActive]);

  useEffect(() => {
    if (status === GameStatus.PLAYING) {
      isJumping.current = false;
      jumpsPerformed.current = 0;
      velocityY.current = 0;
      spinRotation.current = 0;
      setLane(0);
      targetX.current = 0;
      if (groupRef.current) groupRef.current.position.set(0, 0, 0);
      if (bodyRef.current) bodyRef.current.rotation.x = 0;
    }
  }, [status]);

  useEffect(() => {
    const maxLane = Math.floor(laneCount / 2);
    if (Math.abs(lane) > maxLane) {
      setLane((currentLane) => Math.max(Math.min(currentLane, maxLane), -maxLane));
    }
  }, [laneCount, lane]);

  const triggerJump = () => {
    const maxJumps = hasDoubleJump ? 2 : 1;

    if (!isJumping.current) {
      audio.playJump(false);
      isJumping.current = true;
      jumpsPerformed.current = 1;
      velocityY.current = JUMP_FORCE;
    } else if (jumpsPerformed.current < maxJumps) {
      audio.playJump(true);
      jumpsPerformed.current += 1;
      velocityY.current = JUMP_FORCE;
      spinRotation.current = 0;
    }
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (status !== GameStatus.PLAYING) return;
      if (GAMEPLAY_KEYS.has(event.key)) event.preventDefault();

      const maxLane = Math.floor(laneCount / 2);

      if (event.key === 'ArrowLeft' || event.key === 'a' || event.key === 'A') setLane((currentLane) => Math.max(currentLane - 1, -maxLane));
      else if (event.key === 'ArrowRight' || event.key === 'd' || event.key === 'D') setLane((currentLane) => Math.min(currentLane + 1, maxLane));
      else if (event.key === 'ArrowUp' || event.key === 'w' || event.key === 'W') triggerJump();
      else if (event.key === ' ' || event.key === 'Spacebar' || event.key === 'Enter') activateImmortality();
    };

    window.addEventListener('keydown', handleKeyDown, { passive: false });
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [status, laneCount, hasDoubleJump, activateImmortality]);

  useEffect(() => {
    const handleTouchStart = (event: TouchEvent) => {
      touchStartX.current = event.touches[0].clientX;
      touchStartY.current = event.touches[0].clientY;
    };

    const handleTouchEnd = (event: TouchEvent) => {
      if (status !== GameStatus.PLAYING) return;
      const deltaX = event.changedTouches[0].clientX - touchStartX.current;
      const deltaY = event.changedTouches[0].clientY - touchStartY.current;
      const maxLane = Math.floor(laneCount / 2);

      if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 30) {
        if (deltaX > 0) setLane((currentLane) => Math.min(currentLane + 1, maxLane));
        else setLane((currentLane) => Math.max(currentLane - 1, -maxLane));
      } else if (Math.abs(deltaY) > Math.abs(deltaX) && deltaY < -30) {
        triggerJump();
      } else if (Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10) {
        activateImmortality();
      }
    };

    window.addEventListener('touchstart', handleTouchStart);
    window.addEventListener('touchend', handleTouchEnd);
    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [status, laneCount, hasDoubleJump, activateImmortality]);

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    if (status !== GameStatus.PLAYING && status !== GameStatus.SHOP) return;

    targetX.current = lane * LANE_WIDTH;
    groupRef.current.position.x = THREE.MathUtils.lerp(groupRef.current.position.x, targetX.current, delta * 15);

    if (isJumping.current) {
      groupRef.current.position.y += velocityY.current * delta;
      velocityY.current -= GRAVITY * delta;

      if (groupRef.current.position.y <= 0) {
        groupRef.current.position.y = 0;
        isJumping.current = false;
        jumpsPerformed.current = 0;
        velocityY.current = 0;
        if (bodyRef.current) bodyRef.current.rotation.x = 0;
      }

      if (jumpsPerformed.current === 2 && bodyRef.current) {
        spinRotation.current = Math.max(spinRotation.current - delta * 15, -Math.PI * 2);
        bodyRef.current.rotation.x = spinRotation.current;
      }
    }

    const xDiff = targetX.current - groupRef.current.position.x;
    groupRef.current.rotation.z = -xDiff * 0.2;
    groupRef.current.rotation.x = isJumping.current ? 0.1 : 0.05;

    const time = state.clock.elapsedTime * 18;

    if (!isJumping.current) {
      if (leftArmRef.current) leftArmRef.current.rotation.x = Math.sin(time) * 0.62;
      if (rightArmRef.current) rightArmRef.current.rotation.x = Math.sin(time + Math.PI) * 0.62;
      if (leftLegRef.current) leftLegRef.current.rotation.x = Math.sin(time + Math.PI) * 0.88;
      if (rightLegRef.current) rightLegRef.current.rotation.x = Math.sin(time) * 0.88;
      if (bodyRef.current) bodyRef.current.position.y = 1.08 + Math.abs(Math.sin(time)) * 0.075;
    } else {
      const poseSpeed = delta * 10;
      if (leftArmRef.current) leftArmRef.current.rotation.x = THREE.MathUtils.lerp(leftArmRef.current.rotation.x, -2.25, poseSpeed);
      if (rightArmRef.current) rightArmRef.current.rotation.x = THREE.MathUtils.lerp(rightArmRef.current.rotation.x, -2.25, poseSpeed);
      if (leftLegRef.current) leftLegRef.current.rotation.x = THREE.MathUtils.lerp(leftLegRef.current.rotation.x, 0.45, poseSpeed);
      if (rightLegRef.current) rightLegRef.current.rotation.x = THREE.MathUtils.lerp(rightLegRef.current.rotation.x, -0.45, poseSpeed);
      if (bodyRef.current && jumpsPerformed.current !== 2) bodyRef.current.position.y = 1.08;
    }

    if (helmetRef.current) {
      helmetRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 2.1) * 0.05;
      helmetRef.current.position.y = 0.62 + Math.sin(state.clock.elapsedTime * 3.2) * 0.015;
    }

    if (flameRef.current) {
      const flameScale = 0.85 + Math.sin(state.clock.elapsedTime * 32) * 0.28 + (isJumping.current ? 0.5 : 0);
      flameRef.current.scale.set(1, flameScale, 1);
      flameRef.current.visible = status === GameStatus.PLAYING;
    }

    if (shadowRef.current) {
      const height = groupRef.current.position.y;
      const scale = Math.max(0.2, 1 - (height / 2.5) * 0.5);
      const runStretch = isJumping.current ? 1 : 1 + Math.abs(Math.sin(time)) * 0.22;
      shadowRef.current.scale.set(scale, scale, scale * runStretch);
      const material = shadowRef.current.material as THREE.MeshBasicMaterial;
      material.opacity = Math.max(0.12, 0.42 - (height / 2.5) * 0.22);
    }

    const showFlicker = isInvincible.current || isImmortalityActive;
    if (showFlicker) {
      if (isInvincible.current) {
        if (Date.now() - lastDamageTime.current > 1500) {
          isInvincible.current = false;
          groupRef.current.visible = true;
        } else {
          groupRef.current.visible = Math.floor(Date.now() / 50) % 2 === 0;
        }
      }
      if (isImmortalityActive) groupRef.current.visible = true;
    } else {
      groupRef.current.visible = true;
    }
  });

  useEffect(() => {
    const checkHit = () => {
      if (isInvincible.current || isImmortalityActive) return;
      audio.playDamage();
      takeDamage();
      isInvincible.current = true;
      lastDamageTime.current = Date.now();
    };

    window.addEventListener('player-hit', checkHit);
    return () => window.removeEventListener('player-hit', checkHit);
  }, [takeDamage, isImmortalityActive]);

  return (
    <group name="PlayerInnerGroup" ref={groupRef} position={[0, 0, 0]}>
      <group ref={bodyRef} position={[0, 1.08, 0]}>
        <mesh castShadow position={[0, 0.18, 0]} geometry={TORSO_GEO} material={materials.suit} />
        <mesh position={[0, 0.19, 0.19]} geometry={CHEST_GLOW_GEO} material={materials.glow} />

        <group position={[0, 0.18, -0.23]}>
          <mesh geometry={PACK_GEO} material={materials.joints} />
          <mesh position={[-0.12, 0, -0.08]} rotation={[0, 0, 0]} geometry={TANK_GEO} material={materials.trim} />
          <mesh position={[0.12, 0, -0.08]} rotation={[0, 0, 0]} geometry={TANK_GEO} material={materials.trim} />
          <group ref={flameRef} position={[0, -0.38, -0.12]} rotation={[Math.PI, 0, 0]}>
            <mesh geometry={FLAME_GEO} material={materials.flame} />
          </group>
        </group>

        <group ref={helmetRef} position={[0, 0.62, 0]}>
          <mesh castShadow geometry={HELMET_GEO} material={materials.suit} />
          <mesh position={[0, 0.005, 0.12]} scale={[1, 0.72, 0.32]} rotation={[0.25, 0, 0]} geometry={VISOR_GEO} material={materials.visor} />
          <mesh position={[0.08, 0.08, 0.25]} scale={[0.5, 0.18, 0.12]} rotation={[0.2, -0.25, 0.15]} geometry={CHEST_GLOW_GEO} material={materials.glow} />
        </group>

        <group position={[0.31, 0.38, 0]}>
          <group ref={rightArmRef}>
            <mesh position={[0, -0.25, 0]} castShadow geometry={LIMB_GEO} material={materials.suit} />
            <mesh position={[0, -0.55, 0.03]} geometry={GLOVE_GEO} material={materials.trim} />
          </group>
        </group>
        <group position={[-0.31, 0.38, 0]}>
          <group ref={leftArmRef}>
            <mesh position={[0, -0.25, 0]} castShadow geometry={LIMB_GEO} material={materials.suit} />
            <mesh position={[0, -0.55, 0.03]} geometry={GLOVE_GEO} material={materials.trim} />
          </group>
        </group>

        <mesh position={[0, -0.17, 0]} scale={[1.2, 0.5, 1]} geometry={HELMET_GEO} material={materials.joints} />

        <group position={[0.13, -0.29, 0]}>
          <group ref={rightLegRef}>
            <mesh position={[0, -0.34, 0]} castShadow geometry={LIMB_GEO} material={materials.suit} />
            <mesh position={[0, -0.62, 0.04]} geometry={BOOT_GEO} material={materials.trim} />
          </group>
        </group>
        <group position={[-0.13, -0.29, 0]}>
          <group ref={leftLegRef}>
            <mesh position={[0, -0.34, 0]} castShadow geometry={LIMB_GEO} material={materials.suit} />
            <mesh position={[0, -0.62, 0.04]} geometry={BOOT_GEO} material={materials.trim} />
          </group>
        </group>
      </group>

      <mesh ref={shadowRef} position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} geometry={SHADOW_GEO} material={materials.shadow} />
    </group>
  );
};
