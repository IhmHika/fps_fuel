import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

export class Player {
    constructor(camera, domElement, scene) {
        this.camera = camera;
        this.scene = scene;
        this.controls = new PointerLockControls(camera, domElement);

        // Movement settings
        this.velocity = new THREE.Vector3();
        this.direction = new THREE.Vector3();
        this.moveSpeed = 15.0;
        this.jumpForce = 12.0;

        this.onGround = false;
        this.keys = { forward: false, backward: false, left: false, right: false, jump: false, shoot: false };

        // Gun setup (Visual)
        this.initGun();

        // Audio setup (Synthesized)
        this.audioCtx = null;
        this.network = null;

        this.initListeners();
    }

    initGun() {
        const gunGroup = new THREE.Group();

        // Gun Body
        const bodyGeo = new THREE.BoxGeometry(0.1, 0.15, 0.6);
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.9, roughness: 0.1 });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        gunGroup.add(body);

        // Handle
        const gripGeo = new THREE.BoxGeometry(0.08, 0.2, 0.08);
        const grip = new THREE.Mesh(gripGeo, bodyMat);
        grip.position.set(0, -0.15, 0.15);
        gunGroup.add(grip);

        // Barrel glow
        const glow = new THREE.Mesh(
            new THREE.CylinderGeometry(0.04, 0.04, 0.05),
            new THREE.MeshBasicMaterial({ color: 0x00f2ff })
        );
        glow.rotation.x = Math.PI / 2;
        glow.position.z = -0.3;
        gunGroup.add(glow);

        // Attach to camera
        this.camera.add(gunGroup);
        gunGroup.position.set(0.3, -0.35, -0.6);
        this.gun = gunGroup;
    }

    initListeners() {
        document.addEventListener('keydown', (e) => this.onKey(e, true));
        document.addEventListener('keyup', (e) => this.onKey(e, false));

        document.addEventListener('mousedown', () => {
            if (this.controls.isLocked) {
                this.shoot();
            } else {
                this.controls.lock();
            }
        });

        // Initialize audio on first click
        document.addEventListener('click', () => {
            if (!this.audioCtx) this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }, { once: true });
    }

    onKey(e, val) {
        switch (e.code) {
            case 'KeyW': this.keys.forward = val; break;
            case 'KeyS': this.keys.backward = val; break;
            case 'KeyA': this.keys.left = val; break;
            case 'KeyD': this.keys.right = val; break;
            case 'Space': this.keys.jump = val; break;
        }
    }

    update(delta) {
        if (!this.controls.isLocked) {
            if (this.gun) this.gun.visible = false;
            return;
        }
        if (this.gun) this.gun.visible = true;

        // Basic Gravity
        this.velocity.y -= 30.0 * delta;

        // XZ Friction
        this.velocity.x *= (1 - 8.0 * delta);
        this.velocity.z *= (1 - 8.0 * delta);

        // Directional Acceleration
        this.direction.z = Number(this.keys.forward) - Number(this.keys.backward);
        this.direction.x = Number(this.keys.right) - Number(this.keys.left);
        this.direction.normalize();

        if (this.direction.x !== 0 || this.direction.z !== 0) {
            const camDir = new THREE.Vector3();
            this.camera.getWorldDirection(camDir);
            camDir.y = 0;
            camDir.normalize();

            const camSide = new THREE.Vector3().crossVectors(this.camera.up, camDir).normalize();

            const accel = this.onGround ? 100 : 20;
            this.velocity.addScaledVector(camDir, this.direction.z * accel * delta);
            this.velocity.addScaledVector(camSide, -this.direction.x * accel * delta);
        }

        if (this.keys.jump && this.onGround) {
            this.velocity.y = this.jumpForce;
            this.onGround = false;
        }

        // Apply Position
        const nextPos = this.camera.position.clone().addScaledVector(this.velocity, delta);
        if (nextPos.y < 1.7) {
            nextPos.y = 1.7;
            this.velocity.y = 0;
            this.onGround = true;
        } else {
            this.onGround = false;
        }
        this.camera.position.copy(nextPos);
    }

    shoot() {
        this.playShootSound();

        // Raycasting
        const raycaster = new THREE.Raycaster();
        const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
        raycaster.set(this.camera.position, dir);

        // Visual Line
        const start = this.camera.position.clone().addScaledVector(dir, 1);
        const end = this.camera.position.clone().addScaledVector(dir, 100);
        const line = new THREE.Line(
            new THREE.BufferGeometry().setFromPoints([start, end]),
            new THREE.LineBasicMaterial({ color: 0x00f2ff, transparent: true, opacity: 0.5 })
        );
        this.scene.add(line);
        setTimeout(() => this.scene.remove(line), 50);

        // Hits
        const hits = raycaster.intersectObjects(this.scene.children);
        for (let hit of hits) {
            if (hit.object.userData.isTarget) {
                this.onHitTarget(hit.object);
                break;
            }
        }

        if (this.network) this.network.sendShoot(this.camera.position, dir);
    }

    onHitTarget(obj) {
        this.playHitSound();
        obj.userData.health -= 25;
        obj.material.emissiveIntensity = 2.0;
        setTimeout(() => obj.material.emissiveIntensity = 0.2, 100);

        if (obj.userData.health <= 0) {
            obj.position.y = -5;
            setTimeout(() => { obj.position.y = 1; obj.userData.health = 100; }, 3000);
        }
    }

    playShootSound() {
        if (!this.audioCtx) return;
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(250, this.audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(50, this.audioCtx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.1, this.audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.1);
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start();
        osc.stop(this.audioCtx.currentTime + 0.1);
    }

    playHitSound() {
        if (!this.audioCtx) return;
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1000, this.audioCtx.currentTime);
        gain.gain.setValueAtTime(0.1, this.audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.05);
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start();
        osc.stop(this.audioCtx.currentTime + 0.05);
    }
}
