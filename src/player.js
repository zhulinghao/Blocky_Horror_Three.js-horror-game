// import * as THREE from '../three.min.js';
import { t } from './localization.js';

export class Player {
    constructor(camera, scene, world, listener, soundGen) {
        this.camera = camera;
        this.scene = scene;
        this.world = world;
        this.listener = listener;
        this.soundGen = soundGen;
        
        this.pos = new THREE.Vector3(0, 1, 0);
        this.vel = new THREE.Vector3();
        this.speed = 6;
        this.jumpForce = 10;
        this.gravity = 25;
        this.height = 1.75;
        this.radius = 0.25;
        this.onGround = false;
        this.pitch = 0;
        this.yaw = 0;
        
        // 鼠标转动速度系数，默认 1.0
        this.mouseSensitivity = this.getMouseSensitivity();
        
        // Camera Bobbing Parameters
        this.bobbingSpeed = 0.01;
        this.bobbingAmount = 0.02;

        this.isHidden = false;
        this.hidingType = null;
        this.flashlightOn = true;
        this.flashlightIntensity = 2; // Reduced from 20 to avoid overexposure
        
        this.hasKey = false;
        this.hasRadar = false;
        this.hasWon = false;

        this.keys = {};
        
        // Flashlight
        this.flashlight = new THREE.SpotLight(0xffaa88, this.flashlightIntensity, 40, Math.PI/6, 0.5, 1);
        this.flashlight.position.set(0.2, -0.2, 0); // Offset slightly to simulate holding in hand
        this.camera.add(this.flashlight);
        this.camera.add(this.flashlight.target);
        this.flashlight.target.position.set(0, 0, -1);
        this.scene.add(this.camera);
    }

    spawn() {
        if (this.world.walkableNodes.length > 0) {
            const start = this.world.walkableNodes[Math.floor(this.world.walkableNodes.length/2)];
            this.pos.copy(start);
            this.pos.y = 1;
        }
    }

    getMouseSensitivity() {
        const saved = localStorage.getItem('mouseSensitivity');
        return saved ? parseFloat(saved) : 1.0;
    }

    setMouseSensitivity(value) {
        this.mouseSensitivity = value;
        localStorage.setItem('mouseSensitivity', value);
    }

    handleInput(e, isDown) {
        this.keys[e.code] = isDown;
        if (isDown) {
            if (e.code === 'KeyE') this.interact();
            if (e.code === 'KeyF') this.toggleFlashlight();
        }
    }

    handleMouseMove(e) {
        if (this.isHidden && this.hidingType !== 'cabinet') return;

        this.yaw -= e.movementX * 0.002 * this.mouseSensitivity;
        this.pitch -= e.movementY * 0.002 * this.mouseSensitivity;
        this.pitch = Math.max(-Math.PI/2, Math.min(Math.PI/2, this.pitch));

        if (this.isHidden && this.hidingType === 'cabinet') {
            const limit = Math.PI / 2.2;
            if (this.yaw > this.baseYaw + limit) this.yaw = this.baseYaw + limit;
            if (this.yaw < this.baseYaw - limit) this.yaw = this.baseYaw - limit;
        }

        this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
    }

    toggleFlashlight() {
        this.flashlightOn = !this.flashlightOn;
        this.flashlight.intensity = this.flashlightOn ? this.flashlightIntensity : 0;
    }

    playSound(name) {
        if (this.listener && this.soundGen) {
            const sound = new THREE.Audio(this.listener);
            let buffer = null;
            if (name === 'switch') buffer = this.soundGen.getSwitchBuffer();
            else if (name === 'pickup') buffer = this.soundGen.getPickupBuffer();
            
            if (buffer) {
                sound.setBuffer(buffer);
                sound.setVolume(0.5);
                sound.play();
            }
        }
    }

