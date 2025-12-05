// main.js (UPDATED - expanded weapon system + revolver)
// Based on original main.js uploaded by user. See original for earlier baseline. :contentReference[oaicite:1]{index=1}

import * as THREE from 'three';
import * as CANNON from 'cannon-es';

class Game {
    constructor() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.world = new CANNON.World();

        // Player state
        this.player = {
            health: 100,
            maxHealth: 100,
            score: 0,
            shield: 50,
            maxShield: 50,
            weaponIndex: 0,
            aiming: false,
        };

        // Weapon definitions - each entry includes visualModel builder, stats and special behavior flags
        this.weapons = [
            {
                id: 'rifle',
                name: 'Rifle',
                damage: 25,
                fireRate: 120, // ms between shots
                maxAmmo: 30,
                reloadTime: 2000,
                spread: 0.02,
                pellets: 1,
                auto: true,
                modelBuilder: (group) => this.buildRifleModel(group)
            },
            {
                id: 'shotgun',
                name: 'Shotgun',
                damage: 18, // per pellet
                fireRate: 800,
                maxAmmo: 8,
                reloadTime: 3000,
                spread: 0.15,
                pellets: 7,
                auto: false,
                modelBuilder: (group) => this.buildShotgunModel(group)
            },
            {
                id: 'smg',
                name: 'SMG',
                damage: 13,
                fireRate: 70,
                maxAmmo: 50,
                reloadTime: 1300,
                spread: 0.035,
                pellets: 1,
                auto: true,
                modelBuilder: (group) => this.buildSMGModel(group)
            },
            {
                id: 'revolver',
                name: 'Revolver',
                damage: 50,
                fireRate: 300,
                maxAmmo: 6, // cylinder capacity
                reloadTime: 2200, // full cylinder reload
                spread: 0.01,
                pellets: 1,
                auto: false,
                cylinderChambers: 6,
                cylinderIndex: 0,
                modelBuilder: (group) => this.buildRevolverModel(group)
            }
        ];

        // runtime weapon state
        this.runtimeWeapons = this.weapons.map(w => ({
            id: w.id,
            ammo: w.maxAmmo,
            maxAmmo: w.maxAmmo,
            chamber: w.id === 'revolver' ? w.cylinderChambers : w.maxAmmo, // for revolver, track chamber count
            cylinderIndex: 0
        }));

        this.powerups = [];
        this.enemies = [];

        this.lastShot = 0;
        this.reloading = false;
        this.keys = {};
        this.gunGroup = null;
        this.mouse = { x: 0, y: 0 };
        this.locked = false;

        // weapon sway / bobbing params
        this.weaponSway = { x: 0, y: 0 };

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
        this.setupLighting();
        this.createWeaponHolder(); // create initial empty container for weapon models
        this.equipWeapon(this.player.weaponIndex); // equip default weapon
        this.setupControls();
        this.spawnPowerups();

        // UI initialization
        this.createUI();
        this.updateUI();

        // game loops
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
        this.world.addBody(groundBody);

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

    // UI creation helper
    createUI() {
        const style = `position:fixed; left:12px; bottom:12px; color:#fff; font-family:monospace; z-index:999;`;
        const hud = document.createElement('div');
        hud.id = 'hud';
        hud.style = style;
        hud.innerHTML = `
            <div>Health: <span id="health">100</span></div>
            <div>Shield: <span id="shield">50</span></div>
            <div>Ammo: <span id="ammo">30/30</span></div>
            <div>Weapon: <span id="weapon">Rifle</span></div>
            <div>Score: <span id="score">0</span></div>
        `;
        document.body.appendChild(hud);

        // Game over overlay
        const go = document.createElement('div');
        go.id = 'gameOver';
        go.style = 'position:fixed; inset:0; display:none; align-items:center; justify-content:center; background:rgba(0,0,0,0.6); color:#fff; font-size:28px; z-index:1000;';
        go.innerHTML = `<div>Game Over<br/>Final Score: <span id="finalScore">0</span></div>`;
        document.body.appendChild(go);
    }

