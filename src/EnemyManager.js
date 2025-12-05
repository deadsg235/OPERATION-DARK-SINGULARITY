import * as THREE from 'three';

export class EnemyManager {
    constructor(scene) {
        this.scene = scene;
        this.enemies = [];
        this.spawnTimer = 0;
        this.spawnInterval = 2;
        this.maxEnemies = 15;
        this.enemySpeed = 8;
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
        
        // Body
        const bodyGeometry = new THREE.CapsuleGeometry(0.5, 1.5, 4, 8);
        const bodyMaterial = new THREE.MeshLambertMaterial({ color: 0x8B0000 });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.position.y = 1;
        body.castShadow = true;
        enemy.add(body);
        
        // Head
        const headGeometry = new THREE.SphereGeometry(0.3, 8, 6);
        const headMaterial = new THREE.MeshLambertMaterial({ color: 0xFFDBB3 });
        const head = new THREE.Mesh(headGeometry, headMaterial);
        head.position.y = 2;
        head.castShadow = true;
        enemy.add(head);
        
        // Arms
        const armGeometry = new THREE.CapsuleGeometry(0.15, 0.8, 4, 8);
        const armMaterial = new THREE.MeshLambertMaterial({ color: 0xFFDBB3 });
        
        const leftArm = new THREE.Mesh(armGeometry, armMaterial);
        leftArm.position.set(-0.7, 1.2, 0);
        leftArm.rotation.z = Math.PI / 6;
        leftArm.castShadow = true;
        enemy.add(leftArm);
        
        const rightArm = new THREE.Mesh(armGeometry, armMaterial);
        rightArm.position.set(0.7, 1.2, 0);
        rightArm.rotation.z = -Math.PI / 6;
        rightArm.castShadow = true;
        enemy.add(rightArm);
        
        // Legs
        const legGeometry = new THREE.CapsuleGeometry(0.2, 0.9, 4, 8);
        const legMaterial = new THREE.MeshLambertMaterial({ color: 0x4169E1 });
        
        const leftLeg = new THREE.Mesh(legGeometry, legMaterial);
        leftLeg.position.set(-0.3, 0.5, 0);
        leftLeg.castShadow = true;
        enemy.add(leftLeg);
        
        const rightLeg = new THREE.Mesh(legGeometry, legMaterial);
        rightLeg.position.set(0.3, 0.5, 0);
        rightLeg.castShadow = true;
        enemy.add(rightLeg);
        
        // Position enemy randomly
        const angle = Math.random() * Math.PI * 2;
        const distance = 30 + Math.random() * 40;
        enemy.position.set(
            Math.cos(angle) * distance,
            0,
            Math.sin(angle) * distance
        );
        
        // Enemy properties
        enemy.userData = {
            health: 100,
            speed: this.enemySpeed + Math.random() * 5,
            bodyParts: {
                body: body,
                head: head,
                leftArm: leftArm,
                rightArm: rightArm,
                leftLeg: leftLeg,
                rightLeg: rightLeg
            },
            dismembered: [],
            isDead: false
        };
        
        return enemy;
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