    interact() {
        if (this.isHidden) {
            // Exit hiding
            this.isHidden = false;
            document.getElementById('cabinet-overlay').style.display = 'none';
            this.pos.add(new THREE.Vector3(1, 0, 1)); // Pop out
            return;
        }

        for(let i = 0; i < this.world.interactables.length; i++) {
            const item = this.world.interactables[i];
            if (this.pos.distanceTo(item.pos) < 2.0) {
                
                if (item.type === 'cabinet') {
                    this.isHidden = true;
                    this.hidingType = item.type;
                    this.pos.copy(item.pos);
                    
                    // Face the direction the cabinet is looking (outwards)
                    if (item.lookDir) {
                        this.yaw = Math.atan2(item.lookDir.x, item.lookDir.z) + Math.PI;
                    } else {
                        this.yaw = Math.PI;
                    }
                    this.baseYaw = this.yaw;
                    
                    this.camera.rotation.set(0, this.yaw, 0, 'YXZ');
                    
                    const overlay = document.getElementById('cabinet-overlay');
                    overlay.style.display = 'none';
                } else if (item.type === 'switch') {
                    // Toggle Global Light
                    this.playSound('switch');
                    const ambient = this.scene.children.find(c => c.isAmbientLight);
                    const switchObj = item.obj;

                    if (ambient) {
                        if (ambient.intensity < 0.5) {
                            ambient.intensity = 0.8; // Bright
                            this.scene.fog.far = 100;
                            if (switchObj && switchObj.handle) {
                                switchObj.handle.rotation.x = Math.PI / 4; // Down (On)
                                switchObj.isOn = true;
                            }
                        } else {
                            ambient.intensity = 0.05; // Dark
                            this.scene.fog.far = 12;
                            if (switchObj && switchObj.handle) {
                                switchObj.handle.rotation.x = -Math.PI / 4; // Up (Off)
                                switchObj.isOn = false;
                            }
                        }
                    }
                } else if (item.type === 'key') {
                    this.playSound('pickup');
                    this.hasKey = true;
                    this.scene.remove(item.mesh);
                    this.world.interactables.splice(i, 1);
                    this.updateUI();
                    return;
                } else if (item.type === 'radar') {
                    this.playSound('pickup');
                    this.hasRadar = true;
                    this.scene.remove(item.mesh);
                    this.world.interactables.splice(i, 1);
                    this.updateUI();
                    return;
                } else if (item.type === 'door') {
                    if (this.hasKey) {
                        this.hasWon = true;
                    } else {
                        // Locked message?
                        const msg = document.getElementById('interaction-msg');
                        msg.innerText = t('doorLocked');
                        setTimeout(() => msg.innerText = t('interact'), 2000);
                    }
                }
                return;
            }
        }
    }

    updateUI() {
        const info = document.getElementById('info-items');
        if(info) {
            let text = "";
            if (this.hasKey) text += t('gotKey');
            if (this.hasRadar) text += t('gotRadar');
            info.innerText = text;
        }
    }

    update(dt) {
        if (this.isHidden) {
            this.camera.position.copy(this.pos);
            if (this.hidingType === 'cabinet') this.camera.position.y += this.height * 0.9;
            else this.camera.position.y += 0.2;
            return;
        }

        const speed = this.keys['ShiftLeft'] ? this.speed * 1.5 : this.speed;
        const dir = new THREE.Vector3();
        const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
        const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);

        if (this.keys['KeyW']) dir.add(forward);
        if (this.keys['KeyS']) dir.sub(forward);
        if (this.keys['KeyA']) dir.sub(right);
        if (this.keys['KeyD']) dir.add(right);

        if (dir.lengthSq() > 0) dir.normalize();

        this.vel.x = dir.x * speed;
        this.vel.z = dir.z * speed;
        this.vel.y -= this.gravity * dt;

        if (this.onGround && this.keys['Space']) {
            this.vel.y = this.jumpForce;
            this.onGround = false;
        }

        // Collision X
        let nextPos = this.pos.clone();
        nextPos.x += this.vel.x * dt;
        // Use stepHeight 0.5 for horizontal movement to ignore floor friction
        if (!this.world.checkCollision(nextPos, this.radius, this.height, 0.5)) {
            this.pos.x = nextPos.x;
        } else {
            this.vel.x = 0;
        }

        // Collision Z
        nextPos = this.pos.clone();
        nextPos.z += this.vel.z * dt;
        if (!this.world.checkCollision(nextPos, this.radius, this.height, 0.5)) {
            this.pos.z = nextPos.z;
        } else {
            this.vel.z = 0;
        }

        // Collision Y
        nextPos = this.pos.clone();
        nextPos.y += this.vel.y * dt;
        // Use stepHeight 0 for vertical movement to accurately detect floor and prevent jitter
        if (!this.world.checkCollision(nextPos, this.radius, this.height, 0)) {
            this.pos.y = nextPos.y;
            this.onGround = false;
        } else {
            if (this.vel.y < 0) this.onGround = true;
            this.vel.y = 0;
            // Snap to top of block
            if(this.onGround) {
                // Assuming blocks are at integer Y, top is Y+0.5
                // We want to sit exactly on top
                // Use Math.round to find the nearest block layer instead of floor to avoid snapping down incorrectly
                this.pos.y = Math.round(this.pos.y - 0.5) + 0.5; 
            }
        }

        if (this.pos.y < -10) { this.pos.y = 10; this.vel.y = 0; }

        // console.log('this.pos: ', this.pos);
        this.camera.position.copy(this.pos);
        this.camera.position.y += this.height * 0.9;
        
        // Interaction UI
        let canInteract = false;
        for(let item of this.world.interactables) {
            if (this.pos.distanceTo(item.pos) < 2.0) canInteract = true;
        }
        const msg = document.getElementById('interaction-msg');
        if(msg) msg.style.display = canInteract ? 'block' : 'none';
    }
}
