import * as THREE from 'three';

export class WeaponSystem {
    constructor(scene, camera, audioManager) {
        this.scene = scene;
        this.camera = camera;
        this.audioManager = audioManager;
        this.ammo = 30;
        this.maxAmmo = 30;
        this.isReloading = false;
        this.fireRate = 0.1; // seconds between shots
        this.lastShotTime = 0;
        
        this.muzzleFlashes = [];
        this.bulletTrails = [];
        
        this.createWeaponModel();
    }
    
    createWeaponModel() {
        this.weaponGroup = new THREE.Group();

        const metallicMaterial = new THREE.MeshStandardMaterial({
            color: 0x555555,
            metalness: 0.8,
            roughness: 0.3
        });
        const barrelMaterial = new THREE.MeshStandardMaterial({
            color: 0x333333,
            metalness: 0.9,
            roughness: 0.2
        });
        const accentMaterial = new THREE.MeshStandardMaterial({
            color: 0x00ffff, // Cyan glow for cyber elements
            emissive: 0x00ffff,
            emissiveIntensity: 0.5
        });

        // Main Body/Frame
        const bodyGeometry = new THREE.BoxGeometry(0.3, 0.2, 0.8);
        const body = new THREE.Mesh(bodyGeometry, metallicMaterial);
        body.position.set(0, -0.1, -0.2);
        this.weaponGroup.add(body);

        // Barrel (more pronounced)
        const barrelGeometry = new THREE.CylinderGeometry(0.06, 0.08, 0.6, 8);
        const barrel = new THREE.Mesh(barrelGeometry, barrelMaterial);
        barrel.position.set(0, 0, 0.4);
        barrel.rotation.x = Math.PI / 2;
        body.add(barrel);

        // Handle/Grip
        const handleGeometry = new THREE.BoxGeometry(0.2, 0.5, 0.15);
        const handle = new THREE.Mesh(handleGeometry, metallicMaterial);
        handle.position.set(0, -0.3, -0.4);
        this.weaponGroup.add(handle);

        // Cylinder (revolver part)
        const cylinderGeometry = new THREE.CylinderGeometry(0.12, 0.12, 0.2, 6);
        const cylinder = new THREE.Mesh(cylinderGeometry, metallicMaterial);
        cylinder.position.set(0, 0, -0.1);
        cylinder.rotation.x = Math.PI / 2;
        body.add(cylinder);

        // Scope/Sight (simple box)
        const scopeGeometry = new THREE.BoxGeometry(0.1, 0.08, 0.3);
        const scope = new THREE.Mesh(scopeGeometry, barrelMaterial);
        scope.position.set(0, 0.1, 0.2);
        body.add(scope);

        // Cyber Accent (e.g., small light strip)
        const accentGeometry = new THREE.BoxGeometry(0.05, 0.05, 0.1);
        const accent = new THREE.Mesh(accentGeometry, accentMaterial);
        accent.position.set(0, 0.05, 0.1);
        body.add(accent);

        // Position the entire weapon group relative to the camera
        this.weaponGroup.position.set(0.6, -0.4, -0.5); // Adjust these values for proper positioning
        this.weaponGroup.rotation.y = Math.PI * 0.1;

        // Attach to camera
        this.camera.add(this.weaponGroup);
    }
    
    shoot() {
        if (this.ammo <= 0 || this.isReloading) return false;
        
        const currentTime = Date.now() / 1000;
        if (currentTime - this.lastShotTime < this.fireRate) return false;
        
        this.ammo--;
        this.lastShotTime = currentTime;
        
        // Weapon recoil
        this.weaponRecoil();
        
        // Muzzle flash
        this.createMuzzleFlash();
        
        // Bullet trail
        this.createBulletTrail();
        
        // Screen shake
        this.screenShake();

        if (this.audioManager) {
            this.audioManager.playSound('gunshot');
        }

        return true;
    }
    
