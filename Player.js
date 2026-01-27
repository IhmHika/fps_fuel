import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

export class Player {
    constructor(camera, domElement, scene) {
        this.camera = camera;
        this.scene = scene;
        this.controls = new PointerLockControls(camera, domElement);

        // Movement Settings
        this.velocity = new THREE.Vector3();
        this.direction = new THREE.Vector3();
        this.moveSpeed = 16.0;
        this.jumpForce = 12.0;
        this.gravity = 32.0;
        this.friction = 8.0;

        // States
        this.onGround = false;
        this.keys = { forward: false, backward: false, left: false, right: false, jump: false, shoot: false };
        this.network = null;

        // Gun Setup (Visual)
        this.gun = null;
        this.initGun();

        // Audio Setup (Synthesized)
        this.audioCtx = null;

        this.initListeners();
    }

    initGun() {
        // Create a more detailed simple gun
        const gunGroup = new THREE.Group();

        // Body
        const bodyGeo = new THREE.BoxGeometry(0.12, 0.15, 0.6);
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.8, roughness: 0.2 });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        gunGroup.add(body);

        // Grip
        const gripGeo = new THREE.BoxGeometry(0.1, 0.25, 0.12);
        const grip = new THREE.Mesh(gripGeo, bodyMat);
        grip.position.set(0, -0.18, 0.2);
        gunGroup.add(grip);

        // Muzzle
        const muzzleGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.1);
        const muzzleMat = new THREE.MeshBasicMaterial({ color: 0x00f2ff });
        const muzzle = new THREE.Mesh(muzzleGeo, muzzleMat);
        muzzle.rotation.x = Math.PI / 2;
        muzzle.position.z = -0.3;
        gunGroup.add(muzzle);

        // Handle attachment
        this.camera.add(gunGroup);
        gunGroup.position.set(0.35, -0.3, -0.6); // Lower-right position
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
            if (!this.audioCtx) {
                this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }
        }, { once: true });
    }

    onKey(e, isDown) {
        switch (e.code) {
            case 'KeyW': this.keys.forward = isDown; break;
            case 'KeyS': this.keys.backward = isDown; break;
            case 'KeyA': this.keys.left = isDown; break;
            case 'KeyD': this.keys.right = isDown; break;
            case 'Space': this.keys.jump = isDown; break;
        }
    }

    update(delta) {
        if (!this.controls.isLocked) {
            if (this.gun) this.gun.visible = false;
            return;
        }
        if (this.gun) this.gun.visible = true;

        // Apply Gravity
        this.velocity.y -= this.gravity * delta;

        // Movement Direction
        this.direction.z = Number(this.keys.forward) - Number(this.keys.backward);
        this.direction.x = Number(this.keys.right) - Number(this.keys.left);
        this.direction.normalize();

        // Apply Friction
        const horizontalVel = new THREE.Vector3(this.velocity.x, 0, this.velocity.z);
        horizontalVel.multiplyScalar(1 - this.friction * delta);
        this.velocity.x = horizontalVel.x;
        this.velocity.z = horizontalVel.z;

        // Acceleration
        if (this.direction.x !== 0 || this.direction.z !== 0) {
            const camDir = new THREE.Vector3();
            this.camera.getWorldDirection(camDir);
            camDir.y = 0;
            camDir.normalize();

            const camSide = new THREE.Vector3().crossVectors(this.camera.up, camDir).normalize();

            const accel = this.onGround ? 120 : 30; // Slightly faster for Apex feel
            this.velocity.addScaledVector(camDir, this.direction.z * accel * delta);
            this.velocity.addScaledVector(camSide, -this.direction.x * accel * delta);
        }

        // Jump
        if (this.keys.jump && this.onGround) {
            this.velocity.y = this.jumpForce;
            this.onGround = false;
        }

        // Apply Velocity & Floor Collision
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

        // Raycasting for hits
        const raycaster = new THREE.Raycaster();
        const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
        raycaster.set(this.camera.position, dir);

        // Tracer Effect
        const start = this.camera.position.clone().addScaledVector(dir, 1);
        const end = this.camera.position.clone().addScaledVector(dir, 100);
        const line = new THREE.Line(
            new THREE.BufferGeometry().setFromPoints([start, end]),
            new THREE.LineBasicMaterial({ color: 0x00f2ff, transparent: true, opacity: 0.5 })
        );
        this.scene.add(line);
        setTimeout(() => this.scene.remove(line), 50);

        // Hit Detection
        const hits = raycaster.intersectObjects(this.scene.children);
        for (let hit of hits) {
            if (hit.object.userData.isTarget) {
                this.hitTarget(hit.object);
                break;
            }
        }

        if (this.network) this.network.sendShoot(this.camera.position, dir);
    }

    hitTarget(obj) {
        this.playHitSound();
        obj.userData.health -= 20;
        obj.material.emissiveIntensity = 2.0;
        setTimeout(() => obj.material.emissiveIntensity = 0.3, 100);

        if (obj.userData.health <= 0) {
            obj.position.y = -5; // Sink
            setTimeout(() => { obj.position.y = 1; obj.userData.health = 100; }, 3000);
        }
    }

    playShootSound() {
        if (!this.audioCtx) return;
        const o = this.audioCtx.createOscillator();
        const g = this.audioCtx.createGain();
        o.type = 'square';
        o.frequency.setValueAtTime(220, this.audioCtx.currentTime);
        o.frequency.exponentialRampToValueAtTime(40, this.audioCtx.currentTime + 0.1);
        g.gain.setValueAtTime(0.08, this.audioCtx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.1);
        o.connect(g);
        g.connect(this.audioCtx.destination);
        o.start();
        o.stop(this.audioCtx.currentTime + 0.1);
    }

    playHitSound() {
        if (!this.audioCtx) return;
        const o = this.audioCtx.createOscillator();
        const g = this.audioCtx.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(900, this.audioCtx.currentTime);
        g.gain.setValueAtTime(0.1, this.audioCtx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.05);
        o.connect(g);
        g.connect(this.audioCtx.destination);
        o.start();
        o.stop(this.audioCtx.currentTime + 0.05);
    }
}
