import * as THREE from 'three';
import { Player } from './Player.js';
import { NetworkManager } from './NetworkManager.js';

// エラーログの表示
window.onerror = function (msg, url, lineNo, columnNo, error) {
    const display = document.getElementById('error-display');
    if (display) {
        display.innerHTML += `<div style="padding:5px; border-bottom:1px solid red;">[Error] ${msg}<br><small>${url} (L${lineNo}:C${columnNo})</small></div>`;
    }
    console.error(error);
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
    console.log("FPS Game Initializing...");
    try {
        // シーンの作成
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x050510); // 深い紺色

        clock = new THREE.Clock();

        // カメラの作成
        camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
        camera.position.set(0, 5, 15); // 最初は少し高く設定
        scene.add(camera);

        // レンダラーの作成
        renderer = new THREE.WebGLRenderer({
            antialias: true,
            powerPreference: "high-performance"
        });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setClearColor(0x111122); // 万が一シーンが表示されなくても色が出るように

        const container = document.getElementById('game-container');
        if (!container) throw new Error("game-container not found!");
        container.appendChild(renderer.domElement);

        // 照明
        const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
        scene.add(ambientLight);

        const sunLight = new THREE.DirectionalLight(0xffffff, 2.0);
        sunLight.position.set(10, 20, 10);
        scene.add(sunLight);

        // 地面 (巨大化)
        const floorGeo = new THREE.PlaneGeometry(1000, 1000);
        const floorMat = new THREE.MeshStandardMaterial({
            color: 0x111111,
            metalness: 0.1,
            roughness: 0.8
        });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        scene.add(floor);

        // グリッド (目立つように)
        const grid = new THREE.GridHelper(100, 20, 0x00ffff, 0x444444);
        grid.position.y = 0.05;
        scene.add(grid);

        // 確実に目立つテストオブジェクト (超巨大な赤いキューブ)
        const testCube = new THREE.Mesh(
            new THREE.BoxGeometry(5, 5, 5),
            new THREE.MeshBasicMaterial({ color: 0xff0000 })
        );
        testCube.position.set(0, 2.5, -20);
        testCube.name = "testCube";
        scene.add(testCube);

        // 障害物
        addObstacle(0, 2, -10, 10, 4, 3);

        // プレイヤーと通信の準備
        player = new Player(camera, renderer.domElement, scene);
        network = new NetworkManager(scene, player);
        player.network = network;

        window.addEventListener('resize', onWindowResize, false);

        console.log("Start animate loop");
        animate();
    } catch (err) {
        console.error("Init Error:", err);
        const display = document.getElementById('error-display');
        if (display) display.innerHTML += `<div style="color:yellow;">Init Failed: ${err.message}</div>`;
    }
}

function addObstacle(x, y, z, sx, sy, sz) {
    const geo = new THREE.BoxGeometry(sx, sy, sz);
    const mat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.5 });
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

    // ゲームが始まっていれば物理更新
    if (isGameStarted && player) {
        player.update(delta);
    }

    // テストオブジェクトの回転
    const cube = scene.getObjectByName("testCube");
    if (cube) cube.rotation.y += 0.02;

    renderer.render(scene, camera);
}

// UIイベント
btnCreate.onclick = () => {
    startGame();
    network.createRoom(myNameInput.value, (id) => {
        statusMsg.innerText = `ID: ${id}`;
    });
};

btnJoin.onclick = () => {
    if (!targetIdInput.value) return (statusMsg.innerText = "Enter ID");
    startGame();
    network.joinRoom(myNameInput.value + "_join", targetIdInput.value, () => {
        statusMsg.innerText = "Joined!";
    });
};

btnPractice.onclick = () => {
    startGame();
    addPracticeTargets();
    statusMsg.innerText = "Practice Mode";
};

btnRandom.onclick = () => {
    startGame();
    // 簡易的なランダム接続ロジック
    const lobbyId = "APEX_LOBBY_GLOBAL";
    network.joinRoom(myNameInput.value + "_m", lobbyId, () => {
        statusMsg.innerText = "Matched!";
    });
    setTimeout(() => {
        if (network.conn === null) {
            network.createRoom(lobbyId, (id) => {
                statusMsg.innerText = "Waiting for players...";
            });
        }
    }, 3000);
};

function addPracticeTargets() {
    for (let i = 0; i < 5; i++) {
        const x = (Math.random() - 0.5) * 40;
        const z = -30 - Math.random() * 20;
        addTarget(x, 2, z);
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
    // ユーザーインタラクション後にのみロックが可能
    if (player && player.controls) {
        player.controls.lock();
    }
}

// ページ読み込み完了時に初期化
window.addEventListener('load', init);
