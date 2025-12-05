import * as THREE from 'three';
import * as CANNON from 'cannon-es';

class Game {
    constructor() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.world = new CANNON.World();
        
        this.player = { 
            health: 100, maxHealth: 100, score: 0, ammo: 30, maxAmmo: 30, 
            shield: 50, maxShield: 50, weapon: 0 
        };
        this.weapons = [
            { name: 'Rifle', damage: 25, fireRate: 150, maxAmmo: 30, reloadTime: 2000 },
            { name: 'Shotgun', damage: 60, fireRate: 800, maxAmmo: 8, reloadTime: 3000 },
            { name: 'SMG', damage: 15, fireRate: 80, maxAmmo: 50, reloadTime: 1500 }
        ];
        this.powerups = [];
        this.lastShot = 0;
        this.reloading = false;
        this.enemies = [];
        this.keys = {};
        this.gun = null;
        this.mouse = { x: 0, y: 0 };
        this.locked = false;
        
        this.init();
    }
    
    init() {
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setClearColor(0x001122);
        this.renderer.shadowMap.enabled = true;
        document.body.appendChild(this.renderer.domElement);
        
        this.world.gravity.set(0, -20, 0);
        this.world.broadphase = new CANNON.NaiveBroadphase();
        
        this.createEnvironment();
        this.createGun();
        this.setupControls();
        this.setupLighting();
        this.spawnPowerups();
        
        this.animate();
        this.spawnEnemies();
    }
    
    createEnvironment() {
        const groundGeometry = new THREE.PlaneGeometry(200, 200);
        const groundMaterial = new THREE.MeshLambertMaterial({ color: 0x333333 });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add(ground);
        
        const groundShape = new CANNON.Plane();
        const groundBody = new CANNON.Body({ mass: 0 });
        groundBody.addShape(groundShape);
        groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
        this.world.addBody(groundBody);
        
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
        
        this.camera.position.set(0, 2, 0);
    }
    
    createGun() {
        const gunGroup = new THREE.Group();
        
        const barrel = new THREE.Mesh(
            new THREE.CylinderGeometry(0.05, 0.08, 1.5),
            new THREE.MeshLambertMaterial({ color: 0x333333 })
        );
        barrel.rotation.z = Math.PI / 2;
        barrel.position.set(0.3, -0.3, -0.8);
        
        const body = new THREE.Mesh(
            new THREE.BoxGeometry(0.3, 0.2, 0.8),
            new THREE.MeshLambertMaterial({ color: 0x444444 })
        );
        body.position.set(0.2, -0.4, -0.4);
        
        gunGroup.add(barrel, body);
        this.camera.add(gunGroup);
        this.gun = gunGroup;
    }
    
    spawnPowerups() {
        setInterval(() => {
            if (this.powerups.length < 5) {
                this.createPowerup();
            }
        }, 8000);
    }
    
    createPowerup() {
        const types = ['health', 'shield', 'ammo', 'weapon'];
        const type = types[Math.floor(Math.random() * types.length)];
        const colors = { health: 0x00ff00, shield: 0x0088ff, ammo: 0xffaa00, weapon: 0xff0088 };
        
        const powerup = {
            mesh: new THREE.Mesh(
                new THREE.OctahedronGeometry(0.5),
                new THREE.MeshLambertMaterial({ color: colors[type] })
            ),
            type: type,
            rotation: 0
        };
        
        powerup.mesh.position.set(
            (Math.random() - 0.5) * 60,
            1,
            (Math.random() - 0.5) * 60
        );
        
        this.scene.add(powerup.mesh);
        this.powerups.push(powerup);
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
        document.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
            if (e.code === 'KeyQ') this.switchWeapon();
        });
        document.addEventListener('keyup', (e) => this.keys[e.code] = false);
        document.addEventListener('mousemove', (e) => this.onMouseMove(e));
        document.addEventListener('click', () => this.shoot());
        
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
        
        if (this.keys['KeyR'] && this.player.ammo < this.player.maxAmmo && !this.reloading) {
            this.reload();
        }
        
        this.checkPowerupCollision();
        
        if (this.player.shield < this.player.maxShield) {
            this.player.shield = Math.min(this.player.maxShield, this.player.shield + 0.1);
        }
    }
    
    shoot() {
        const weapon = this.weapons[this.player.weapon];
        if (this.player.ammo <= 0 || this.reloading || Date.now() - this.lastShot < weapon.fireRate) return;
        
        this.lastShot = Date.now();
        this.player.ammo--;
        this.updateUI();
        
        if (this.gun) {
            this.gun.position.z += 0.1;
            setTimeout(() => this.gun.position.z -= 0.1, 50);
        }
        
        this.createMuzzleFlash();
        
        const raycaster = new THREE.Raycaster();
        const pellets = weapon.name === 'Shotgun' ? 5 : 1;
        
        for (let i = 0; i < pellets; i++) {
            const spread = weapon.name === 'Shotgun' ? 0.1 : 0;
            const direction = new THREE.Vector3(
                (Math.random() - 0.5) * spread,
                (Math.random() - 0.5) * spread,
                -1
            ).normalize();
            
            raycaster.set(this.camera.position, direction.applyQuaternion(this.camera.quaternion));
            const intersects = raycaster.intersectObjects(this.enemies.map(e => e.mesh));
            
            if (intersects.length > 0) {
                const enemy = this.enemies.find(e => e.mesh === intersects[0].object);
                if (enemy) {
                    this.hitEnemy(enemy, weapon.damage);
                }
            }
        }
        
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
    
    hitEnemy(enemy, damage) {
        enemy.health -= damage;
        
        if (Math.random() < 0.3) {
            this.createAmmoDrop(enemy.mesh.position);
        }
        
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
                const direction = new THREE.Vector3()
                    .subVectors(this.camera.position, enemy.mesh.position)
                    .normalize()
                    .multiplyScalar(enemy.speed);
                
                enemy.mesh.position.add(direction);
                enemy.mesh.lookAt(this.camera.position);
                
                if (distToPlayer < 2) {
                    this.takeDamage(1);
                }
            }
        });
    }
    
    reload() {
        if (this.reloading) return;
        this.reloading = true;
        
        setTimeout(() => {
            this.player.ammo = this.weapons[this.player.weapon].maxAmmo;
            this.player.maxAmmo = this.weapons[this.player.weapon].maxAmmo;
            this.reloading = false;
            this.updateUI();
        }, this.weapons[this.player.weapon].reloadTime);
    }
    
    switchWeapon() {
        this.player.weapon = (this.player.weapon + 1) % this.weapons.length;
        this.player.maxAmmo = this.weapons[this.player.weapon].maxAmmo;
        this.player.ammo = Math.min(this.player.ammo, this.player.maxAmmo);
        this.updateUI();
    }
    
    createAmmoDrop(position) {
        const ammoDrop = {
            mesh: new THREE.Mesh(
                new THREE.BoxGeometry(0.3, 0.3, 0.3),
                new THREE.MeshLambertMaterial({ color: 0xffaa00 })
            ),
            type: 'ammo'
        };
        
        ammoDrop.mesh.position.copy(position);
        ammoDrop.mesh.position.y = 0.5;
        this.scene.add(ammoDrop.mesh);
        this.powerups.push(ammoDrop);
    }
    
    checkPowerupCollision() {
        this.powerups.forEach((powerup, index) => {
            if (powerup.mesh.position.distanceTo(this.camera.position) < 2) {
                this.collectPowerup(powerup);
                this.scene.remove(powerup.mesh);
                this.powerups.splice(index, 1);
            }
            
            powerup.rotation += 0.02;
            powerup.mesh.rotation.y = powerup.rotation;
        });
    }
    
    collectPowerup(powerup) {
        switch (powerup.type) {
            case 'health':
                this.player.health = Math.min(this.player.maxHealth, this.player.health + 30);
                break;
            case 'shield':
                this.player.shield = this.player.maxShield;
                break;
            case 'ammo':
                this.player.ammo = Math.min(this.player.maxAmmo, this.player.ammo + 15);
                break;
            case 'weapon':
                this.switchWeapon();
                break;
        }
        this.updateUI();
    }
    
    takeDamage(damage) {
        if (this.player.shield > 0) {
            const shieldDamage = Math.min(this.player.shield, damage);
            this.player.shield -= shieldDamage;
            damage -= shieldDamage;
        }
        
        if (damage > 0) {
            this.player.health -= damage;
        }
        
        this.updateUI();
        
        if (this.player.health <= 0) {
            this.gameOver();
        }
    }
    
    updateUI() {
        document.getElementById('health').textContent = Math.floor(this.player.health);
        document.getElementById('score').textContent = this.player.score;
        
        if (this.reloading) {
            document.getElementById('ammo').textContent = 'RELOADING...';
        } else {
            document.getElementById('ammo').textContent = `${this.player.ammo}/${this.player.maxAmmo}`;
        }
        
        document.getElementById('shield').textContent = Math.floor(this.player.shield);
        document.getElementById('weapon').textContent = this.weapons[this.player.weapon].name;
    }
    
    gameOver() {
        document.getElementById('finalScore').textContent = this.player.score;
        document.getElementById('gameOver').style.display = 'block';
    }
    
    animate() {
        requestAnimationFrame(() => this.animate());
        
        this.updatePlayer();
        this.updateEnemies();
        this.updatePowerups();
        this.world.step(1/60);
        
        this.renderer.render(this.scene, this.camera);
    }
    
    updatePowerups() {
        this.powerups.forEach(powerup => {
            powerup.rotation += 0.02;
            powerup.mesh.rotation.y = powerup.rotation;
            powerup.mesh.position.y = 1 + Math.sin(Date.now() * 0.003 + powerup.rotation) * 0.2;
        });
    }
}

new Game();