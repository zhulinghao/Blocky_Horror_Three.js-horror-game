export function drawMinimap(canvasId, world, player, ghost) {
    const canvas = document.getElementById(canvasId);
    if(!canvas) return;
    const ctx = canvas.getContext('2d');
    const size = canvas.clientWidth; 
    if (canvas.width !== size) { canvas.width = size; canvas.height = size; }
    
    ctx.clearRect(0, 0, size, size);
    
    const cellSize = size / world.MAP_WIDTH;
    const offsetX = -world.MAP_WIDTH/2;
    const offsetZ = -world.MAP_DEPTH/2;

    // Draw Walls
    ctx.fillStyle = '#444';
    if (world.grid) {
        for(let x=0; x<world.MAP_WIDTH; x++) {
            for(let z=0; z<world.MAP_DEPTH; z++) {
                if (world.grid[x][z] === 1) {
                    ctx.fillRect(x * cellSize, z * cellSize, cellSize, cellSize);
                }
            }
        }
    }

    // Draw Room Numbers
    if (world.rooms) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        world.rooms.forEach(r => {
            const cx = (r.x + r.w/2) * cellSize;
            const cz = (r.z + r.d/2) * cellSize;
            ctx.fillText(r.id.toString(), cx, cz);
        });
    }
    
    // Draw Player
    const px = player.pos.x - offsetX;
    const pz = player.pos.z - offsetZ;
    ctx.fillStyle = '#0f0';
    ctx.beginPath();
    ctx.arc(px * cellSize, pz * cellSize, cellSize * 1.5, 0, Math.PI*2);
    ctx.fill();

    // Draw Flashlight Cone
    if (player.flashlightOn) {
        ctx.fillStyle = 'rgba(255, 255, 0, 0.3)';
        ctx.beginPath();
        ctx.moveTo(px * cellSize, pz * cellSize);
        // Map Three.js Yaw to Canvas Angle
        // Three.js: 0 is -Z. Canvas: 0 is +X.
        // -Z is Up in Canvas (y=0).
        // So Yaw 0 -> -90 deg (-PI/2).
        const canvasAngle = -player.yaw - Math.PI/2;
        ctx.arc(px * cellSize, pz * cellSize, cellSize * 8, canvasAngle - Math.PI/6, canvasAngle + Math.PI/6);
        ctx.fill();
    }

    // Draw Ghost
    if (player.hasRadar) {
        const gx = ghost.mesh.position.x - offsetX;
        const gz = ghost.mesh.position.z - offsetZ;
        ctx.fillStyle = '#f00';
        ctx.beginPath();
        ctx.arc(gx * cellSize, gz * cellSize, cellSize * 1.5, 0, Math.PI*2);
        ctx.fill();
    }

    // Draw Light Switch (Only if found or debug? Let's hide it for now as per request)
    // if (world.lightSwitch) { ... }
}
