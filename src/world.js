// import * as THREE from '../three.min.js';
import { materials } from './utils.js';

export class World {
    constructor(scene) {
        this.scene = scene;
        this.BLOCK_SIZE = 1;
        this.WALL_HEIGHT = 3;
        this.MAP_WIDTH = 80;
        this.MAP_DEPTH = 80;
        
        this.blocks = new Map(); // Key: "x,y,z", Value: Box3
        this.interactables = []; // { type, pos, box }
        this.walkableNodes = []; // Vector3[]
        this.grid = [];
        this.lightSwitch = null; // { pos, box }
        this.switchRoomId = -1;
        this.spawnRoomId = -1;
        
        this.geometry = new THREE.BoxGeometry(this.BLOCK_SIZE, this.BLOCK_SIZE, this.BLOCK_SIZE);
    }

    addBlock(x, y, z, type, collidable = true) {
        const mesh = new THREE.Mesh(this.geometry, materials[type]);
        mesh.position.set(x, y, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.scene.add(mesh);

        if (collidable) {
            const box = new THREE.Box3().setFromObject(mesh);
            this.blocks.set(`${Math.round(x)},${Math.round(y)},${Math.round(z)}`, box);
        }
        return mesh;
    }

    createRoomNumber(x, y, z, number) {
        const canvas = document.createElement('canvas');
        canvas.width = 128; canvas.height = 128;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, 128, 128);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 80px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(number.toString(), 64, 64);
        
        const tex = new THREE.CanvasTexture(canvas);
        const mat = new THREE.MeshBasicMaterial({ map: tex });
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
        mesh.position.set(x, y, z);
        mesh.rotation.x = -Math.PI / 2; // Flat on floor
        mesh.position.y += 0.01; // Slightly above floor
        this.scene.add(mesh);
    }

