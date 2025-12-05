import * as THREE from 'three';
import * as CANNON from 'cannon-es';

class Game {
    constructor() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.world = new CANNON.World();
        
        this.player = { health: 100, score: 0, ammo: 30, maxAmmo: 30 };
        this.enemies = [];
        this.keys = {};
        this.mouse = { x: 0, y: 0 };
        this.locked = false;
        
        this.init();
    }
    
    init() {
        // Renderer setup
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setClearColor(0x001122);
        this.renderer.shadowMap.enabled = true;
        document.body.appendChild(this.renderer.domElement);
        
        // Physics world
        this.world.gravity.set(0, -20, 0);
        this.world.broadphase = new CANNON.NaiveBroadphase();
        
        // Scene setup
        this.createEnvironment();
        this.setupControls();
        this.setupLighting();
        
        // Game loop
        this.animate();
        this.spawnEnemies();
    }
    
    createEnvironment() {
        // Ground
        const groundGeometry = new THREE.PlaneGeometry(200, 200);
        const groundMaterial = new THREE.MeshLambertMaterial({ color: 0x333333 });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add(ground);
        
        // Ground physics
        const groundShape = new CANNON.Plane();
        const groundBody = new CANNON.Body({ mass: 0 });
        groundBody.addShape(groundShape);
        groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
        this.world.add(groundBody);
        
        // Walls for boundaries
        for (let i = 0; i < 8; i++) {
            const wall = new THREE.Mesh(
                new THREE.BoxGeometry(5, 10, 5),
                new THREE.MeshLambertMaterial({ color: 0x666666 })
            );
            wall.position.set(
                (Math.random() - 0.5) * 180,
                5,
                (Math.random() - 0.5) * 180
            );
            wall.castShadow = true;
            this.scene.add(wall);
        }
        
        // Player position
        this.camera.position.set(0, 2, 0);
    }
    
    setupLighting() {
        const ambientLight = new THREE.AmbientLight(0x404040, 0.3);
        this.scene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(50, 50, 50);
        directionalLight.castShadow = true;
        this.scene.add(directionalLight);
    }
    
    setupControls() {
        document.addEventListener('keydown', (e) => this.keys[e.code] = true);
        document.addEventListener('keyup', (e) => this.keys[e.code] = false);
        document.addEventListener('mousemove', (e) => this.onMouseMove(e));
        document.addEventListener('click', () => this.shoot());
        
        // Pointer lock
        document.addEventListener('click', () => {
            if (!this.locked) {
                document.body.requestPointerLock();
            }
        });
        
        document.addEventListener('pointerlockchange', () => {
            this.locked = document.pointerLockElement === document.body;
        });
    }
    
    onMouseMove(event) {
        if (!this.locked) return;
        
        this.mouse.x += event.movementX * 0.002;
        this.mouse.y += event.movementY * 0.002;
        this.mouse.y = Math.max(-Math.PI/2, Math.min(Math.PI/2, this.mouse.y));
        
        this.camera.rotation.order = 'YXZ';
        this.camera.rotation.y = -this.mouse.x;
        this.camera.rotation.x = -this.mouse.y;
    }
    
    updatePlayer() {
        const speed = this.keys['ShiftLeft'] ? 0.3 : 0.15;
        const direction = new THREE.Vector3();
        
        if (this.keys['KeyW']) direction.z -= speed;
        if (this.keys['KeyS']) direction.z += speed;
        if (this.keys['KeyA']) direction.x -= speed;
        if (this.keys['KeyD']) direction.x += speed;
        
        direction.applyQuaternion(this.camera.quaternion);
        direction.y = 0;
        this.camera.position.add(direction);
        
        if (this.keys['KeyR'] && this.player.ammo < this.player.maxAmmo) {
            this.reload();
        }
    }
    
    shoot() {
        if (this.player.ammo <= 0) return;
        
        this.player.ammo--;
        this.updateUI();
        
        // Muzzle flash effect
        this.createMuzzleFlash();
        
        // Raycast for hit detection
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
        
        const intersects = raycaster.intersectObjects(this.enemies.map(e => e.mesh));
        if (intersects.length > 0) {
            const enemy = this.enemies.find(e => e.mesh === intersects[0].object);
            if (enemy) {
                this.hitEnemy(enemy);
            }
        }
        
        // Screen shake
        this.screenShake();
    }
    
    createMuzzleFlash() {
        const flash = new THREE.Mesh(
            new THREE.SphereGeometry(0.2),
            new THREE.MeshBasicMaterial({ color: 0xffff00 })
        );
        
        const flashPos = this.camera.position.clone();
        const forward = new THREE.Vector3(0, 0, -1);
        forward.applyQuaternion(this.camera.quaternion);
        flashPos.add(forward.multiplyScalar(2));
        
        flash.position.copy(flashPos);
        this.scene.add(flash);
        
        setTimeout(() => this.scene.remove(flash), 50);
    }
    
    screenShake() {
        const originalPos = this.camera.position.clone();
        const shakeIntensity = 0.05;
        
        this.camera.position.x += (Math.random() - 0.5) * shakeIntensity;
        this.camera.position.y += (Math.random() - 0.5) * shakeIntensity;
        
        setTimeout(() => {
            this.camera.position.copy(originalPos);
        }, 50);
    }
    
    hitEnemy(enemy) {
        enemy.health -= 25;
        
        // Hit effect
        const hitEffect = new THREE.Mesh(
            new THREE.SphereGeometry(0.5),
            new THREE.MeshBasicMaterial({ color: 0xff0000 })
        );
        hitEffect.position.copy(enemy.mesh.position);
        this.scene.add(hitEffect);
        
        setTimeout(() => this.scene.remove(hitEffect), 200);
        
        if (enemy.health <= 0) {
            this.destroyEnemy(enemy);
            this.player.score += 100;
            this.updateUI();
        }
    }
    
    destroyEnemy(enemy) {
        this.scene.remove(enemy.mesh);
        this.enemies = this.enemies.filter(e => e !== enemy);
        
        // Explosion effect
        for (let i = 0; i < 5; i++) {
            const particle = new THREE.Mesh(
                new THREE.SphereGeometry(0.1),
                new THREE.MeshBasicMaterial({ color: 0xff4400 })
            );
            particle.position.copy(enemy.mesh.position);
            particle.position.add(new THREE.Vector3(
                (Math.random() - 0.5) * 2,
                Math.random() * 2,
                (Math.random() - 0.5) * 2
            ));
            this.scene.add(particle);
            
            setTimeout(() => this.scene.remove(particle), 1000);
        }
    }
    
    spawnEnemies() {
        setInterval(() => {
            if (this.enemies.length < 8) {
                this.createEnemy();
            }
        }, 3000);
    }
    
    createEnemy() {
        const enemy = {
            mesh: new THREE.Mesh(
                new THREE.BoxGeometry(1, 2, 1),
                new THREE.MeshLambertMaterial({ color: 0xff0000 })
            ),
            health: 75,
            speed: 0.02,
            state: 'patrol',
            target: new THREE.Vector3()
        };
        
        // Random spawn position
        enemy.mesh.position.set(
            (Math.random() - 0.5) * 80,
            1,
            (Math.random() - 0.5) * 80
        );
        
        enemy.mesh.castShadow = true;
        this.scene.add(enemy.mesh);
        this.enemies.push(enemy);
    }
    
    updateEnemies() {
        this.enemies.forEach(enemy => {
            const distToPlayer = enemy.mesh.position.distanceTo(this.camera.position);
            
            if (distToPlayer < 15) {
                // Chase player
                const direction = new THREE.Vector3()
                    .subVectors(this.camera.position, enemy.mesh.position)
                    .normalize()
                    .multiplyScalar(enemy.speed);
                
                enemy.mesh.position.add(direction);
                enemy.mesh.lookAt(this.camera.position);
                
                // Attack if close
                if (distToPlayer < 2) {
                    this.player.health -= 1;
                    this.updateUI();
                    
                    if (this.player.health <= 0) {
                        this.gameOver();
                    }
                }
            }
        });
    }
    
    reload() {
        this.player.ammo = this.player.maxAmmo;
        this.updateUI();
    }
    
    updateUI() {
        document.getElementById('health').textContent = this.player.health;
        document.getElementById('score').textContent = this.player.score;
        document.getElementById('ammo').textContent = `${this.player.ammo}/${this.player.maxAmmo}`;
    }
    
    gameOver() {
        document.getElementById('finalScore').textContent = this.player.score;
        document.getElementById('gameOver').style.display = 'block';
    }
    
    animate() {
        requestAnimationFrame(() => this.animate());
        
        this.updatePlayer();
        this.updateEnemies();
        this.world.step(1/60);
        
        this.renderer.render(this.scene, this.camera);
    }
}

// Start game
new Game();