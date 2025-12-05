import * as THREE from 'three';

export class ParticleSystem {
    constructor(scene) {
        this.scene = scene;
        this.particles = [];
        this.sparksEffects = []; // Renamed from bloodSplatters
        this.debrisEffects = []; // Renamed from goreEffects
        this.smokeEffects = []; // New array for smoke effects
    }
    
    createSparksEffect(position) {
        const particleCount = 20;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        const velocities = [];
        
        for (let i = 0; i < particleCount; i++) {
            const i3 = i * 3;
            positions[i3] = position.x;
            positions[i3 + 1] = position.y;
            positions[i3 + 2] = position.z;
            
            velocities.push(new THREE.Vector3(
                (Math.random() - 0.5) * 10,
                Math.random() * 8 + 2,
                (Math.random() - 0.5) * 10
            ));
        }
        
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        
        const material = new THREE.PointsMaterial({
            color: 0xffffaa, // Yellowish-white for sparks
            size: 0.1,
            transparent: true,
            opacity: 1.0
        });
        
        const particles = new THREE.Points(geometry, material);
        this.scene.add(particles);
        
        const splatter = { // Rename this locally to sparks
            particles: particles,
            velocities: velocities,
            life: 1.0,
            maxLife: 1.0
        };
        
        this.bloodSplatters.push(splatter);
    }
    
    createDebrisEffect(position, enemy) {
        // Create metallic debris chunks
        for (let i = 0; i < 8; i++) {
            const chunkGeometry = Math.random() < 0.5 ? new THREE.BoxGeometry(0.1 + Math.random() * 0.1, 0.1 + Math.random() * 0.1, 0.1 + Math.random() * 0.1) : new THREE.CylinderGeometry(0.05 + Math.random() * 0.05, 0.05 + Math.random() * 0.05, 0.2 + Math.random() * 0.2, 8);
            const chunkMaterial = new THREE.MeshStandardMaterial({ 
                color: 0x888888, 
                metalness: 0.9, 
                roughness: 0.5 
            });
            const chunk = new THREE.Mesh(chunkGeometry, chunkMaterial);
            
            chunk.position.copy(position);
            chunk.position.add(new THREE.Vector3(
                (Math.random() - 0.5) * 0.5,
                (Math.random() - 0.5) * 0.5,
                (Math.random() - 0.5) * 0.5
            ));
            
            this.scene.add(chunk);
            
            const debris = {
                mesh: chunk,
                velocity: new THREE.Vector3(
                    (Math.random() - 0.5) * 15,
                    Math.random() * 10 + 5,
                    (Math.random() - 0.5) * 15
                ),
                angularVelocity: new THREE.Vector3(
                    (Math.random() - 0.5) * 20,
                    (Math.random() - 0.5) * 20,
                    (Math.random() - 0.5) * 20
                ),
                life: 3.0
            };
            
            this.goreEffects.push(debris); // Will rename goreEffects later
        }
        
        // Create sparks
        this.createSparksEffect(position);
    }
    
    createSmokeEffect(position) {
        const sprayCount = 50;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(sprayCount * 3);
        const velocities = [];
        
        for (let i = 0; i < sprayCount; i++) {
            const i3 = i * 3;
            positions[i3] = position.x;
            positions[i3 + 1] = position.y;
            positions[i3 + 2] = position.z;
            
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 20 + 5;
            const elevation = (Math.random() - 0.5) * Math.PI * 0.5;
            
            velocities.push(new THREE.Vector3(
                Math.cos(angle) * Math.cos(elevation) * speed,
                Math.sin(elevation) * speed + Math.random() * 5,
                Math.sin(angle) * Math.cos(elevation) * speed
            ));
        }
        
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        
        const material = new THREE.PointsMaterial({
            color: 0x333333, // Dark grey/black for smoke
            size: 0.05,
            transparent: true,
            opacity: 0.8
        });
        
        const spray = new THREE.Points(geometry, material);
        this.scene.add(spray);
        
        const smoke = { // Renamed locally to smoke
            particles: spray,
            velocities: velocities,
            life: 2.0,
            maxLife: 2.0
        };
        
        this.smokeEffects.push(smoke);
    }
    
