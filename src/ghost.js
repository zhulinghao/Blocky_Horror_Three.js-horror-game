// import * as THREE from '../three.min.js';
import { materials } from './utils.js';

export class Ghost {
    constructor(scene, world, player, listener, soundGen) {
        this.scene = scene;
        this.world = world;
        this.player = player;
        this.listener = listener;
        this.soundGen = soundGen;
        
        this.mesh = new THREE.Group();
        this.pos = new THREE.Vector3();
        this.target = new THREE.Vector3();
        this.state = 'patrol';
        this.speed = 2.8; // Reduced by 20% (was 3.5)
        
        this.path = [];
        this.pathIndex = 0;
        this.lastPathTime = 0;
        
        this.raycaster = new THREE.Raycaster();
        
        this.createMesh();
    }

    createMesh() {
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.8, 0.3), materials.obsidian);
        body.position.y = 0.9;
        this.mesh.add(body);
        
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), materials.obsidian);
        head.position.y = 2.05;
        this.mesh.add(head);

        const eyeGeo = new THREE.BoxGeometry(0.1, 0.05, 0.05);
        const leftEye = new THREE.Mesh(eyeGeo, materials.glow);
        leftEye.position.set(-0.1, 2.05, 0.26);
        this.mesh.add(leftEye);
        
        const rightEye = new THREE.Mesh(eyeGeo, materials.glow);
        rightEye.position.set(0.1, 2.05, 0.26);
        this.mesh.add(rightEye);

        // Ghost Sound
        if (this.listener && this.soundGen) {
            const sound = new THREE.PositionalAudio(this.listener);
            const buffer = this.soundGen.getGhostBuffer();
            if (buffer) {
                sound.setBuffer(buffer);
                sound.setRefDistance(1); // Reduced from 5 to make it sound closer/drop off faster
                sound.setRolloffFactor(2); // Increase rolloff for sharper distance attenuation
                sound.setLoop(true);
                sound.setVolume(1.5);
                sound.play();
            }
            this.mesh.add(sound);
        }

        this.scene.add(this.mesh);
    }

    spawn() {
        let spawnNode = this.world.walkableNodes[0];
        let maxDist = 0;
        for(let node of this.world.walkableNodes) {
            const d = node.distanceTo(this.player.pos);
            if (d > maxDist) {
                maxDist = d;
                spawnNode = node;
            }
        }
        if(spawnNode) {
            this.pos.copy(spawnNode);
            this.pos.y = 1;
            this.target.copy(this.pos);
            this.mesh.position.copy(this.pos);
        }
    }

    findPath(start, end) {
        const offsetX = -this.world.MAP_WIDTH/2;
        const offsetZ = -this.world.MAP_DEPTH/2;
        
        const startNode = {
            x: Math.round(start.x - offsetX),
            z: Math.round(start.z - offsetZ)
        };
        const endNode = {
            x: Math.round(end.x - offsetX),
            z: Math.round(end.z - offsetZ)
        };

        // Simple BFS/A* for grid
        const open = [startNode];
        const cameFrom = {};
        const cost = {};
        const key = (n) => `${n.x},${n.z}`;
        
        cost[key(startNode)] = 0;
        
        let found = false;
        let closest = startNode;
        let minDist = Infinity;

        // Limit iterations to prevent lag
        let iterations = 0;
        
        while(open.length > 0 && iterations < 2000) {
            iterations++;
            // Sort by cost + heuristic (A*)
            open.sort((a, b) => {
                const fA = cost[key(a)] + (Math.abs(a.x - endNode.x) + Math.abs(a.z - endNode.z));
                const fB = cost[key(b)] + (Math.abs(b.x - endNode.x) + Math.abs(b.z - endNode.z));
                return fA - fB;
            });
            
            const current = open.shift();
            
            // Check if reached end (or close enough)
            const d = Math.abs(current.x - endNode.x) + Math.abs(current.z - endNode.z);
            if (d < minDist) {
                minDist = d;
                closest = current;
            }
            
            if (d === 0) {
                found = true;
                break;
            }
            
            const neighbors = [
                {x: current.x+1, z: current.z},
                {x: current.x-1, z: current.z},
                {x: current.x, z: current.z+1},
                {x: current.x, z: current.z-1}
            ];
            
            for(let next of neighbors) {
                // Bounds
                if(next.x < 0 || next.x >= this.world.MAP_WIDTH || next.z < 0 || next.z >= this.world.MAP_DEPTH) continue;
                
                // Collision Check
                // 1. Grid Wall
                if(this.world.grid[next.x][next.z] === 1) continue;
                
                // 2. Furniture (Check blocks map)
                // World coords of next node
                const wx = next.x + offsetX;
                const wz = next.z + offsetZ;
                // Check height 1 and 2
                if (this.world.blocks.has(`${wx},1,${wz}`) || this.world.blocks.has(`${wx},2,${wz}`)) continue;
                
                const newCost = cost[key(current)] + 1;
                if (!(key(next) in cost) || newCost < cost[key(next)]) {
                    cost[key(next)] = newCost;
                    cameFrom[key(next)] = current;
                    open.push(next);
                }
            }
        }
        
        // Reconstruct
        const path = [];
        let curr = found ? endNode : closest; // If not found, go to closest reachable
        
        while(key(curr) !== key(startNode)) {
            const wx = curr.x + offsetX;
            const wz = curr.z + offsetZ;
            path.push(new THREE.Vector3(wx, 1, wz));
            curr = cameFrom[key(curr)];
            if(!curr) break;
        }
        return path.reverse();
    }

    update(dt) {
        const dist = this.mesh.position.distanceTo(this.player.pos);
        
        // 1. Vision Check
        let canSee = false;
        if (!this.player.isHidden && dist < 20) {
            const toPlayer = new THREE.Vector3().subVectors(this.player.pos, this.mesh.position).normalize();
            const ghostDir = new THREE.Vector3(0, 0, 1).applyQuaternion(this.mesh.quaternion);
            
            if (toPlayer.dot(ghostDir) > 0.3) { // Wider angle
                // Raycast check for walls
                this.raycaster.set(this.mesh.position.clone().add(new THREE.Vector3(0,1.5,0)), toPlayer);
                const hits = this.raycaster.intersectObjects(this.scene.children);
                
                let hitWall = false;
                for(let hit of hits) {
                    if (hit.distance < dist) {
                        // Check if it's a wall/block
                        if (hit.object.geometry && hit.object.geometry.type === 'BoxGeometry') {
                            hitWall = true;
                            break;
                        }
                    }
                }
                if (!hitWall) canSee = true;
            }
        }

        // 2. State Machine
        if (canSee) {
            this.state = 'chase';
            this.target.copy(this.player.pos);
        } else {
            if (this.state === 'chase') {
                if (this.mesh.position.distanceTo(this.target) < 1) this.state = 'patrol';
            }
        }

        // 3. Pathfinding Logic
        const now = Date.now();
        if (this.state === 'chase') {
            // Re-path to player every 0.5s
            if (now - this.lastPathTime > 500) {
                this.path = this.findPath(this.mesh.position, this.target);
                this.pathIndex = 0;
                this.lastPathTime = now;
            }
        } else if (this.state === 'patrol') {
            // If no path or finished, pick new target
            if (this.path.length === 0 || this.pathIndex >= this.path.length) {
                if(this.world.walkableNodes.length > 0) {
                    const rNode = this.world.walkableNodes[Math.floor(Math.random() * this.world.walkableNodes.length)];
                    this.target.copy(rNode);
                    this.path = this.findPath(this.mesh.position, this.target);
                    this.pathIndex = 0;
                }
            }
        }

        // 4. Movement along path
        if (this.path.length > 0 && this.pathIndex < this.path.length) {
            const nextPoint = this.path[this.pathIndex];
            const dir = new THREE.Vector3().subVectors(nextPoint, this.mesh.position);
            dir.y = 0;
            const d = dir.length();
            
            if (d < 0.1) {
                this.pathIndex++;
            } else {
                dir.normalize();
                this.mesh.lookAt(nextPoint.x, this.mesh.position.y, nextPoint.z);
                
                const moveSpeed = this.state === 'chase' ? this.speed * 1.5 : this.speed;
                this.mesh.position.add(dir.multiplyScalar(moveSpeed * dt));
            }
        }

        return (!this.player.isHidden && dist < 1.0); // Return true if killed
    }
}
