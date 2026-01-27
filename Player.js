import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';

export class Player {
    constructor(camera, domElement, scene) {
        this.camera = camera;
        this.scene = scene;
        this.controls = new PointerLockControls(camera, domElement);

        // 物理パラメーター
        this.velocity = new THREE.Vector3();
        this.direction = new THREE.Vector3();
        this.moveSpeed = 15.0;
        this.jumpForce = 12.0;
        this.gravity = 30.0;
        this.friction = 8.0;

        // 状態
        this.onGround = false;
        this.keys = { forward: false, backward: false, left: false, right: false, jump: false, crouch: false, shoot: false };
        this.network = null;

        // 銃の作成
        this.gun = null;
        this.initGun();

        // オーディオ
        this.audioCtx = null;

        this.initEventListeners();
    }

    initGun() {
        // 簡易的な銃のメッシュ
        const gunGroup = new THREE.Group();

        const bodyGeo = new THREE.BoxGeometry(0.15, 0.15, 0.6);
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.9, roughness: 0.1 });
        const body = new THREE.Mesh(bodyGeo, bodyMat);

        const gripGeo = new THREE.BoxGeometry(0.1, 0.25, 0.1);
        const grip = new THREE.Mesh(gripGeo, bodyMat);
        grip.position.set(0, -0.15, 0.2);

        const barrelGeo = new THREE.BoxGeometry(0.05, 0.05, 0.1);
        const barrelMat = new THREE.MeshBasicMaterial({ color: 0x00f2ff });
        const barrel = new THREE.Mesh(barrelGeo, barrelMat);
        barrel.position.set(0, 0.02, -0.3);

        gunGroup.add(body);
        gunGroup.add(grip);
        gunGroup.add(barrel);

        // カメラに追加して常に視界に入るようにする
        this.camera.add(gunGroup);
        gunGroup.position.set(0.3, -0.3, -0.5); // 右下に配置
        this.gun = gunGroup;
    }

    initEventListeners() {
        document.addEventListener('keydown', (e) => this.onKey(e, true));
        document.addEventListener('keyup', (e) => this.onKey(e, false));
        document.addEventListener('mousedown', () => {
            if (this.controls.isLocked) {
                this.shoot();
            } else {
                this.controls.lock();
            }
        });

        // オーディオの有効化（クリック時に一度だけ）
        document.addEventListener('click', () => {
            if (!this.audioCtx) {
                this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }
        }, { once: true });
    }

    onKey(e, val) {
        switch (e.code) {
            case 'KeyW': this.keys.forward = val; break;
            case 'KeyS': this.keys.backward = val; break;
            case 'KeyA': this.keys.left = val; break;
            case 'KeyD': this.keys.right = val; break;
            case 'Space': this.keys.jump = val; break;
            case 'ControlLeft': this.keys.crouch = val; break;
        }
    }

    update(delta) {
        if (!this.controls.isLocked) {
            if (this.gun) this.gun.visible = false;
            return;
        }
        if (this.gun) this.gun.visible = true;

        // 基本移動ロジック
        this.velocity.y -= this.gravity * delta;

        const moveDir = new THREE.Vector3();
        moveDir.z = Number(this.keys.forward) - Number(this.keys.backward);
        moveDir.x = Number(this.keys.right) - Number(this.keys.left);
        moveDir.normalize();

        const horizontalVel = new THREE.Vector3(this.velocity.x, 0, this.velocity.z);
        horizontalVel.multiplyScalar(1 - this.friction * delta);
        this.velocity.x = horizontalVel.x;
        this.velocity.z = horizontalVel.z;

        if (moveDir.x !== 0 || moveDir.z !== 0) {
            const camDir = new THREE.Vector3();
            this.camera.getWorldDirection(camDir);
            camDir.y = 0;
            camDir.normalize();
            const camSide = new THREE.Vector3().crossVectors(this.camera.up, camDir).normalize();

            const accel = this.onGround ? 100 : 20;
            this.velocity.addScaledVector(camDir, moveDir.z * accel * delta);
            this.velocity.addScaledVector(camSide, -moveDir.x * accel * delta);
        }

        if (this.keys.jump && this.onGround) {
            this.velocity.y = this.jumpForce;
            this.onGround = false;
        }

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

        const raycaster = new THREE.Raycaster();
        const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
        raycaster.set(this.camera.position, dir);

        // 線を描画
        const points = [this.camera.position.clone().addScaledVector(dir, 1), this.camera.position.clone().addScaledVector(dir, 100)];
        const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: 0x00f2ff }));
        this.scene.add(line);
        setTimeout(() => this.scene.remove(line), 50);

        // ヒット判定
        const intersects = raycaster.intersectObjects(this.scene.children);
        for (let intersect of intersects) {
            if (intersect.object.userData.isTarget) {
                this.playHitSound();
                intersect.object.userData.health -= 20;
                intersect.object.material.emissive.set(0xff0000);
                setTimeout(() => intersect.object.material.emissive.set(0x552200), 100);
                if (intersect.object.userData.health <= 0) {
                    intersect.object.position.y = -5;
                    setTimeout(() => { intersect.object.position.y = 1; intersect.object.userData.health = 100; }, 3000);
                }
                break;
            }
        }

        if (this.network) this.network.sendShoot(this.camera.position, dir);
    }

    playShootSound() {
        if (!this.audioCtx) return;
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(200, this.audioCtx.currentTime);
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
        osc.frequency.setValueAtTime(800, this.audioCtx.currentTime);
        gain.gain.setValueAtTime(0.1, this.audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.05);
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start();
        osc.stop(this.audioCtx.currentTime + 0.05);
    }
}