    weaponRecoil() {
        const recoilAmount = 0.05;
        const originalPosition = this.weaponGroup.position.clone();
        
        this.weaponGroup.position.z += recoilAmount;
        this.weaponGroup.rotation.x -= recoilAmount;
        
        // Return to original position
        const returnToPosition = () => {
            this.weaponGroup.position.lerp(originalPosition, 0.2);
            this.weaponGroup.rotation.x *= 0.8;
            
            if (this.weaponGroup.position.distanceTo(originalPosition) > 0.001) {
                requestAnimationFrame(returnToPosition);
            }
        };
        requestAnimationFrame(returnToPosition);
    }
    
    createMuzzleFlash() {
        const flashGeometry = new THREE.SphereGeometry(0.1, 6, 4);
        const flashMaterial = new THREE.MeshBasicMaterial({ 
            color: 0xffff00,
            transparent: true,
            opacity: 0.8
        });
        const flash = new THREE.Mesh(flashGeometry, flashMaterial);
        
        // Position at barrel end
        const barrelEnd = new THREE.Vector3(0.1, -0.3, -0.9);
        flash.position.copy(barrelEnd);
        
        this.weaponGroup.add(flash);
        this.muzzleFlashes.push(flash);
        
        // Remove flash after short time
        setTimeout(() => {
            this.weaponGroup.remove(flash);
            const index = this.muzzleFlashes.indexOf(flash);
            if (index > -1) this.muzzleFlashes.splice(index, 1);
        }, 50);
    }
    
    createBulletTrail() {
        const trailGeometry = new THREE.CylinderGeometry(0.002, 0.002, 100, 4);
        const trailMaterial = new THREE.MeshBasicMaterial({ 
            color: 0xffff00,
            transparent: true,
            opacity: 0.6
        });
        const trail = new THREE.Mesh(trailGeometry, trailMaterial);
        
        // Position and orient trail
        const direction = new THREE.Vector3(0, 0, -1);
        this.camera.getWorldDirection(direction);
        
        trail.position.copy(this.camera.position);
        trail.position.add(direction.clone().multiplyScalar(50));
        trail.lookAt(this.camera.position.clone().add(direction.multiplyScalar(100)));
        trail.rotation.x += Math.PI / 2;
        
        this.scene.add(trail);
        this.bulletTrails.push(trail);
        
        // Fade out trail
        const fadeTrail = () => {
            trail.material.opacity -= 0.05;
            if (trail.material.opacity > 0) {
                requestAnimationFrame(fadeTrail);
            } else {
                this.scene.remove(trail);
                const index = this.bulletTrails.indexOf(trail);
                if (index > -1) this.bulletTrails.splice(index, 1);
            }
        };
        requestAnimationFrame(fadeTrail);
    }
    
    screenShake() {
        const originalPosition = this.camera.position.clone();
        const shakeIntensity = 0.02;
        const shakeDuration = 100;
        
        let shakeTime = 0;
        const shake = () => {
            shakeTime += 16;
            
            if (shakeTime < shakeDuration) {
                this.camera.position.x = originalPosition.x + (Math.random() - 0.5) * shakeIntensity;
                this.camera.position.y = originalPosition.y + (Math.random() - 0.5) * shakeIntensity;
                requestAnimationFrame(shake);
            } else {
                this.camera.position.copy(originalPosition);
            }
        };
        shake();
    }
    
    reload() {
        if (this.isReloading || this.ammo === this.maxAmmo) return;
        
        this.isReloading = true;
        
        // Reload animation
        const reloadAnimation = () => {
            this.weaponGroup.rotation.z += 0.1;
            
            setTimeout(() => {
                this.weaponGroup.rotation.z = 0;
                this.ammo = this.maxAmmo;
                this.isReloading = false;
            }, 1500);
        };
        reloadAnimation();
    }
    
    update(deltaTime) {
        // Weapon sway
        const time = Date.now() * 0.001;
        this.weaponGroup.rotation.x = Math.sin(time * 2) * 0.01;
        this.weaponGroup.rotation.y = Math.cos(time * 1.5) * 0.01;
        
        // Update muzzle flashes
        this.muzzleFlashes.forEach(flash => {
            flash.material.opacity -= deltaTime * 20;
        });
    }
}