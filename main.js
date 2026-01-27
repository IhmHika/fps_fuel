import * as THREE from 'three';
import { Player } from './Player.js';
import { NetworkManager } from './NetworkManager.js';

// Global error display
const reportError = (msg) => {
    const display = document.getElementById('error-display');
    if (display) {
        display.innerHTML += `<div style="padding:4px; border-bottom:1px solid #722;">[Script] ${msg}</div>`;
    }
};

window.onerror = (msg, url, line) => {
    reportError(`${msg} (${url}:${line})`);
    return false;
};

let scene, camera, renderer, clock;
let player, network;
let isGameStarted = false;

function init() {
    console.log("Initializing Game...");

    try {
        const container = document.getElementById('game-container');
        if (!container) throw new Error("Canvas container not found");

        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x050510);

        camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        // 最初はロビー用の俯瞰カメラ
        camera.position.set(20, 20, 20);
        camera.lookAt(0, 0, 0);

        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        container.appendChild(renderer.domElement);

        clock = new THREE.Clock();

        // 照明
        const ambient = new THREE.AmbientLight(0xffffff, 1.0);
        scene.add(ambient);

        const sun = new THREE.DirectionalLight(0xffffff, 1.0);
        sun.position.set(5, 10, 7.5);
        scene.add(sun);

        // 地面
        const ground = new THREE.Mesh(
            new THREE.PlaneGeometry(200, 200),
            new THREE.MeshStandardMaterial({ color: 0x1a1a2e })
        );
        ground.rotation.x = -Math.PI / 2;
        scene.add(ground);

        // グリッド
        const grid = new THREE.GridHelper(200, 40, 0x00f2ff, 0x111111);
        grid.position.y = 0.01;
        scene.add(grid);

        // 障害物の追加
        addObstacle(10, 2, -10, 5, 4, 5);
        addObstacle(-15, 3, 5, 8, 6, 2);

        // プレイヤーとネットワーク
        player = new Player(camera, renderer.domElement, scene);
        network = new NetworkManager(scene, player);
        player.network = network;

        window.addEventListener('resize', onWindowResize);

        animate();
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
    if (!camera || !renderer) return;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();

    if (isGameStarted) {
        player.update(delta);
    } else {
        // ロビー時のカメラ回転演出
        const time = Date.now() * 0.0005;
        camera.position.x = Math.sin(time) * 30;
        camera.position.z = Math.cos(time) * 30;
        camera.position.y = 20;
        camera.lookAt(0, 0, 0);
    }

    renderer.render(scene, camera);
}

// UI Setup
function startGlobalMatch() {
    isGameStarted = true;
    document.getElementById('menu').style.display = 'none';
    document.getElementById('hud').style.display = 'block';

    // FPS視点へ移行
    camera.position.set(0, 1.7, 0);
    camera.rotation.set(0, 0, 0);
    if (player && player.controls) player.controls.lock();
}

document.getElementById('btn-practice').onclick = () => {
    startGlobalMatch();
    // ターゲット追加
    for (let i = 0; i < 10; i++) {
        const x = (Math.random() - 0.5) * 60;
        const z = -20 - Math.random() * 40;
        const target = new THREE.Mesh(
            new THREE.CylinderGeometry(0.5, 0.5, 2),
            new THREE.MeshStandardMaterial({ color: 0xffaa00, emissive: 0x552200 })
        );
        target.position.set(x, 1, z);
        target.userData.isTarget = true;
        target.userData.health = 100;
        scene.add(target);
    }
};

document.getElementById('btn-random-match').onclick = () => {
    startGlobalMatch();
    network.joinRoom("Player_" + Math.floor(Math.random() * 100), "RANDOM_LOBBY", () => { });
    setTimeout(() => {
        if (!network.conn) network.createRoom("RANDOM_LOBBY", () => { });
    }, 3000);
};

init();