    generateMansion(roomLayout) {
        // 1. Initialize Grid
        for(let x=0; x<this.MAP_WIDTH; x++) {
            this.grid[x] = [];
            for(let z=0; z<this.MAP_DEPTH; z++) {
                this.grid[x][z] = 1; // Wall
            }
        }

        const rooms = [];

        // 2. Place Rooms
        roomLayout.forEach((r, index) => {
            if(r.x + r.w < this.MAP_WIDTH && r.z + r.d < this.MAP_DEPTH) {
                r.id = index + 1; // Assign Room ID (1-based)
                rooms.push(r);
                for(let rx = r.x; rx < r.x+r.w; rx++) {
                    for(let rz = r.z; rz < r.z+r.d; rz++) {
                        this.grid[rx][rz] = 0;
                    }
                }
            }
        });

        // 3. Connect Rooms
        for(let i=0; i<rooms.length - 1; i++) {
            const r1 = rooms[i];
            const r2 = rooms[i+1];
            const c1 = { x: Math.floor(r1.x + r1.w/2), z: Math.floor(r1.z + r1.d/2) };
            const c2 = { x: Math.floor(r2.x + r2.w/2), z: Math.floor(r2.z + r2.d/2) };

            const minX = Math.min(c1.x, c2.x);
            const maxX = Math.max(c1.x, c2.x);
            for(let x=minX; x<=maxX; x++) this.grid[x][c1.z] = 0;

            const minZ = Math.min(c1.z, c2.z);
            const maxZ = Math.max(c1.z, c2.z);
            for(let z=minZ; z<=maxZ; z++) this.grid[c2.x][z] = 0;
        }

        // 4. Build 3D World
        const offsetX = -this.MAP_WIDTH/2;
        const offsetZ = -this.MAP_DEPTH/2;

        for(let x=0; x<this.MAP_WIDTH; x++) {
            for(let z=0; z<this.MAP_DEPTH; z++) {
                // Floor
                this.addBlock(x + offsetX, 0, z + offsetZ, 'planks');
                // Ceiling
                this.addBlock(x + offsetX, this.WALL_HEIGHT + 1, z + offsetZ, 'planks');
                
                if (this.grid[x][z] === 1) {
                    for(let y=1; y<=this.WALL_HEIGHT; y++) {
                        this.addBlock(x + offsetX, y, z + offsetZ, 'stone');
                    }
                } else {
                    this.walkableNodes.push(new THREE.Vector3(x + offsetX, 1, z + offsetZ));
                }
            }
        }

        // Determine Spawn Room (Middle of walkable nodes usually, but let's pick a specific room)
        // Actually Player.spawn() picks middle node. Let's find which room that is.
        // Or better, let's just pick a random room for spawn and tell Player to spawn there.
        // For now, let's stick to existing spawn logic but identify the room.
        // Existing logic: walkableNodes[middle].
        const spawnNode = this.walkableNodes[Math.floor(this.walkableNodes.length/2)];
        // Find which room contains spawnNode
        // Note: spawnNode coordinates are world coords (with offset).
        // Room coords are grid coords (0..80).
        const spawnGridX = spawnNode.x - offsetX;
        const spawnGridZ = spawnNode.z - offsetZ;
        
        let spawnRoom = null;
        for(let r of rooms) {
            if (spawnGridX >= r.x && spawnGridX < r.x + r.w &&
                spawnGridZ >= r.z && spawnGridZ < r.z + r.d) {
                spawnRoom = r;
                break;
            }
        }
        this.spawnRoomId = spawnRoom ? spawnRoom.id : -1;

        // 5. Add Furniture & Room Numbers
        const occupiedFurniture = new Set(); // Store (x,z) of furniture
        rooms.forEach(r => {
            const cx = r.x + offsetX;
            const cz = r.z + offsetZ;
            
            // Room Number on Floor (Center)
            this.createRoomNumber(cx + r.w/2, 0.02, cz + r.d/2, r.id);

            if (r.features.includes('cabinet')) {
                const wx = cx + 1; 
                const wz = cz + 1;
                const cabBot = this.addBlock(wx, 1, wz, 'cabinet');
                this.addBlock(wx, 2, wz, 'cabinet');
                this.interactables.push({
                    type: 'cabinet',
                    pos: new THREE.Vector3(wx, 1, wz),
                    lookDir: new THREE.Vector3(0, 0, 1),
                    box: new THREE.Box3().setFromObject(cabBot)
                });
                occupiedFurniture.add(`${wx},${wz}`);
            }

        });

        // 6. Add Light Switch (Randomly in one of the rooms)
        if (rooms.length > 0) {
            // Try to find a valid spot
            let switchPos = null;
            let attempts = 0;
            let selectedRoom = null;
            
            while (!switchPos && attempts < 20) {
                selectedRoom = rooms[Math.floor(Math.random() * rooms.length)];
                const cx = selectedRoom.x + offsetX;
                const cz = selectedRoom.z + offsetZ;
                
                // Try North Wall (z = cz)
                for (let x = cx + 1; x < cx + selectedRoom.w - 1; x++) {
                    if (!occupiedFurniture.has(`${x},${cz + 1}`)) {
                        switchPos = { x: x, y: 1.5, z: cz + 0.6 };
                        break;
                    }
                }
                attempts++;
            }

            if (switchPos && selectedRoom) {
                this.switchRoomId = selectedRoom.id;
                
                // Create Group for Switch
                const switchGroup = new THREE.Group();
                switchGroup.position.set(switchPos.x, switchPos.y, switchPos.z);
                this.scene.add(switchGroup);

                // Base
                const baseGeo = new THREE.BoxGeometry(0.3, 0.5, 0.1);
                const baseMat = new THREE.MeshStandardMaterial({ color: 0x555555 });
                const base = new THREE.Mesh(baseGeo, baseMat);
                base.castShadow = true;
                switchGroup.add(base);

                // Handle
                const handleGeo = new THREE.BoxGeometry(0.08, 0.4, 0.08);
                handleGeo.translate(0, 0.2, 0);
                const handleMat = new THREE.MeshStandardMaterial({ color: 0xaa0000 });
                const handle = new THREE.Mesh(handleGeo, handleMat);
                
                handle.position.set(0, -0.1, 0.05); 
                handle.rotation.x = -Math.PI / 4; 
                switchGroup.add(handle);
                
                this.lightSwitch = {
                    pos: new THREE.Vector3(switchPos.x, switchPos.y, switchPos.z),
                    box: new THREE.Box3().setFromObject(base),
                    handle: handle,
                    isOn: false
                };
                this.interactables.push({
                    type: 'switch',
                    pos: this.lightSwitch.pos,
                    box: this.lightSwitch.box,
                    obj: this.lightSwitch
                });
            }
        }

        // 7. Add Door (Exit) - Random Room != Spawn Room
        const availableRooms = rooms.filter(r => r.id !== this.spawnRoomId);
        if (availableRooms.length > 0) {
            const doorRoom = availableRooms[Math.floor(Math.random() * availableRooms.length)];
            // Place door on South Wall (z = cz + d)
            const cx = doorRoom.x + offsetX;
            const cz = doorRoom.z + offsetZ;
            const dx = Math.floor(cx + doorRoom.w / 2);
            const dz = cz + doorRoom.d; // Wall position
            
            // Remove wall blocks at door position
            // Note: Wall is at grid[dx][doorRoom.z + doorRoom.d] which is 1.
            // But we already built the world. We need to remove the mesh or just place the door "in" the wall.
            // Actually, let's just place a door mesh in front of the wall for simplicity, or replace the wall block.
            // Since we can't easily remove specific blocks from the merged mesh (if we merged), but here we added individual meshes.
            // We can just place a "Door" object that is interactable.
            
            const doorMesh = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.5, 0.2), materials.door);
            doorMesh.position.set(dx, 1.25, dz - 0.6); // Inside the room slightly
            this.scene.add(doorMesh);
            
