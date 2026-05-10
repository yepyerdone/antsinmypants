/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { RigidBody, RapierRigidBody, useRapier, CapsuleCollider } from '@react-three/rapier';
import * as THREE from 'three';
import { useGameStore } from '../store';

const SPEED = 12;
const MAX_LASER_DIST = 100;
const MOUSE_SENSITIVITY = 0.002;
const DOOR_INTERACTION_DISTANCE = 10.5;

export function Player() {
  const body = useRef<RapierRigidBody>(null);
  const { camera } = useThree();
  const { rapier, world } = useRapier();
  
  const playerState = useGameStore(state => state.playerState);
  const gameState = useGameStore(state => state.gameState);
  const addLaser = useGameStore(state => state.addLaser);
  const hitEnemy = useGameStore(state => state.hitEnemy);
  const addParticles = useGameStore(state => state.addParticles);
  const openSpawnDoor = useGameStore(state => state.openSpawnDoor);

  const keys = useRef({ 
    w: false, a: false, s: false, d: false,
    arrowup: false, arrowdown: false, arrowleft: false, arrowright: false 
  });
  const lastEmitTime = useRef(0);
  const lastShootTime = useRef(0);
  const isDragLooking = useRef(false);
  const fallbackLookActive = useRef(false);

  const gunGroupRef = useRef<THREE.Group>(null);
  const gunVisualRef = useRef<THREE.Group>(null);
  const gunBarrelRef = useRef<THREE.Group>(null);

  // More robust mobile detection (checks for touch support)
  const isTouchDevice = useRef(false);
  useEffect(() => {
    isTouchDevice.current = window.matchMedia('(pointer: coarse)').matches || 
                           'ontouchstart' in window || 
                           navigator.maxTouchPoints > 0;
  }, []);

  useEffect(() => {
    camera.rotation.order = 'YXZ';
  }, [camera]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key in keys.current) {
        keys.current[key as keyof typeof keys.current] = true;
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key in keys.current) {
        keys.current[key as keyof typeof keys.current] = false;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Shooting logic function
  const shoot = () => {
    const state = useGameStore.getState();
    if (state.gameState !== 'playing' || state.playerState !== 'active') return;
    
    // Rate limit shooting
    const now = Date.now();
    if (now - lastShootTime.current < 200) return;
    lastShootTime.current = now;

    // Raycast from camera
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);

    // Start raycast slightly ahead of the camera to avoid hitting the player's own collider
    const rayStart = camera.position.clone().add(raycaster.ray.direction.clone().multiplyScalar(0.8));
    const ray = new rapier.Ray(rayStart, raycaster.ray.direction);
    const hit = world.castRay(ray, MAX_LASER_DIST, true);

    const startPosVec = new THREE.Vector3();
    if (gunBarrelRef.current) {
      gunBarrelRef.current.getWorldPosition(startPosVec);
    } else {
      startPosVec.copy(camera.position);
    }
    const startPos: [number, number, number] = [startPosVec.x, startPosVec.y, startPosVec.z];

    // Apply recoil
    if (gunVisualRef.current) {
      gunVisualRef.current.position.z = -0.4;
      gunVisualRef.current.rotation.x = 0.1;
    }

    let endPos: [number, number, number];

    if (hit) {
      const hitPoint = ray.pointAt(hit.timeOfImpact);
      endPos = [hitPoint.x, hitPoint.y, hitPoint.z];
      
      const collider = hit.collider;
      const rb = collider.parent();
      if (rb && rb.userData) {
        const userData = rb.userData as { name?: string };
        const name = userData.name;
        
        if (name) {
          if (name === 'spawn-door' && camera.position.distanceTo(hitPoint) <= DOOR_INTERACTION_DISTANCE) {
            openSpawnDoor();
            addParticles(endPos, '#facc15');
            addLaser(startPos, endPos, '#facc15');
            return;
          }

          // Check if it's an enemy
          if (name.startsWith('enemy-') || name.startsWith('bot-')) {
            hitEnemy(name, true);
          } 
        }
      }
      
      addParticles(endPos, '#ffff00');
    } else {
      endPos = [
        camera.position.x + raycaster.ray.direction.x * MAX_LASER_DIST,
        camera.position.y + raycaster.ray.direction.y * MAX_LASER_DIST,
        camera.position.z + raycaster.ray.direction.z * MAX_LASER_DIST
      ];
    }

    addLaser(startPos, endPos, '#ffff00');
  };

  const prevState = useRef(gameState);

  useEffect(() => {
    if (gameState === 'playing' && prevState.current !== 'playing') {
      // Game started, reset position
      if (body.current) {
        body.current.setTranslation({ x: 0, y: 5, z: 0 }, true);
        body.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
      }
    }
    prevState.current = gameState;
  }, [gameState]);

  useFrame((state, delta) => {
    if (!body.current) return;
    const { camera } = state;
    const currentGameState = useGameStore.getState().gameState;

    // Movement logic - only when playing
    if (currentGameState === 'playing') {
      const mobileInput = useGameStore.getState().mobileInput;

      // Handle Mobile Shooting
      if (mobileInput.shooting) {
        shoot();
      }

      // Movement
      const velocity = body.current.linvel();
      const k = keys.current;
      
      const forward = new THREE.Vector3();
      camera.getWorldDirection(forward);
      forward.y = 0;
      if (forward.lengthSq() > 0.001) forward.normalize();

      const right = new THREE.Vector3();
      right.crossVectors(forward, camera.up).normalize();

      const direction = new THREE.Vector3();
      if (k.w || k.arrowup) direction.add(forward);
      if (k.s || k.arrowdown) direction.sub(forward);
      if (k.a || k.arrowleft) direction.sub(right);
      if (k.d || k.arrowright) direction.add(right);
      
      // Joypad input
      if (Math.abs(mobileInput.move.x) > 0.01 || Math.abs(mobileInput.move.y) > 0.01) {
        direction.addScaledVector(forward, -mobileInput.move.y);
        direction.addScaledVector(right, mobileInput.move.x);
      }

      if (direction.lengthSq() > 0.1) {
        direction.normalize().multiplyScalar(SPEED);
      } else {
        direction.set(0, 0, 0);
      }

      // Preserve gravity, and directly advance horizontal movement so input
      // remains responsive even if contact friction or sleep state interferes.
      body.current.setLinvel({ x: 0, y: velocity.y, z: 0 }, true);
      if (direction.lengthSq() > 0.1) {
        const pos = body.current.translation();
        body.current.setTranslation({
          x: pos.x + direction.x * delta,
          y: pos.y,
          z: pos.z + direction.z * delta
        }, true);
      }

      // Mobile Look Rotation
      if (Math.abs(mobileInput.look.x) > 0.01 || Math.abs(mobileInput.look.y) > 0.01) {
        const lookSpeed = 2.0 * delta;
        camera.rotation.y -= mobileInput.look.x * lookSpeed;
        camera.rotation.x -= mobileInput.look.y * lookSpeed;
        camera.rotation.x = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, camera.rotation.x));
      }
    }

    // Always update camera position to follow rigid body
    const pos = body.current.translation();
    camera.position.set(pos.x, pos.y + 1.6, pos.z);

    // Sync gun to camera
    if (gunGroupRef.current) {
      gunGroupRef.current.position.copy(camera.position);
      gunGroupRef.current.quaternion.copy(camera.quaternion);
    }
    
    // Recover recoil
    if (gunVisualRef.current) {
      gunVisualRef.current.position.z = THREE.MathUtils.lerp(gunVisualRef.current.position.z, -0.6, delta * 15);
      gunVisualRef.current.rotation.x = THREE.MathUtils.lerp(gunVisualRef.current.rotation.x, 0, delta * 15);
    }
  });

  useEffect(() => {
    const isCanvasEvent = (event: MouseEvent) => event.target instanceof HTMLCanvasElement;

    const handleMouseDown = (event: MouseEvent) => {
      const state = useGameStore.getState();
      if (state.gameState !== 'playing' || state.playerState !== 'active') return;
      const isCanvas = isCanvasEvent(event);

      if (document.pointerLockElement || isCanvas) {
        shoot();
      }

      if (!document.pointerLockElement && isCanvas && event.button === 0) {
        isDragLooking.current = true;
        fallbackLookActive.current = true;

        const canvas = event.target as HTMLCanvasElement;
        try {
          canvas.requestPointerLock().catch(() => {
            // Embedded browsers can reject pointer lock. Drag-look still works.
          });
        } catch {
          // Keep fallback controls active when pointer lock is unavailable.
        }
      }
    };

    const handleMouseUp = () => {
      isDragLooking.current = false;
    };

    const handleMouseMove = (event: MouseEvent) => {
      const state = useGameStore.getState();
      if (
        state.gameState !== 'playing' ||
        state.playerState !== 'active' ||
        (!document.pointerLockElement && !isDragLooking.current && !fallbackLookActive.current)
      ) {
        return;
      }

      const sensitivity = useGameStore.getState().sensitivity;
      camera.rotation.y -= event.movementX * MOUSE_SENSITIVITY * sensitivity;
      camera.rotation.x -= event.movementY * MOUSE_SENSITIVITY * sensitivity;
      camera.rotation.x = Math.max(
        -Math.PI / 2 + 0.1,
        Math.min(Math.PI / 2 - 0.1, camera.rotation.x)
      );
    };

    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('blur', handleMouseUp);
    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('blur', handleMouseUp);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [gameState, playerState, camera, world, rapier, hitEnemy, addParticles, addLaser, openSpawnDoor]);

  return (
    <>
      <RigidBody
        ref={body}
        colliders={false}
        mass={1}
        type="dynamic"
        position={[0, 5, 0]}
        enabledRotations={[false, false, false]}
        userData={{ name: 'player' }}
        friction={0}
        canSleep={false}
        ccd={true}
      >
        <CapsuleCollider args={[0.75, 0.35]} friction={0} />
      </RigidBody>

      {/* First Person Gun (Circus Style) */}
      <group ref={gunGroupRef}>
        <group ref={gunVisualRef} position={[0.4, -0.3, -0.6]}>
          {/* Main body */}
          <mesh position={[0, 0, 0.2]}>
            <boxGeometry args={[0.15, 0.2, 0.5]} />
            <meshStandardMaterial color="#ffffff" roughness={0.5} />
          </mesh>
          {/* Barrel */}
          <mesh position={[0, 0.05, -0.15]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.04, 0.04, 0.4, 8]} />
            <meshStandardMaterial color="#ff0000" roughness={0.2} />
          </mesh>
          {/* Circus Stripes/Accents */}
          <mesh position={[0, 0.11, 0.1]}>
            <boxGeometry args={[0.16, 0.05, 0.3]} />
            <meshBasicMaterial color="#ffff00" toneMapped={false} />
          </mesh>
          {/* Red nose at the tip */}
          <mesh position={[0, 0.05, -0.35]}>
            <sphereGeometry args={[0.08, 16, 16]} />
            <meshStandardMaterial color="#ff0000" />
          </mesh>
          {/* Barrel Tip Reference */}
          <group ref={gunBarrelRef} position={[0, 0.05, -0.35]} />
        </group>
      </group>
    </>
  );
}