    // Create empty group attached to camera where weapons will be placed
    createWeaponHolder() {
        if (this.gunGroup) this.camera.remove(this.gunGroup);
        this.gunGroup = new THREE.Group();
        this.gunGroup.position.set(0.5, -0.6, -1.0);
        this.camera.add(this.gunGroup);
    }

    // Equip weapon by index, create model by calling the weapon's modelBuilder
    equipWeapon(index) {
        if (index < 0 || index >= this.weapons.length) index = 0;
        this.player.weaponIndex = index;
        const weapon = this.weapons[index];

        // Reset and populate the holder
        this.createWeaponHolder();

        // Let the weapon build its model into the group
        weapon.modelBuilder(this.gunGroup);

        // set ammo if not present
        const runtime = this.runtimeWeapons[index];
        if (!runtime) {
            this.runtimeWeapons[index] = { ammo: weapon.maxAmmo, maxAmmo: weapon.maxAmmo, chamber: weapon.maxAmmo, cylinderIndex: 0 };
        }

        this.updateUI();
    }

    // Simple weapons models (replace with glTF for more fidelity)
    buildRifleModel(group) {
        // barrel
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 1.4), new THREE.MeshLambertMaterial({ color: 0x222222 }));
        barrel.rotation.z = Math.PI / 2;
        barrel.position.set(0.6, -0.15, -0.9);

        // body
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.9), new THREE.MeshLambertMaterial({ color: 0x444444 }));
        body.position.set(0.12, -0.35, -0.5);

        // scope
        const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.6), new THREE.MeshLambertMaterial({ color: 0x111111 }));
        scope.rotation.z = Math.PI / 2;
        scope.position.set(0.25, -0.2, -0.4);

        group.add(barrel, body, scope);
    }

    buildShotgunModel(group) {
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 1.1), new THREE.MeshLambertMaterial({ color: 0x111111 }));
        barrel.rotation.z = Math.PI / 2;
        barrel.position.set(0.5, -0.25, -0.8);

        const body = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.22, 0.7), new THREE.MeshLambertMaterial({ color: 0x2b2b2b }));
        body.position.set(0.08, -0.45, -0.4);

        const pump = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.12, 0.5), new THREE.MeshLambertMaterial({ color: 0x333333 }));
        pump.position.set(0.35, -0.35, -0.6);

        group.add(barrel, body, pump);
    }

    buildSMGModel(group) {
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.9), new THREE.MeshLambertMaterial({ color: 0x222222 }));
        barrel.rotation.z = Math.PI / 2;
        barrel.position.set(0.45, -0.2, -0.8);

        const body = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.16, 0.6), new THREE.MeshLambertMaterial({ color: 0x2f2f2f }));
        body.position.set(0.05, -0.36, -0.4);

        const stock = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.5), new THREE.MeshLambertMaterial({ color: 0x1b1b1b }));
        stock.position.set(-0.1, -0.3, 0.0);
        stock.rotation.y = 0.2;

        group.add(barrel, body, stock);
    }

    buildRevolverModel(group) {
        // Build a cylinder (rotating) and barrel + frame
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.6), new THREE.MeshLambertMaterial({ color: 0x222222 }));
        barrel.rotation.z = Math.PI / 2;
        barrel.position.set(0.4, -0.15, -0.6);

        const frame = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.18, 0.5), new THREE.MeshLambertMaterial({ color: 0x333333 }));
        frame.position.set(0.05, -0.38, -0.25);

        // Cylinder - will rotate on shoot
        const cylinder = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.2, 32), new THREE.MeshLambertMaterial({ color: 0x555555 }));
        cylinder.rotation.z = Math.PI / 2;
        cylinder.position.set(0.18, -0.28, -0.35);
        cylinder.name = 'revolverCylinder'; // reference

        // hammer (simple)
        const hammer = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.03, 0.12), new THREE.MeshLambertMaterial({ color: 0x111111 }));
        hammer.position.set(0.02, -0.16, -0.05);
        hammer.rotation.x = 0.2;

        group.add(barrel, frame, cylinder, hammer);
    }

    // Input handling
    setupControls() {
        document.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
            // quick weapon keys: 1-4
            if (e.code === 'Digit1') this.swapToIndex(0);
            if (e.code === 'Digit2') this.swapToIndex(1);
            if (e.code === 'Digit3') this.swapToIndex(2);
            if (e.code === 'Digit4') this.swapToIndex(3);
            if (e.code === 'KeyR') this.reload();
            if (e.code === 'KeyQ') this.switchWeapon();
        });
        document.addEventListener('keyup', (e) => this.keys[e.code] = false);

        // Mouse for look & fire
        document.addEventListener('mousemove', (e) => this.onMouseMove(e));
        document.addEventListener('mousedown', (e) => {
            if (e.button === 0) this.shoot(); // left click
            if (e.button === 2) { // right click -> aim
                this.player.aiming = true;
            }
        });
        document.addEventListener('mouseup', (e) => {
            if (e.button === 2) this.player.aiming = false;
        });

        // prevent context menu so right-click can be used for aim
        document.addEventListener('contextmenu', (e) => e.preventDefault());

        // pointer lock
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
        this.mouse.y = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.mouse.y));

        this.camera.rotation.order = 'YXZ';
        this.camera.rotation.y = -this.mouse.x;
        this.camera.rotation.x = -this.mouse.y;

        // weapon sway based on movementX/Y
        this.weaponSway.x = Math.max(-0.02, Math.min(0.02, this.weaponSway.x + event.movementX * 0.0003));
        this.weaponSway.y = Math.max(-0.02, Math.min(0.02, this.weaponSway.y + event.movementY * 0.0002));
    }

    swapToIndex(i) {
        if (i === this.player.weaponIndex) return;
        this.equipWeapon(i);
    }

    switchWeapon() {
        const next = (this.player.weaponIndex + 1) % this.weapons.length;
        this.equipWeapon(next);
    }

    // Shooting logic (handles auto/semi modes, ammo, spread, muzzle)
    shoot() {
        const wIndex = this.player.weaponIndex;
        const weapon = this.weapons[wIndex];
        const runtime = this.runtimeWeapons[wIndex];

        // handle auto: if held, should respect fireRate by lastShot; firing on each click here
        if (this.reloading) return;
        if (!runtime || runtime.ammo <= 0) return;
        if (Date.now() - this.lastShot < weapon.fireRate) return;

        // For revolver, ensure cylinderChambers represented
        if (weapon.id === 'revolver') {
            if (runtime.chamber <= 0) {
                // cylinder empty
                this.playDryFire();
                return;
            }
            runtime.chamber--;
            // rotate cylinder mesh visually
            const cyl = this.gunGroup.getObjectByName('revolverCylinder');
            if (cyl) {
                // rotate by /6th of circle per shot
                const step = (Math.PI * 2) / (weapon.cylinderChambers || 6);
                new TWEEN.Tween(cyl.rotation) // if TWEEN available; fallback to simple rotation
                    .to({ z: cyl.rotation.z + step }, 80)
                    .start && new TWEEN.Tween(cyl.rotation).to({ z: cyl.rotation.z + step }, 80).start();
                cyl.rotation.z += step; // immediate fallback
            }
        } else {
            // normal magazine weapon
            runtime.ammo--;
        }

        this.lastShot = Date.now();
        this.createMuzzleFlash();
        this.spawnShell(weapon.id);

        // recoil animation (move gunGroup back and up)
        this.gunGroup.position.z += 0.08;
        this.gunGroup.position.y += 0.02;
        setTimeout(() => {
            this.gunGroup.position.z -= 0.08;
            this.gunGroup.position.y -= 0.02;
        }, 80);

        // raycast(s)
        const pellets = weapon.pellets || 1;
        for (let i = 0; i < pellets; i++) {
            const spread = weapon.spread * (this.player.aiming ? 0.25 : 1); // better accuracy when aiming
            const dir = new THREE.Vector3(
                (Math.random() - 0.5) * spread,
                (Math.random() - 0.5) * spread,
                -1
            ).normalize();
            dir.applyQuaternion(this.camera.quaternion);

            const raycaster = new THREE.Raycaster(this.camera.position, dir);
            const intersects = raycaster.intersectObjects(this.enemies.map(e => e.mesh));
            if (intersects.length > 0) {
                const enemy = this.enemies.find(e => e.mesh === intersects[0].object);
                if (enemy) this.hitEnemy(enemy, weapon.damage);
            }
        }

        // screen shake proportional to damage
        this.screenShake(Math.min(0.08, weapon.damage * 0.0025));
        this.updateUI();
    }

    // Very small dry-fire feedback
    playDryFire() {
        // TODO: play dry-fire sound. For now small camera twitch
        this.camera.position.y -= 0.05;
        setTimeout(() => this.camera.position.y += 0.05, 80);
    }

    createMuzzleFlash() {
        const flash = new THREE.Mesh(
            new THREE.SphereGeometry(0.18),
            new THREE.MeshBasicMaterial({ color: 0xffcc66 })
        );

        const flashPos = this.camera.position.clone();
        const forward = new THREE.Vector3(0, 0, -1);
        forward.applyQuaternion(this.camera.quaternion);
        flashPos.add(forward.multiplyScalar(2));
        flash.position.copy(flashPos);
        this.scene.add(flash);

        setTimeout(() => this.scene.remove(flash), 50);
    }

    // spawn a small casing that flies out for visual feedback
    spawnShell(weaponId) {
        const casing = new THREE.Mesh(
            new THREE.BoxGeometry(0.06, 0.02, 0.02),
            new THREE.MeshLambertMaterial({ color: 0xCCA66A })
        );
        // position near right side of camera
        const offset = new THREE.Vector3(0.6, -0.3, -0.3);
        offset.applyQuaternion(this.camera.quaternion);
        casing.position.copy(this.camera.position).add(offset);

        // random velocity
        const vel = new THREE.Vector3((Math.random() - 0.5) * 0.4 + 0.8, Math.random() * 0.6 + 0.2, (Math.random() - 0.5) * 0.4);
        // store a simple dt-based movement for a short life
        casing.userData = { vel, life: 800 };
        this.scene.add(casing);

        // manage in update loop (we'll track casings array)
        if (!this._casings) this._casings = [];
        this._casings.push(casing);
    }

    screenShake(intensity = 0.05) {
        const originalPos = this.camera.position.clone();
        this.camera.position.x += (Math.random() - 0.5) * intensity;
        this.camera.position.y += (Math.random() - 0.5) * intensity;
        setTimeout(() => this.camera.position.copy(originalPos), 60);
    }

    // Hit/damage logic unchanged but refactored to accept damage
    hitEnemy(enemy, damage) {
        enemy.health -= damage;

        if (Math.random() < 0.3) {
            this.createAmmoDrop(enemy.mesh.position);
        }

        const hitEffect = new THREE.Mesh(
            new THREE.SphereGeometry(0.4),
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

        // Explosion particles
        for (let i = 0; i < 8; i++) {
            const particle = new THREE.Mesh(
                new THREE.SphereGeometry(0.12),
                new THREE.MeshBasicMaterial({ color: 0xff6644 })
            );
            particle.position.copy(enemy.mesh.position);
            particle.userData = { vel: new THREE.Vector3((Math.random() - 0.5) * 2, Math.random() * 2, (Math.random() - 0.5) * 2), life: 900 };
            this.scene.add(particle);
            if (!this._particles) this._particles = [];
            this._particles.push(particle);
        }
    }

    // Enemy spawner/update
    spawnEnemies() {
        setInterval(() => {
            if (this.enemies.length < 10) this.createEnemy();
        }, 2500);
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
        enemy.mesh.position.set((Math.random() - 0.5) * 80, 1, (Math.random() - 0.5) * 80);
        enemy.mesh.castShadow = true;
        this.scene.add(enemy.mesh);
        this.enemies.push(enemy);
    }

    updateEnemies() {
        this.enemies.forEach(enemy => {
            const dist = enemy.mesh.position.distanceTo(this.camera.position);
            if (dist < 20) {
                const dir = new THREE.Vector3().subVectors(this.camera.position, enemy.mesh.position).normalize().multiplyScalar(enemy.speed);
                enemy.mesh.position.add(dir);
                enemy.mesh.lookAt(this.camera.position);
                if (dist < 2.0) this.takeDamage(0.8); // continuous bite
            } else {
                // small idle patrol
                enemy.mesh.position.x += Math.sin(Date.now() * 0.001 + enemy.mesh.position.x) * 0.002;
            }
        });
    }

    // Reload supports per-weapon special behavior (revolver vs magazine)
    reload() {
        const i = this.player.weaponIndex;
        const weapon = this.weapons[i];
        const runtime = this.runtimeWeapons[i];
        if (!runtime) return;
        if (this.reloading) return;

        // If revolver: simulate cylinder reload
        if (weapon.id === 'revolver') {
            this.reloading = true;
            // small "cylinder out" animation (visual)
            const cyl = this.gunGroup.getObjectByName('revolverCylinder');
            if (cyl) {
                // move cylinder out & back (simple)
                const original = cyl.position.clone();
                cyl.position.z += 0.2;
                setTimeout(() => { cyl.position.copy(original); }, weapon.reloadTime - 150);
            }
            setTimeout(() => {
                runtime.chamber = weapon.cylinderChambers || 6;
                this.reloading = false;
                this.updateUI();
            }, weapon.reloadTime);
            this.updateUI();
            return;
        }

        // default magazine-style reload
        if (runtime.ammo >= runtime.maxAmmo) return;
        this.reloading = true;
        setTimeout(() => {
            runtime.ammo = runtime.maxAmmo;
            this.reloading = false;
            this.updateUI();
        }, weapon.reloadTime);
        this.updateUI();
    }

    // powerups spawn/pickup kept intact but extended to include weapon pickups that change model
    spawnPowerups() {
        setInterval(() => {
            if (this.powerups.length < 6) this.createPowerup();
        }, 7000);
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

        powerup.mesh.position.set((Math.random() - 0.5) * 60, 1, (Math.random() - 0.5) * 60);

        this.scene.add(powerup.mesh);
        this.powerups.push(powerup);
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
                // refill current weapon partially
                const runtime = this.runtimeWeapons[this.player.weaponIndex];
                if (runtime) runtime.ammo = Math.min(runtime.maxAmmo, runtime.ammo + 15);
                break;
            case 'weapon':
                // randomly equip another weapon
                const idx = Math.floor(Math.random() * this.weapons.length);
                this.equipWeapon(idx);
                break;
        }
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

    takeDamage(damage) {
        if (this.player.shield > 0) {
            const used = Math.min(this.player.shield, damage);
            this.player.shield -= used;
            damage -= used;
        }
        if (damage > 0) this.player.health -= damage;
        this.updateUI();
        if (this.player.health <= 0) this.gameOver();
    }

    gameOver() {
        document.getElementById('finalScore').textContent = this.player.score;
        document.getElementById('gameOver').style.display = 'flex';
    }

    updateUI() {
        const runtime = this.runtimeWeapons[this.player.weaponIndex];
        document.getElementById('health').textContent = Math.floor(this.player.health);
        document.getElementById('score').textContent = this.player.score;
        document.getElementById('shield').textContent = Math.floor(this.player.shield);
        document.getElementById('weapon').textContent = this.weapons[this.player.weaponIndex].name;

        if (this.reloading) {
            document.getElementById('ammo').textContent = 'RELOADING...';
        } else if (this.weapons[this.player.weaponIndex].id === 'revolver') {
            // show revolver chamber
            const runtimeRe = this.runtimeWeapons[this.player.weaponIndex];
            document.getElementById('ammo').textContent = `${runtimeRe ? runtimeRe.chamber : 0}/${this.weapons[this.player.weaponIndex].cylinderChambers || 6}`;
        } else {
            document.getElementById('ammo').textContent = `${runtime ? runtime.ammo : 0}/${this.weapons[this.player.weaponIndex].maxAmmo}`;
        }
    }

    // update loop
    animate() {
        requestAnimationFrame(() => this.animate());

        this.updatePlayer();
        this.updateEnemies();
        this.updatePowerups();

        // step physics world
        this.world.step(1 / 60);

        // update casings (simple movement)
        if (this._casings && this._casings.length) {
            for (let i = this._casings.length - 1; i >= 0; i--) {
                const c = this._casings[i];
                c.userData.vel.y -= 0.02; // gravity
                c.position.addScaledVector(c.userData.vel, 1 / 60);
                c.userData.life -= 16;
                c.rotation.x += 0.2;
                c.rotation.z += 0.1;
                if (c.userData.life <= 0) {
                    this.scene.remove(c);
                    this._casings.splice(i, 1);
                }
            }
        }

        // update generic particles
        if (this._particles && this._particles.length) {
            for (let i = this._particles.length - 1; i >= 0; i--) {
                const p = this._particles[i];
                p.position.addScaledVector(p.userData.vel, 1 / 60);
                p.userData.vel.y -= 0.03;
                p.userData.life -= 16;
                if (p.userData.life <= 0) {
                    this.scene.remove(p);
                    this._particles.splice(i, 1);
                }
            }
        }

        // weapon bob / sway & ADS zoom
        this.updateWeaponTransform();

        this.renderer.render(this.scene, this.camera);
    }

    updateWeaponTransform() {
        if (!this.gunGroup) return;
        // bob based on movement keys
        const walking = (this.keys['KeyW'] || this.keys['KeyA'] || this.keys['KeyS'] || this.keys['KeyD']);
        const bob = walking ? Math.sin(Date.now() * 0.006) * 0.005 : 0;
        const swayX = this.weaponSway.x;
        const swayY = this.weaponSway.y;

        // aim down sights: move forward & tighten
        const aimOffset = this.player.aiming ? -0.25 : 0;

        this.gunGroup.position.x = 0.5 + swayX;
        this.gunGroup.position.y = -0.6 + swayY + bob;
        this.gunGroup.position.z = -1.0 + aimOffset;

        // slowly damp sway
        this.weaponSway.x *= 0.94;
        this.weaponSway.y *= 0.94;

        // camera FOV change for ADS
        this.camera.fov = this.player.aiming ? 50 : 75;
        this.camera.updateProjectionMatrix();
    }

    updatePlayer() {
        const speed = this.keys['ShiftLeft'] ? 0.35 : 0.18;
        const direction = new THREE.Vector3();

        if (this.keys['KeyW']) direction.z -= speed;
        if (this.keys['KeyS']) direction.z += speed;
        if (this.keys['KeyA']) direction.x -= speed;
        if (this.keys['KeyD']) direction.x += speed;

        direction.applyQuaternion(this.camera.quaternion);
        direction.y = 0;
        this.camera.position.add(direction);

        if (this.keys['KeyR'] && !this.reloading) {
            this.reload();
        }

        // quick weapon swap via Q (already handled on keydown)
        this.checkPowerupCollision();

        // Shield regeneration
        if (this.player.shield < this.player.maxShield) {
            this.player.shield = Math.min(this.player.maxShield, this.player.shield + 0.12);
        }
    }

    updatePowerups() {
        this.powerups.forEach(powerup => {
            powerup.rotation += 0.02;
            powerup.mesh.rotation.y = powerup.rotation;
            powerup.me
