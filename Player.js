import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
// もし上記でエラーが出る場合は 'three/addons/controls/PointerLockControls.js' に変更

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

        // 状態フラグ
        this.onGround = false;
        this.isSliding = false;
        this.slideTimer = 0;
        this.canWallJump = false;
        this.wallNormal = new THREE.Vector3();

        // 入力
        this.keys = {
            forward: false,
            backward: false,
            left: false,
            right: false,
            jump: false,
            crouch: false,
            shoot: false
        };

        this.lastShootTime = 0;
        this.shootInterval = 0.2; // 秒
        this.network = null; // 後でセット

        this.initEventListeners();
    }

    initEventListeners() {
        document.addEventListener('keydown', (e) => this.onKeyDown(e));
        document.addEventListener('keyup', (e) => this.onKeyUp(e));

        document.addEventListener('mouseup', () => this.keys.shoot = false);
        document.addEventListener('mousedown', (e) => {
            if (this.controls.isLocked) {
                this.keys.shoot = true;
            } else {
                this.controls.lock();
            }
        });
    }

    onKeyDown(event) {
        switch (event.code) {
            case 'KeyW': this.keys.forward = true; break;
            case 'KeyS': this.keys.backward = true; break;
            case 'KeyA': this.keys.left = true; break;
            case 'KeyD': this.keys.right = true; break;
            case 'Space': this.keys.jump = true; break;
            case 'ControlLeft': this.keys.crouch = true; break;
        }
    }

    onKeyUp(event) {
        switch (event.code) {
            case 'KeyW': this.keys.forward = false; break;
            case 'KeyS': this.keys.backward = false; break;
            case 'KeyA': this.keys.left = false; break;
            case 'KeyD': this.keys.right = false; break;
            case 'Space': this.keys.jump = false; break;
            case 'ControlLeft': this.keys.crouch = false; break;
        }
    }

    update(delta) {
        if (!this.controls.isLocked) return;

        // 重力の適用
        this.velocity.y -= this.gravity * delta;

        // 移動方向の計算
        this.direction.z = Number(this.keys.forward) - Number(this.keys.backward);
        this.direction.x = Number(this.keys.right) - Number(this.keys.left);
        this.direction.normalize();

        // 平面移動の摩擦
        const horizontalVelocity = new THREE.Vector3(this.velocity.x, 0, this.velocity.z);
        horizontalVelocity.multiplyScalar(1 - this.friction * delta);
        this.velocity.x = horizontalVelocity.x;
        this.velocity.z = horizontalVelocity.z;

        // スライディング判定 (走り中 + しゃがみ)
        if (this.keys.crouch && this.onGround && !this.isSliding && horizontalVelocity.length() > 5) {
            this.startSlide();
        }

        if (this.isSliding) {
            this.updateSlide(delta);
        } else {
            // 通常移動
            if (this.direction.z !== 0 || this.direction.x !== 0) {
                const moveDir = new THREE.Vector3();
                this.camera.getWorldDirection(moveDir);
                moveDir.y = 0;
                moveDir.normalize();

                const sideDir = new THREE.Vector3();
                sideDir.crossVectors(this.camera.up, moveDir).normalize();

                const accel = this.onGround ? this.moveSpeed * 10 : this.moveSpeed * 2; // 空中制御は弱く
                this.velocity.addScaledVector(moveDir, this.direction.z * accel * delta);
                this.velocity.addScaledVector(sideDir, -this.direction.x * accel * delta);
            }
        }

        // 壁蹴り (Wall Jump) 判定 (空中 + 壁接触)
        if (!this.onGround) {
            this.checkWallContact();
        } else {
            this.canWallJump = false;
        }

        // ジャンプ
        if (this.keys.jump) {
            if (this.onGround) {
                this.velocity.y = this.jumpForce;
                this.onGround = false;
            } else if (this.canWallJump) {
                this.wallJump();
            }
        }

        // 座標更新 (簡易的な床判定)
        const nextPos = this.camera.position.clone().addScaledVector(this.velocity, delta);

        if (nextPos.y < 1.7) {
            nextPos.y = 1.7;
            this.velocity.y = 0;
            this.onGround = true;
        } else {
            this.onGround = false;
        }

        this.camera.position.copy(nextPos);

        // 射撃処理
        if (this.keys.shoot) {
            this.shoot();
        }

        // しゃがみ姿勢のカメラ高さ
        const targetHeight = (this.keys.crouch || this.isSliding) ? 0.8 : 1.7;
        this.camera.position.y = THREE.MathUtils.lerp(this.camera.position.y, nextPos.y - (1.7 - targetHeight), 0.2);
    }

    startSlide() {
        this.isSliding = true;
        this.slideTimer = 1.0; // 1秒間
        // 初速ブースト
        this.velocity.x *= 1.5;
        this.velocity.z *= 1.5;
    }

    updateSlide(delta) {
        this.slideTimer -= delta;
        if (this.slideTimer <= 0 || !this.keys.crouch) {
            this.isSliding = false;
        }
        // スライディング中の摩擦は極小にする
        this.velocity.x *= (1 - 0.5 * delta);
        this.velocity.z *= (1 - 0.5 * delta);
    }

    checkWallContact() {
        // プレイヤーの周囲にレイを飛ばして壁を確認
        const raycaster = new THREE.Raycaster();
        const directions = [
            new THREE.Vector3(1, 0, 0),
            new THREE.Vector3(-1, 0, 0),
            new THREE.Vector3(0, 0, 1),
            new THREE.Vector3(0, 0, -1)
        ];

        this.canWallJump = false;

        for (let dir of directions) {
            dir.applyQuaternion(this.camera.quaternion);
            dir.y = 0;
            dir.normalize();

            raycaster.set(this.camera.position, dir);
            const intersects = raycaster.intersectObjects(this.scene.children);

            if (intersects.length > 0 && intersects[0].distance < 1.0) {
                this.canWallJump = true;
                this.wallNormal.copy(intersects[0].face.normal);
                break;
            }
        }
    }

    wallJump() {
        // 壁の法線方向に強く押し出す
        this.velocity.y = this.jumpForce * 0.8;
        this.velocity.addScaledVector(this.wallNormal, 15);
        this.canWallJump = false;
        console.log("Wall Jump!");
    }

    shoot() {
        const now = performance.now() / 1000;
        if (now - this.lastShootTime < this.shootInterval) return;
        this.lastShootTime = now;

        console.log("Shoot!");

        // レイキャスティングによるヒット判定
        const raycaster = new THREE.Raycaster();
        const dir = new THREE.Vector3(0, 0, -1);
        dir.applyQuaternion(this.camera.quaternion);
        raycaster.set(this.camera.position, dir);

        // 射撃エフェクト (簡易的な線)
        this.createTracer(this.camera.position, dir);

        if (this.network && this.network.remotePlayerMesh) {
            const intersects = raycaster.intersectObject(this.network.remotePlayerMesh);
            if (intersects.length > 0) {
                console.log("HIT PLAYER!");
                this.network.sendHit();
            }
        }

        // 練習用ターゲットの判定
        const targetIntersects = raycaster.intersectObjects(this.scene.children);
        for (let intersect of targetIntersects) {
            if (intersect.object.userData.isTarget) {
                this.hitTarget(intersect.object);
                break; // 貫通はしない
            }
        }

        // ネットワーク越しに射撃を通知
        if (this.network) {
            this.network.sendShoot(this.camera.position, dir);
        }
    }

    createTracer(start, direction) {
        const points = [];
        points.push(start.clone().addScaledVector(direction, 1)); // 少し前から開始
        points.push(start.clone().addScaledVector(direction, 100));
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({ color: 0x00f2ff, transparent: true, opacity: 0.5 });
        const line = new THREE.Line(geometry, material);
        this.scene.add(line);

        setTimeout(() => {
            this.scene.remove(line);
        }, 50);
    }

    hitTarget(obj) {
        console.log("HIT TARGET!");
        obj.userData.health -= 25;
        obj.material.color.set(0xff0000); // 一瞬赤くする
        setTimeout(() => {
            if (obj.userData.health > 0) {
                obj.material.color.set(0xffaa00);
            } else {
                // 壊れる演出（沈む）
                obj.position.y = -5;
                setTimeout(() => {
                    obj.position.y = 2; // 3秒後に復活
                    obj.userData.health = 100;
                    obj.material.color.set(0xffaa00);
                }, 3000);
            }
        }, 100);
    }
}
