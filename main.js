import * as THREE from 'three';
import * as CANNON from 'cannon-es';

class Game {
    constructor() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.world = new CANNON.World();
        
        this.player = { 
            health: 50, maxHealth: 50, score: 0, ammo: 6, maxAmmo: 6, 
            shield: 25, maxShield: 25, weapon: 0, kills: 0, speed: 0.6
        };
        
        this.weapons = [
            { name: 'Heavy Revolver', damage: 120, fireRate: 600, maxAmmo: 6, reloadTime: 2800, color: 0x333333, recoil: 0.1, shake: 0.2, trailColor: 0xffffff },
            { name: 'Assault Rifle', damage: 55, fireRate: 120, maxAmmo: 30, reloadTime: 2200, color: 0x444444, recoil: 0.04, shake: 0.12, trailColor: 0x00ffff },
            { name: 'Heavy Shotgun', damage: 180, fireRate: 800, maxAmmo: 8, reloadTime: 3500, color: 0x8B4513, recoil: 0.08, shake: 0.25, trailColor: 0xff8800, pellets: 6 },
            { name: 'Plasma SMG', damage: 35, fireRate: 60, maxAmmo: 45, reloadTime: 1500, color: 0x2F4F4F, recoil: 0.02, shake: 0.08, trailColor: 0x88ff00 },
            { name: 'Rail Cannon', damage: 300, fireRate: 1500, maxAmmo: 5, reloadTime: 4000, color: 0x660066, recoil: 0.12, shake: 0.35, trailColor: 0xff00ff }
        ];
        
        this.wave = { current: 1, enemiesLeft: 0, totalEnemies: 15, waveActive: false, betweenWaves: false };
        this.enemies = [];
        this.enemyLasers = [];
        this.powerups = [];
        this.particles = [];
        this.bulletTrails = [];
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
        
