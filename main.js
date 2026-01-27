import { Player } from './Player.js';
import { NetworkManager } from './NetworkManager.js';

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
    // シーンの作成
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a0c);
    scene.fog = new THREE.FogExp2(0x0a0a0c, 0.02);

    clock = new THREE.Clock();

    // カメラの作成
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

    // レンダラーの作成
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    document.getElementById('game-container').appendChild(renderer.domElement);

    // 照明
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0x00f2ff, 1);
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

    // グリッドヘルパー
    const grid = new THREE.GridHelper(200, 50, 0x00f2ff, 0x222222);
    grid.position.y = 0.01;
    scene.add(grid);

    // 障害物の追加 (立体感と移動の楽しみのため)
    addObstacle(0, 2, -10, 10, 4, 2);
    addObstacle(15, 1, 0, 5, 2, 5);
    addObstacle(-15, 3, 5, 4, 6, 4);

    // プレイヤーの初期化
    player = new Player(camera, renderer.domElement, scene);

    // ネットワークの初期化
    network = new NetworkManager(scene, player);
    player.network = network;

    // ウィンドウリサイズ対応
    window.addEventListener('resize', onWindowResize, false);

    animate();
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

    renderer.render(scene, camera);
}

// UIイベント
btnCreate.onclick = () => {
    const myId = myNameInput.value;
    statusMsg.innerText = "Connecting...";
    network.createRoom(myId, (id) => {
        statusMsg.innerText = `Room Created! ID: ${id} (Wait for player...)`;
        // ホストは参加を待つ
    });
    // ゲームは開始するが、相手を待つ状態
    startGame();
};

btnJoin.onclick = () => {
    const myId = myNameInput.value + "_join" + Math.floor(Math.random() * 1000);
    const targetId = targetIdInput.value;
    if (!targetId) {
        statusMsg.innerText = "Please enter a Join ID";
        return;
    }
    statusMsg.innerText = "Joining...";
    network.joinRoom(myId, targetId, (id) => {
        statusMsg.innerText = "Connected!";
        startGame();
    });
};

btnPractice.onclick = () => {
    startGame();
    addPracticeTargets();
    statusMsg.innerText = "Practice Mode Started";
};

btnRandom.onclick = () => {
    const randomLobbyId = "APEX_FPS_RANDOM_LOBBY";
    const myId = myNameInput.value + "_match_" + Math.floor(Math.random() * 1000);

    statusMsg.innerText = "Searching for match...";

    // まず参加を試みる
    network.joinRoom(myId, randomLobbyId, (id) => {
        statusMsg.innerText = "Matched! Connected.";
        startGame();
    });

    // 5秒待って接続できなければ自分がホストになる（簡易）
    setTimeout(() => {
        if (!isGameStarted) {
            statusMsg.innerText = "No one found. Hosting match...";
            network.createRoom(randomLobbyId, (id) => {
                startGame();
            });
        }
    }, 5000);
};

function addPracticeTargets() {
    // 練習用のターゲットをいくつか配置
    for (let i = 0; i < 5; i++) {
        const x = (Math.random() - 0.5) * 40;
        const z = -20 - Math.random() * 20;
        const target = addTarget(x, 2, z);
        targets.push(target);
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
    return mesh;
}

function startGame() {
    menu.style.display = 'none';
    hud.style.display = 'block';
    isGameStarted = true;
    console.log("Game Started");
}

init();