            this.interactables.push({
                type: 'door',
                pos: new THREE.Vector3(dx, 1.25, dz - 0.6),
                box: new THREE.Box3().setFromObject(doorMesh)
            });
        }

        // 8. Add Key & Radar - Random Rooms
        const itemRooms = rooms.filter(r => r.id !== this.spawnRoomId);
        const keyRoom = itemRooms[Math.floor(Math.random() * itemRooms.length)];
        const radarRoom = itemRooms[Math.floor(Math.random() * itemRooms.length)];
        
        // Place Key
        const kx = keyRoom.x + offsetX + keyRoom.w/2;
        const kz = keyRoom.z + offsetZ + keyRoom.d/2;
        const keyMesh = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), materials.key);
        keyMesh.position.set(kx + (Math.random()-0.5)*2, 0.5, kz + (Math.random()-0.5)*2);
        this.scene.add(keyMesh);
        this.interactables.push({
            type: 'key',
            pos: keyMesh.position.clone(),
            box: new THREE.Box3().setFromObject(keyMesh),
            mesh: keyMesh
        });

        // Place Radar
        const rx = radarRoom.x + offsetX + radarRoom.w/2;
        const rz = radarRoom.z + offsetZ + radarRoom.d/2;
        const radarMesh = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.1, 0.4), materials.radar);
        radarMesh.position.set(rx + (Math.random()-0.5)*2, 0.5, rz + (Math.random()-0.5)*2);
        this.scene.add(radarMesh);
        this.interactables.push({
            type: 'radar',
            pos: radarMesh.position.clone(),
            box: new THREE.Box3().setFromObject(radarMesh),
            mesh: radarMesh
        });

        this.rooms = rooms;
    }

    checkCollision(pos, radius, playerHeight, stepHeight = 0) {
        const playerBox = new THREE.Box3();
        // Lift the bottom by stepHeight to allow walking over small obstacles/floor friction
        // For horizontal movement, stepHeight should be > 0 (e.g. 0.5)
        // For vertical movement (falling), stepHeight should be 0 or very small
        playerBox.min.set(pos.x - radius, pos.y + stepHeight, pos.z - radius);
        playerBox.max.set(pos.x + radius, pos.y + playerHeight - 0.1, pos.z + radius);

        const minX = Math.floor(pos.x - radius - 1);
        const maxX = Math.ceil(pos.x + radius + 1);
        const minY = Math.floor(pos.y - 1);
        const maxY = Math.ceil(pos.y + playerHeight + 1);
        const minZ = Math.floor(pos.z - radius - 1);
        const maxZ = Math.ceil(pos.z + radius + 1);

        for (let x = minX; x <= maxX; x++) {
            for (let y = minY; y <= maxY; y++) {
                for (let z = minZ; z <= maxZ; z++) {
                    const key = `${x},${y},${z}`;
                    if (this.blocks.has(key)) {
                        const blockBox = this.blocks.get(key);
                        if (playerBox.intersectsBox(blockBox)) return true;
                    }
                }
            }
        }
        return false;
    }
}
