// import * as THREE from '../three.min.js';

export function createPixelTexture(color, noiseIntensity = 0.1, grid = false, pattern = 'noise') {
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');
    
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, size, size);

    if (pattern === 'noise') {
        for (let i = 0; i < 400; i++) {
            ctx.fillStyle = `rgba(0,0,0,${Math.random() * noiseIntensity})`;
            const x = Math.floor(Math.random() * 16) * 4;
            const y = Math.floor(Math.random() * 16) * 4;
            ctx.fillRect(x, y, 4, 4);
        }
    } else if (pattern === 'planks') {
        ctx.fillStyle = 'rgba(0,0,0,0.1)';
        for(let i=0; i<4; i++) {
            ctx.fillRect(0, i*16, 64, 2);
        }
    } else if (pattern === 'cabinet') {
        // Door design
        ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        ctx.lineWidth = 4;
        ctx.strokeRect(4, 4, 56, 56);
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(48, 32, 4, 8); // Handle
    } else if (pattern === 'wool') {
        // Softer noise
        for (let i = 0; i < 800; i++) {
            ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.05})`;
            ctx.fillRect(Math.random()*64, Math.random()*64, 2, 2);
        }
    }
    
    if (grid && pattern !== 'cabinet') {
        ctx.strokeStyle = 'rgba(0,0,0,0.2)';
        ctx.lineWidth = 4;
        ctx.strokeRect(0, 0, size, size);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    return tex;
}

export const materials = {
    stone: new THREE.MeshStandardMaterial({ map: createPixelTexture('#7a7a7a', 0.3, true), roughness: 0.9 }),
    planks: new THREE.MeshStandardMaterial({ map: createPixelTexture('#8f563b', 0.2, true, 'planks'), roughness: 0.8 }),
    dirt: new THREE.MeshStandardMaterial({ map: createPixelTexture('#5d4037', 0.4, true), roughness: 1.0 }),
    obsidian: new THREE.MeshStandardMaterial({ map: createPixelTexture('#1a0b2e', 0.1, true), roughness: 0.2 }),
    cabinet: new THREE.MeshStandardMaterial({ map: createPixelTexture('#5c4033', 0.1, false, 'cabinet'), roughness: 0.7 }),
    bed_red: new THREE.MeshStandardMaterial({ map: createPixelTexture('#a00000', 0.1, false, 'wool'), roughness: 1.0 }),
    bed_white: new THREE.MeshStandardMaterial({ map: createPixelTexture('#dddddd', 0.1, false, 'wool'), roughness: 1.0 }),
    glow: new THREE.MeshBasicMaterial({ color: 0xff0000 }),
    key: new THREE.MeshStandardMaterial({ color: 0xffd700, roughness: 0.3, metalness: 0.8 }),
    radar: new THREE.MeshStandardMaterial({ color: 0x00ff00, roughness: 0.5, metalness: 0.5 }),
    door: new THREE.MeshStandardMaterial({ map: createPixelTexture('#3e2723', 0.2, true, 'planks'), roughness: 0.9 })
};
