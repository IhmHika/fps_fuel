import * as THREE from 'three';
import { Player } from './Player.js';
import { NetworkManager } from './NetworkManager.js';

// --- Global Error Capture ---
const reportError = (msg) => {
    const display = document.getElementById('error-display');
    if (display) {
        display.innerHTML += `<div style="padding:10px; border-bottom:1px solid red; background:rgba(20,0,0,0.8); font-size:12px;">[Error] ${msg}</div>`;
    }
    console.error(msg);
};

window.onerror = (msg, url, line) => {
    reportError(`${msg} at line ${line}`);
    return false;
};

// --- Variables ---
let scene, camera, renderer, clock;
let player, network;
let isGameStarted = false;

const menu = document.getElementById('menu');
const hud = document.getElementById('hud');
const statusMsg = document.getElementById('status-msg');

function init() {
    console.log("Game Init Sequence...");

    try {
        const container = document.getElementById('game-container');
        if (!container) throw new Error("#game-container not found");

        // 1. Scene
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x050510);
        scene.fog = new THREE.Fog(0x050510, 10, 200);

        // 2. Camera (Initial Lobby Position)
        camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
        camera.position.set(30, 30, 30);
        camera.lookAt(0, 5, 0);
        scene.add(camera); // Required for Gun to be visible (it's attached to camera)

        // 3. Renderer
        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        container.appendChild(renderer.domElement);

        clock = new THREE.Clock();

        // 4. Lights
        const ambient = new THREE.AmbientLight(0xffffff, 1.0);
        scene.add(ambient);

        const directional = new THREE.DirectionalLight(0x00f2ff, 1.5);
        directional.position.set(10, 30, 10);
        scene.add(directional);

        // 5. Map
        // Floor
        const ground = new THREE.Mesh(
            new THREE.PlaneGeometry(500, 500),
            new THREE.MeshStandardMaterial({ color: 0x111122, roughness: 0.8, metalness: 0.2 })
        );
        ground.rotation.x = -Math.PI / 2;
        scene.add(ground);

        // Grid
        const grid = new THREE.GridHelper(200, 40, 0x00f2ff, 0x111111);
        grid.position.y = 0.01;
        scene.add(grid);

        // Obstacles
        addObstacle(0, 2, -10, 10, 4, 3);
        addObstacle(15, 3, 5, 5, 6, 5);
        addObstacle(-15, 2, -5, 6, 4, 8);

        // 6. Components
        player = new Player(camera, renderer.domElement, scene);
        network = new NetworkManager(scene, player);
        player.network = network;

        window.addEventListener('resize', onWindowResize);

        // 7. Start Loop
        animate();
        console.log("Game Ready!");

    } catch (e) {
        reportError("Initialization Failed: " + e.message);
    }
}

function addObstacle(x, y, z, sx, sy, sz) {
    const geo = new THREE.BoxGeometry(sx, sy, sz);
    const mat = new THREE.MeshStandardMaterial({ color: 0x222233 });
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
    } else {
        // Lobby Camera: Dramatic rotation
        const time = Date.now() * 0.0003;
        const radius = 40;
        camera.position.x = Math.sin(time) * radius;
        camera.position.z = Math.cos(time) * radius;
        camera.position.y = 20 + Math.sin(time * 0.5) * 5;
        camera.lookAt(0, 5, 0);
    }

    renderer.render(scene, camera);
}

// --- Menu Actions ---
function startSession() {
    isGameStarted = true;
    menu.style.display = 'none';
    hud.style.display = 'block';

    // FPS View Transition
    camera.position.set(0, 1.7, 0);
    camera.rotation.set(0, 0, 0);
    if (player.controls) player.controls.lock();
}

document.getElementById('btn-practice').onclick = () => {
    startSession();
    statusMsg.innerText = "Practice Mode";

    // Add dummy targets
    for (let i = 0; i < 10; i++) {
        const target = new THREE.Mesh(
            new THREE.CylinderGeometry(0.5, 0.5, 2, 8),
            new THREE.MeshStandardMaterial({ color: 0xffaa00, emissive: 0xff5500, emissiveIntensity: 0.3 })
        );
        target.position.set((Math.random() - 0.5) * 50, 1, -15 - Math.random() * 30);
        target.userData.isTarget = true;
        target.userData.health = 100;
        scene.add(target);
    }
};

document.getElementById('btn-random-match').onclick = () => {
    statusMsg.innerText = "Searching for match...";
    startSession();
    const myId = "Player_" + Math.floor(Math.random() * 1000);
    const lobbyId = "PUBLIC_FPS_LOBBY";
    network.joinRoom(myId, lobbyId, () => {
        statusMsg.innerText = "Matched! Ready.";
    });
    setTimeout(() => {
        if (!network.conn) {
            network.createRoom(lobbyId, () => {
                statusMsg.innerText = "Hosting... Waiting for player.";
            });
        }
    }, 4000);
};

document.getElementById('btn-create-room').onclick = () => {
    const id = document.getElementById('peer-id-input').value;
    startSession();
    network.createRoom(id, (myId) => {
        statusMsg.innerText = "Room Created: " + myId;
    });
};

document.getElementById('btn-join-room').onclick = () => {
    const targetId = document.getElementById('target-id-input').value;
    if (!targetId) return statusMsg.innerText = "Please enter Join ID";
    startSession();
    network.joinRoom("Challenger", targetId, () => {
        statusMsg.innerText = "Connected!";
    });
};

init();
