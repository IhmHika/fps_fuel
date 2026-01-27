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
        scene.background = new THREE.Color(0x0a0a14);

        camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        camera.position.set(0, 1.7, 10);

        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        container.appendChild(renderer.domElement);

        clock = new THREE.Clock();

        // Basic Light
        const ambient = new THREE.AmbientLight(0xffffff, 1.0);
        scene.add(ambient);

        const sun = new THREE.DirectionalLight(0xffffff, 1.0);
        sun.position.set(5, 10, 7.5);
        scene.add(sun);

        // Ground
        const ground = new THREE.Mesh(
            new THREE.PlaneGeometry(100, 100),
            new THREE.MeshStandardMaterial({ color: 0x222222 })
        );
        ground.rotation.x = -Math.PI / 2;
        scene.add(ground);

        // Test Box at Center
        const box = new THREE.Mesh(
            new THREE.BoxGeometry(2, 2, 2),
            new THREE.MeshBasicMaterial({ color: 0xff0000 })
        );
        box.position.set(0, 1, 0);
        box.name = "test_target";
        scene.add(box);

        // Components
        player = new Player(camera, renderer.domElement, scene);
        network = new NetworkManager(scene, player);
        player.network = network;

        window.addEventListener('resize', onWindowResize);

        animate();
        console.log("Game Loaded Successfully");
    } catch (e) {
        reportError("Init Fail: " + e.message);
        console.error(e);
    }
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

    if (isGameStarted && player) {
        player.update(delta);
    }

    const testTarget = scene.getObjectByName("test_target");
    if (testTarget) testTarget.rotation.y += 0.01;

    renderer.render(scene, camera);
}

// UI Setup
document.getElementById('btn-practice').onclick = () => {
    isGameStarted = true;
    document.getElementById('menu').style.display = 'none';
    document.getElementById('hud').style.display = 'block';
    if (player && player.controls) player.controls.lock();

    // Add practice targets
    for (let i = 0; i < 5; i++) {
        const target = new THREE.Mesh(
            new THREE.CylinderGeometry(0.5, 0.5, 2),
            new THREE.MeshStandardMaterial({ color: 0xffaa00 })
        );
        target.position.set((Math.random() - 0.5) * 20, 1, -10 - Math.random() * 10);
        target.userData.isTarget = true;
        target.userData.health = 100;
        scene.add(target);
    }
};

// ... other buttons simplified or skipped for immediate test
document.getElementById('btn-random-match').onclick = () => reportError("Matching not ready, use Practice");

init();
