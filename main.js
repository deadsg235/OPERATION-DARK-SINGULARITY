import * as THREE from 'three';
import * as CANNON from 'cannon-es';

class Game {
    constructor() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.world = new CANNON.World();
        
        this.listener = new THREE.AudioListener();
        this.camera.add(this.listener);
        this.sound = new THREE.Audio(this.listener);

        this.player = { 
            health: 100, maxHealth: 100, score: 0, ammo: 6, maxAmmo: 6, 
            shield: 100, maxShield: 100, weapon: 0, kills: 0,
            model: null,
            limbs: {},
            moveDirection: new THREE.Vector3(),
            isMoving: false,
            recoilAlpha: 0,
            recoilAmount: 0.3
        };
        
        this.weapons = [
            { name: 'Heavy Revolver', damage: 75, fireRate: 450, maxAmmo: 6, reloadTime: 3000, color: 0x3d3d3d },
            { name: 'Assault Rifle', damage: 35, fireRate: 120, maxAmmo: 30, reloadTime: 2500, color: 0x444444 },
            { name: 'Combat Shotgun', damage: 80, fireRate: 600, maxAmmo: 8, reloadTime: 3200, color: 0x8B4513 },
            { name: 'SMG', damage: 22, fireRate: 60, maxAmmo: 40, reloadTime: 1800, color: 0x2F4F4F }
        ];
        
        this.enemies = [];
        this.powerups = [];
        this.particles = [];
        this.keys = {};
        
