import { Peer } from 'peerjs';
import * as THREE from 'three';

export class NetworkManager {
    constructor(scene, player) {
        this.scene = scene;
        this.player = player;
        this.peer = null;
        this.conn = null;
        this.isHost = false;
        this.remotePlayerMesh = null;
        this.health = 100;

        this.initRemotePlayerMesh();
    }

    initRemotePlayerMesh() {
        // 他のプレイヤーの見た目（簡易カプセル）
        const geometry = new THREE.CapsuleGeometry(0.5, 1, 4, 8);
        const material = new THREE.MeshStandardMaterial({ color: 0xff0055 });
        this.remotePlayerMesh = new THREE.Mesh(geometry, material);
        this.remotePlayerMesh.position.set(0, -10, 0); // 初期は画面外
        this.scene.add(this.remotePlayerMesh);

        // ヘルム（前を向いているか分かるように）
        const eyeGeo = new THREE.BoxGeometry(0.6, 0.2, 0.2);
        const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const eyes = new THREE.Mesh(eyeGeo, eyeMat);
        eyes.position.set(0, 0.5, 0.4);
        this.remotePlayerMesh.add(eyes);
    }

    setupPeer(id, onReady) {
        this.peer = new Peer(id);

        this.peer.on('open', (peerId) => {
            console.log('My peer ID is: ' + peerId);
            onReady(peerId);
        });

        this.peer.on('connection', (connection) => {
            console.log('Incoming connection...');
            this.handleConnection(connection);
        });

        this.peer.on('error', (err) => {
            console.error('PeerJS error:', err);
        });
    }

    createRoom(id, onReady) {
        this.isHost = true;
        this.setupPeer(id, onReady);
    }

    joinRoom(id, targetId, onReady) {
        this.isHost = false;
        this.setupPeer(id, (myId) => {
            const connection = this.peer.connect(targetId);
            this.handleConnection(connection);
            onReady(myId);
        });
    }

    handleConnection(connection) {
        this.conn = connection;
        this.conn.on('open', () => {
            console.log('Connected to peer!');
            // データ送信ループ開始
            setInterval(() => this.sendState(), 1000 / 30); // 30Hz
        });

        this.conn.on('data', (data) => {
            this.onReceiveData(data);
        });
    }

    sendState() {
        if (!this.conn || !this.conn.open) return;

        const state = {
            type: 'move',
            pos: {
                x: this.player.camera.position.x,
                y: this.player.camera.position.y,
                z: this.player.camera.position.z
            },
            rot: {
                y: this.player.camera.rotation.y
            },
            health: this.health
        };
        this.conn.send(state);
    }

    sendShoot(pos, dir) {
        if (!this.conn || !this.conn.open) return;
        this.conn.send({ type: 'shoot', pos, dir });
    }

    sendHit() {
        if (!this.conn || !this.conn.open) return;
        this.conn.send({ type: 'hit', damage: 20 });
    }

    onReceiveData(data) {
        if (data.type === 'move') {
            const { pos, rot, health } = data;
            this.remotePlayerMesh.position.set(pos.x, pos.y - 0.8, pos.z);
            this.remotePlayerMesh.rotation.y = rot.y;
            // リモートプレイヤーのヘルス表示などはオプション
        } else if (data.type === 'shoot') {
            // 他人の弾筋を表示
            const start = new THREE.Vector3(data.pos.x, data.pos.y, data.pos.z);
            const dir = new THREE.Vector3(data.dir.x, data.dir.y, data.dir.z);
            this.player.createTracer(start, dir);
        } else if (data.type === 'hit') {
            // 自分が撃たれた
            this.health -= data.damage;
            console.log("I'M HIT! Health:", this.health);
            this.updateHUD();
            if (this.health <= 0) {
                this.respawn();
            }
        }
    }

    updateHUD() {
        const healthBar = document.getElementById('health-bar');
        if (healthBar) {
            healthBar.style.width = `${this.health}%`;
        }
    }

    respawn() {
        alert("You died! Respawning...");
        this.health = 100;
        this.updateHUD();
        this.player.camera.position.set(Math.random() * 20 - 10, 1.7, Math.random() * 20 - 10);
        this.player.velocity.set(0, 0, 0);
    }
}
