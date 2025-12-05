import * as THREE from 'three';

export class ParticleSystem {
    constructor(scene) {
        this.scene = scene;
        this.particles = [];
        this.bloodSplatters = [];
        this.goreEffects = [];
    }
    
    createBloodSplatter(position) {
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
            color: 0x8B0000,
            size: 0.1,
            transparent: true,
            opacity: 1.0
        });
        
        const particles = new THREE.Points(geometry, material);
        this.scene.add(particles);
        
        const splatter = {
            particles: particles,
            velocities: velocities,
            life: 1.0,
            maxLife: 1.0
        };
        
        this.bloodSplatters.push(splatter);
    }
    
    createGoreEffect(position, enemy) {
        // Create meat chunks
        for (let i = 0; i < 8; i++) {
            const chunkGeometry = new THREE.SphereGeometry(0.05 + Math.random() * 0.1, 4, 3);
            const chunkMaterial = new THREE.MeshLambertMaterial({ 
                color: new THREE.Color().setHSL(0, 0.8, 0.2 + Math.random() * 0.3)
            });
            const chunk = new THREE.Mesh(chunkGeometry, chunkMaterial);
            
            chunk.position.copy(position);
            chunk.position.add(new THREE.Vector3(
                (Math.random() - 0.5) * 0.5,
                (Math.random() - 0.5) * 0.5,
                (Math.random() - 0.5) * 0.5
            ));
            
            this.scene.add(chunk);
            
            const gore = {
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
            
            this.goreEffects.push(gore);
        }
        
        // Create blood spray
        this.createBloodSpray(position);
    }
    
    createBloodSpray(position) {
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
            color: 0x660000,
            size: 0.05,
            transparent: true,
            opacity: 0.8
        });
        
        const spray = new THREE.Points(geometry, material);
        this.scene.add(spray);
        
        const bloodSpray = {
            particles: spray,
            velocities: velocities,
            life: 2.0,
            maxLife: 2.0
        };
        
        this.bloodSplatters.push(bloodSpray);
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
        this.bloodSplatters = this.bloodSplatters.filter(splatter => {
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
        this.goreEffects = this.goreEffects.filter(gore => {
            gore.life -= deltaTime;
            
            // Apply physics
            gore.velocity.y -= 20 * deltaTime; // gravity
            gore.mesh.position.add(gore.velocity.clone().multiplyScalar(deltaTime));
            
            // Rotation
            gore.mesh.rotation.x += gore.angularVelocity.x * deltaTime;
            gore.mesh.rotation.y += gore.angularVelocity.y * deltaTime;
            gore.mesh.rotation.z += gore.angularVelocity.z * deltaTime;
            
            // Ground collision
            if (gore.mesh.position.y < 0) {
                gore.mesh.position.y = 0;
                gore.velocity.y = 0;
                gore.velocity.multiplyScalar(0.3);
                gore.angularVelocity.multiplyScalar(0.5);
            }
            
            // Fade out
            gore.mesh.material.opacity = Math.max(0, gore.life / 3.0);
            
            if (gore.life <= 0) {
                this.scene.remove(gore.mesh);
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