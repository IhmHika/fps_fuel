import * as THREE from 'three';
import { Player } from './Player.js';
import { NetworkManager } from './NetworkManager.js';

// --- Error Logger ---
const reportError = (msg) => {
    const display = document.getElementById('error-display');
    if (display) {
        display.innerHTML += `<div style="padding:4px; border-bottom:1px solid #ff4444; background:rgba(0,0,0,0.5);">[Script] ${msg}</div>`;
    }
    console.error(msg);
};

window.onerror = (msg, url, line) => {
    reportError(`${msg} (${url}:${line})`);
    return false;
};

// --- Game Variables ---
let scene, camera, renderer, clock;
let player, network;
let isGameStarted = false; // "In Match" flag

const menu = document.getElementById('menu');
const hud = document.getElementById('hud');
const statusMsg = document.getElementById('status-msg');

function init() {
    console.log("Initializing Game Core...");

    try {
        const container = document.getElementById('game-container');
        if (!container) throw new Error("Canvas container missing");

        // 1. Scene & Camera
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x050510);

        camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
        camera.position.set(0, 10, 20); // Lobby initial view
        camera.lookAt(0, 0, 0);

        // 2. Renderer
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        container.appendChild(renderer.domElement);

        clock = new THREE.Clock();

        // 3. Lighting
        const ambient = new THREE.AmbientLight(0xffffff, 0.8);
        scene.add(ambient);

        const spot = new THREE.SpotLight(0x00f2ff, 2);
        spot.position.set(10, 20, 10);
        scene.add(spot);

        // 4. World Geometry
        // Ground
        const ground = new THREE.Mesh(
            new THREE.PlaneGeometry(500, 500),
            new THREE.MeshStandardMaterial({ color: 0x1a1a2e, roughness: 0.7 })
        );
        ground.rotation.x = -Math.PI / 2;
        scene.add(ground);

        // Grid
        const grid = new THREE.GridHelper(500, 50, 0x00f2ff, 0x111111);
        grid.position.y = 0.01;
        scene.add(grid);

        // Obstacles
        addObstacle(10, 2, -10, 5, 4, 5);
        addObstacle(-15, 3, 5, 8, 6, 2);

        // 5. Player & Network
        player = new Player(camera, renderer.domElement, scene);
        network = new NetworkManager(scene, player);
        player.network = network;

        // 6. Event Listeners
        window.addEventListener('resize', onWindowResize);

        // 7. Start Loop (Renders immediately even in lobby)
        animate();
        console.log("Scene initialized and rendering.");

    } catch (e) {
        reportError("Init Fail: " + e.message);
    }
}

function addObstacle(x, y, z, sx, sy, sz) {
    const geo = new THREE.BoxGeometry(sx, sy, sz);
    const mat = new THREE.MeshStandardMaterial({ color: 0x2d2d3d });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    scene.add(mesh);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();

    // 常にレンダリングを実行（ロビーでも3Dが見えるように）
    if (isGameStarted) {
        player.update(delta);
    } else {
        // ロビー中のふわふわしたカメラ演出（オプション）
        camera.position.x = Math.sin(Date.now() * 0.0005) * 5;
        camera.position.z = 15 + Math.cos(Date.now() * 0.0005) * 5;
        camera.lookAt(0, 0, 0);
    }

    renderer.render(scene, camera);
}

// --- Menu Actions ---
function startMatch() {
    isGameStarted = true;
    menu.style.display = 'none';
    hud.style.display = 'block';

    // マッチ開始時のプレイヤー位置
    camera.position.set(0, 1.7, 0);
    if (player.controls) player.controls.lock();
}

document.getElementById('btn-practice').onclick = () => {
    startMatch();
    statusMsg.innerText = "Practice Mode";
    // ターゲット追加
    for (let i = 0; i < 8; i++) {
        const x = (Math.random() - 0.5) * 40;
        const z = -10 - Math.random() * 30;
        const target = new THREE.Mesh(
            new THREE.CylinderGeometry(0.5, 0.5, 2, 8),
            new THREE.MeshStandardMaterial({ color: 0xffaa00, emissive: 0xff5500 })
        );
        target.position.set(x, 1, z);
        target.userData.isTarget = true;
        target.userData.health = 100;
        scene.add(target);
    }
};

document.getElementById('btn-random-match').onclick = () => {
    statusMsg.innerText = "Searching...";
    startMatch();
    const lobbyId = "APEX_RANDOM_LOBBY";
    network.joinRoom("Player_" + Math.floor(Math.random() * 100), lobbyId, () => {
        statusMsg.innerText = "Connected!";
    });
    setTimeout(() => {
        if (!network.conn) network.createRoom(lobbyId, () => { });
    }, 4000);
};

document.getElementById('btn-create-room').onclick = () => {
    const id = document.getElementById('peer-id-input').value;
    network.createRoom(id, (myId) => {
        statusMsg.innerText = "Room ID: " + myId;
        startMatch();
    });
};

document.getElementById('btn-join-room').onclick = () => {
    const targetId = document.getElementById('target-id-input').value;
    if (!targetId) return statusMsg.innerText = "Enter ID";
    network.joinRoom("Joiner", targetId, () => {
        statusMsg.innerText = "Joined!";
        startMatch();
    });
};

window.onload = init;
