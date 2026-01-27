import * as THREE from 'three';
import { Player } from './Player.js';
import { NetworkManager } from './NetworkManager.js';

// エラーログの表示
window.onerror = function (msg, url, lineNo, columnNo, error) {
    const display = document.getElementById('error-display');
    if (display) {
        display.innerHTML += `<div>Error: ${msg} at ${lineNo}:${columnNo}</div>`;
    }
    return false;
};

// 基本変数の定義
let scene, camera, renderer, clock;
let player, network;
let isGameStarted = false;

// DOM要素
const menu = document.getElementById('menu');
const hud = document.getElementById('hud');
const statusMsg = document.getElementById('status-msg');
const btnCreate = document.getElementById('btn-create-room');
const btnJoin = document.getElementById('btn-join-room');
const btnPractice = document.getElementById('btn-practice');
const btnRandom = document.getElementById('btn-random-match');
const myNameInput = document.getElementById('peer-id-input');
const targetIdInput = document.getElementById('target-id-input');

let targets = [];

function init() {
    console.log("Initializing Three.js scene...");
    try {
        // シーンの作成
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x111122); // 少し青みがかった背景

        clock = new THREE.Clock();

        // カメラの作成
        camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        camera.position.set(0, 1.7, 5);
        scene.add(camera);

        // レンダラーの作成
        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        document.getElementById('game-container').appendChild(renderer.domElement);

        // 照明
        const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
        scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
        directionalLight.position.set(5, 10, 7.5);
        scene.add(directionalLight);

        // 仮の地面
        const floorGeometry = new THREE.PlaneGeometry(200, 200);
        const floorMaterial = new THREE.MeshStandardMaterial({
            color: 0x1a1a1c,
            roughness: 0.8,
            metalness: 0.2
        });
        const floor = new THREE.Mesh(floorGeometry, floorMaterial);
        floor.rotation.x = -Math.PI / 2;
        scene.add(floor);

        // グリッド
        const grid = new THREE.GridHelper(200, 50, 0x00f2ff, 0x222222);
        grid.position.y = 0.01;
        scene.add(grid);

        // テスト用ボックス
        const testBox = new THREE.Mesh(
            new THREE.BoxGeometry(2, 2, 2),
            new THREE.MeshBasicMaterial({ color: 0xff0000 })
        );
        testBox.name = "testBox";
        testBox.position.set(0, 1, -5);
        scene.add(testBox);

        // 障害物の追加
        addObstacle(10, 2, -10, 10, 4, 2);
        addObstacle(-10, 1, 0, 5, 2, 5);

        // プレイヤーとネットワーク
        player = new Player(camera, renderer.domElement, scene);
        network = new NetworkManager(scene, player);
        player.network = network;

        window.addEventListener('resize', onWindowResize, false);
        animate();
    } catch (e) {
        console.error("Init failed:", e);
        document.getElementById('error-display').innerHTML += `<div>Init error: ${e.message}</div>`;
    }
}

function addObstacle(x, y, z, sx, sy, sz) {
    const geo = new THREE.BoxGeometry(sx, sy, sz);
    const mat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.5 });
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
    if (isGameStarted) {
        player.update(delta);
    }

    // テストボックスを回転させる
    const box = scene.getObjectByName("testBox");
    if (box) box.rotation.y += 0.01;

    renderer.render(scene, camera);
}

// UIイベント
btnCreate.onclick = () => {
    const myId = myNameInput.value;
    statusMsg.innerText = "Connecting...";
    network.createRoom(myId, (id) => {
        statusMsg.innerText = `Room Created! ID: ${id}`;
    });
    startGame();
};

btnJoin.onclick = () => {
    const myId = myNameInput.value + "_join" + Math.floor(Math.random() * 1000);
    const targetId = targetIdInput.value;
    if (!targetId) {
        statusMsg.innerText = "Enter Join ID";
        return;
    }
    statusMsg.innerText = "Joining...";
    network.joinRoom(myId, targetId, () => {
        statusMsg.innerText = "Connected!";
        startGame();
    });
};

btnPractice.onclick = () => {
    startGame();
    addPracticeTargets();
    statusMsg.innerText = "Practice Mode";
};

btnRandom.onclick = () => {
    const randomLobbyId = "APEX_FPS_RANDOM_LOBBY";
    const myId = myNameInput.value + "_match_" + Math.floor(Math.random() * 1000);
    statusMsg.innerText = "Matching...";
    network.joinRoom(myId, randomLobbyId, () => {
        startGame();
    });
    setTimeout(() => {
        if (!isGameStarted) {
            network.createRoom(randomLobbyId, () => startGame());
        }
    }, 4000);
};

function addPracticeTargets() {
    for (let i = 0; i < 5; i++) {
        const x = (Math.random() - 0.5) * 30;
        const z = -15 - Math.random() * 15;
        addTarget(x, 1, z);
    }
}

function addTarget(x, y, z) {
    const geo = new THREE.CylinderGeometry(0.5, 0.5, 2, 8);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffaa00 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.userData.isTarget = true;
    mesh.userData.health = 100;
    scene.add(mesh);
}

function startGame() {
    menu.style.display = 'none';
    hud.style.display = 'block';
    isGameStarted = true;
    if (player && player.controls) {
        player.controls.lock();
    }
}

init();
