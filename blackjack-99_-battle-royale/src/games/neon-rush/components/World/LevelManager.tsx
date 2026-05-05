import React, { useRef, useEffect, useState, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { v4 as uuidv4 } from 'uuid';
import { useStore } from '../../store';
import { GameObject, ObjectType, LANE_WIDTH, SPAWN_DISTANCE, REMOVE_DISTANCE, GameStatus } from '../../types';
import { audio } from '../System/Audio';

const OBSTACLE_HEIGHT = 1.0;
const ASTEROID_GEOMETRY = new THREE.DodecahedronGeometry(0.68, 1);
const MINE_CORE_GEOMETRY = new THREE.SphereGeometry(0.36, 18, 12);
const MINE_RING_GEOMETRY = new THREE.TorusGeometry(0.52, 0.035, 8, 32);
const WARNING_RING_GEOMETRY = new THREE.TorusGeometry(0.88, 0.025, 8, 40);

const CRYSTAL_GEOMETRY = new THREE.OctahedronGeometry(0.34, 0);
const CRYSTAL_RING_GEOMETRY = new THREE.TorusGeometry(0.42, 0.018, 8, 32);

const UFO_BODY_GEO = new THREE.CylinderGeometry(0.62, 0.86, 0.22, 36);
const UFO_DOME_GEO = new THREE.SphereGeometry(0.42, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.52);
const UFO_LIGHT_GEO = new THREE.SphereGeometry(0.055, 10, 8);
const UFO_BEAM_GEO = new THREE.ConeGeometry(0.34, 0.95, 24);

const LASER_CORE_GEO = new THREE.CapsuleGeometry(0.12, 0.48, 6, 12);
const LASER_TRAIL_GEO = new THREE.ConeGeometry(0.16, 0.5, 16);

// Shadow Geometries
const SHADOW_GEM_GEO = new THREE.CircleGeometry(0.4, 16);
const SHADOW_ALIEN_GEO = new THREE.CircleGeometry(0.6, 16);
const SHADOW_MISSILE_GEO = new THREE.CircleGeometry(0.3, 16);
const SHADOW_DEFAULT_GEO = new THREE.CircleGeometry(0.8, 6);

const PARTICLE_COUNT = 700;

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
        
        // UFO firing logic
        if (obj.type === ObjectType.ALIEN && obj.active && !obj.hasFired) {
             if (obj.position[2] > -90) {
                 obj.hasFired = true;
                 
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
                    detail: { position: obj.position, color: '#a855f7' } 
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
                     
                     // Space hazards, UFOs, and laser bolts damage the astronaut
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
                             
                             // Visual burst for laser impact
                             if (obj.type === ObjectType.MISSILE) {
                                window.dispatchEvent(new CustomEvent('particle-burst', { 
                                    detail: { position: obj.position, color: '#fb7185' } 
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
                // UFOs enter the hazard mix once the run is moving quickly.
                const spawnUfo = speed > 25 && Math.random() < 0.25;

                if (spawnUfo) {
                    // Multi-lane UFO logic
                    const availableLanes = [];
                    const maxLane = Math.floor(laneCount / 2);
                    for (let i = -maxLane; i <= maxLane; i++) availableLanes.push(i);
                    availableLanes.sort(() => Math.random() - 0.5);

                    // Determine how many aliens to spawn 
                    let alienCount = 1;
                    const pUfo = Math.random();
                    
                    if (pUfo > 0.7) {
                        alienCount = Math.min(2, availableLanes.length);
                    }
                    if (pUfo > 0.9 && availableLanes.length >= 3) {
                        alienCount = 3;
                    }

                    for (let k = 0; k < alienCount; k++) {
                        const lane = availableLanes[k];
                        keptObjects.push({
                            id: uuidv4(),
                            type: ObjectType.ALIEN,
                            position: [lane * LANE_WIDTH, 1.5, spawnZ],
                            active: true,
                            color: '#22d3ee',
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
                        // Heavy asteroid field
                        countToSpawn = Math.min(3, availableLanes.length - 1); // never fill all lanes entirely
                    } else if (p > 0.50) {
                        // Medium asteroid field
                        countToSpawn = Math.min(2, availableLanes.length);
                    } else {
                        // Single asteroid or mine
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
                            color: Math.random() > 0.5 ? '#fb7185' : '#f97316'
                        });

                        // Chance for crystal above a hazard
                        if (Math.random() < 0.3) {
                             keptObjects.push({
                                id: uuidv4(),
                                type: ObjectType.GEM,
                                position: [laneX, OBSTACLE_HEIGHT + 1.0, spawnZ],
                                active: true,
                                color: '#facc15',
                                points: 50
                            });
                        }
                    }
                }

            } else {
                // Ground crystal spawning
                const lane = getRandomLane(laneCount);
                keptObjects.push({
                    id: uuidv4(),
                    type: ObjectType.GEM,
                    position: [lane * LANE_WIDTH, 1.2, spawnZ],
                    active: true,
                    color: '#22d3ee',
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
                 visualRef.current.rotation.z += delta * 20;
                 visualRef.current.rotation.x = Math.PI / 2;
                 visualRef.current.position.y = baseHeight;
            } else if (data.type === ObjectType.ALIEN) {
                 visualRef.current.position.y = baseHeight + Math.sin(state.clock.elapsedTime * 3 + data.position[0]) * 0.22;
                 visualRef.current.rotation.y += delta * 1.35;
            } else if (data.type !== ObjectType.OBSTACLE) {
                visualRef.current.rotation.y += delta * 3.4;
                visualRef.current.rotation.z += delta * 1.2;
                const bobOffset = Math.sin(state.clock.elapsedTime * 4 + data.position[0]) * 0.1;
                visualRef.current.position.y = baseHeight + bobOffset;
                
                if (shadowRef.current) {
                    const shadowScale = 1 - bobOffset; 
                    shadowRef.current.scale.setScalar(shadowScale);
                }
            } else {
                visualRef.current.position.y = baseHeight;
                visualRef.current.rotation.y += delta * 0.35;
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
                {/* --- SPACE HAZARD --- */}
                {data.type === ObjectType.OBSTACLE && (
                    <group>
                        <mesh geometry={ASTEROID_GEOMETRY} castShadow receiveShadow rotation={[0.5, 0.35, 0.2]} scale={[1.05, 0.88, 0.72]}>
                             <meshStandardMaterial
                                 color="#8b5e3c"
                                 emissive="#7f1d1d"
                                 emissiveIntensity={0.16}
                                 roughness={0.86}
                                 metalness={0.12}
                             />
                        </mesh>
                        <mesh geometry={MINE_CORE_GEOMETRY} castShadow position={[0.38, 0.12, 0.2]} scale={[0.72, 0.72, 0.72]}>
                            <meshStandardMaterial color="#1e293b" emissive={data.color || '#fb7185'} emissiveIntensity={0.9} roughness={0.42} metalness={0.68} />
                        </mesh>
                        <mesh geometry={MINE_RING_GEOMETRY} rotation={[Math.PI / 2, 0, 0]} position={[0.38, 0.12, 0.2]}>
                            <meshBasicMaterial color={data.color || '#fb7185'} transparent opacity={0.8} toneMapped={false} />
                        </mesh>
                        <mesh geometry={WARNING_RING_GEOMETRY} rotation={[Math.PI / 2, 0, 0]}>
                            <meshBasicMaterial color={data.color || '#fb7185'} transparent opacity={0.42} toneMapped={false} />
                        </mesh>
                    </group>
                )}

                {/* --- UFO --- */}
                {data.type === ObjectType.ALIEN && (
                    <group>
                        <mesh castShadow geometry={UFO_BODY_GEO}>
                            <meshStandardMaterial color="#94a3b8" emissive="#155e75" emissiveIntensity={0.22} metalness={0.75} roughness={0.28} />
                        </mesh>
                        <mesh position={[0, 0.11, 0]} geometry={UFO_DOME_GEO}>
                            <meshStandardMaterial color="#22d3ee" emissive="#0891b2" emissiveIntensity={0.9} transparent opacity={0.78} roughness={0.08} metalness={0.25} />
                        </mesh>
                        <mesh position={[0, -0.42, 0.18]} rotation={[Math.PI, 0, 0]} geometry={UFO_BEAM_GEO}>
                            <meshBasicMaterial color="#a855f7" transparent opacity={0.26} toneMapped={false} />
                        </mesh>
                        <mesh position={[0, -0.12, 0.46]} geometry={UFO_LIGHT_GEO}>
                             <meshBasicMaterial color="#fb7185" toneMapped={false} />
                        </mesh>
                        <mesh position={[0.42, -0.12, 0.08]} geometry={UFO_LIGHT_GEO}>
                             <meshBasicMaterial color="#facc15" toneMapped={false} />
                        </mesh>
                        <mesh position={[-0.42, -0.12, 0.08]} geometry={UFO_LIGHT_GEO}>
                             <meshBasicMaterial color="#facc15" toneMapped={false} />
                        </mesh>
                    </group>
                )}

                {/* --- LASER BOLT --- */}
                {data.type === ObjectType.MISSILE && (
                    <group>
                        <mesh geometry={LASER_CORE_GEO}>
                            <meshStandardMaterial color="#fb7185" emissive="#fb7185" emissiveIntensity={1.8} roughness={0.18} metalness={0.15} />
                        </mesh>
                        <mesh position={[0, -0.42, 0]} rotation={[Math.PI, 0, 0]} geometry={LASER_TRAIL_GEO}>
                            <meshBasicMaterial color="#a855f7" transparent opacity={0.58} toneMapped={false} />
                        </mesh>
                    </group>
                )}

                {/* --- STAR CRYSTAL --- */}
                {data.type === ObjectType.GEM && (
                    <group>
                        <mesh castShadow geometry={CRYSTAL_GEOMETRY}>
                            <meshStandardMaterial
                                color={data.color || '#22d3ee'}
                                emissive={data.color || '#22d3ee'}
                                emissiveIntensity={1.1}
                                roughness={0.18}
                                metalness={0.42}
                            />
                        </mesh>
                        <mesh rotation={[Math.PI / 2, 0, 0]} geometry={CRYSTAL_RING_GEOMETRY}>
                            <meshBasicMaterial color={data.color || '#22d3ee'} transparent opacity={0.72} toneMapped={false} />
                        </mesh>
                        <pointLight color={data.color || '#22d3ee'} intensity={0.8} distance={3} />
                    </group>
                )}
            </group>
        </group>
    );
});
