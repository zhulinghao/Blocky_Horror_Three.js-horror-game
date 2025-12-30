// import * as THREE from '../three.min.js';
import { World } from './world.js';
import { Player } from './player.js';
import { Ghost } from './ghost.js';
import { drawMinimap } from './minimap.js';
import { SoundGenerator } from './sound_generator.js';
import { initLocalization, t } from './localization.js';

const roomLayout = [
    { "x": 5, "z": 5, "w": 15, "d": 15, "features": ["cabinet", "bed"] },
    { "x": 25, "z": 5, "w": 12, "d": 20, "features": ["cabinet"] },
    { "x": 42, "z": 10, "w": 20, "d": 15, "features": ["bed"] },
    { "x": 5, "z": 25, "w": 15, "d": 15, "features": ["cabinet"] },
    { "x": 25, "z": 30, "w": 25, "d": 25, "features": ["cabinet", "bed"] },
    { "x": 55, "z": 30, "w": 15, "d": 15, "features": [] },
    { "x": 10, "z": 45, "w": 12, "d": 25, "features": ["bed"] },
    { "x": 30, "z": 60, "w": 20, "d": 10, "features": ["cabinet"] },
    { "x": 60, "z": 5, "w": 10, "d": 10, "features": [] },
    { "x": 60, "z": 55, "w": 15, "d": 15, "features": ["bed"] }
];

class Game {
    constructor() {
        initLocalization();
        this.isPlaying = false;
        this.isGameOver = false;
        
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x050505);
        this.scene.fog = new THREE.Fog(0x050505, 2, 12);

        this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 100);
        this.renderer = new THREE.WebGLRenderer({ antialias: false });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.BasicShadowMap;
        document.body.appendChild(this.renderer.domElement);

        this.scene.add(new THREE.AmbientLight(0xffffff, 0.05));

        // Audio Setup
        this.listener = new THREE.AudioListener();
        this.camera.add(this.listener);
        this.soundGen = new SoundGenerator(this.listener);

        // Heartbeat Sound
        this.heartbeat = new THREE.Audio(this.listener);
        this.heartbeat.setBuffer(this.soundGen.getHeartbeatBuffer());
        this.heartbeat.setLoop(true);
        this.heartbeat.setVolume(0);

        this.world = new World(this.scene);
        this.world.generateMansion(roomLayout);

        this.player = new Player(this.camera, this.scene, this.world, this.listener, this.soundGen);
        this.player.spawn();

        this.ghost = new Ghost(this.scene, this.world, this.player, this.listener, this.soundGen);
        this.ghost.spawn();

        this.clock = new THREE.Clock();

        this.setupInput();
        this.animate = this.animate.bind(this);
        requestAnimationFrame(this.animate);
    }

    setupInput() {
        document.addEventListener('keydown', e => {
            this.player.handleInput(e, true);
            if (e.code === 'KeyM') {
                const map = document.getElementById('minimap');
                if(map) map.classList.toggle('large');
            }
        });
        document.addEventListener('keyup', e => this.player.handleInput(e, false));
        document.addEventListener('mousemove', e => {
            if (this.isPlaying) this.player.handleMouseMove(e);
        });

        const btn = document.getElementById('btn-start');
        if(btn) {
            btn.addEventListener('click', () => {
                // Resume Audio Context (Fix for "no sound before interaction")
                if (this.listener.context.state === 'suspended') {
                    this.listener.context.resume();
                }

                document.body.requestPointerLock();
                document.getElementById('menu').classList.add('hidden');
                document.getElementById('game-info').style.display = 'block';
                
                // Show Switch Room Info
                const infoSwitch = document.getElementById('info-switch');
                if (this.world.switchRoomId !== -1) {
                    infoSwitch.innerText = t('switchInRoom', { id: this.world.switchRoomId });
                } else {
                    infoSwitch.innerText = t('switchNotFound');
                }

                this.isPlaying = true;
            });
        }

        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }

    animate() {
        requestAnimationFrame(this.animate);
        
        if (!this.isPlaying) {
            this.renderer.render(this.scene, this.camera);
            return;
        }

        const dt = Math.min(this.clock.getDelta(), 0.1);
        
        this.player.update(dt);

        if (this.player.hasWon) {
            this.isPlaying = false;
            document.exitPointerLock();
            document.getElementById('game-win').classList.remove('hidden');
        }

        const killed = this.ghost.update(dt);
        
        // Heartbeat Logic
        const dist = this.player.pos.distanceTo(this.ghost.mesh.position);
        const threshold = 15;
        const ui = document.getElementById('heartbeat-ui');
        
        if (dist < threshold && !this.player.hasWon && !this.isGameOver) {
            const intensity = 1 - (dist / threshold);
            
            if (!this.heartbeat.isPlaying) this.heartbeat.play();
            this.heartbeat.setVolume(intensity * 2); // Max volume 2
            this.heartbeat.setPlaybackRate(1 + intensity); // Speed up
            
            if (ui) {
                ui.style.opacity = intensity;
                // Adjust animation speed via duration
                const duration = 1.0 - (intensity * 0.6); // 1s down to 0.4s
                ui.style.animation = `beat ${duration}s infinite`;
            }
        } else {
            if (this.heartbeat.isPlaying) this.heartbeat.stop();
            if (ui) {
                ui.style.opacity = 0;
                ui.style.animation = 'none';
            }
        }

        if (killed) {
            this.isPlaying = false;
            this.isGameOver = true;
            document.exitPointerLock();
            document.getElementById('game-over').classList.remove('hidden');
        }

        drawMinimap('minimap', this.world, this.player, this.ghost);
        this.renderer.render(this.scene, this.camera);
    }
}

new Game();
