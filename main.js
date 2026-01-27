import * as THREE from 'three';
import { Player } from './Player.js';
import { NetworkManager } from './NetworkManager.js';

// --- Error Logger ---
const reportError = (msg) => {
    const display = document.getElementById('error-display');
    if (display) {
        display.innerHTML += `<div style="padding:4px; border-bottom:1px dotted #f00; background:rgba(0,0,0,0.5);">[Log] ${msg}</div>`;
    }
};

window.onerror = (msg, url, line) => {
    reportError(`${msg} (${line})`);
    return false;
};

// --- Game Logic ---
let scene, camera, renderer, clock;
let player, network;
let isGameStarted = false;

const menu = document.getElementById('menu');
const hud = document.getElementById('hud');
const statusMsg = document.getElementById('status-msg');

async function init() {
    console.log("Game Initialization Started");

    try {
        const container = document.getElementById('game-container');
        if (!container) throw new Error("Container #game-container not found");

        // 1. Scene setup
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x0a0a14);

        camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
        camera.position.set(20, 20, 20);
        camera.lookAt(0, 0, 0);
        scene.add(camera); // IMPORTANT: Needed for camera-attached objects like the gun

        // 2. Renderer
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        container.appendChild(renderer.domElement);

        clock = new THREE.Clock();

        // 3. World
        const ambient = new THREE.AmbientLight(0xffffff, 1.2);
        scene.add(ambient);

        const directional = new THREE.DirectionalLight(0x00f2ff, 1.0);
        directional.position.set(10, 20, 10);
        scene.add(directional);

        // Ground
        const ground = new THREE.Mesh(
            new THREE.PlaneGeometry(1000, 1000),
            new THREE.MeshStandardMaterial({ color: 0x111122 })
        );
        ground.rotation.x = -Math.PI / 2;
        scene.add(ground);

        // Grid
        const grid = new THREE.GridHelper(100, 20, 0x00f2ff, 0x222222);
        grid.position.y = 0.01;
        scene.add(grid);

        // 4. Player & Network
        player = new Player(camera, renderer.domElement, scene);
        network = new NetworkManager(scene, player);
        player.network = network;

        window.addEventListener('resize', onWindowResize);

        // 5. Start looping
        animate();
        console.log("Initialization Complete");

    } catch (e) {
        reportError("Fatal error during init: " + e.message);
    }
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
        // Lobby view: Rotate camera around center
        const time = Date.now() * 0.0005;
        camera.position.x = Math.sin(time) * 25;
        camera.position.z = Math.cos(time) * 25;
        camera.position.y = 15;
        camera.lookAt(0, 5, 0);
    }

    renderer.render(scene, camera);
}

function startMatch() {
    isGameStarted = true;
    menu.style.display = 'none';
    hud.style.display = 'block';

    // Switch to FPS view
    camera.position.set(0, 1.7, 0);
    camera.rotation.set(0, 0, 0);
    if (player.controls) player.controls.lock();
}

// Button Events
document.getElementById('btn-practice').onclick = () => {
    startMatch();
    statusMsg.innerText = "Practice Range Entered";

    // Add dummy targets
    for (let i = 0; i < 10; i++) {
        const target = new THREE.Mesh(
            new THREE.CylinderGeometry(0.5, 0.5, 2, 8),
            new THREE.MeshStandardMaterial({ color: 0xffaa00, emissive: 0xff0000, emissiveIntensity: 0.2 })
        );
        target.position.set((Math.random() - 0.5) * 40, 1, -10 - Math.random() * 20);
        target.userData.isTarget = true;
        target.userData.health = 100;
        scene.add(target);
    }
};

document.getElementById('btn-random-match').onclick = () => {
    startMatch();
    statusMsg.innerText = "Connecting to Global Lobby...";
    const lobbyId = "GLOBAL_FPS_LOBBY";
    network.joinRoom("Player_" + Math.floor(Math.random() * 100), lobbyId, () => { });
    setTimeout(() => {
        if (!network.conn) network.createRoom(lobbyId, () => { });
    }, 4000);
};

// Initial call
init();
