import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Player } from './Player.js';
import { EnemyManager } from './EnemyManager.js';
import { WeaponSystem } from './WeaponSystem.js';
import { ParticleSystem } from './ParticleSystem.js';
import { AudioManager } from './AudioManager.js';

export class Game {
    constructor() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.clock = new THREE.Clock();
        
        this.world = new CANNON.World({
            gravity: new CANNON.Vec3(0, -9.82, 0) // m/s²
        });

        // Create player physics body
        const playerShape = new CANNON.Capsule(0.5, 0.9); // Radius, height (total height 1.8)
        this.playerBody = new CANNON.Body({
            mass: 50,
            position: new CANNON.Vec3(0, 1.8, 0), // Initial player position
            shape: playerShape
        });
        this.world.addBody(this.playerBody);
        
        this.player = new Player(this.camera, this.playerBody);
        this.enemyManager = new EnemyManager(this.scene, this.takeDamage.bind(this));
        this.weaponSystem = new WeaponSystem(this.scene, this.camera, this.audioManager);
        this.particleSystem = new ParticleSystem(this.scene);
        this.audioManager = new AudioManager();
        
        this.gameState = {
            health: 100,
            ammo: 30,
            score: 0,
            isPlaying: false
        };
        
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        
        this.hitmarkerElement = document.getElementById('hitmarker');
    }

    showHitmarker() {
        if (this.hitmarkerElement) {
            this.hitmarkerElement.style.opacity = '1';
            setTimeout(() => {
                this.hitmarkerElement.style.opacity = '0';
            }, 100); // Hitmarker visible for 100ms
        }
    }
    
    init() {
        // Setup renderer
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.setClearColor(0x000000);
        document.getElementById('gameContainer').appendChild(this.renderer.domElement);
        
        // Setup scene
        this.setupLighting();
        this.createEnvironment();
        
        // Setup camera
        this.camera.position.set(0, 1.8, 0);
        
        // Setup event listeners
        this.setupEventListeners();
    }
    
    setupLighting() {
        // Ambient light
        const ambientLight = new THREE.AmbientLight(0x404040, 0.3);
        this.scene.add(ambientLight);
        
        // Directional light (sun)
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(50, 100, 50);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        this.scene.add(directionalLight);
        
        // Point lights for atmosphere
        for (let i = 0; i < 5; i++) {
            const light = new THREE.PointLight(0xff4444, 0.5, 20);
            light.position.set(
                (Math.random() - 0.5) * 100,
                Math.random() * 10 + 5,
                (Math.random() - 0.5) * 100
            );
            this.scene.add(light);
        }
    }
    
    createEnvironment() {
        // Ground
        const groundGeometry = new THREE.PlaneGeometry(200, 200);
        const groundMaterial = new THREE.MeshLambertMaterial({ 
            color: 0x333333,
            transparent: true,
            opacity: 0.8
        });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add(ground);

        // Cannon.js ground body
        const groundBody = new CANNON.Body({
            mass: 0, // A mass of 0 means it's static
            shape: new CANNON.Plane(),
            position: new CANNON.Vec3(0, 0, 0)
        });
        groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0); // Rotate to match Three.js ground
        this.world.addBody(groundBody);
        
        // Walls and obstacles
        this.createWalls();
        this.createObstacles();
        
        // Fog for atmosphere
        this.scene.fog = new THREE.Fog(0x000000, 50, 150);
    }
    
    createWalls() {
        const wallMaterial = new THREE.MeshLambertMaterial({ color: 0x666666 });
        
        // Create maze-like walls
        const wallPositions = [
            { x: 0, z: 50, w: 100, h: 10 },
            { x: 0, z: -50, w: 100, h: 10 },
            { x: 50, z: 0, w: 10, h: 100 },
            { x: -50, z: 0, w: 10, h: 100 },
            { x: 25, z: 25, w: 30, h: 5 },
            { x: -25, z: -25, w: 30, h: 5 }
        ];
        
        wallPositions.forEach(wall => {
            const geometry = new THREE.BoxGeometry(wall.w, wall.h, 5);
            const mesh = new THREE.Mesh(geometry, wallMaterial);
            mesh.position.set(wall.x, wall.h / 2, wall.z);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            this.scene.add(mesh);

            // Cannon.js wall body
            const wallShape = new CANNON.Box(new CANNON.Vec3(wall.w / 2, wall.h / 2, 5 / 2));
            const wallBody = new CANNON.Body({
                mass: 0, // Static body
                shape: wallShape,
                position: new CANNON.Vec3(wall.x, wall.h / 2, wall.z)
            });
            this.world.addBody(wallBody);
        });
    }
    
    createObstacles() {
        const crateMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
        
        for (let i = 0; i < 20; i++) {
            const size = Math.random() * 2 + 1;
            const geometry = new THREE.BoxGeometry(size, size, size);
            const crate = new THREE.Mesh(geometry, crateMaterial);
            
            crate.position.set(
                (Math.random() - 0.5) * 80,
                size / 2,
                (Math.random() - 0.5) * 80
            );
            
            crate.castShadow = true;
            crate.receiveShadow = true;
            this.scene.add(crate);

            // Cannon.js crate body
            const crateShape = new CANNON.Box(new CANNON.Vec3(size / 2, size / 2, size / 2));
            const crateBody = new CANNON.Body({
                mass: 0, // Static body
                shape: crateShape,
                position: new CANNON.Vec3(crate.position.x, crate.position.y, crate.position.z)
            });
            this.world.addBody(crateBody);
        }
    }
    
    setupEventListeners() {
        // Mouse events
        document.addEventListener('click', (event) => {
            if (this.gameState.isPlaying && document.pointerLockElement) {
                const shotFired = this.weaponSystem.shoot();
                if (shotFired) {
                    this.checkHit();
                }
            }
        });
        
        // Keyboard events
        document.addEventListener('keydown', (event) => {
            if (event.code === 'KeyR') {
                this.weaponSystem.reload();
            }
        });
    }
    
    checkHit() {
        this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
        const intersects = this.raycaster.intersectObjects(this.enemyManager.enemies);
        
        if (intersects.length > 0) {
            const enemy = intersects[0].object;
            const hitPoint = intersects[0].point;
            
            // Create robotic impact effect
            this.particleSystem.createSparksEffect(hitPoint);
            this.particleSystem.createDebrisEffect(hitPoint, enemy);

            // Show hitmarker
            this.showHitmarker();
            
            // Damage enemy
            this.enemyManager.damageEnemy(enemy, hitPoint);
            
            // Update score
            this.gameState.score += 10;
            this.updateHUD();
        }
    }
    
    start() {
        this.gameState.isPlaying = true;
        this.enemyManager.startSpawning();
        this.animate();
    }
    
    animate() {
        if (!this.gameState.isPlaying) return;
        
        requestAnimationFrame(() => this.animate());
        
        const deltaTime = this.clock.getDelta();

        // Update physics world
        this.world.step(1/60, deltaTime, 3); // Fixed time step for physics
        
        // Update game systems
        this.player.update(deltaTime);
        this.enemyManager.update(deltaTime, this.camera.position);
        this.weaponSystem.update(deltaTime);
        this.particleSystem.update(deltaTime);
        
        // Check enemy collisions with player
        this.checkEnemyCollisions();
        
        // Render
        this.renderer.render(this.scene, this.camera);
    }
    
    checkEnemyCollisions() {
        const playerPos = this.camera.position;
        this.enemyManager.enemies.forEach(enemy => {
            const distance = enemy.position.distanceTo(playerPos);
            if (distance < 2) {
                this.takeDamage(10);
            }
        });
    }
    
    takeDamage(amount) {
        this.gameState.health -= amount;
        if (this.gameState.health <= 0) {
            this.gameOver();
        }
        this.updateHUD();
        
        // Screen flash effect
        this.renderer.domElement.style.filter = 'brightness(2) saturate(0) sepia(1) hue-rotate(0deg)';
        setTimeout(() => {
            this.renderer.domElement.style.filter = 'none';
        }, 100);
    }
    
    gameOver() {
        this.gameState.isPlaying = false;
        document.getElementById('menu').innerHTML = `
            <h1>GAME OVER</h1>
            <p>Final Score: ${this.gameState.score}</p>
            <button onclick="location.reload()">RESTART</button>
        `;
        document.getElementById('menu').style.display = 'block';
        document.exitPointerLock();
    }
    
    updateHUD() {
        document.getElementById('health').textContent = this.gameState.health;
        document.getElementById('ammo').textContent = this.weaponSystem.ammo;
        document.getElementById('score').textContent = this.gameState.score;
    }
    
    enableControls() {
        this.player.enableControls();
    }
    
    disableControls() {
        this.player.disableControls();
    }
    
    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
}