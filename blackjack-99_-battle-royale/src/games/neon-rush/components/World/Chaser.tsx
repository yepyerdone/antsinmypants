import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore } from '../../store';
import { GameStatus } from '../../types';

const BODY_GEO = new THREE.CapsuleGeometry(0.27, 0.62, 8, 14);
const HEAD_GEO = new THREE.SphereGeometry(0.34, 28, 18);
const EYE_GEO = new THREE.SphereGeometry(0.075, 16, 10);
const ANTENNA_GEO = new THREE.CylinderGeometry(0.018, 0.025, 0.45, 8);
const ANTENNA_TIP_GEO = new THREE.SphereGeometry(0.055, 12, 8);
const ARM_GEO = new THREE.CapsuleGeometry(0.055, 0.58, 6, 10);
const LEG_GEO = new THREE.CapsuleGeometry(0.06, 0.52, 6, 10);
const HAND_GEO = new THREE.SphereGeometry(0.085, 12, 8);
const SHADOW_GEO = new THREE.CircleGeometry(0.65, 32);

export const Chaser: React.FC = () => {
  const groupRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Group>(null);
  const eyeLeftRef = useRef<THREE.Mesh>(null);
  const eyeRightRef = useRef<THREE.Mesh>(null);
  const shadowRef = useRef<THREE.Mesh>(null);
  const leftArmRef = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);
  const leftLegRef = useRef<THREE.Group>(null);
  const rightLegRef = useRef<THREE.Group>(null);
  const antennaLeftRef = useRef<THREE.Group>(null);
  const antennaRightRef = useRef<THREE.Group>(null);

  const { status, speed } = useStore();
  const targetX = useRef(0);
  const currentZ = useRef(4);
  const catchDelay = useRef(0);
  const prevStatus = useRef(status);

  const materials = useMemo(
    () => ({
      skin: new THREE.MeshStandardMaterial({ color: '#6ee7b7', emissive: '#064e3b', emissiveIntensity: 0.45, roughness: 0.44 }),
      belly: new THREE.MeshStandardMaterial({ color: '#a7f3d0', emissive: '#0f766e', emissiveIntensity: 0.22, roughness: 0.5 }),
      joints: new THREE.MeshStandardMaterial({ color: '#14b8a6', emissive: '#0f766e', emissiveIntensity: 0.45, roughness: 0.35 }),
      eyes: new THREE.MeshBasicMaterial({ color: '#f0fdf4', toneMapped: false }),
      pupils: new THREE.MeshBasicMaterial({ color: '#111827', toneMapped: false }),
      glow: new THREE.MeshBasicMaterial({ color: '#a7f3d0', transparent: true, opacity: 0.55, toneMapped: false }),
      shadow: new THREE.MeshBasicMaterial({ color: '#020617', opacity: 0.4, transparent: true }),
    }),
    [],
  );

  useEffect(() => {
    if (status === GameStatus.PLAYING && prevStatus.current !== GameStatus.PLAYING) {
      currentZ.current = 5;
      targetX.current = 0;
      catchDelay.current = 0;
      if (groupRef.current) groupRef.current.position.set(0, 0, currentZ.current);
    }
    prevStatus.current = status;
  }, [status]);

  useFrame((state, delta) => {
    if (!groupRef.current) return;

    const playerInner = state.scene.getObjectByName('PlayerInnerGroup');
    if (playerInner) targetX.current = playerInner.position.x;

    let targetZ = 2.4;
    const isGameOver = status === GameStatus.GAME_OVER;

    if (isGameOver) {
      catchDelay.current += delta;
      if (catchDelay.current > 0.5) targetZ = 0.75;
    } else if (status === GameStatus.MENU) {
      targetZ = 1.55;
    } else if (status === GameStatus.PLAYING) {
      targetZ = 2.0 + speed * 0.022;
    }

    const time = state.clock.elapsedTime;
    const runTime = time * (speed > 0 ? speed * 1.35 : 10);
    const weaveOffset = status === GameStatus.PLAYING ? Math.sin(runTime * 0.28) * 0.5 - 0.72 : 0;
    const lerpSpeedX = isGameOver ? 5 : 3;

    groupRef.current.position.x = THREE.MathUtils.lerp(groupRef.current.position.x, targetX.current + weaveOffset, delta * lerpSpeedX);

    const lerpSpeedZ = isGameOver && catchDelay.current > 0.5 ? 8 : 2;
    currentZ.current = THREE.MathUtils.lerp(currentZ.current, targetZ, delta * lerpSpeedZ);
    groupRef.current.position.z = currentZ.current;

    const xDiff = targetX.current - groupRef.current.position.x;
    groupRef.current.rotation.z = -xDiff * 0.12;

    if (status === GameStatus.PLAYING) {
      if (leftArmRef.current) leftArmRef.current.rotation.x = Math.sin(runTime) * 0.68 - 0.25;
      if (rightArmRef.current) rightArmRef.current.rotation.x = Math.sin(runTime + Math.PI) * 0.68 - 0.25;
      if (leftLegRef.current) leftLegRef.current.rotation.x = Math.sin(runTime + Math.PI) * 0.72;
      if (rightLegRef.current) rightLegRef.current.rotation.x = Math.sin(runTime) * 0.72;
      if (bodyRef.current) {
        bodyRef.current.position.y = 1.18 + Math.abs(Math.sin(runTime)) * 0.13;
        bodyRef.current.rotation.y = Math.sin(runTime * 0.18) * 0.16;
      }
    } else {
      const lerpDelta = delta * 5;
      if (leftArmRef.current) leftArmRef.current.rotation.x = THREE.MathUtils.lerp(leftArmRef.current.rotation.x, -0.25, lerpDelta);
      if (rightArmRef.current) rightArmRef.current.rotation.x = THREE.MathUtils.lerp(rightArmRef.current.rotation.x, 0.25, lerpDelta);
      if (leftLegRef.current) leftLegRef.current.rotation.x = THREE.MathUtils.lerp(leftLegRef.current.rotation.x, 0.1, lerpDelta);
      if (rightLegRef.current) rightLegRef.current.rotation.x = THREE.MathUtils.lerp(rightLegRef.current.rotation.x, -0.1, lerpDelta);
      if (bodyRef.current) bodyRef.current.position.y = THREE.MathUtils.lerp(bodyRef.current.position.y, 1.18, lerpDelta);

      if (isGameOver && currentZ.current < 1.5) {
        groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, 0.45, delta * 2);
        if (rightArmRef.current) rightArmRef.current.rotation.z = THREE.MathUtils.lerp(rightArmRef.current.rotation.z, 0.85, lerpDelta);
        if (rightArmRef.current) rightArmRef.current.rotation.x = THREE.MathUtils.lerp(rightArmRef.current.rotation.x, -1.35, lerpDelta);
      } else {
        groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, 0, delta * 5);
        if (rightArmRef.current) rightArmRef.current.rotation.z = THREE.MathUtils.lerp(rightArmRef.current.rotation.z, 0, lerpDelta);
      }
    }

    const blink = Math.sin(time * 3.7) > 0.93 ? 0.18 : 1;
    if (eyeLeftRef.current) eyeLeftRef.current.scale.y = blink;
    if (eyeRightRef.current) eyeRightRef.current.scale.y = blink;
    if (antennaLeftRef.current) antennaLeftRef.current.rotation.z = 0.28 + Math.sin(time * 3.2) * 0.12;
    if (antennaRightRef.current) antennaRightRef.current.rotation.z = -0.28 - Math.sin(time * 3.1 + 1) * 0.12;
    if (shadowRef.current) shadowRef.current.scale.set(1, 1, status === GameStatus.PLAYING ? 1 + Math.abs(Math.sin(runTime)) * 0.18 : 1);
  });

  return (
    <group ref={groupRef} position={[0, 0, 4]} scale={[0.86, 0.86, 0.86]}>
      <group ref={bodyRef} position={[0, 1.18, 0]}>
        <mesh castShadow position={[0, 0.18, 0]} geometry={BODY_GEO} material={materials.skin} />
        <mesh position={[0, 0.22, 0.21]} scale={[0.72, 0.95, 0.18]} geometry={HEAD_GEO} material={materials.belly} />

        <group position={[0, 0.76, 0]}>
          <mesh castShadow geometry={HEAD_GEO} material={materials.skin} />
          <mesh ref={eyeLeftRef} position={[-0.12, 0.05, 0.29]} scale={[1.35, 1.0, 0.7]} geometry={EYE_GEO} material={materials.eyes} />
          <mesh ref={eyeRightRef} position={[0.12, 0.05, 0.29]} scale={[1.35, 1.0, 0.7]} geometry={EYE_GEO} material={materials.eyes} />
          <mesh position={[-0.12, 0.04, 0.35]} scale={[0.45, 0.45, 0.45]} geometry={EYE_GEO} material={materials.pupils} />
          <mesh position={[0.12, 0.04, 0.35]} scale={[0.45, 0.45, 0.45]} geometry={EYE_GEO} material={materials.pupils} />

          <group ref={antennaLeftRef} position={[-0.16, 0.26, 0]} rotation={[0.05, 0, 0.28]}>
            <mesh position={[0, 0.2, 0]} geometry={ANTENNA_GEO} material={materials.joints} />
            <mesh position={[0, 0.44, 0]} geometry={ANTENNA_TIP_GEO} material={materials.glow} />
          </group>
          <group ref={antennaRightRef} position={[0.16, 0.26, 0]} rotation={[0.05, 0, -0.28]}>
            <mesh position={[0, 0.2, 0]} geometry={ANTENNA_GEO} material={materials.joints} />
            <mesh position={[0, 0.44, 0]} geometry={ANTENNA_TIP_GEO} material={materials.glow} />
          </group>
        </group>

        <group position={[0.38, 0.44, 0]}>
          <group ref={rightArmRef} rotation={[0, 0, -0.18]}>
            <mesh position={[0, -0.28, 0]} castShadow geometry={ARM_GEO} material={materials.joints} />
            <mesh position={[0.02, -0.6, 0.03]} geometry={HAND_GEO} material={materials.skin} />
          </group>
        </group>
        <group position={[-0.38, 0.44, 0]}>
          <group ref={leftArmRef} rotation={[0, 0, 0.18]}>
            <mesh position={[0, -0.28, 0]} castShadow geometry={ARM_GEO} material={materials.joints} />
            <mesh position={[-0.02, -0.6, 0.03]} geometry={HAND_GEO} material={materials.skin} />
          </group>
        </group>

        <group position={[0.14, -0.28, 0]}>
          <group ref={rightLegRef}>
            <mesh position={[0, -0.28, 0]} castShadow geometry={LEG_GEO} material={materials.joints} />
          </group>
        </group>
        <group position={[-0.14, -0.28, 0]}>
          <group ref={leftLegRef}>
            <mesh position={[0, -0.28, 0]} castShadow geometry={LEG_GEO} material={materials.joints} />
          </group>
        </group>
      </group>

      <mesh ref={shadowRef} position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} geometry={SHADOW_GEO} material={materials.shadow} />
    </group>
  );
};