        if (weapon.name === 'Heavy Revolver') {
            // Revolver cylinder
            const cylinder = new THREE.Mesh(
                new THREE.CylinderGeometry(0.08, 0.08, 0.3),
                new THREE.MeshLambertMaterial({ color: weapon.color })
            );
            cylinder.rotation.z = Math.PI / 2;
            cylinder.position.set(0.4, -0.3, -0.7);
            
            // Revolver barrel
            const barrel = new THREE.Mesh(
                new THREE.CylinderGeometry(0.03, 0.04, 0.8),
                new THREE.MeshLambertMaterial({ color: 0x222222 })
            );
            barrel.rotation.z = Math.PI / 2;
            barrel.position.set(0.4, -0.25, -1.1);
            
            // Revolver grip
            const grip = new THREE.Mesh(
                new THREE.BoxGeometry(0.06, 0.35, 0.12),
                new THREE.MeshLambertMaterial({ color: 0x2a1810 })
            );
            grip.position.set(0.38, -0.55, -0.5);
            
            // Trigger guard
            const guard = new THREE.Mesh(
                new THREE.TorusGeometry(0.06, 0.01, 8, 16),
                new THREE.MeshLambertMaterial({ color: weapon.color })
            );
            guard.rotation.x = Math.PI / 2;
            guard.position.set(0.38, -0.4, -0.5);
            
            this.weaponGroup.add(cylinder, barrel, grip, guard);
        } else {
            // Standard weapon design
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
        }
        
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
            this.player.shield = Math.min(this.player.maxShield, this.player.shield + 0.05);
        }
    }
    
    updateWeaponTransform() {
        if (!this.weaponGroup) return;
        
        const bobAmount = Math.sin(this.walkBob) * 0.025;
        const swayDamping = 0.88; // Slower recovery for weightier feel
        
        this.weaponSway.x *= swayDamping;
        this.weaponSway.y *= swayDamping;
        
        this.weaponGroup.position.set(
            0.2 + this.weaponSway.x,
            -0.3 + this.weaponSway.y + bobAmount,
            -0.5
        );
        
        // More pronounced weapon rotation
        this.weaponGroup.rotation.z = this.weaponSway.x * 0.5;
        this.weaponGroup.rotation.x = this.weaponSway.y * 0.3;
    }
    
    shoot() {
        const weapon = this.weapons[this.player.weapon];
        if (this.player.ammo <= 0 || this.reloading || Date.now() - this.lastShot < weapon.fireRate) return;
        
        this.lastShot = Date.now();
        this.player.ammo--;
        this.updateUI();
        
        // Heavy weapon recoil
        this.weaponSway.y -= weapon.recoil;
        this.weaponSway.x += (Math.random() - 0.5) * weapon.recoil * 0.5;
        
        // Weapon-specific screen shake
        this.screenShake(weapon.shake);
        
        // Multiple pellets for shotgun
        const pellets = weapon.pellets || 1;
        for (let i = 0; i < pellets; i++) {
            const raycaster = new THREE.Raycaster();
            const direction = new THREE.Vector3(0, 0, -1);
            
            // Add spread for shotgun
            if (pellets > 1) {
                direction.x += (Math.random() - 0.5) * 0.2;
                direction.y += (Math.random() - 0.5) * 0.2;
                direction.normalize();
            }
            
            direction.applyQuaternion(this.camera.quaternion);
            raycaster.set(this.camera.position, direction);
            
            this.createBulletTrail(this.camera.position, direction, weapon.trailColor);
            
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
                const hitMesh = intersects[0].object;
                const enemy = hitMesh.userData.parentEnemy;
                if (enemy) {
                    const isHeadshot = hitMesh.name === 'head';
                    const finalDamage = isHeadshot ? weapon.damage * 2.5 : weapon.damage;
                    this.hitEnemy(enemy, finalDamage, intersects[0].point, hitMesh.name, isHeadshot);
                }
            }
        }
    }
    

    
    createBulletTrail(start, direction, color = 0x00ffff) {
        const end = start.clone().add(direction.clone().multiplyScalar(200));
        
        const geometry = new THREE.BufferGeometry();
        geometry.setFromPoints([start, end]);
        
        const trail = {
            mesh: new THREE.Line(
                geometry,
                new THREE.LineBasicMaterial({ 
                    color: color, 
                    transparent: true, 
                    opacity: 0.9,
                    linewidth: 3
                })
            ),
            life: 3000,
            maxLife: 3000
        };
        
        this.scene.add(trail.mesh);
        this.bulletTrails.push(trail);
    }
    
    screenShake(intensity = 0.1) {
        const shakeX = (Math.random() - 0.5) * intensity;
        const shakeY = (Math.random() - 0.5) * intensity;
        
        this.camera.position.x += shakeX;
        this.camera.position.y += shakeY;
        
        // Camera rotation shake
        this.camera.rotation.z += (Math.random() - 0.5) * intensity * 0.1;
        
        setTimeout(() => {
            this.camera.position.x -= shakeX;
            this.camera.position.y -= shakeY;
            this.camera.rotation.z = 0;
        }, 120);
    }
    
    hitEnemy(enemy, damage, hitPoint, bodyPart = 'torso', isHeadshot = false) {
        enemy.health -= damage;
        
        // Dismember body part if enough damage
        if (bodyPart !== 'torso' && enemy.parts[bodyPart] && damage > 50) {
            this.dismemberPart(enemy, bodyPart, hitPoint);
        }
        
        // Headshot effects
        if (isHeadshot) {
            this.createHeadshotEffect(hitPoint);
            this.player.score += 100; // Bonus points
        }
        
        if (enemy.health <= 0) {
            if (isHeadshot) {
                this.headshotKillAnimation(enemy);
            } else {
                this.destroyEnemy(enemy);
            }
            
            this.player.score += isHeadshot ? 400 : 200;
            this.player.kills++;
            this.wave.enemiesLeft--;
            
            // Rare drops
            if (Math.random() < 0.2) this.createAmmoDrop(enemy.mesh.position);
            if (Math.random() < 0.1) this.createPowerup(enemy.mesh.position);
            
            this.updateUI();
            
            if (this.wave.enemiesLeft <= 0 && !this.wave.betweenWaves) {
                this.endWave();
            }
        }
    }
    
    dismemberPart(enemy, bodyPart, hitPoint) {
        if (!enemy.parts[bodyPart]) return;
        
        enemy.parts[bodyPart] = false;
        const part = enemy.mesh.getObjectByName(bodyPart);
        
        if (part) {
            // Create flying dismembered part
            const dismemberedPart = part.clone();
            dismemberedPart.position.copy(part.getWorldPosition(new THREE.Vector3()));
            this.scene.add(dismemberedPart);
            
            // Remove from enemy
            enemy.mesh.remove(part);
            
            // Add physics to dismembered part
            this.particles.push({
                mesh: dismemberedPart,
                life: 3000,
                velocity: new THREE.Vector3(
                    (Math.random() - 0.5) * 0.3,
                    Math.random() * 0.2,
                    (Math.random() - 0.5) * 0.3
                )
            });
            
            // Oil spray from dismemberment
            for (let i = 0; i < 8; i++) {
                const oil = new THREE.Mesh(
                    new THREE.SphereGeometry(0.03),
                    new THREE.MeshBasicMaterial({ color: 0x1a1a1a })
                );
                oil.position.copy(hitPoint);
                this.scene.add(oil);
                this.particles.push({
                    mesh: oil,
                    life: 1500,
                    velocity: new THREE.Vector3(
                        (Math.random() - 0.5) * 0.2,
                        Math.random() * 0.1,
                        (Math.random() - 0.5) * 0.2
                    ),
                    createStain: true
                });
            }
        }
    }
    
    createHeadshotEffect(hitPoint) {
        // Critical hit sparks
        for (let i = 0; i < 12; i++) {
            const spark = new THREE.Mesh(
                new THREE.SphereGeometry(0.06),
                new THREE.MeshBasicMaterial({ color: 0xffff00 })
            );
            spark.position.copy(hitPoint);
            spark.position.add(new THREE.Vector3(
                (Math.random() - 0.5) * 0.8,
                (Math.random() - 0.5) * 0.8,
                (Math.random() - 0.5) * 0.8
            ));
            this.scene.add(spark);
            this.particles.push({
                mesh: spark,
                life: 800,
                velocity: new THREE.Vector3(
                    (Math.random() - 0.5) * 0.25,
                    Math.random() * 0.15,
                    (Math.random() - 0.5) * 0.25
                )
            });
        }
        
        // Screen flash for critical hit
        document.body.style.background = 'rgba(255,255,0,0.2)';
        setTimeout(() => document.body.style.background = '#000', 80);
    }
    
    headshotKillAnimation(enemy) {
        const enemyPos = enemy.mesh.position.clone();
        
        // Slow motion effect
        const originalTimeScale = 1;
        const slowMotionScale = 0.3;
        
        // Dramatic camera shake
        this.screenShake(0.4);
        
        // Massive explosion of sparks and debris
        for (let i = 0; i < 25; i++) {
            const spark = new THREE.Mesh(
                new THREE.SphereGeometry(0.08),
                new THREE.MeshBasicMaterial({ color: 0xffaa00 })
            );
            spark.position.copy(enemyPos);
            spark.position.y += 1.1; // Head level
            spark.position.add(new THREE.Vector3(
                (Math.random() - 0.5) * 1.5,
                (Math.random() - 0.5) * 1.5,
                (Math.random() - 0.5) * 1.5
            ));
            this.scene.add(spark);
            this.particles.push({
                mesh: spark,
                life: 1200,
                velocity: new THREE.Vector3(
                    (Math.random() - 0.5) * 0.4,
                    Math.random() * 0.3,
                    (Math.random() - 0.5) * 0.4
                )
            });
        }
        
        // Head explosion with oil spray
        for (let i = 0; i < 15; i++) {
            const oil = new THREE.Mesh(
                new THREE.SphereGeometry(0.05),
                new THREE.MeshBasicMaterial({ color: 0x1a1a1a })
            );
            oil.position.copy(enemyPos);
            oil.position.y += 1.1;
            this.scene.add(oil);
            this.particles.push({
                mesh: oil,
                life: 2000,
                velocity: new THREE.Vector3(
                    (Math.random() - 0.5) * 0.3,
                    Math.random() * 0.2,
                    (Math.random() - 0.5) * 0.3
                ),
                createStain: true
            });
        }
        
        // Body collapse animation
        const collapseAnimation = () => {
            let frame = 0;
            const maxFrames = 30;
            
            const animate = () => {
                if (frame < maxFrames && enemy.mesh.parent) {
                    // Gradual fall backward
                    enemy.mesh.rotation.x -= 0.05;
                    enemy.mesh.position.y -= 0.02;
                    
                    frame++;
                    setTimeout(animate, 33); // ~30fps for dramatic effect
                } else {
                    // Final destruction
                    this.destroyEnemy(enemy);
                }
            };
            animate();
        };
        
        // Enhanced screen effects
        document.body.style.background = 'rgba(255,255,255,0.4)';
        setTimeout(() => {
            document.body.style.background = 'rgba(255,255,0,0.3)';
            setTimeout(() => {
                document.body.style.background = '#000';
            }, 150);
        }, 100);
        
        // Start collapse animation after brief pause
        setTimeout(collapseAnimation, 200);
    }
    
    destroyEnemy(enemy) {
        this.scene.remove(enemy.mesh);
        this.enemies = this.enemies.filter(e => e !== enemy);
        
        const pos = enemy.mesh.position;
        
        // Electric explosion
        for (let i = 0; i < 15; i++) {
            const spark = new THREE.Mesh(
                new THREE.SphereGeometry(0.05),
                new THREE.MeshBasicMaterial({ color: 0x00ffff })
            );
            spark.position.copy(pos);
            spark.position.add(new THREE.Vector3(
                (Math.random() - 0.5) * 2,
                Math.random() * 1.5,
                (Math.random() - 0.5) * 2
            ));
            this.scene.add(spark);
            this.particles.push({ 
                mesh: spark, 
                life: 600,
                velocity: new THREE.Vector3(
                    (Math.random() - 0.5) * 0.15,
                    Math.random() * 0.1,
                    (Math.random() - 0.5) * 0.15
                )
            });
        }
    }
    
    createEnemy() {
        const androidGroup = new THREE.Group();
        
        const torso = new THREE.Mesh(
            new THREE.BoxGeometry(1.0, 1.5, 0.6),
            new THREE.MeshLambertMaterial({ color: 0x666666 })
        );
        torso.position.y = 0.2;
        torso.name = 'torso';
        androidGroup.add(torso);
        
        const head = new THREE.Mesh(
            new THREE.BoxGeometry(0.7, 0.7, 0.7),
            new THREE.MeshLambertMaterial({ color: 0x888888 })
        );
        head.position.y = 1.1;
        head.name = 'head';
        androidGroup.add(head);
        
        const leftArm = new THREE.Mesh(
            new THREE.BoxGeometry(0.3, 1.2, 0.3),
            new THREE.MeshLambertMaterial({ color: 0x555555 })
        );
        leftArm.position.set(-0.7, 0.2, 0);
        leftArm.name = 'leftArm';
        androidGroup.add(leftArm);
        
        const rightArm = new THREE.Mesh(
            new THREE.BoxGeometry(0.3, 1.2, 0.3),
            new THREE.MeshLambertMaterial({ color: 0x555555 })
        );
        rightArm.position.set(0.7, 0.2, 0);
        rightArm.name = 'rightArm';
        androidGroup.add(rightArm);
        
        const leftLeg = new THREE.Mesh(
            new THREE.BoxGeometry(0.4, 1.3, 0.4),
            new THREE.MeshLambertMaterial({ color: 0x444444 })
        );
        leftLeg.position.set(-0.3, -1.0, 0);
        leftLeg.name = 'leftLeg';
        androidGroup.add(leftLeg);
        
        const rightLeg = new THREE.Mesh(
            new THREE.BoxGeometry(0.4, 1.3, 0.4),
            new THREE.MeshLambertMaterial({ color: 0x444444 })
        );
        rightLeg.position.set(0.3, -1.0, 0);
        rightLeg.name = 'rightLeg';
        androidGroup.add(rightLeg);
        
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
        
        const enemy = {
            mesh: androidGroup,
            health: 120 + (this.wave.current * 40),
            maxHealth: 120 + (this.wave.current * 40),
            speed: 0.06 + (this.wave.current * 0.015),
            lastAttack: 0,
            lastShot: 0,
            fireRate: 800 - (this.wave.current * 50),
            parts: { head: true, leftArm: true, rightArm: true, leftLeg: true, rightLeg: true }
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
                if (distToPlayer < 3 && Date.now() - enemy.lastAttack > 400) {
                    enemy.lastAttack = Date.now();
                    this.takeDamage(35 + this.wave.current * 5);
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
            damage: 25 + this.wave.current * 4
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
            setTimeout(() => this.createEnemy(), i * 200);
        }
        
        this.updateWaveUI();
    }
    
    endWave() {
        this.wave.waveActive = false;
        this.wave.betweenWaves = true;
        this.wave.current++;
        this.wave.totalEnemies = Math.min(40, 15 + this.wave.current * 4);
        
        // Minimal wave bonus
        this.player.score += this.wave.current * 200;
        this.player.health = Math.min(this.player.maxHealth, this.player.health + 10);
        this.player.shield = Math.min(this.player.maxShield, this.player.shield + 15);
        
        setTimeout(() => this.startWave(), 1500);
        this.updateUI();
        this.updateWaveUI();
    }
    
    createPowerup(position = null) {
        const types = ['health', 'shield'];
        const type = types[Math.floor(Math.random() * types.length)];
        const colors = { health: 0x00ff00, shield: 0x0088ff };
        
        const powerup = {
            mesh: new THREE.Mesh(
                new THREE.OctahedronGeometry(0.6),
                new THREE.MeshLambertMaterial({ 
                    color: colors[type],
                    transparent: true,
                    opacity: 0.9
                })
            ),
            type: type,
            rotation: 0
        };
        
        if (position) {
            powerup.mesh.position.copy(position);
            powerup.mesh.position.y = 1.2;
        } else {
            powerup.mesh.position.set(
                (Math.random() - 0.5) * 200,
                1.2,
                (Math.random() - 0.5) * 200
            );
        }
        
        this.scene.add(powerup.mesh);
        this.powerups.push(powerup);
    }
    
    createAmmoDrop(position) {
        const ammoDrop = {
            mesh: new THREE.Mesh(
                new THREE.BoxGeometry(0.5, 0.3, 0.5),
                new THREE.MeshLambertMaterial({ 
                    color: 0xffaa00,
                    transparent: true,
                    opacity: 0.9
                })
            ),
            type: 'ammo',
            rotation: 0
        };
        
        ammoDrop.mesh.position.copy(position);
        ammoDrop.mesh.position.y = 1.0;
        this.scene.add(ammoDrop.mesh);
        this.powerups.push(ammoDrop);
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
                this.player.health = Math.min(this.player.maxHealth, this.player.health + 15);
                break;
            case 'shield':
                this.player.shield = Math.min(this.player.maxShield, this.player.shield + 10);
                break;
            case 'ammo':
                this.player.ammo = Math.min(this.player.maxAmmo, this.player.ammo + Math.floor(this.player.maxAmmo * 0.3));
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
        this.updateBulletTrails();
        this.world.step(1/60);
        
        this.renderer.render(this.scene, this.camera);
    }
    
    updatePowerups() {
        this.powerups.forEach(powerup => {
            powerup.rotation += 0.03;
            powerup.mesh.rotation.y = powerup.rotation;
            
            if (powerup.type === 'ammo') {
                powerup.mesh.position.y = 1.0 + Math.sin(Date.now() * 0.004 + powerup.rotation) * 0.2;
                powerup.mesh.rotation.x = powerup.rotation * 0.5;
            } else {
                powerup.mesh.position.y = 1.2 + Math.sin(Date.now() * 0.005 + powerup.rotation) * 0.3;
            }
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
                
                // Create oil stain when particle hits ground
                if (particle.createStain && particle.mesh.position.y <= 0.1 && !particle.stainCreated) {
                    this.createOilStain(particle.mesh.position);
                    particle.stainCreated = true;
                }
            }
            
            if (particle.life <= 0) {
                this.scene.remove(particle.mesh);
                this.particles.splice(i, 1);
            }
        }
    }
    
    createOilStain(position) {
        const stainSize = 0.5 + Math.random() * 0.8;
        const oilStain = new THREE.Mesh(
            new THREE.CircleGeometry(stainSize),
            new THREE.MeshBasicMaterial({ 
                color: 0x0a0a0a,
                transparent: true,
                opacity: 0.8
            })
        );
        oilStain.rotation.x = -Math.PI / 2;
        oilStain.position.copy(position);
        oilStain.position.y = 0.02;
        this.scene.add(oilStain);
        
        // Add to particles for cleanup (long-lasting stain)
        this.particles.push({ mesh: oilStain, life: 30000, velocity: null });
    }
    
    updateBulletTrails() {
        for (let i = this.bulletTrails.length - 1; i >= 0; i--) {
            const trail = this.bulletTrails[i];
            trail.life -= 16;
            
            // Fade out over time
            const fadeRatio = trail.life / trail.maxLife;
            trail.mesh.material.opacity = fadeRatio * 0.9;
            
            if (trail.life <= 0) {
                this.scene.remove(trail.mesh);
                this.bulletTrails.splice(i, 1);
            }
        }
    }
}

new Game();