    createExplosion(position) {
        // Explosion particles
        const particleCount = 100;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        const velocities = [];
        
        for (let i = 0; i < particleCount; i++) {
            const i3 = i * 3;
            positions[i3] = position.x;
            positions[i3 + 1] = position.y;
            positions[i3 + 2] = position.z;
            
            velocities.push(new THREE.Vector3(
                (Math.random() - 0.5) * 30,
                Math.random() * 20 + 10,
                (Math.random() - 0.5) * 30
            ));
        }
        
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        
        const material = new THREE.PointsMaterial({
            color: 0xff4400,
            size: 0.2,
            transparent: true,
            opacity: 1.0
        });
        
        const explosion = new THREE.Points(geometry, material);
        this.scene.add(explosion);
        
        const effect = {
            particles: explosion,
            velocities: velocities,
            life: 1.5,
            maxLife: 1.5
        };
        
        this.particles.push(effect);
    }
    
    update(deltaTime) {
        // Update blood splatters
        this.sparksEffects = this.sparksEffects.filter(splatter => {
            splatter.life -= deltaTime;
            
            const positions = splatter.particles.geometry.attributes.position.array;
            
            for (let i = 0; i < splatter.velocities.length; i++) {
                const i3 = i * 3;
                
                // Apply gravity
                splatter.velocities[i].y -= 20 * deltaTime;
                
                // Update positions
                positions[i3] += splatter.velocities[i].x * deltaTime;
                positions[i3 + 1] += splatter.velocities[i].y * deltaTime;
                positions[i3 + 2] += splatter.velocities[i].z * deltaTime;
                
                // Ground collision
                if (positions[i3 + 1] < 0) {
                    positions[i3 + 1] = 0;
                    splatter.velocities[i].y = 0;
                    splatter.velocities[i].x *= 0.5;
                    splatter.velocities[i].z *= 0.5;
                }
            }
            
            splatter.particles.geometry.attributes.position.needsUpdate = true;
            splatter.particles.material.opacity = splatter.life / splatter.maxLife;
            
            if (splatter.life <= 0) {
                this.scene.remove(splatter.particles);
                return false;
            }
            
            return true;
        });
        
        // Update gore effects
        this.debrisEffects = this.debrisEffects.filter(debris => {
            debris.life -= deltaTime;
            
            // Apply physics
            debris.velocity.y -= 20 * deltaTime; // gravity
            debris.mesh.position.add(debris.velocity.clone().multiplyScalar(deltaTime));
            
            // Rotation
            debris.mesh.rotation.x += debris.angularVelocity.x * deltaTime;
            debris.mesh.rotation.y += debris.angularVelocity.y * deltaTime;
            debris.mesh.rotation.z += debris.angularVelocity.z * deltaTime;
            
            // Ground collision
            if (debris.mesh.position.y < 0) {
                debris.mesh.position.y = 0;
                debris.velocity.y = 0;
                debris.velocity.multiplyScalar(0.3);
                debris.angularVelocity.multiplyScalar(0.5);
            }
            
            // Fade out
            debris.mesh.material.opacity = Math.max(0, debris.life / 3.0);
            
            if (debris.life <= 0) {
                this.scene.remove(debris.mesh);
                return false;
            }
            
            return true;
        });
        
        // Update smoke effects
        this.smokeEffects = this.smokeEffects.filter(smoke => {
            smoke.life -= deltaTime;
            
            const positions = smoke.particles.geometry.attributes.position.array;
            
            for (let i = 0; i < smoke.velocities.length; i++) {
                const i3 = i * 3;
                
                // Apply gravity
                smoke.velocities[i].y -= 10 * deltaTime; // Slightly less gravity for smoke
                
                // Update positions
                positions[i3] += smoke.velocities[i].x * deltaTime;
                positions[i3 + 1] += smoke.velocities[i].y * deltaTime;
                positions[i3 + 2] += smoke.velocities[i].z * deltaTime;
            }
            
            smoke.particles.geometry.attributes.position.needsUpdate = true;
            smoke.particles.material.opacity = smoke.life / smoke.maxLife;
            
            if (smoke.life <= 0) {
                this.scene.remove(smoke.particles);
                return false;
            }
            
            return true;
        });
        
        // Update other particles
        this.particles = this.particles.filter(particle => {
            particle.life -= deltaTime;
            
            const positions = particle.particles.geometry.attributes.position.array;
            
            for (let i = 0; i < particle.velocities.length; i++) {
                const i3 = i * 3;
                
                positions[i3] += particle.velocities[i].x * deltaTime;
                positions[i3 + 1] += particle.velocities[i].y * deltaTime;
                positions[i3 + 2] += particle.velocities[i].z * deltaTime;
                
                particle.velocities[i].y -= 10 * deltaTime;
            }
            
            particle.particles.geometry.attributes.position.needsUpdate = true;
            particle.particles.material.opacity = particle.life / particle.maxLife;
            
            if (particle.life <= 0) {
                this.scene.remove(particle.particles);
                return false;
            }
            
            return true;
        });
    }
}