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
            shield: 100, maxShield: 100, weapon: 0, kills: 0, speed: 0.4
        };
        
        this.weapons = [
            { name: 'Plasma Rifle', damage: 45, fireRate: 80, maxAmmo: 30, reloadTime: 1800, color: 0x444444 },
            { name: 'Ion Cannon', damage: 120, fireRate: 400, maxAmmo: 6, reloadTime: 2500, color: 0x8B4513 },
            { name: 'Pulse SMG', damage: 28, fireRate: 50, maxAmmo: 50, reloadTime: 1200, color: 0x2F4F4F }
        ];
        
        this.wave = { current: 1, enemiesLeft: 0, totalEnemies: 8, waveActive: false, betweenWaves: false };
        this.enemies = [];
        this.enemyLasers = [];
        this.powerups = [];
        this.particles = [];
        this.keys = {};
        this.mouse = { x: 0, y: 0 };
        this.locked = false;
        this.lastShot = 0;
        this.reloading = false;
        this.weaponSway = { x: 0, y: 0 };
        this.walkBob = 0;
        
        this.init();
    }
    
    init() {
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setClearColor(0x0a0a1a);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        document.body.appendChild(this.renderer.domElement);
        
        this.world.gravity.set(0, -25, 0);
        this.world.broadphase = new CANNON.NaiveBroadphase();
        
        this.createEnvironment();
        this.createWeapon();
        this.setupControls();
        this.setupLighting();
        this.startWave();
        this.animate();
    }
    
    createEnvironment() {
        const groundGeometry = new THREE.PlaneGeometry(400, 400, 80, 80);
        const groundMaterial = new THREE.MeshLambertMaterial({ color: 0x1a1a2e });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add(ground);
        
        const gridHelper = new THREE.GridHelper(400, 80, 0x00ffff, 0x003366);
        gridHelper.position.y = 0.01;
        this.scene.add(gridHelper);
        
        const groundShape = new CANNON.Plane();
        const groundBody = new CANNON.Body({ mass: 0 });
        groundBody.addShape(groundShape);
        groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
        this.world.addBody(groundBody);
        
        for (let i = 0; i < 20; i++) {
            const height = 10 + Math.random() * 15;
            const structure = new THREE.Mesh(
                new THREE.BoxGeometry(5, height, 5),
                new THREE.MeshLambertMaterial({ 
                    color: new THREE.Color().setHSL(0.6, 0.8, 0.3 + Math.random() * 0.3)
                })
            );
            structure.position.set(
                (Math.random() - 0.5) * 350,
                height / 2,
                (Math.random() - 0.5) * 350
            );
            structure.castShadow = true;
            this.scene.add(structure);
        }
        
        this.camera.position.set(0, 1.8, 0);
    }
    
    createWeapon() {
        if (this.weaponGroup) this.camera.remove(this.weaponGroup);
        this.weaponGroup = new THREE.Group();
        
        const weapon = this.weapons[this.player.weapon];
        
        const body = new THREE.Mesh(
            new THREE.BoxGeometry(0.15, 0.4, 1.4),
            new THREE.MeshLambertMaterial({ color: weapon.color })
        );
        body.position.set(0.4, -0.4, -0.9);
        
        const barrel = new THREE.Mesh(
            new THREE.CylinderGeometry(0.04, 0.05, 1.0),
            new THREE.MeshLambertMaterial({ color: 0x222222 })
        );
        barrel.rotation.z = Math.PI / 2;
        barrel.position.set(0.4, -0.25, -1.4);
        
        const grip = new THREE.Mesh(
            new THREE.BoxGeometry(0.08, 0.3, 0.15),
            new THREE.MeshLambertMaterial({ color: 0x333333 })
        );
        grip.position.set(0.38, -0.6, -0.6);
        
        this.weaponGroup.add(body, barrel, grip);
        this.camera.add(this.weaponGroup);
    }
    
    setupLighting() {
        const ambientLight = new THREE.AmbientLight(0x404080, 0.5);
        this.scene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
        directionalLight.position.set(100, 100, 50);
        directionalLight.castShadow = true;
        this.scene.add(directionalLight);
        
        const light1 = new THREE.PointLight(0x00ffff, 0.8, 60);
        light1.position.set(30, 15, 30);
        this.scene.add(light1);
        
        const light2 = new THREE.PointLight(0xff0080, 0.8, 60);
        light2.position.set(-30, 15, -30);
        this.scene.add(light2);
    }
    
    setupControls() {
        document.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
            if (e.code === 'KeyQ') this.switchWeapon();
        });
        document.addEventListener('keyup', (e) => this.keys[e.code] = false);
        document.addEventListener('mousemove', (e) => this.onMouseMove(e));
        document.addEventListener('mousedown', (e) => {
            if (e.button === 0) this.shooting = true;
        });
        document.addEventListener('mouseup', (e) => {
            if (e.button === 0) this.shooting = false;
        });
        
        document.addEventListener('click', () => {
            if (!this.locked) document.body.requestPointerLock();
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
        
        this.weaponSway.x += event.movementX * 0.0001;
        this.weaponSway.y += event.movementY * 0.0001;
        
        this.camera.rotation.order = 'YXZ';
        this.camera.rotation.y = -this.mouse.x;
        this.camera.rotation.x = -this.mouse.y;
    }
    
    updatePlayer() {
        const speed = this.keys['ShiftLeft'] ? this.player.speed * 1.5 : this.player.speed;
        const direction = new THREE.Vector3();
        let moving = false;
        
        if (this.keys['KeyW']) { direction.z -= speed; moving = true; }
        if (this.keys['KeyS']) { direction.z += speed; moving = true; }
        if (this.keys['KeyA']) { direction.x -= speed; moving = true; }
        if (this.keys['KeyD']) { direction.x += speed; moving = true; }
        
        direction.applyQuaternion(this.camera.quaternion);
        direction.y = 0;
        this.camera.position.add(direction);
        
        if (moving) this.walkBob += 0.2;
        else this.walkBob *= 0.95;
        
        if (this.keys['KeyR'] && !this.reloading) this.reload();
        if (this.shooting) this.shoot();
        
        this.checkCollisions();
        this.updateWeaponTransform();
        
        if (this.player.shield < this.player.maxShield) {
            this.player.shield = Math.min(this.player.maxShield, this.player.shield + 0.2);
        }
    }
    
    updateWeaponTransform() {
        if (!this.weaponGroup) return;
        
        const bobAmount = Math.sin(this.walkBob) * 0.02;
        this.weaponSway.x *= 0.94;
        this.weaponSway.y *= 0.94;
        
        this.weaponGroup.position.set(
            0.2 + this.weaponSway.x,
            -0.3 + this.weaponSway.y + bobAmount,
            -0.5
        );
        
        this.weaponGroup.rotation.z = this.weaponSway.x * 0.3;
    }
    
    shoot() {
        const weapon = this.weapons[this.player.weapon];
        if (this.player.ammo <= 0 || this.reloading || Date.now() - this.lastShot < weapon.fireRate) return;
        
        this.lastShot = Date.now();
        this.player.ammo--;
        this.updateUI();
        
        this.weaponSway.y -= 0.03;
        this.weaponSway.x += (Math.random() - 0.5) * 0.015;
        
        this.createMuzzleFlash();
        this.screenShake();
        
        const raycaster = new THREE.Raycaster();
        const direction = new THREE.Vector3(0, 0, -1);
        direction.applyQuaternion(this.camera.quaternion);
        raycaster.set(this.camera.position, direction);
        
        this.createBulletTrail(this.camera.position, direction);
        
        const allEnemyMeshes = [];
        this.enemies.forEach(enemy => {
            enemy.mesh.traverse(child => {
                if (child.isMesh) {
                    child.userData.parentEnemy = enemy;
                    allEnemyMeshes.push(child);
                }
            });
        });
        
        const intersects = raycaster.intersectObjects(allEnemyMeshes);
        if (intersects.length > 0) {
            const enemy = intersects[0].object.userData.parentEnemy;
            if (enemy) this.hitEnemy(enemy, weapon.damage, intersects[0].point);
        }
    }
    
    createMuzzleFlash() {
        const flash = new THREE.Mesh(
            new THREE.SphereGeometry(0.4),
            new THREE.MeshBasicMaterial({ color: 0xffff88, transparent: true, opacity: 0.9 })
        );
        
        const flashPos = this.camera.position.clone();
        const forward = new THREE.Vector3(0, 0, -1);
        forward.applyQuaternion(this.camera.quaternion);
        flashPos.add(forward.multiplyScalar(1.8));
        
        flash.position.copy(flashPos);
        this.scene.add(flash);
        setTimeout(() => this.scene.remove(flash), 60);
    }
    
    createBulletTrail(start, direction) {
        const end = start.clone().add(direction.clone().multiplyScalar(200));
        
        const geometry = new THREE.BufferGeometry();
        geometry.setFromPoints([start, end]);
        
        const trail = new THREE.Line(
            geometry,
            new THREE.LineBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.8 })
        );
        
        this.scene.add(trail);
        setTimeout(() => this.scene.remove(trail), 100);
    }
    
    screenShake() {
        const intensity = 0.1;
        this.camera.position.x += (Math.random() - 0.5) * intensity;
        this.camera.position.y += (Math.random() - 0.5) * intensity;
        
        setTimeout(() => {
            this.camera.position.x -= (Math.random() - 0.5) * intensity;
            this.camera.position.y -= (Math.random() - 0.5) * intensity;
        }, 80);
    }
    
    hitEnemy(enemy, damage, hitPoint) {
        enemy.health -= damage;
        
        for (let i = 0; i < 8; i++) {
            const spark = new THREE.Mesh(
                new THREE.SphereGeometry(0.04),
                new THREE.MeshBasicMaterial({ color: 0xffff00 })
            );
            spark.position.copy(hitPoint);
            spark.position.add(new THREE.Vector3(
                (Math.random() - 0.5) * 0.5,
                (Math.random() - 0.5) * 0.5,
                (Math.random() - 0.5) * 0.5
            ));
            this.scene.add(spark);
            this.particles.push({ 
                mesh: spark, 
                life: 400,
                velocity: new THREE.Vector3(
                    (Math.random() - 0.5) * 0.1,
                    Math.random() * 0.05,
                    (Math.random() - 0.5) * 0.1
                )
            });
        }
        
        if (enemy.health <= 0) {
            this.destroyEnemy(enemy);
            this.player.score += 200;
            this.player.kills++;
            this.wave.enemiesLeft--;
            this.updateUI();
            
            if (this.wave.enemiesLeft <= 0 && !this.wave.betweenWaves) {
                this.endWave();
            }
        }
    }
    
    destroyEnemy(enemy) {
        this.scene.remove(enemy.mesh);
        this.enemies = this.enemies.filter(e => e !== enemy);
        
        const pos = enemy.mesh.position;
        
        // Electric explosion
        for (let i = 0; i < 20; i++) {
            const spark = new THREE.Mesh(
                new THREE.SphereGeometry(0.06),
                new THREE.MeshBasicMaterial({ color: 0x00ffff })
            );
            spark.position.copy(pos);
            spark.position.add(new THREE.Vector3(
                (Math.random() - 0.5) * 2.5,
                Math.random() * 2,
                (Math.random() - 0.5) * 2.5
            ));
            this.scene.add(spark);
            this.particles.push({ 
                mesh: spark, 
                life: 800,
                velocity: new THREE.Vector3(
                    (Math.random() - 0.5) * 0.2,
                    Math.random() * 0.15,
                    (Math.random() - 0.5) * 0.2
                )
            });
        }
        
        // Random powerup drop
        if (Math.random() < 0.3) this.createPowerup(pos);
    }
    
    createEnemy() {
        const androidGroup = new THREE.Group();
        
        const torso = new THREE.Mesh(
            new THREE.BoxGeometry(1.0, 1.5, 0.6),
            new THREE.MeshLambertMaterial({ color: 0x666666 })
        );
        torso.position.y = 0.2;
        androidGroup.add(torso);
        
        const head = new THREE.Mesh(
            new THREE.BoxGeometry(0.7, 0.7, 0.7),
            new THREE.MeshLambertMaterial({ color: 0x888888 })
        );
        head.position.y = 1.1;
        androidGroup.add(head);
        
        const eye1 = new THREE.Mesh(
            new THREE.SphereGeometry(0.08),
            new THREE.MeshBasicMaterial({ color: 0xff0000 })
        );
        eye1.position.set(-0.15, 1.15, 0.35);
        androidGroup.add(eye1);
        
        const eye2 = new THREE.Mesh(
            new THREE.SphereGeometry(0.08),
            new THREE.MeshBasicMaterial({ color: 0xff0000 })
        );
        eye2.position.set(0.15, 1.15, 0.35);
        androidGroup.add(eye2);
        
        // Weapon arm
        const weaponArm = new THREE.Mesh(
            new THREE.BoxGeometry(0.3, 1.2, 0.3),
            new THREE.MeshLambertMaterial({ color: 0x555555 })
        );
        weaponArm.position.set(0.7, 0.2, 0);
        androidGroup.add(weaponArm);
        
        const enemy = {
            mesh: androidGroup,
            health: 80 + (this.wave.current * 20),
            maxHealth: 80 + (this.wave.current * 20),
            speed: 0.03 + (this.wave.current * 0.005),
            lastAttack: 0,
            lastShot: 0,
            fireRate: 1500 - (this.wave.current * 100)
        };
        
        enemy.mesh.position.set(
            (Math.random() - 0.5) * 300,
            1.25,
            (Math.random() - 0.5) * 300
        );
        
        enemy.mesh.castShadow = true;
        this.scene.add(enemy.mesh);
        this.enemies.push(enemy);
    }
    
    updateEnemies() {
        this.enemies.forEach(enemy => {
            const distToPlayer = enemy.mesh.position.distanceTo(this.camera.position);
            
            if (distToPlayer < 40) {
                const direction = new THREE.Vector3()
                    .subVectors(this.camera.position, enemy.mesh.position)
                    .normalize()
                    .multiplyScalar(enemy.speed);
                
                enemy.mesh.position.add(direction);
                enemy.mesh.lookAt(this.camera.position);
                
                // Shoot red lasers at player
                if (distToPlayer < 30 && distToPlayer > 3 && Date.now() - enemy.lastShot > enemy.fireRate) {
                    enemy.lastShot = Date.now();
                    this.enemyShoot(enemy);
                }
                
                // Melee attack if close
                if (distToPlayer < 3 && Date.now() - enemy.lastAttack > 800) {
                    enemy.lastAttack = Date.now();
                    this.takeDamage(20 + this.wave.current * 2);
                }
            }
        });
    }
    
    enemyShoot(enemy) {
        const start = enemy.mesh.position.clone();
        start.y += 1;
        const direction = new THREE.Vector3()
            .subVectors(this.camera.position, start)
            .normalize();
        
        // Create red laser
        const laser = {
            start: start.clone(),
            direction: direction.clone(),
            speed: 0.8,
            life: 2000,
            damage: 15 + this.wave.current * 2
        };
        
        const geometry = new THREE.BufferGeometry();
        const end = start.clone().add(direction.multiplyScalar(3));
        geometry.setFromPoints([start, end]);
        
        laser.mesh = new THREE.Line(
            geometry,
            new THREE.LineBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.9 })
        );
        
        this.scene.add(laser.mesh);
        this.enemyLasers.push(laser);
    }
    
    updateEnemyLasers() {
        for (let i = this.enemyLasers.length - 1; i >= 0; i--) {
            const laser = this.enemyLasers[i];
            laser.life -= 16;
            
            // Move laser
            laser.start.add(laser.direction.clone().multiplyScalar(laser.speed));
            const end = laser.start.clone().add(laser.direction.clone().multiplyScalar(3));
            
            laser.mesh.geometry.setFromPoints([laser.start, end]);
            
            // Check collision with player
            const distToPlayer = laser.start.distanceTo(this.camera.position);
            if (distToPlayer < 1.5) {
                this.takeDamage(laser.damage);
                this.scene.remove(laser.mesh);
                this.enemyLasers.splice(i, 1);
                continue;
            }
            
            if (laser.life <= 0) {
                this.scene.remove(laser.mesh);
                this.enemyLasers.splice(i, 1);
            }
        }
    }
    
    startWave() {
        this.wave.waveActive = true;
        this.wave.betweenWaves = false;
        this.wave.enemiesLeft = this.wave.totalEnemies;
        
        for (let i = 0; i < this.wave.totalEnemies; i++) {
            setTimeout(() => this.createEnemy(), i * 500);
        }
        
        this.updateWaveUI();
    }
    
    endWave() {
        this.wave.waveActive = false;
        this.wave.betweenWaves = true;
        this.wave.current++;
        this.wave.totalEnemies = Math.min(20, 8 + this.wave.current * 2);
        
        // Bonus score and health
        this.player.score += this.wave.current * 500;
        this.player.health = Math.min(this.player.maxHealth, this.player.health + 30);
        this.player.shield = this.player.maxShield;
        
        setTimeout(() => this.startWave(), 3000);
        this.updateUI();
        this.updateWaveUI();
    }
    
    createPowerup(position = null) {
        const types = ['health', 'shield', 'ammo'];
        const type = types[Math.floor(Math.random() * types.length)];
        const colors = { health: 0x00ff00, shield: 0x0088ff, ammo: 0xffaa00 };
        
        const powerup = {
            mesh: new THREE.Mesh(
                new THREE.OctahedronGeometry(0.7),
                new THREE.MeshLambertMaterial({ 
                    color: colors[type],
                    transparent: true,
                    opacity: 0.8
                })
            ),
            type: type,
            rotation: 0
        };
        
        if (position) {
            powerup.mesh.position.copy(position);
            powerup.mesh.position.y = 1.5;
        } else {
            powerup.mesh.position.set(
                (Math.random() - 0.5) * 200,
                1.5,
                (Math.random() - 0.5) * 200
            );
        }
        
        this.scene.add(powerup.mesh);
        this.powerups.push(powerup);
    }
    
    checkCollisions() {
        this.powerups.forEach((powerup, index) => {
            if (powerup.mesh.position.distanceTo(this.camera.position) < 3) {
                this.collectPowerup(powerup);
                this.scene.remove(powerup.mesh);
                this.powerups.splice(index, 1);
            }
        });
    }
    
    collectPowerup(powerup) {
        switch (powerup.type) {
            case 'health':
                this.player.health = Math.min(this.player.maxHealth, this.player.health + 50);
                break;
            case 'shield':
                this.player.shield = this.player.maxShield;
                break;
            case 'ammo':
                this.player.ammo = this.player.maxAmmo;
                break;
        }
        this.updateUI();
    }
    
    switchWeapon() {
        this.player.weapon = (this.player.weapon + 1) % this.weapons.length;
        this.player.maxAmmo = this.weapons[this.player.weapon].maxAmmo;
        this.player.ammo = this.player.maxAmmo;
        this.createWeapon();
        this.updateUI();
    }
    
    reload() {
        if (this.reloading || this.player.ammo >= this.player.maxAmmo) return;
        this.reloading = true;
        
        setTimeout(() => {
            this.player.ammo = this.weapons[this.player.weapon].maxAmmo;
            this.reloading = false;
            this.updateUI();
        }, this.weapons[this.player.weapon].reloadTime);
    }
    
    takeDamage(damage) {
        if (this.player.shield > 0) {
            const shieldDamage = Math.min(this.player.shield, damage);
            this.player.shield -= shieldDamage;
            damage -= shieldDamage;
        }
        
        if (damage > 0) this.player.health -= damage;
        
        // Screen flash on damage
        document.body.style.background = 'rgba(255,0,0,0.3)';
        setTimeout(() => document.body.style.background = '#000', 100);
        
        this.updateUI();
        if (this.player.health <= 0) this.gameOver();
    }
    
    updateUI() {
        document.getElementById('health').textContent = Math.floor(this.player.health);
        document.getElementById('shield').textContent = Math.floor(this.player.shield);
        document.getElementById('score').textContent = this.player.score;
        document.getElementById('kills').textContent = this.player.kills;
        document.getElementById('weapon').textContent = this.weapons[this.player.weapon].name;
        
        if (this.reloading) {
            document.getElementById('ammo').textContent = 'RELOADING...';
        } else {
            document.getElementById('ammo').textContent = `${this.player.ammo}/${this.player.maxAmmo}`;
        }
    }
    
    updateWaveUI() {
        document.getElementById('wave').textContent = this.wave.current;
        document.getElementById('enemies').textContent = this.wave.enemiesLeft;
        
        if (this.wave.betweenWaves) {
            document.getElementById('waveStatus').textContent = 'NEXT WAVE INCOMING...';
        } else {
            document.getElementById('waveStatus').textContent = 'ELIMINATE ALL HOSTILES';
        }
    }
    
    gameOver() {
        document.getElementById('finalScore').textContent = this.player.score;
        document.getElementById('finalKills').textContent = this.player.kills;
        document.getElementById('finalWave').textContent = this.wave.current;
        document.getElementById('gameOver').style.display = 'flex';
        document.exitPointerLock();
    }
    
    animate() {
        requestAnimationFrame(() => this.animate());
        
        this.updatePlayer();
        this.updateEnemies();
        this.updateEnemyLasers();
        this.updatePowerups();
        this.updateParticles();
        this.world.step(1/60);
        
        this.renderer.render(this.scene, this.camera);
    }
    
    updatePowerups() {
        this.powerups.forEach(powerup => {
            powerup.rotation += 0.04;
            powerup.mesh.rotation.y = powerup.rotation;
            powerup.mesh.position.y = 1.5 + Math.sin(Date.now() * 0.005 + powerup.rotation) * 0.4;
        });
    }
    
    updateParticles() {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const particle = this.particles[i];
            particle.life -= 16;
            
            if (particle.velocity) {
                particle.mesh.position.add(particle.velocity);
                particle.velocity.y -= 0.004;
                particle.velocity.multiplyScalar(0.97);
            }
            
            if (particle.life <= 0) {
                this.scene.remove(particle.mesh);
                this.particles.splice(i, 1);
            }
        }
    }
}

new Game();