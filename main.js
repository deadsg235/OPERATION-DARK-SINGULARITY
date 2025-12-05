import * as THREE from 'three';
import * as CANNON from 'cannon-es';

class Game {
    constructor() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.world = new CANNON.World();
        
        // Audio setup
        this.listener = new THREE.AudioListener();
        this.camera.add(this.listener);
        this.sound = new THREE.Audio(this.listener);

        this.player = { 
            health: 100, maxHealth: 100, score: 0, ammo: 6, maxAmmo: 6, 
            shield: 100, maxShield: 100, weapon: 0, kills: 0
        };
        
        this.weapons = [
            { name: 'Heavy Revolver', damage: 75, fireRate: 450, maxAmmo: 6, reloadTime: 3000, color: 0x3d3d3d },
            { name: 'Assault Rifle', damage: 35, fireRate: 120, maxAmmo: 30, reloadTime: 2500, color: 0x444444 },
            { name: 'Combat Shotgun', damage: 80, fireRate: 600, maxAmmo: 8, reloadTime: 3200, color: 0x8B4513 },
            { name: 'SMG', damage: 22, fireRate: 60, maxAmmo: 40, reloadTime: 1800, color: 0x2F4F4F }
        ];
        
        this.enemies = [];
        this.powerups = [];
        this.bullets = [];
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
        this.spawnLoop();
        this.animate();
    }
    
    createEnvironment() {
        // Futuristic ground with grid pattern
        const groundGeometry = new THREE.PlaneGeometry(300, 300, 50, 50);
        const groundMaterial = new THREE.MeshLambertMaterial({ 
            color: 0x1a1a2e,
            wireframe: false
        });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add(ground);
        
        // Grid overlay
        const gridHelper = new THREE.GridHelper(300, 60, 0x00ffff, 0x003366);
        gridHelper.position.y = 0.01;
        this.scene.add(gridHelper);
        
        // Physics ground
        const groundShape = new CANNON.Plane();
        const groundBody = new CANNON.Body({ mass: 0 });
        groundBody.addShape(groundShape);
        groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
        this.world.addBody(groundBody);
        
        // Futuristic structures
        for (let i = 0; i < 15; i++) {
            const height = 8 + Math.random() * 12;
            const structure = new THREE.Mesh(
                new THREE.BoxGeometry(4, height, 4),
                new THREE.MeshLambertMaterial({ 
                    color: new THREE.Color().setHSL(0.6, 0.8, 0.3 + Math.random() * 0.3)
                })
            );
            structure.position.set(
                (Math.random() - 0.5) * 250,
                height / 2,
                (Math.random() - 0.5) * 250
            );
            structure.castShadow = true;
            structure.receiveShadow = true;
            this.scene.add(structure);
        }
        
        this.camera.position.set(0, 1.8, 0);
    }

    createWeapon() {
        this.weaponGroup = new THREE.Group();
        const weapon = this.weapons[this.player.weapon];

        if (weapon.name === 'Heavy Revolver') {
            this.createRevolver();
            return;
        }

        //
        // === Receiver (main body) ===
        //
        const receiver = new THREE.Mesh(
            new THREE.BoxGeometry(0.18, 0.22, 0.75),
            new THREE.MeshStandardMaterial({ color: weapon.color, roughness: 0.5, metalness: 0.3 })
        );
        receiver.position.set(0.32, -0.29, -0.75);
        this.weaponGroup.add(receiver);

        //
        // === Barrel ===
        //
        const barrelOuter = new THREE.Mesh(
            new THREE.CylinderGeometry(0.05, 0.05, 0.9, 16),
            new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.8 })
        );
        barrelOuter.rotation.z = Math.PI / 2;
        barrelOuter.position.set(0.32, -0.24, -1.2);
        this.weaponGroup.add(barrelOuter);

        //
        // === Handguard with grooves ===
        //
        const handguard = new THREE.Mesh(
            new THREE.BoxGeometry(0.16, 0.18, 0.45),
            new THREE.MeshStandardMaterial({ color: 0x1b1b1b, roughness: 0.8 })
        );
        handguard.position.set(0.32, -0.33, -1.0);
        this.weaponGroup.add(handguard);

        //
        // === Rail / Sight ===
        //
        const rail = new THREE.Mesh(
            new THREE.BoxGeometry(0.12, 0.05, 0.28),
            new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.4, metalness: 0.7 })
        );
        rail.position.set(0.32, -0.17, -0.50);
        this.weaponGroup.add(rail);

        const frontSight = new THREE.Mesh(
            new THREE.BoxGeometry(0.05, 0.06, 0.08),
            new THREE.MeshStandardMaterial({ color: 0x222222 })
        );
        frontSight.position.set(0.32, -0.17, -1.05);
        this.weaponGroup.add(frontSight);

        //
        // === Grip (angled foregrip style) ===
        //
        const grip = new THREE.Mesh(
            new THREE.BoxGeometry(0.10, 0.25, 0.18),
            new THREE.MeshStandardMaterial({ color: 0x333333 })
        );
        grip.position.set(0.35, -0.55, -0.55);
        grip.rotation.x = Math.PI / 6;
        this.weaponGroup.add(grip);

        //
        // === Magazine ===
        //
        const mag = new THREE.Mesh(
            new THREE.BoxGeometry(0.12, 0.35, 0.22),
            new THREE.MeshStandardMaterial({ color: 0x222222 })
        );
        mag.position.set(0.33, -0.52, -0.85);
        this.weaponGroup.add(mag);

        //
        // === Ejection port ===
        //
        const port = new THREE.Mesh(
            new THREE.BoxGeometry(0.04, 0.08, 0.14),
            new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.2 })
        );
        port.position.set(0.40, -0.30, -0.55);
        this.weaponGroup.add(port);

        //
        // === Saved original positions for recoil/animation ===
        //
        this.weaponRestPos = this.weaponGroup.position.clone();
        this.weaponRestRot = this.weaponGroup.rotation.clone();

        this.camera.add(this.weaponGroup);
    }

    createRevolver() {
        const weapon = this.weapons[this.player.weapon];
        const darkMetal = new THREE.MeshStandardMaterial({ color: weapon.color, roughness: 0.4, metalness: 0.8 });
        const gripMaterial = new THREE.MeshStandardMaterial({ color: 0x4a2a0a, roughness: 0.8 });

        // Main frame
        const frame = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.15, 0.2), darkMetal);
        frame.position.set(0, 0, 0);
        this.weaponGroup.add(frame);

        // Barrel
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.4, 16), darkMetal);
        barrel.rotation.z = Math.PI / 2;
        barrel.position.set(0, 0.05, -0.25);
        this.weaponGroup.add(barrel);

        // Cylinder
        this.revolverCylinder = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.18, 6), darkMetal);
        this.revolverCylinder.rotation.x = Math.PI / 2;
        this.revolverCylinder.position.set(0, 0, 0);
        this.weaponGroup.add(this.revolverCylinder);

        // Grip
        const grip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.3, 0.1), gripMaterial);
        grip.position.set(0, -0.15, 0.05);
        grip.rotation.z = -0.2;
        this.weaponGroup.add(grip);
        
        // Hammer
        const hammer = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.05, 0.08), darkMetal);
        hammer.position.set(0, 0.1, 0.1);
        this.weaponGroup.add(hammer);

        this.camera.add(this.weaponGroup);
    }
    
    setupLighting() {
        // Ambient lighting
        const ambientLight = new THREE.AmbientLight(0x404080, 0.4);
        this.scene.add(ambientLight);
        
        // Main directional light
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
        directionalLight.position.set(100, 100, 50);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        this.scene.add(directionalLight);
        
        // Colored accent lights
        const light1 = new THREE.PointLight(0x00ffff, 0.5, 50);
        light1.position.set(20, 10, 20);
        this.scene.add(light1);
        
        const light2 = new THREE.PointLight(0xff0080, 0.5, 50);
        light2.position.set(-20, 10, -20);
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
            if (e.button === 0) this.startShooting();
        });
        document.addEventListener('mouseup', (e) => {
            if (e.button === 0) this.stopShooting();
        });
        
        document.addEventListener('click', () => {
            if (!this.locked) document.body.requestPointerLock();
        });
        
        document.addEventListener('pointerlockchange', () => {
            this.locked = document.pointerLockElement === document.body;
        });
        
        this.shooting = false;
    }
    
    onMouseMove(event) {
        if (!this.locked) return;
        
        this.mouse.x += event.movementX * 0.002;
        this.mouse.y += event.movementY * 0.002;
        this.mouse.y = Math.max(-Math.PI/2, Math.min(Math.PI/2, this.mouse.y));
        
        // Weapon sway
        this.weaponSway.x += event.movementX * 0.0001;
        this.weaponSway.y += event.movementY * 0.0001;
        
        this.camera.rotation.order = 'YXZ';
        this.camera.rotation.y = -this.mouse.x;
        this.camera.rotation.x = -this.mouse.y;
    }
    
    startShooting() {
        this.shooting = true;
    }
    
    stopShooting() {
        this.shooting = false;
    }
    
    updatePlayer() {
        const speed = this.keys['ShiftLeft'] ? 0.4 : 0.2;
        const direction = new THREE.Vector3();
        let moving = false;
        
        if (this.keys['KeyW']) { direction.z -= speed; moving = true; }
        if (this.keys['KeyS']) { direction.z += speed; moving = true; }
        if (this.keys['KeyA']) { direction.x -= speed; moving = true; }
        if (this.keys['KeyD']) { direction.x += speed; moving = true; }
        
        direction.applyQuaternion(this.camera.quaternion);
        direction.y = 0;
        this.camera.position.add(direction);
        
        // Walking bob
        if (moving) {
            this.walkBob += 0.15;
        } else {
            this.walkBob *= 0.95;
        }
        
        if (this.keys['KeyR'] && !this.reloading) this.reload();
        if (this.shooting) this.shoot();
        
        this.checkCollisions();
        this.updateWeaponTransform();
        
        // Shield regeneration
        if (this.player.shield < this.player.maxShield) {
            this.player.shield = Math.min(this.player.maxShield, this.player.shield + 0.15);
        }
    }
    
    updateWeaponTransform() {
        if (!this.weaponGroup) return;
        
        const bobAmount = Math.sin(this.walkBob) * 0.015;
        const swayDamping = 0.94;
        
        this.weaponSway.x *= swayDamping;
        this.weaponSway.y *= swayDamping;
        
        this.weaponGroup.position.set(
            0.3 + this.weaponSway.x,
            -0.35 + this.weaponSway.y + bobAmount,
            -0.6
        );
        
        this.weaponGroup.rotation.z = this.weaponSway.x * 0.3;
        this.weaponGroup.rotation.x = this.weaponSway.y * 0.2;
    }
    
    shoot() {
        const weapon = this.weapons[this.player.weapon];
        if (this.player.ammo <= 0 || this.reloading || Date.now() - this.lastShot < weapon.fireRate) return;
        
        this.lastShot = Date.now();
        this.player.ammo--;
        this.updateUI();

        // Play gunshot sound (you need to load a sound file)
         const audioLoader = new THREE.AudioLoader();
         audioLoader.load('/sounds/gunshot.mp3', (buffer) => {
             this.sound.setBuffer(buffer);
             this.sound.setLoop(false);
             this.sound.setVolume(0.5);
             this.sound.play();
         });
        
        // --- PUNCHY RECOIL ---
        // Sharp upward kick
        this.camera.rotation.x -= 0.05; 
        // Random side-to-side kick
        this.camera.rotation.y += (Math.random() - 0.5) * 0.01;

        if (this.revolverCylinder) {
            this.revolverCylinder.rotation.y += Math.PI / 3; // Rotate cylinder
        }
        
        this.createMuzzleFlash();
        this.screenShake();
        
        // Raycast hit detection with improved collision
        const raycaster = new THREE.Raycaster();
        const pellets = weapon.name === 'Combat Shotgun' ? 6 : 1;
        
        for (let i = 0; i < pellets; i++) {
            const spread = weapon.name === 'Combat Shotgun' ? 0.15 : 0.02;
            const direction = new THREE.Vector3(
                (Math.random() - 0.5) * spread,
                (Math.random() - 0.5) * spread,
                -1
            ).normalize();
            
            direction.applyQuaternion(this.camera.quaternion);
            raycaster.set(this.camera.position, direction);
            
            // Create bullet trail
            this.createBulletTrail(this.camera.position, direction);
            
            // Check all enemy parts for hits
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
                    this.hitEnemy(enemy, weapon.damage, intersects[0].point);
                }
            }
        }
    }
    
    createMuzzleFlash() {
        const flash = new THREE.PointLight(0xffaa33, 2, 10);
        
        const forward = new THREE.Vector3(0, 0, -1);
        forward.applyQuaternion(this.camera.quaternion);
        
        // Position flash at the end of the gun barrel
        const weaponPos = this.weaponGroup.position.clone();
        const flashPos = this.camera.localToWorld(weaponPos);
        flashPos.add(forward.multiplyScalar(0.5));
        
        flash.position.copy(flashPos);
        this.scene.add(flash);
        
        setTimeout(() => this.scene.remove(flash), 60);
    }
    
    createBulletTrail(start, direction) {
        const end = start.clone().add(direction.clone().multiplyScalar(150));
        
        // Main trail line
        const geometry = new THREE.BufferGeometry();
        geometry.setFromPoints([start, end]);
        
        const trail = new THREE.Line(
            geometry,
            new THREE.LineBasicMaterial({ 
                color: 0xffff00,
                transparent: true,
                opacity: 0.6,
                linewidth: 2
            })
        );
        
        this.scene.add(trail);
        
        // Remove trail after short time
        setTimeout(() => {
            this.scene.remove(trail);
        }, 100);
    }
    
    screenShake() {
        const intensity = 0.02; // Increased intensity
        this.camera.position.x += (Math.random() - 0.5) * intensity;
        this.camera.position.y += (Math.random() - 0.5) * intensity;
        
        // Smoothly return to original position
        setTimeout(() => {
            this.camera.position.x -= (Math.random() - 0.5) * intensity;
            this.camera.position.y -= (Math.random() - 0.5) * intensity;
        }, 80);
    }
    
    hitEnemy(enemy, damage, hitPoint) {
        enemy.health -= damage;
        
        // Metal sparks and oil splatter
        for (let i = 0; i < 6; i++) {
            const spark = new THREE.Mesh(
                new THREE.SphereGeometry(0.03),
                new THREE.MeshBasicMaterial({ color: 0xffff00 })
            );
            spark.position.copy(hitPoint);
            spark.position.add(new THREE.Vector3(
                (Math.random() - 0.5) * 0.4,
                (Math.random() - 0.5) * 0.4,
                (Math.random() - 0.5) * 0.4
            ));
            this.scene.add(spark);
            this.particles.push({ mesh: spark, life: 300, velocity: new THREE.Vector3(
                (Math.random() - 0.5) * 0.1,
                Math.random() * 0.05,
                (Math.random() - 0.5) * 0.1
            )});
        }
        
        // Oil drops
        for (let i = 0; i < 4; i++) {
            const oil = new THREE.Mesh(
                new THREE.SphereGeometry(0.04),
                new THREE.MeshBasicMaterial({ color: 0x1a1a1a })
            );
            oil.position.copy(hitPoint);
            oil.position.add(new THREE.Vector3(
                (Math.random() - 0.5) * 0.3,
                Math.random() * 0.2,
                (Math.random() - 0.5) * 0.3
            ));
            this.scene.add(oil);
            this.particles.push({ mesh: oil, life: 800, velocity: new THREE.Vector3(
                (Math.random() - 0.5) * 0.05,
                -0.02,
                (Math.random() - 0.5) * 0.05
            )});
        }
        
        if (Math.random() < 0.4) this.createAmmoDrop(enemy.mesh.position);
        
        if (enemy.health <= 0) {
            this.destroyEnemy(enemy);
            this.player.score += 150;
            this.player.kills++;
            this.updateUI();
        }
    }
    
    destroyEnemy(enemy) {
        this.scene.remove(enemy.mesh);
        this.enemies = this.enemies.filter(e => e !== enemy);
        
        const pos = enemy.mesh.position;
        
        // Electric sparks explosion
        for (let i = 0; i < 15; i++) {
            const spark = new THREE.Mesh(
                new THREE.SphereGeometry(0.05 + Math.random() * 0.05),
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
        
        // Metal debris
        for (let i = 0; i < 8; i++) {
            const debris = new THREE.Mesh(
                new THREE.BoxGeometry(0.1, 0.1, 0.1),
                new THREE.MeshLambertMaterial({ color: 0x666666 })
            );
            debris.position.copy(pos);
            debris.position.add(new THREE.Vector3(
                (Math.random() - 0.5) * 1.5,
                Math.random() * 1,
                (Math.random() - 0.5) * 1.5
            ));
            this.scene.add(debris);
            this.particles.push({ 
                mesh: debris, 
                life: 1200,
                velocity: new THREE.Vector3(
                    (Math.random() - 0.5) * 0.1,
                    -0.05,
                    (Math.random() - 0.5) * 0.1
                )
            });
        }
        
        // Oil pool
        const oilPool = new THREE.Mesh(
            new THREE.CircleGeometry(1.2),
            new THREE.MeshBasicMaterial({ 
                color: 0x0a0a0a,
                transparent: true,
                opacity: 0.7
            })
        );
        oilPool.rotation.x = -Math.PI / 2;
        oilPool.position.copy(pos);
        oilPool.position.y = 0.01;
        this.scene.add(oilPool);
        this.particles.push({ mesh: oilPool, life: 5000, velocity: new THREE.Vector3(0, 0, 0) });
        
        // Lightning effect
        for (let i = 0; i < 5; i++) {
            const lightning = new THREE.Mesh(
                new THREE.CylinderGeometry(0.02, 0.02, 2),
                new THREE.MeshBasicMaterial({ color: 0xffffff })
            );
            lightning.position.copy(pos);
            lightning.position.y += 1;
            lightning.rotation.z = (Math.random() - 0.5) * 0.5;
            this.scene.add(lightning);
            this.particles.push({ mesh: lightning, life: 150, velocity: new THREE.Vector3(0, 0, 0) });
        }
    }
    
    spawnLoop() {
        setInterval(() => {
            if (this.enemies.length < 12) this.createEnemy();
            if (this.powerups.length < 6) this.createPowerup();
        }, 2500);
    }
    
    createEnemy() {
        const androidGroup = new THREE.Group();
        
        // Main body (torso)
        const torso = new THREE.Mesh(
            new THREE.BoxGeometry(1.0, 1.5, 0.6),
            new THREE.MeshLambertMaterial({ color: 0x666666 })
        );
        torso.position.y = 0.2;
        androidGroup.add(torso);
        
        // Head
        const head = new THREE.Mesh(
            new THREE.BoxGeometry(0.7, 0.7, 0.7),
            new THREE.MeshLambertMaterial({ color: 0x888888 })
        );
        head.position.y = 1.1;
        androidGroup.add(head);
        
        // Arms
        const arm1 = new THREE.Mesh(
            new THREE.BoxGeometry(0.3, 1.2, 0.3),
            new THREE.MeshLambertMaterial({ color: 0x555555 })
        );
        arm1.position.set(-0.7, 0.2, 0);
        androidGroup.add(arm1);
        
        const arm2 = new THREE.Mesh(
            new THREE.BoxGeometry(0.3, 1.2, 0.3),
            new THREE.MeshLambertMaterial({ color: 0x555555 })
        );
        arm2.position.set(0.7, 0.2, 0);
        androidGroup.add(arm2);
        
        // Legs
        const leg1 = new THREE.Mesh(
            new THREE.BoxGeometry(0.4, 1.3, 0.4),
            new THREE.MeshLambertMaterial({ color: 0x444444 })
        );
        leg1.position.set(-0.3, -1.0, 0);
        androidGroup.add(leg1);
        
        const leg2 = new THREE.Mesh(
            new THREE.BoxGeometry(0.4, 1.3, 0.4),
            new THREE.MeshLambertMaterial({ color: 0x444444 })
        );
        leg2.position.set(0.3, -1.0, 0);
        androidGroup.add(leg2);
        
        // Glowing red eyes
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
        
        // Chest panel
        const panel = new THREE.Mesh(
            new THREE.BoxGeometry(0.6, 0.4, 0.05),
            new THREE.MeshBasicMaterial({ color: 0x00ffff })
        );
        panel.position.set(0, 0.3, 0.31);
        androidGroup.add(panel);
        
        const enemy = {
            mesh: androidGroup,
            health: 100,
            maxHealth: 100,
            speed: 0.025 + Math.random() * 0.015,
            lastAttack: 0
        };
        
        enemy.mesh.position.set(
            (Math.random() - 0.5) * 200,
            1.25,
            (Math.random() - 0.5) * 200
        );
        
        enemy.mesh.castShadow = true;
        this.scene.add(enemy.mesh);
        this.enemies.push(enemy);
    }
    
    updateEnemies() {
        this.enemies.forEach(enemy => {
            const distToPlayer = enemy.mesh.position.distanceTo(this.camera.position);
            
            if (distToPlayer < 25) {
                const direction = new THREE.Vector3()
                    .subVectors(this.camera.position, enemy.mesh.position)
                    .normalize()
                    .multiplyScalar(enemy.speed);
                
                enemy.mesh.position.add(direction);
                enemy.mesh.lookAt(this.camera.position);
                
                // Attack player
                if (distToPlayer < 3 && Date.now() - enemy.lastAttack > 1000) {
                    enemy.lastAttack = Date.now();
                    this.takeDamage(15);
                }
            }
        });
    }
    
    createPowerup() {
        const types = ['health', 'shield', 'ammo', 'weapon'];
        const type = types[Math.floor(Math.random() * types.length)];
        const colors = { health: 0x00ff00, shield: 0x0088ff, ammo: 0xffaa00, weapon: 0xff0088 };
        
        const powerup = {
            mesh: new THREE.Mesh(
                new THREE.OctahedronGeometry(0.6),
                new THREE.MeshLambertMaterial({ 
                    color: colors[type],
                    transparent: true,
                    opacity: 0.8
                })
            ),
            type: type,
            rotation: 0
        };
        
        powerup.mesh.position.set(
            (Math.random() - 0.5) * 150,
            1.5,
            (Math.random() - 0.5) * 150
        );
        
        this.scene.add(powerup.mesh);
        this.powerups.push(powerup);
    }
    
    checkCollisions() {
        this.powerups.forEach((powerup, index) => {
            if (powerup.mesh.position.distanceTo(this.camera.position) < 2.5) {
                this.collectPowerup(powerup);
                this.scene.remove(powerup.mesh);
                this.powerups.splice(index, 1);
            }
        });
    }
    
    collectPowerup(powerup) {
        switch (powerup.type) {
            case 'health':
                this.player.health = Math.min(this.player.maxHealth, this.player.health + 40);
                break;
            case 'shield':
                this.player.shield = this.player.maxShield;
                break;
            case 'ammo':
                this.player.ammo = Math.min(this.player.maxAmmo, this.player.ammo + 20);
                break;
            case 'weapon':
                this.switchWeapon();
                break;
        }
        this.updateUI();
    }
    
    createAmmoDrop(position) {
        const ammoDrop = {
            mesh: new THREE.Mesh(
                new THREE.BoxGeometry(0.4, 0.4, 0.4),
                new THREE.MeshLambertMaterial({ color: 0xffaa00 })
            ),
            type: 'ammo',
            rotation: 0
        };
        
        ammoDrop.mesh.position.copy(position);
        ammoDrop.mesh.position.y = 0.8;
        this.scene.add(ammoDrop.mesh);
        this.powerups.push(ammoDrop);
    }
    
    switchWeapon() {
        this.player.weapon = (this.player.weapon + 1) % this.weapons.length;
        this.player.maxAmmo = this.weapons[this.player.weapon].maxAmmo;
        this.player.ammo = Math.min(this.player.ammo, this.player.maxAmmo);
        
        // Recreate weapon model
        this.camera.remove(this.weaponGroup);
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
    
    gameOver() {
        document.getElementById('finalScore').textContent = this.player.score;
        document.getElementById('finalKills').textContent = this.player.kills;
        document.getElementById('gameOver').style.display = 'flex';
    }
    
    animate() {
        requestAnimationFrame(() => this.animate());
        
        this.updatePlayer();
        this.updateEnemies();
        this.updatePowerups();
        this.updateParticles();
        this.world.step(1/60);
        
        this.renderer.render(this.scene, this.camera);
    }
    
    updatePowerups() {
        this.powerups.forEach(powerup => {
            powerup.rotation += 0.03;
            powerup.mesh.rotation.y = powerup.rotation;
            powerup.mesh.position.y = 1.5 + Math.sin(Date.now() * 0.004 + powerup.rotation) * 0.3;
        });
    }
    
    updateParticles() {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const particle = this.particles[i];
            particle.life -= 16;
            
            // Apply physics to particles with velocity
            if (particle.velocity) {
                particle.mesh.position.add(particle.velocity);
                particle.velocity.y -= 0.003; // gravity
                particle.velocity.multiplyScalar(0.98); // air resistance
            }
            
            // Fade out effect
            if (particle.mesh.material.opacity !== undefined) {
                particle.mesh.material.opacity = Math.max(0, particle.life / 1000);
            }
            
            if (particle.life <= 0) {
                this.scene.remove(particle.mesh);
                this.particles.splice(i, 1);
            }
        }
    }
}

new Game();