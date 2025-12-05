import * as THREE from 'three';

export class EnemyManager {
    constructor(scene, takeDamageCallback) {
        this.scene = scene;
        this.takeDamageCallback = takeDamageCallback;
        this.enemies = [];
        this.spawnTimer = 0;
        this.spawnInterval = 2;
        this.maxEnemies = 15;
        this.enemySpeed = 8;
        this.enemyFireRate = 2; // seconds between enemy shots
        this.enemyLastShotTime = 0;
        this.laserBeams = [];
    }
    
    startSpawning() {
        this.spawnEnemy();
    }
    
    spawnEnemy() {
        if (this.enemies.length >= this.maxEnemies) return;
        
        const enemy = this.createEnemy();
        this.enemies.push(enemy);
        this.scene.add(enemy);
    }
    
    createEnemy() {
        // Create enemy body parts for dismemberment
        const enemy = new THREE.Group();
        
        const metallicMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x888888, 
            metalness: 0.9, 
            roughness: 0.5 
        });
        const jointMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x444444, 
            metalness: 0.9, 
            roughness: 0.3 
        });
        const emissiveMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 }); // Green glowing eyes
        
        // Body (central core)
        const bodyGeometry = new THREE.BoxGeometry(0.8, 1.6, 0.6);
        const body = new THREE.Mesh(bodyGeometry, metallicMaterial);
        body.position.y = 1;
        body.castShadow = true;
        enemy.add(body);
        
        // Head (more geometric)
        const headGeometry = new THREE.BoxGeometry(0.6, 0.6, 0.6);
        const head = new THREE.Mesh(headGeometry, metallicMaterial);
        head.position.y = 2;
        head.castShadow = true;
        enemy.add(head);

        // Glowing Eyes
        const eyeGeometry = new THREE.BoxGeometry(0.1, 0.1, 0.05);
        const leftEye = new THREE.Mesh(eyeGeometry, emissiveMaterial);
        leftEye.position.set(-0.2, 0.1, 0.3);
        head.add(leftEye);
        const rightEye = new THREE.Mesh(eyeGeometry, emissiveMaterial);
        rightEye.position.set(0.2, 0.1, 0.3);
        head.add(rightEye);
        
        // Arms (cylindrical with joints)
        const armGeometry = new THREE.CylinderGeometry(0.1, 0.1, 0.8, 8);
        
        const leftArmUpper = new THREE.Mesh(armGeometry, metallicMaterial);
        leftArmUpper.position.set(-0.5, 0.4, 0);
        leftArmUpper.rotation.z = Math.PI / 4;
        body.add(leftArmUpper); // Attach to body

        const leftElbowJoint = new THREE.Mesh(new THREE.SphereGeometry(0.15), jointMaterial);
        leftElbowJoint.position.set(-0.9, 0.9, 0);
        leftElbowJoint.castShadow = true;
        enemy.add(leftElbowJoint);
        
        const leftArmLower = new THREE.Mesh(armGeometry, metallicMaterial);
        leftArmLower.position.set(-0.9, 0.4, 0);
        leftArmLower.rotation.z = -Math.PI / 4;
        enemy.add(leftArmLower); // Attach to enemy directly for easier dismemberment

        const rightArmUpper = new THREE.Mesh(armGeometry, metallicMaterial);
        rightArmUpper.position.set(0.5, 0.4, 0);
        rightArmUpper.rotation.z = -Math.PI / 4;
        body.add(rightArmUpper);

        const rightElbowJoint = new THREE.Mesh(new THREE.SphereGeometry(0.15), jointMaterial);
        rightElbowJoint.position.set(0.9, 0.9, 0);
        rightElbowJoint.castShadow = true;
        enemy.add(rightElbowJoint);

        const rightArmLower = new THREE.Mesh(armGeometry, metallicMaterial);
        rightArmLower.position.set(0.9, 0.4, 0);
        rightArmLower.rotation.z = Math.PI / 4;
        enemy.add(rightArmLower);
        
        // Legs (cylindrical with joints)
        const legGeometry = new THREE.CylinderGeometry(0.15, 0.15, 0.9, 8);
        
        const leftLegUpper = new THREE.Mesh(legGeometry, metallicMaterial);
        leftLegUpper.position.set(-0.25, -0.4, 0);
        body.add(leftLegUpper);

        const leftKneeJoint = new THREE.Mesh(new THREE.SphereGeometry(0.18), jointMaterial);
        leftKneeJoint.position.set(-0.25, -0.9, 0);
        leftKneeJoint.castShadow = true;
        enemy.add(leftKneeJoint);
        
        const leftLegLower = new THREE.Mesh(legGeometry, metallicMaterial);
        leftLegLower.position.set(-0.25, -1.4, 0);
        enemy.add(leftLegLower);

        const rightLegUpper = new THREE.Mesh(legGeometry, metallicMaterial);
        rightLegUpper.position.set(0.25, -0.4, 0);
        body.add(rightLegUpper);

        const rightKneeJoint = new THREE.Mesh(new THREE.SphereGeometry(0.18), jointMaterial);
        rightKneeJoint.position.set(0.25, -0.9, 0);
        rightKneeJoint.castShadow = true;
        enemy.add(rightKneeJoint);

        const rightLegLower = new THREE.Mesh(legGeometry, metallicMaterial);
        rightLegLower.position.set(0.25, -1.4, 0);
        enemy.add(rightLegLower);
        
        // Adjust enemy group position so its base is at y=0
        enemy.position.y = 1.0; 

        // Position enemy randomly
        const angle = Math.random() * Math.PI * 2;
        const distance = 30 + Math.random() * 40;
        enemy.position.set(
            Math.cos(angle) * distance,
            0, // Start at ground level
            Math.sin(angle) * distance
        );
        
        // Enemy properties
        enemy.userData = {
            health: 100,
            speed: this.enemySpeed + Math.random() * 5,
            bodyParts: {
                body: body,
                head: head,
                leftArm: leftArmLower, // Reference the lower arms for dismemberment
                rightArm: rightArmLower,
                leftLeg: leftLegLower, // Reference the lower legs for dismemberment
                rightLeg: rightLegLower
            },
            dismembered: [],
            isDead: false
        };
        
        return enemy;
    }

    shootLaser(enemy, playerPosition, takeDamageCallback) {
        // Only allow enemy to shoot if not dead and cooldown is met
        if (enemy.userData.isDead) return;

        // Calculate fire rate per enemy
        if (!enemy.userData.lastLaserShotTime) enemy.userData.lastLaserShotTime = 0;
        const currentTime = Date.now() / 1000;
        const effectiveFireRate = this.enemyFireRate + (Math.random() * 1); // Randomize a bit
        if (currentTime - enemy.userData.lastLaserShotTime < effectiveFireRate) return;

        enemy.userData.lastLaserShotTime = currentTime;

        const laserOrigin = enemy.position.clone();
        laserOrigin.y += 1.5; // From enemy's 'head' height

        const direction = new THREE.Vector3()
            .subVectors(playerPosition, laserOrigin)
            .normalize();

        // Create laser visual (thin cylinder)
        const laserGeometry = new THREE.CylinderGeometry(0.05, 0.05, 100, 8);
        const laserMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.8 });
        const laser = new THREE.Mesh(laserGeometry, laserMaterial);

        laser.position.copy(laserOrigin);
        laser.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction); // Orient along direction
        laser.position.add(direction.clone().multiplyScalar(50)); // Position mid-way

        this.scene.add(laser);
        this.laserBeams.push(laser);

        // Raycast for player hit
        const raycaster = new THREE.Raycaster(laserOrigin, direction);
        // Note: For player hit detection, we'll need player's collision mesh/bounding box.
        // For now, we'll assume a direct hit on playerPosition for simplicity or use a sphere around player.
        // This part needs to be refined when player collision is implemented.
        const distanceToPlayer = laserOrigin.distanceTo(playerPosition);
        if (distanceToPlayer < 2) { // Simple hit detection range for now
            // Placeholder for calling player damage. Game.js will provide this callback.
            takeDamageCallback(10); 
        }

        // Remove laser after short duration
        setTimeout(() => {
            this.scene.remove(laser);
            const index = this.laserBeams.indexOf(laser);
            if (index > -1) {
                this.laserBeams.splice(index, 1);
            }
        }, 150); // Laser visible for 150ms
    }
    
    update(deltaTime, playerPosition) {
        this.spawnTimer += deltaTime;
        
        if (this.spawnTimer >= this.spawnInterval) {
            this.spawnEnemy();
            this.spawnTimer = 0;
        }
        
        // Update enemy AI
        this.enemies.forEach(enemy => {
            if (enemy.userData.isDead) return;
            
            // Move towards player
            const direction = new THREE.Vector3()
                .subVectors(playerPosition, enemy.position)
                .normalize();
            
            enemy.position.add(
                direction.multiplyScalar(enemy.userData.speed * deltaTime)
            );
            
            // Face player
            enemy.lookAt(playerPosition);
            
            // Enemy shooting logic
            this.shootLaser(enemy, playerPosition, this.takeDamageCallback);

            // Animate movement
            const time = Date.now() * 0.005;
            enemy.rotation.y += Math.sin(time) * 0.1;
            enemy.position.y = Math.sin(time * 2) * 0.1;
        });
        
        // Remove dead enemies after delay
        this.enemies = this.enemies.filter(enemy => {
            if (enemy.userData.isDead && enemy.userData.deathTime < Date.now() - 5000) {
                this.scene.remove(enemy);
                return false;
            }
            return true;
        });
    }
    
    damageEnemy(enemy, hitPoint) {
        if (enemy.userData.isDead) return;
        
        // Determine which body part was hit
        const bodyPart = this.getHitBodyPart(enemy, hitPoint);
        
        if (bodyPart === 'head') {
            // Headshot - instant kill
            enemy.userData.health = 0;
            this.dismemberBodyPart(enemy, 'head', hitPoint);
        } else {
            // Body shot
            enemy.userData.health -= 50;
            if (Math.random() < 0.3) {
                this.dismemberBodyPart(enemy, bodyPart, hitPoint);
            }
        }
        
        if (enemy.userData.health <= 0) {
            this.killEnemy(enemy);
        }
    }
    
    getHitBodyPart(enemy, hitPoint) {
        const localPoint = enemy.worldToLocal(hitPoint.clone());
        
        if (localPoint.y > 1.7) return 'head';
        if (localPoint.y > 0.8) {
            if (Math.abs(localPoint.x) > 0.4) {
                return localPoint.x > 0 ? 'rightArm' : 'leftArm';
            }
            return 'body';
        }
        return localPoint.x > 0 ? 'rightLeg' : 'leftLeg';
    }
    
    dismemberBodyPart(enemy, partName, hitPoint) {
        const bodyPart = enemy.userData.bodyParts[partName];
        if (!bodyPart || enemy.userData.dismembered.includes(partName)) return;
        
        enemy.userData.dismembered.push(partName);
        
        // Create flying body part
        const flyingPart = bodyPart.clone();
        flyingPart.position.copy(bodyPart.getWorldPosition(new THREE.Vector3()));
        flyingPart.material = bodyPart.material.clone();
        flyingPart.material.color.multiplyScalar(0.7);
        
        this.scene.add(flyingPart);
        
        // Add physics to flying part
        const velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 10,
            Math.random() * 8 + 5,
            (Math.random() - 0.5) * 10
        );
        
        flyingPart.userData = {
            velocity: velocity,
            angularVelocity: new THREE.Vector3(
                (Math.random() - 0.5) * 10,
                (Math.random() - 0.5) * 10,
                (Math.random() - 0.5) * 10
            )
        };
        
        // Animate flying part
        const animatePart = () => {
            flyingPart.userData.velocity.y -= 20 * 0.016; // gravity
            flyingPart.position.add(flyingPart.userData.velocity.clone().multiplyScalar(0.016));
            flyingPart.rotation.x += flyingPart.userData.angularVelocity.x * 0.016;
            flyingPart.rotation.y += flyingPart.userData.angularVelocity.y * 0.016;
            flyingPart.rotation.z += flyingPart.userData.angularVelocity.z * 0.016;
            
            if (flyingPart.position.y > -10) {
                requestAnimationFrame(animatePart);
            } else {
                this.scene.remove(flyingPart);
            }
        };
        animatePart();
        
        // Hide original body part
        bodyPart.visible = false;
    }
    
    killEnemy(enemy) {
        enemy.userData.isDead = true;
        enemy.userData.deathTime = Date.now();
        
        // Death animation
        const deathTween = () => {
            enemy.rotation.x += 0.05;
            enemy.position.y -= 0.02;
            
            if (enemy.rotation.x < Math.PI / 2) {
                requestAnimationFrame(deathTween);
            }
        };
        deathTween();
    }
}