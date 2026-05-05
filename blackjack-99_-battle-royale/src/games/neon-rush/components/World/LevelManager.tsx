import React, { useRef, useEffect, useState, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { v4 as uuidv4 } from 'uuid';
import { useStore } from '../../store';
import { GameObject, ObjectType, LANE_WIDTH, SPAWN_DISTANCE, REMOVE_DISTANCE, GameStatus } from '../../types';
import { audio } from '../System/Audio';

// Geometry Constants
const OBSTACLE_HEIGHT = 1.0;
const OBSTACLE_GEOMETRY = new THREE.BoxGeometry(1.6, OBSTACLE_HEIGHT, 0.5); // Road Barrier

const GEM_GEOMETRY = new THREE.CylinderGeometry(0.3, 0.3, 0.1, 16); // Coin shape

// Alien (Drone) Geometries
const ALIEN_BODY_GEO = new THREE.BoxGeometry(0.8, 0.2, 0.8);
const ALIEN_DOME_GEO = new THREE.CylinderGeometry(0.1, 0.1, 0.3, 8); // Rotors
const ALIEN_EYE_GEO = new THREE.SphereGeometry(0.1);

// Missile Geometries
const MISSILE_CORE_GEO = new THREE.SphereGeometry(0.2, 8, 8);

// Shadow Geometries
const SHADOW_GEM_GEO = new THREE.CircleGeometry(0.4, 16);
const SHADOW_ALIEN_GEO = new THREE.CircleGeometry(0.6, 16);
const SHADOW_MISSILE_GEO = new THREE.CircleGeometry(0.3, 16);
const SHADOW_DEFAULT_GEO = new THREE.CircleGeometry(0.8, 6);

const PARTICLE_COUNT = 600;

const MISSILE_SPEED = 30; // Extra speed added to world speed

// --- Particle System ---
const ParticleSystem: React.FC = () => {
    const mesh = useRef<THREE.InstancedMesh>(null);
    const dummy = useMemo(() => new THREE.Object3D(), []);
    
    const particles = useMemo(() => new Array(PARTICLE_COUNT).fill(0).map(() => ({
        life: 0,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        rot: new THREE.Vector3(),
        rotVel: new THREE.Vector3(),
        color: new THREE.Color()
    })), []);

    useEffect(() => {
        const handleExplosion = (e: CustomEvent) => {
            const { position, color } = e.detail;
            let spawned = 0;
            const burstAmount = 40; 

            for(let i = 0; i < PARTICLE_COUNT; i++) {
                const p = particles[i];
                if (p.life <= 0) {
                    p.life = 1.0 + Math.random() * 0.5; 
                    p.pos.set(position[0], position[1], position[2]);
                    
                    const theta = Math.random() * Math.PI * 2;
                    const phi = Math.acos(2 * Math.random() - 1);
                    const speed = 2 + Math.random() * 10;
                    
                    p.vel.set(
                        Math.sin(phi) * Math.cos(theta),
                        Math.sin(phi) * Math.sin(theta),
                        Math.cos(phi)
                    ).multiplyScalar(speed);

                    p.rot.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
                    p.rotVel.set(Math.random()-0.5, Math.random()-0.5, Math.random()-0.5).multiplyScalar(5);
                    
                    p.color.set(color);
                    
                    spawned++;
                    if (spawned >= burstAmount) break;
                }
            }
        };
        
        window.addEventListener('particle-burst', handleExplosion as any);
        return () => window.removeEventListener('particle-burst', handleExplosion as any);
    }, [particles]);

    useFrame((state, delta) => {
        if (!mesh.current) return;
        const safeDelta = Math.min(delta, 0.1);

        particles.forEach((p, i) => {
            if (p.life > 0) {
                p.life -= safeDelta * 1.5;
                p.pos.addScaledVector(p.vel, safeDelta);
                p.vel.y -= safeDelta * 5; 
                p.vel.multiplyScalar(0.98);

                p.rot.x += p.rotVel.x * safeDelta;
                p.rot.y += p.rotVel.y * safeDelta;
                
                dummy.position.copy(p.pos);
                const scale = Math.max(0, p.life * 0.25);
                dummy.scale.set(scale, scale, scale);
                
                dummy.rotation.set(p.rot.x, p.rot.y, p.rot.z);
                dummy.updateMatrix();
                
                mesh.current!.setMatrixAt(i, dummy.matrix);
                mesh.current!.setColorAt(i, p.color);
            } else {
                dummy.scale.set(0,0,0);
                dummy.updateMatrix();
                mesh.current!.setMatrixAt(i, dummy.matrix);
            }
        });
        
        mesh.current.instanceMatrix.needsUpdate = true;
        if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true;
    });

    return (
        <instancedMesh ref={mesh} args={[undefined, undefined, PARTICLE_COUNT]}>
            <octahedronGeometry args={[0.5, 0]} />
            <meshBasicMaterial toneMapped={false} transparent opacity={0.9} />
        </instancedMesh>
    );
};


const getRandomLane = (laneCount: number) => {
    const max = Math.floor(laneCount / 2);
    return Math.floor(Math.random() * (max * 2 + 1)) - max;
};

export const LevelManager: React.FC = () => {
  const { 
    status, 
    speed, 
    collectGem,
    addScore,
    laneCount,
    setDistance,
  } = useStore();
  
  const objectsRef = useRef<GameObject[]>([]);
  const [renderTrigger, setRenderTrigger] = useState(0);
  const prevStatus = useRef(status);

  const playerObjRef = useRef<THREE.Object3D | null>(null);
  const distanceTraveled = useRef(0);

  // Handle resets and transitions
  useEffect(() => {
    const isRestart = status === GameStatus.PLAYING && prevStatus.current === GameStatus.GAME_OVER;
    const isMenuReset = status === GameStatus.MENU;

    if (isMenuReset || isRestart) {
        // Hard Reset of objects
        objectsRef.current = [];
        setRenderTrigger(t => t + 1);
        
        // Reset trackers
        distanceTraveled.current = 0;

    } else if (status === GameStatus.GAME_OVER) {
        setDistance(Math.floor(distanceTraveled.current));
    }
    
    prevStatus.current = status;
  }, [status, setDistance]);

  useFrame((state) => {
      if (!playerObjRef.current) {
          const group = state.scene.getObjectByName('PlayerGroup');
          if (group && group.children.length > 0) {
              playerObjRef.current = group.children[0];
          }
      }
  });

  useFrame((state, delta) => {
    if (status !== GameStatus.PLAYING) return;

    const safeDelta = Math.min(delta, 0.05); 
    const dist = speed * safeDelta;
    
    distanceTraveled.current += dist;
    
    // Add points constantly based on distance
    addScore(dist * 0.2); // Score calculation
    setDistance(distanceTraveled.current);

    let hasChanges = false;
    let playerPos = new THREE.Vector3(0, 0, 0);
    
    if (playerObjRef.current) {
        playerObjRef.current.getWorldPosition(playerPos);
    }

    // 1. Move & Update
    const currentObjects = objectsRef.current;
    const keptObjects: GameObject[] = [];
    const newSpawns: GameObject[] = [];

    for (const obj of currentObjects) {
        // Standard Movement
        let moveAmount = dist;
        
        // Missile Movement (Moves faster than world)
        if (obj.type === ObjectType.MISSILE) {
            moveAmount += MISSILE_SPEED * safeDelta;
        }

        // Store previous Z for swept collision check (prevents tunneling)
        const prevZ = obj.position[2];
        obj.position[2] += moveAmount;
        
        // Alien AI Logic
        if (obj.type === ObjectType.ALIEN && obj.active && !obj.hasFired) {
             // Fire when within range (e.g., -90 units away)
             if (obj.position[2] > -90) {
                 obj.hasFired = true;
                 
                 // Spawn Missile
                 newSpawns.push({
                     id: uuidv4(),
                     type: ObjectType.MISSILE,
                     position: [obj.position[0], 1.0, obj.position[2] + 2], // Spawn slightly in front
                     active: true,
                     color: '#ff0000'
                 });
                 hasChanges = true;
                 
                 // Visual flare event
                 window.dispatchEvent(new CustomEvent('particle-burst', { 
                    detail: { position: obj.position, color: '#ff00ff' } 
                 }));
             }
        }

        let keep = true;
        if (obj.active) {
            // Swept Collision: Check if object's path [prevZ, currentZ] overlaps with player collision zone
            // INCREASED THRESHOLD from 1.0 to 2.0 to prevent missile tunneling at low FPS/High Speed
            const zThreshold = 2.0; 
            const inZZone = (prevZ < playerPos.z + zThreshold) && (obj.position[2] > playerPos.z - zThreshold);
            
            if (inZZone) {
                // STANDARD COLLISION
                const dx = Math.abs(obj.position[0] - playerPos.x);
                if (dx < 0.9) { // Slightly increased horizontal forgiveness
                     
                     // Obstacles, Aliens, and Missiles damage player
                     const isDamageSource = obj.type === ObjectType.OBSTACLE || obj.type === ObjectType.ALIEN || obj.type === ObjectType.MISSILE;
                     
                     if (isDamageSource) {
                         // VERTICAL COLLISION WITH BOUNDS CHECK
                         // More robust than simple distance check for jumping/running
                         const playerBottom = playerPos.y;
                         const playerTop = playerPos.y + 1.8; // Approx height of player

                         let objBottom = obj.position[1] - 0.5;
                         let objTop = obj.position[1] + 0.5;

                         if (obj.type === ObjectType.OBSTACLE) {
                             objBottom = 0;
                             objTop = OBSTACLE_HEIGHT;
                         } else if (obj.type === ObjectType.MISSILE) {
                             // Missile at Y=1.0
                             objBottom = 0.5;
                             objTop = 1.5;
                         }

                         const isHit = (playerBottom < objTop) && (playerTop > objBottom);

                         if (isHit) { 
                             window.dispatchEvent(new Event('player-hit'));
                             obj.active = false; 
                             hasChanges = true;
                             
                             // Visual burst for missile impact
                             if (obj.type === ObjectType.MISSILE) {
                                window.dispatchEvent(new CustomEvent('particle-burst', { 
                                    detail: { position: obj.position, color: '#ff4400' } 
                                }));
                             }
                         }
                     } else {
                         // Item Collection
                         const dy = Math.abs(obj.position[1] - playerPos.y);
                         if (dy < 2.5) { // Generous vertical pickup range
                            if (obj.type === ObjectType.GEM) {
                                collectGem(obj.points || 50);
                                audio.playGemCollect();
                            }
                            
                            window.dispatchEvent(new CustomEvent('particle-burst', { 
                                detail: { 
                                    position: obj.position, 
                                    color: obj.color || '#ffffff' 
                                } 
                            }));

                            obj.active = false;
                            hasChanges = true;
                         }
                     }
                }
            }
        }

        if (obj.position[2] > REMOVE_DISTANCE) {
            keep = false;
            hasChanges = true;
        }

        if (keep) {
            keptObjects.push(obj);
        }
    }

    // Add any newly spawned entities (Missiles)
    if (newSpawns.length > 0) {
        keptObjects.push(...newSpawns);
    }

    // 2. Spawning Logic
    let furthestZ = 0;
    // Only consider static obstacles/gems for gap calculation, not missiles or moving aliens
    const staticObjects = keptObjects.filter(o => o.type !== ObjectType.MISSILE);
    
    if (staticObjects.length > 0) {
        furthestZ = Math.min(...staticObjects.map(o => o.position[2]));
    } else {
        furthestZ = -20;
    }

    if (furthestZ > -SPAWN_DISTANCE) {
         // Reduced gap formula to increase obstacle frequency. Endless mode speeds up and adds more obstacles.
         const minGap = 12 + (speed * 0.4); 
         const spawnZ = Math.min(furthestZ - minGap, -SPAWN_DISTANCE);
         
         if (Math.random() > 0.1) { // 90% chance to attempt spawn if gap exists
            
            // Increased obstacle probability
            const isObstacle = Math.random() > 0.20;

            if (isObstacle) {
                // Decide between Alien or Spikes based on distance/speed. Aliens spawn more often late game.
                const spawnAlien = (speed > 25) && Math.random() < 0.25; 

                if (spawnAlien) {
                    // Multi-Lane Alien Logic
                    const availableLanes = [];
                    const maxLane = Math.floor(laneCount / 2);
                    for (let i = -maxLane; i <= maxLane; i++) availableLanes.push(i);
                    availableLanes.sort(() => Math.random() - 0.5);

                    // Determine how many aliens to spawn 
                    let alienCount = 1;
                    const pAlien = Math.random();
                    
                    if (pAlien > 0.7) {
                        alienCount = Math.min(2, availableLanes.length);
                    }
                    if (pAlien > 0.9 && availableLanes.length >= 3) {
                        alienCount = 3;
                    }

                    for (let k = 0; k < alienCount; k++) {
                        const lane = availableLanes[k];
                        keptObjects.push({
                            id: uuidv4(),
                            type: ObjectType.ALIEN,
                            position: [lane * LANE_WIDTH, 1.5, spawnZ],
                            active: true,
                            color: '#00ff00',
                            hasFired: false
                        });
                    }
                } else {
                    // Standard Obstacle Spawning
                    const availableLanes = [];
                    const maxLane = Math.floor(laneCount / 2);
                    for (let i = -maxLane; i <= maxLane; i++) availableLanes.push(i);
                    availableLanes.sort(() => Math.random() - 0.5);
                    
                    let countToSpawn = 1;
                    const p = Math.random();

                    if (p > 0.80) {
                        // Triple Spike
                        countToSpawn = Math.min(3, availableLanes.length - 1); // never fill all lanes entirely
                    } else if (p > 0.50) {
                        // Double Spike
                        countToSpawn = Math.min(2, availableLanes.length);
                    } else {
                        // Single Spike
                        countToSpawn = 1;
                    }

                    for (let i = 0; i < countToSpawn; i++) {
                        const lane = availableLanes[i];
                        const laneX = lane * LANE_WIDTH;
                        
                        keptObjects.push({
                            id: uuidv4(),
                            type: ObjectType.OBSTACLE,
                            position: [laneX, OBSTACLE_HEIGHT / 2, spawnZ],
                            active: true,
                            color: '#ff0054'
                        });

                        // Chance for gem on top of obstacle
                        if (Math.random() < 0.3) {
                             keptObjects.push({
                                id: uuidv4(),
                                type: ObjectType.GEM,
                                position: [laneX, OBSTACLE_HEIGHT + 1.0, spawnZ],
                                active: true,
                                color: '#ffd700',
                                points: 50
                            });
                        }
                    }
                }

            } else {
                // GROUND GEM SPAWNING
                const lane = getRandomLane(laneCount);
                keptObjects.push({
                    id: uuidv4(),
                    type: ObjectType.GEM,
                    position: [lane * LANE_WIDTH, 1.2, spawnZ],
                    active: true,
                    color: '#00ffff',
                    points: 50
                });
            }
            hasChanges = true;
         }
    }

    if (hasChanges) {
        objectsRef.current = keptObjects;
        setRenderTrigger(t => t + 1);
    }
  });

  return (
    <group>
      <ParticleSystem />
      {objectsRef.current.map(obj => {
        if (!obj.active) return null;
        return <GameEntity key={obj.id} data={obj} />;
      })}
    </group>
  );
};

const GameEntity: React.FC<{ data: GameObject }> = React.memo(({ data }) => {
    const groupRef = useRef<THREE.Group>(null);
    const visualRef = useRef<THREE.Group>(null);
    const shadowRef = useRef<THREE.Mesh>(null);
    
    useFrame((state, delta) => {
        // 1. Move Main Container
        if (groupRef.current) {
            groupRef.current.position.set(data.position[0], 0, data.position[2]);
        }

        // 2. Animate Visuals
        if (visualRef.current) {
            const baseHeight = data.position[1];
            
            if (data.type === ObjectType.MISSILE) {
                 // Missile rotation
                 visualRef.current.rotation.z += delta * 20; // Fast spin
                 visualRef.current.position.y = baseHeight;
            } else if (data.type === ObjectType.ALIEN) {
                 // Alien Hover
                 visualRef.current.position.y = baseHeight + Math.sin(state.clock.elapsedTime * 3) * 0.2;
                 visualRef.current.rotation.y += delta;
            } else if (data.type !== ObjectType.OBSTACLE) {
                // Gem Bobbing
                visualRef.current.rotation.y += delta * 3;
                const bobOffset = Math.sin(state.clock.elapsedTime * 4 + data.position[0]) * 0.1;
                visualRef.current.position.y = baseHeight + bobOffset;
                
                if (shadowRef.current) {
                    const shadowScale = 1 - bobOffset; 
                    shadowRef.current.scale.setScalar(shadowScale);
                }
            } else {
                visualRef.current.position.y = baseHeight;
            }
        }
    });

    // Select Shadow Geometry based on type (using shared geometries)
    const shadowGeo = useMemo(() => {
        if (data.type === ObjectType.GEM) return SHADOW_GEM_GEO;
        if (data.type === ObjectType.ALIEN) return SHADOW_ALIEN_GEO;
        if (data.type === ObjectType.MISSILE) return SHADOW_MISSILE_GEO;
        return SHADOW_DEFAULT_GEO; 
    }, [data.type]);

    return (
        <group ref={groupRef} position={[data.position[0], 0, data.position[2]]}>
            {shadowGeo && (
                <mesh ref={shadowRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]} geometry={shadowGeo}>
                    <meshBasicMaterial color="#000000" opacity={0.3} transparent />
                </mesh>
            )}

            <group ref={visualRef} position={[0, data.position[1], 0]}>
                {/* --- OBSTACLE --- */}
                {data.type === ObjectType.OBSTACLE && (
                    <group>
                        {/* Base Barrier */}
                        <mesh geometry={OBSTACLE_GEOMETRY} castShadow receiveShadow>
                             <meshStandardMaterial 
                                 color="#ff2222" // Red barrier
                                 roughness={0.7} 
                                 metalness={0.1} 
                             />
                        </mesh>
                        {/* White Stripe Overlay */}
                        <mesh position={[0, 0, 0.26]} castShadow receiveShadow>
                             <planeGeometry args={[1.6, 0.3]} />
                             <meshStandardMaterial color="#ffffff" roughness={0.9} />
                        </mesh>
                    </group>
                )}

                {/* --- ALIEN --- */}
                {data.type === ObjectType.ALIEN && (
                    <group>
                        {/* Drone Body */}
                        <mesh castShadow geometry={ALIEN_BODY_GEO}>
                            <meshStandardMaterial color="#eeeeee" metalness={0.2} roughness={0.5} />
                        </mesh>
                        {/* Rotors */}
                        <mesh position={[0.4, 0.2, 0.4]} geometry={ALIEN_DOME_GEO}>
                            <meshStandardMaterial color="#222222" />
                        </mesh>
                        <mesh position={[-0.4, 0.2, 0.4]} geometry={ALIEN_DOME_GEO}>
                            <meshStandardMaterial color="#222222" />
                        </mesh>
                        <mesh position={[0.4, 0.2, -0.4]} geometry={ALIEN_DOME_GEO}>
                            <meshStandardMaterial color="#222222" />
                        </mesh>
                        <mesh position={[-0.4, 0.2, -0.4]} geometry={ALIEN_DOME_GEO}>
                            <meshStandardMaterial color="#222222" />
                        </mesh>
                        {/* Glowing Light */}
                        <mesh position={[0, -0.1, 0.3]} geometry={ALIEN_EYE_GEO}>
                             <meshBasicMaterial color="#00aaff" />
                        </mesh>
                    </group>
                )}

                {/* --- MISSILE (Drone Pellet) --- */}
                {data.type === ObjectType.MISSILE && (
                    <group rotation={[Math.PI / 2, 0, 0]}>
                        <mesh geometry={MISSILE_CORE_GEO}>
                            <meshStandardMaterial color="#00aaff" emissive="#00aaff" emissiveIntensity={1} />
                        </mesh>
                    </group>
                )}

                {/* --- GEM (Coin) --- */}
                {data.type === ObjectType.GEM && (
                    <mesh rotation={[Math.PI / 2, 0, 0]} castShadow geometry={GEM_GEOMETRY}>
                        <meshStandardMaterial 
                            color="#ffd700" 
                            roughness={0.2} 
                            metalness={0.8} 
                        />
                    </mesh>
                )}
            </group>
        </group>
    );
});
