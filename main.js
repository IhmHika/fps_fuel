import * as THREE from 'three';
import { Player } from './Player.js';
import { NetworkManager } from './NetworkManager.js';

// --- Error Logger ---
const reportError = (msg) => {
    const display = document.getElementById('error-display');
    if (display) {
        display.innerHTML += `<div style="padding:10px; border-bottom:1px solid red; background:rgba(15, 25, 35, 0.9); font-size:12px; color:#ff4655;">[SYSTEM] ${msg}</div>`;
    }
};

window.onerror = (msg, url, line) => {
    reportError(`${msg} at line ${line}`);
    return false;
};

window.addEventListener('keydown', (e) => {
    // Specifically block common browser shortcuts during matches
    if (isGameStarted || e.ctrlKey) {
        // Block movement interfering combos
        const blockedCodes = ['KeyW', 'KeyS', 'KeyA', 'KeyD', 'KeyR', 'KeyF', 'KeyT', 'KeyN', 'KeyP', 'KeyS', 'KeyH'];
        if (e.ctrlKey && blockedCodes.includes(e.code)) {
            e.preventDefault();
            e.stopImmediatePropagation();
        }
        // Block F-keys
        if (['F1', 'F3', 'F5', 'F6', 'F11', 'F12'].includes(e.code) && !e.ctrlKey) {
            e.preventDefault();
            e.stopImmediatePropagation();
        }
    }
}, { capture: true });

// --- Game Logic ---
let scene, camera, renderer, clock;
let player, network;
let isGameStarted = false;

// DOM Elements
const hud = document.getElementById('hud');
const statusMsg = document.getElementById('status-msg');
const topNav = document.getElementById('top-nav');
const lobbyContent = document.getElementById('lobby-content');

const navHome = document.getElementById('nav-home');
const navPractice = document.getElementById('nav-practice');
const navMatch = document.getElementById('nav-match');

const homePanel = document.getElementById('home-panel');
const matchPanel = document.getElementById('match-panel');

async function init() {
    console.log("Initializing Val-Style Game...");

    try {
        const container = document.getElementById('game-container');
        if (!container) throw new Error("Container missing");

        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x06080a);
        scene.fog = new THREE.Fog(0x06080a, 20, 150);

        camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
        camera.position.set(20, 20, 20);
        camera.lookAt(0, 5, 0);
        scene.add(camera);

        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        container.appendChild(renderer.domElement);

        clock = new THREE.Clock();

        // Environment
        const ambient = new THREE.AmbientLight(0xffffff, 0.4);
        scene.add(ambient);

        const directional = new THREE.DirectionalLight(0xff4655, 1.5);
        directional.position.set(15, 30, 10);
        scene.add(directional);

        const pointLight = new THREE.PointLight(0x00f2ff, 1.5, 100);
        pointLight.position.set(0, 10, 0);
        scene.add(pointLight);

        // Lobby Particles
        const particleGeo = new THREE.BufferGeometry();
        const particleCount = 200;
        const posArray = new Float32Array(particleCount * 3);
        for (let i = 0; i < particleCount * 3; i++) {
            posArray[i] = (Math.random() - 0.5) * 100;
        }
        particleGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
        const particleMat = new THREE.PointsMaterial({ size: 0.1, color: 0xff4655, transparent: true, opacity: 0.5 });
        const particles = new THREE.Points(particleGeo, particleMat);
        scene.add(particles);
        window.lobbyParticles = particles;

        // Ground (Valorant style grid)
        const groundGeo = new THREE.PlaneGeometry(500, 500);
        const groundMat = new THREE.MeshStandardMaterial({
            color: 0x10151a,
            roughness: 0.9,
            metalness: 0.1
        });
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        scene.add(ground);

        const grid = new THREE.GridHelper(200, 40, 0xff4655, 0x1a1a1a);
        grid.position.y = 0.02;
        scene.add(grid);

        // Visual Boundary (Wall of lights)
        const boundGeo = new THREE.CylinderGeometry(100, 100, 10, 64, 1, true);
        const boundMat = new THREE.MeshBasicMaterial({
            color: 0xff4655,
            transparent: true,
            opacity: 0.1,
            side: THREE.BackSide,
            wireframe: true
        });
        const boundary = new THREE.Mesh(boundGeo, boundMat);
        boundary.position.y = 5;
        scene.add(boundary);

        // Map obstacles (Abstract shapes)
        addObstacle(10, 5, -10, 4, 10, 4);
        addObstacle(-15, 2, 5, 6, 4, 10);
        addObstacle(0, 3, -15, 8, 6, 2);

        // Player & Network
        player = new Player(camera, renderer.domElement, scene);
        network = new NetworkManager(scene, player);
        player.network = network;

        window.addEventListener('resize', onWindowResize);

        setupUIListeners();
        animate();

    } catch (e) {
        reportError("Init Fail: " + e.message);
    }
}