        this.cameraOffset = new THREE.Vector3(0, 2.5, 5);
        this.mouse = { x: 0, y: 0 };
        this.locked = false;
        this.lastShot = 0;
        this.reloading = false;
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
        this.createPlayer();
        this.createWeapon();
        this.setupControls();
        this.setupLighting();
        this.spawnLoop();
        this.animate();
    }

    createPlayer() {
        const playerGroup = new THREE.Group();
        playerGroup.position.set(0, 1.8, 0);

        const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), new THREE.MeshLambertMaterial({ color: 0xcccccc }));
        head.position.y = 1;
        playerGroup.add(head);

        const torso = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.2, 0.4), new THREE.MeshLambertMaterial({ color: 0x555555 }));
        playerGroup.add(torso);

        const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.0, 0.2), new THREE.MeshLambertMaterial({ color: 0x777777 }));
        leftArm.position.set(-0.5, 0.4, 0);
        playerGroup.add(leftArm);

        const rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.0, 0.2), new THREE.MeshLambertMaterial({ color: 0x777777 }));
        rightArm.position.set(0.5, 0.4, 0);
        playerGroup.add(rightArm);

        const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.2, 0.3), new THREE.MeshLambertMaterial({ color: 0x777777 }));
        leftLeg.position.set(-0.25, -1.2, 0);
        playerGroup.add(leftLeg);

        const rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.2, 0.3), new THREE.MeshLambertMaterial({ color: 0x777777 }));
        rightLeg.position.set(0.25, -1.2, 0);
        playerGroup.add(rightLeg);

        this.player.model = playerGroup;
        this.player.limbs = { head, torso, leftArm, rightArm, leftLeg, rightLeg };
        this.scene.add(this.player.model);
    }
    
    createEnvironment() {
        const groundGeometry = new THREE.PlaneGeometry(300, 300, 50, 50);
        const groundMaterial = new THREE.MeshLambertMaterial({ color: 0x1a1a2e, wireframe: false });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add(ground);
        
        const gridHelper = new THREE.GridHelper(300, 60, 0x00ffff, 0x003366);
        gridHelper.position.y = 0.01;
        this.scene.add(gridHelper);
        
        const groundShape = new CANNON.Plane();
        const groundBody = new CANNON.Body({ mass: 0 });
        groundBody.addShape(groundShape);
        groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
        this.world.addBody(groundBody);
        
        for (let i = 0; i < 15; i++) {
            const height = 8 + Math.random() * 12;
            const structure = new THREE.Mesh(
                new THREE.BoxGeometry(4, height, 4),
                new THREE.MeshLambertMaterial({ color: new THREE.Color().setHSL(0.6, 0.8, 0.3 + Math.random() * 0.3) })
            );
            structure.position.set((Math.random() - 0.5) * 250, height / 2, (Math.random() - 0.5) * 250);
            structure.castShadow = true;
            structure.receiveShadow = true;
            this.scene.add(structure);
        }
    }

    createWeapon() {
        if (this.weaponGroup) {
            this.player.limbs.rightArm.remove(this.weaponGroup);
        }
        this.weaponGroup = new THREE.Group();
        const weapon = this.weapons[this.player.weapon];

        if (weapon.name === 'Heavy Revolver') {
            this.createRevolver();
        } else {
            // Logic for other weapons can be placed here
            const receiver = new THREE.Mesh(
                new THREE.BoxGeometry(0.1, 0.15, 0.5),
                new THREE.MeshStandardMaterial({ color: weapon.color, roughness: 0.5, metalness: 0.3 })
            );
            this.weaponGroup.add(receiver);
        }
        
        this.weaponGroup.position.set(0, -0.3, 0.3);
        this.player.limbs.rightArm.add(this.weaponGroup);
    }

    createRevolver() {
        const weapon = this.weapons[this.player.weapon];
        const darkMetal = new THREE.MeshStandardMaterial({ color: weapon.color, roughness: 0.4, metalness: 0.8 });
        const gripMaterial = new THREE.MeshStandardMaterial({ color: 0x4a2a0a, roughness: 0.8 });

        const frame = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.15, 0.2), darkMetal);
        this.weaponGroup.add(frame);

        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.4, 16), darkMetal);
        barrel.rotation.z = Math.PI / 2;
        barrel.position.set(0, 0.05, -0.25);
        this.weaponGroup.add(barrel);

        this.revolverCylinder = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.18, 6), darkMetal);
        this.revolverCylinder.rotation.x = Math.PI / 2;
        this.weaponGroup.add(this.revolverCylinder);

        const grip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.3, 0.1), gripMaterial);
        grip.position.set(0, -0.15, 0.05);
        grip.rotation.z = -0.2;
        this.weaponGroup.add(grip);
        
        const hammer = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.05, 0.08), darkMetal);
        hammer.position.set(0, 0.1, 0.1);
        this.weaponGroup.add(hammer);
    }
    
    setupLighting() {
        const ambientLight = new THREE.AmbientLight(0x404080, 0.4);
        this.scene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
        directionalLight.position.set(100, 100, 50);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        this.scene.add(directionalLight);
    }
    
    setupControls() {
        document.addEventListener('keydown', (e) => { this.keys[e.code] = true; });
        document.addEventListener('keyup', (e) => { this.keys[e.code] = false; });
        document.addEventListener('mousemove', (e) => this.onMouseMove(e));
        document.addEventListener('mousedown', (e) => { if (e.button === 0) this.startShooting(); });
        document.addEventListener('mouseup', (e) => { if (e.button === 0) this.stopShooting(); });
        
        document.addEventListener('click', () => { if (!this.locked) document.body.requestPointerLock(); });
        document.addEventListener('pointerlockchange', () => { this.locked = document.pointerLockElement === document.body; });
        
        this.shooting = false;
    }
    
    onMouseMove(event) {
        if (!this.locked) return;
        this.mouse.x += event.movementX * 0.002; // Mouse right -> camera right
        this.mouse.y += event.movementY * 0.002; // Mouse up -> camera down (inverted Y)
        this.mouse.y = Math.max(-Math.PI / 4, Math.min(Math.PI / 2, this.mouse.y));
    }
    
    startShooting() { 
        console.log("startShooting called");
        this.shooting = true; 
    }
    stopShooting() { this.shooting = false; }
    
    updatePlayer() {
        const speed = this.keys['ShiftLeft'] ? 0.2 : 0.1;
        this.player.isMoving = false;
        
        let zSpeed = 0;
        let xSpeed = 0;

        if (this.keys['KeyW']) { zSpeed = speed; this.player.isMoving = true; }
        if (this.keys['KeyS']) { zSpeed = -speed; this.player.isMoving = true; }
        if (this.keys['KeyA']) { xSpeed = -speed; this.player.isMoving = true; }
        if (this.keys['KeyD']) { xSpeed = speed; this.player.isMoving = true; }

        const forward = new THREE.Vector3();
        this.camera.getWorldDirection(forward);
        forward.y = 0;
        forward.normalize();

        const right = new THREE.Vector3().crossVectors(this.camera.up, forward).normalize();

        const forwardMove = forward.clone().multiplyScalar(zSpeed);
        const rightMove = right.clone().multiplyScalar(xSpeed);
        
        const moveDirection = new THREE.Vector3().add(forwardMove).add(rightMove);

        this.player.model.position.add(moveDirection);

        const cameraDirection = new THREE.Vector3();
        this.camera.getWorldDirection(cameraDirection);
        const angle = Math.atan2(cameraDirection.x, cameraDirection.z);
        this.player.model.rotation.y = angle;

        if (this.player.isMoving) {
            this.walkBob += 0.2;
        }

        this.updateCamera();
        this.animateLimbs();

        if (this.keys['KeyR'] && !this.reloading) this.reload();
        if (this.shooting) this.shoot();
        
        this.checkCollisions();
    }

    updateCamera() {
        const targetPosition = this.player.model.position;
        const cameraLookAt = new THREE.Vector3().copy(targetPosition).add(new THREE.Vector3(0, 1, 0));

        const spherical = new THREE.Spherical().setFromVector3(this.cameraOffset);
        spherical.theta = this.mouse.x;
        spherical.phi = Math.PI / 2 - this.mouse.y;
        const newCameraOffset = new THREE.Vector3().setFromSpherical(spherical);

        const cameraPosition = new THREE.Vector3().copy(targetPosition).add(newCameraOffset);
        
        this.camera.position.lerp(cameraPosition, 0.1);
        this.camera.lookAt(cameraLookAt);
    }

    animateLimbs() {
        if (this.player.isMoving) {
            this.player.limbs.leftArm.rotation.x = Math.sin(this.walkBob) * 0.5;
            this.player.limbs.rightArm.rotation.x = -Math.sin(this.walkBob) * 0.5;
            this.player.limbs.leftLeg.rotation.x = -Math.sin(this.walkBob) * 0.5;
            this.player.limbs.rightLeg.rotation.x = Math.sin(this.walkBob) * 0.5;
        } else {
            this.player.limbs.leftArm.rotation.x = 0;
            this.player.limbs.rightArm.rotation.x = 0;
            this.player.limbs.leftLeg.rotation.x = 0;
            this.player.limbs.rightLeg.rotation.x = 0;
        }
    }
    
    shoot() {
        console.log("shoot() called");
        const weapon = this.weapons[this.player.weapon];
        if (this.player.ammo <= 0) {
            console.log("shoot() returning early because: Ammo is 0");
            return;
        }
        if (this.reloading) {
            console.log("shoot() returning early because: Reloading");
            return;
        }
        if (Date.now() - this.lastShot < weapon.fireRate) {
            console.log("shoot() returning early because: Fire Rate limit (", Date.now() - this.lastShot, "ms since last shot, fire rate is", weapon.fireRate, "ms)");
            return;
        }
        
        this.lastShot = Date.now();
        this.player.ammo--;
        this.updateUI();

        // To enable sound:
        // 1. Create a 'sounds' folder in your project.
        // 2. Add a 'gunshot.mp3' file to it.
        // 3. Uncomment the block below.
        /*
        const audioLoader = new THREE.AudioLoader();
        audioLoader.load('/sounds/gunshot.mp3', (buffer) => {
            if (this.sound.isPlaying) this.sound.stop();
            this.sound.setBuffer(buffer);
            this.sound.setLoop(false);
            this.sound.setVolume(0.5);
            this.sound.play();
        });
        */

        this.gunRecoil();

        if (this.revolverCylinder) {
            this.revolverCylinder.rotation.y += Math.PI / 3;
        }
        
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera({ x: 0, y: 0 }, this.camera);

        const allEnemyMeshes = this.enemies.flatMap(enemy => enemy.mesh.children);
        const intersects = raycaster.intersectObjects(allEnemyMeshes, true);
        
        let targetPoint;
        if (intersects.length > 0) {
            const hitMesh = intersects[0].object;
            const enemy = this.enemies.find(e => e.mesh.children.includes(hitMesh));
            if (enemy) {
                this.hitEnemy(enemy, weapon.damage, intersects[0].point);
            }
            targetPoint = intersects[0].point;
        } else {
            targetPoint = raycaster.ray.at(100);
        }

        const barrelPosition = new THREE.Vector3();
        this.weaponGroup.getWorldPosition(barrelPosition);
        this.createBulletTrail(barrelPosition, targetPoint);
        this.createMuzzleFlash();
    }

    gunRecoil() {
        this.player.recoilAlpha = 1;
    }

    updateWeapon() {
        if (this.weaponGroup) {
            this.player.recoilAlpha = THREE.MathUtils.lerp(this.player.recoilAlpha, 0, 0.15);
            this.weaponGroup.rotation.x = this.player.recoilAlpha * -this.player.recoilAmount;
        }
    }
    
    createMuzzleFlash() {
        const flash = new THREE.PointLight(0xffaa33, 2, 10);
        this.weaponGroup.getWorldPosition(flash.position);
        this.scene.add(flash);
        setTimeout(() => this.scene.remove(flash), 60);
    }
    
    createBulletTrail(start, end) {
        const geometry = new THREE.BufferGeometry();
        geometry.setFromPoints([start, end]);
        
        const trail = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: 0xffff00, transparent: true, opacity: 0.6, linewidth: 2 }));
        this.scene.add(trail);
        setTimeout(() => { this.scene.remove(trail); }, 100);
    }
    
    hitEnemy(enemy, damage, hitPoint) {
        enemy.health -= damage;
        
        for (let i = 0; i < 6; i++) {
            const spark = new THREE.Mesh(new THREE.SphereGeometry(0.03), new THREE.MeshBasicMaterial({ color: 0xffff00 }));
            spark.position.copy(hitPoint);
            this.scene.add(spark);
            this.particles.push({ mesh: spark, life: 300, velocity: new THREE.Vector3((Math.random() - 0.5) * 0.1, Math.random() * 0.05, (Math.random() - 0.5) * 0.1) });
        }
        
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
    }
    
    spawnLoop() {
        setInterval(() => {
            if (this.enemies.length < 12) this.createEnemy();
            if (this.powerups.length < 6) this.createPowerup();
        }, 2500);
    }
    
    createEnemy() {
        const androidGroup = new THREE.Group();
        
        const torso = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.5, 0.6), new THREE.MeshLambertMaterial({ color: 0x666666 }));
        torso.position.y = 0.2;
        androidGroup.add(torso);
        
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), new THREE.MeshLambertMaterial({ color: 0x888888 }));
        head.position.y = 1.1;
        androidGroup.add(head);
        
        const eye1 = new THREE.Mesh(new THREE.SphereGeometry(0.08), new THREE.MeshBasicMaterial({ color: 0xff0000 }));
        eye1.position.set(-0.15, 1.15, 0.35);
        androidGroup.add(eye1);
        
        const eye2 = new THREE.Mesh(new THREE.SphereGeometry(0.08), new THREE.MeshBasicMaterial({ color: 0xff0000 }));
        eye2.position.set(0.15, 1.15, 0.35);
        androidGroup.add(eye2);
        
        const enemy = { mesh: androidGroup, health: 100, maxHealth: 100, speed: 0.025 + Math.random() * 0.015, lastAttack: 0 };
        
        enemy.mesh.position.set((Math.random() - 0.5) * 200, 1.25, (Math.random() - 0.5) * 200);
        
        enemy.mesh.castShadow = true;
        this.scene.add(enemy.mesh);
        this.enemies.push(enemy);
    }
    
    updateEnemies() {
        this.enemies.forEach(enemy => {
            const distToPlayer = enemy.mesh.position.distanceTo(this.player.model.position);
            
            if (distToPlayer < 25) {
                const direction = new THREE.Vector3().subVectors(this.player.model.position, enemy.mesh.position).normalize().multiplyScalar(enemy.speed);
                enemy.mesh.position.add(direction);
                enemy.mesh.lookAt(this.player.model.position);
                
                if (distToPlayer < 2 && Date.now() - enemy.lastAttack > 1000) {
                    enemy.lastAttack = Date.now();
                    this.takeDamage(15);
                }
            }
        });
    }
    
    createPowerup() {
        const types = ['health', 'shield', 'ammo'];
        const type = types[Math.floor(Math.random() * types.length)];
        const colors = { health: 0x00ff00, shield: 0x0088ff, ammo: 0xffaa00 };
        
        const powerup = {
            mesh: new THREE.Mesh(new THREE.OctahedronGeometry(0.6), new THREE.MeshLambertMaterial({ color: colors[type], transparent: true, opacity: 0.8 })),
            type: type, rotation: 0
        };
        
        powerup.mesh.position.set((Math.random() - 0.5) * 150, 1.5, (Math.random() - 0.5) * 150);
        this.scene.add(powerup.mesh);
        this.powerups.push(powerup);
    }
    
    checkCollisions() {
        this.powerups.forEach((powerup, index) => {
            if (powerup.mesh.position.distanceTo(this.player.model.position) < 2.5) {
                this.collectPowerup(powerup);
                this.scene.remove(powerup.mesh);
                this.powerups.splice(index, 1);
            }
        });
    }
    
    collectPowerup(powerup) {
        switch (powerup.type) {
            case 'health': this.player.health = Math.min(this.player.maxHealth, this.player.health + 40); break;
            case 'shield': this.player.shield = this.player.maxShield; break;
            case 'ammo': this.player.ammo = Math.min(this.player.maxAmmo, this.player.ammo + 20); break;
        }
        this.updateUI();
    }
    
    switchWeapon() {
        this.player.weapon = (this.player.weapon + 1) % this.weapons.length;
        const newWeapon = this.weapons[this.player.weapon];
        this.player.maxAmmo = newWeapon.maxAmmo;
        this.player.ammo = newWeapon.maxAmmo; // Full ammo on switch
        
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
        document.exitPointerLock();
    }
    
    animate() {
        requestAnimationFrame(() => this.animate());
        
        this.updatePlayer();
        this.updateEnemies();
        this.updatePowerups();
        this.updateParticles();
        this.updateWeapon();
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
            const p = this.particles[i];
            p.life -= 16;
            if (p.velocity) {
                p.mesh.position.add(p.velocity);
                p.velocity.y -= 0.003;
                p.velocity.multiplyScalar(0.98);
            }
            if (p.life <= 0) {
                this.scene.remove(p.mesh);
                this.particles.splice(i, 1);
            }
        }
    }
}

new Game();
