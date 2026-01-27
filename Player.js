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

        // 銃の作成 (簡易メッシュ)
        this.gun = null;
        this.initGun();

        // オーディオ
        this.audioCtx = null;

        this.initEventListeners();
    }

    initGun() {
        const gunGroup = new THREE.Group();

        // 銃身
        const bodyGeo = new THREE.BoxGeometry(0.2, 0.2, 0.6);
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.8, roughness: 0.2 });
        const body = new THREE.Mesh(bodyGeo, bodyMat);

        // 持ち手
        const gripGeo = new THREE.BoxGeometry(0.15, 0.3, 0.15);
        const grip = new THREE.Mesh(gripGeo, bodyMat);
        grip.position.set(0, -0.2, 0.2);

        gunGroup.add(body);
        gunGroup.add(grip);

        // カメラの子要素にする (FPS視点)
        this.scene.add(gunGroup); // シーンに直接追加してupdateで追従させるか、カメラの子にする
        this.gun = gunGroup;
    }

    initEventListeners() {
        document.addEventListener('keydown', (e) => this.onKey(e, true));
        document.addEventListener('keyup', (e) => this.onKey(e, false));
        document.addEventListener('mousedown', () => {
            if (this.controls.isLocked) {
                this.keys.shoot = true;
                this.shoot();
            } else {
                this.controls.lock();
            }
        });
        document.addEventListener('mouseup', () => this.keys.shoot = false);

        // Audio Context はユーザー操作後に初期化
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
        if (!this.controls.isLocked) return;

        // 銃の位置更新 (カメラに追従)
        if (this.gun) {
            const gunOffset = new THREE.Vector3(0.3, -0.3, -0.6); // 右下前方に配置
            gunOffset.applyQuaternion(this.camera.quaternion);
            this.gun.position.copy(this.camera.position).add(gunOffset);
            this.gun.quaternion.copy(this.camera.quaternion);
        }

        // 基本物理
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

        // 仮の床判定
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
        console.log("Shooting!");
        this.playShootSound();

        const raycaster = new THREE.Raycaster();
        const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
        raycaster.set(this.camera.position, dir);

        // Tracer effect
        const points = [this.camera.position.clone().addScaledVector(dir, 1), this.camera.position.clone().addScaledVector(dir, 100)];
        const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: 0x00f2ff }));
        this.scene.add(line);
        setTimeout(() => this.scene.remove(line), 50);

        // Hit detection
        const intersects = raycaster.intersectObjects(this.scene.children);
        for (let intersect of intersects) {
            if (intersect.object.userData.isTarget) {
                this.onHitTarget(intersect.object);
                break;
            }
            if (this.network && intersect.object === this.network.remotePlayerMesh) {
                this.network.sendHit();
                break;
            }
        }

        if (this.network) this.network.sendShoot(this.camera.position, dir);
    }

    onHitTarget(obj) {
        obj.material.emissive.set(0xff0000);
        obj.userData.health -= 25;
        if (obj.userData.health <= 0) {
            obj.position.y = -5; // 沈む
            setTimeout(() => { obj.position.y = 1; obj.userData.health = 100; obj.material.emissive.set(0xff5500); }, 3000);
        } else {
            setTimeout(() => obj.material.emissive.set(0xff5500), 100);
        }
    }

    playShootSound() {
        if (!this.audioCtx) return;
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(150, this.audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(40, this.audioCtx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.1, this.audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.1);
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start();
        osc.stop(this.audioCtx.currentTime + 0.1);
    }
}