function addObstacle(x, y, z, sx, sy, sz) {
    const geo = new THREE.BoxGeometry(sx, sy, sz);
    const mat = new THREE.MeshStandardMaterial({ color: 0x1f2326, emissive: 0xff4655, emissiveIntensity: 0.1 });
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
        // Dramatic Lobby Camera
        const time = Date.now() * 0.0004;
        camera.position.x = Math.sin(time) * 35;
        camera.position.z = Math.cos(time) * 35;
        camera.position.y = 15 + Math.sin(time * 0.5) * 5;
        camera.lookAt(0, 5, 0);

        if (window.lobbyParticles) {
            window.lobbyParticles.rotation.y += delta * 0.05;
        }
    }

    renderer.render(scene, camera);
}

// --- UI Logic ---
function setupUIListeners() {
    const playHoverSound = () => {
        if (!player || !player.audioCtx) return;
        const o = player.audioCtx.createOscillator();
        const g = player.audioCtx.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(440, player.audioCtx.currentTime);
        g.gain.setValueAtTime(0.02, player.audioCtx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, player.audioCtx.currentTime + 0.05);
        o.connect(g);
        g.connect(player.audioCtx.destination);
        o.start();
        o.stop(player.audioCtx.currentTime + 0.05);
    };

    // Add hover to all nav and primary buttons
    document.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('mouseenter', playHoverSound);
    });

    window.addEventListener('kill-notification', (e) => {
        const feed = document.getElementById('kill-feed');
        if (!feed) return;
        const item = document.createElement('div');
        item.className = 'kill-item';
        item.innerText = `YOU KILLED ${e.detail.victim}`;
        feed.appendChild(item);
        setTimeout(() => item.remove(), 3000);
    });

    const switchPanel = (panelId) => {
        [homePanel, matchPanel].forEach(p => p.classList.remove('active'));
        [navHome, navPractice, navMatch].forEach(b => b.classList.remove('active'));

        if (panelId === 'home') {
            homePanel.classList.add('active');
            navHome.classList.add('active');
        } else if (panelId === 'match') {
            matchPanel.classList.add('active');
            navMatch.classList.add('active');
        }
    };

    navHome.onclick = () => switchPanel('home');
    navMatch.onclick = () => switchPanel('match');

    navPractice.onclick = () => {
        startSession();
        addPracticeTargets();
    };

    document.getElementById('btn-quick-play').onclick = () => {
        switchPanel('match');
    };

    document.getElementById('btn-random-match').onclick = () => {
        startSession();
        const lobbyId = "VAL_DUEL_LOBBY";
        network.joinRoom("Agent_" + Math.floor(Math.random() * 100), lobbyId, () => {
            statusMsg.innerText = "試合開始";
        });
        setTimeout(() => {
            if (!network.conn) network.createRoom(lobbyId, () => {
                statusMsg.innerText = "対戦相手待機中...";
            });
        }, 3000);
    };

    document.getElementById('btn-create-room').onclick = () => {
        const id = document.getElementById('target-id-input').value || "ROOM_" + Math.floor(Math.random() * 1000);
        startSession();
        network.createRoom(id, (myId) => {
            statusMsg.innerText = "ルーム作成完了: " + myId;
        });
    };

    document.getElementById('btn-join-room').onclick = () => {
        const id = document.getElementById('target-id-input').value;
        if (!id) return statusMsg.innerText = "IDを入力してください";
        startSession();
        network.joinRoom("Challenger", id, () => {
            statusMsg.innerText = "接続完了";
        });
    };
}

function startSession() {
    isGameStarted = true;
    if (player) player.isActive = true; // Activate player logic and pointer lock
    topNav.style.display = 'none';
    lobbyContent.style.display = 'none';
    hud.style.display = 'block';

    // Switch to FPS view
    camera.position.set(0, 1.7, 0);
    camera.rotation.set(0, 0, 0);
    if (player.controls) player.controls.lock();
}

window.addEventListener('beforeunload', (event) => {
    if (isGameStarted) {
        event.preventDefault();
        event.returnValue = ''; // Chrome require this
    }
});

function addPracticeTargets() {
    for (let i = 0; i < 12; i++) {
        const target = new THREE.Mesh(
            new THREE.CylinderGeometry(0.5, 0.5, 2, 8),
            new THREE.MeshStandardMaterial({ color: 0xff4655, emissive: 0xff4655, emissiveIntensity: 0.5 })
        );
        target.position.set((Math.random() - 0.5) * 60, 1, -20 - Math.random() * 40);
        target.userData.isTarget = true;
        target.userData.health = 100;
        scene.add(target);
    }
}

init();
