import * as THREE from 'three';

export class Player {
    constructor(camera) {
        this.camera = camera;
        this.velocity = new THREE.Vector3();
        this.direction = new THREE.Vector3();
        this.moveSpeed = 15;
        this.mouseSensitivity = 0.002;
        
        this.keys = {
            forward: false,
            backward: false,
            left: false,
            right: false,
            shift: false
        };
        
        this.euler = new THREE.Euler(0, 0, 0, 'YXZ');
        this.controlsEnabled = false;
        
        this.setupEventListeners();
    }
    

    
    onKeyDown(event) {
        switch (event.code) {
            case 'KeyW': this.keys.forward = true; break;
            case 'KeyS': this.keys.backward = true; break;
            case 'KeyA': this.keys.left = true; break;
            case 'KeyD': this.keys.right = true; break;
            case 'ShiftLeft': this.keys.shift = true; break;
        }
    }
    
    onKeyUp(event) {
        switch (event.code) {
            case 'KeyW': this.keys.forward = false; break;
            case 'KeyS': this.keys.backward = false; break;
            case 'KeyA': this.keys.left = false; break;
            case 'KeyD': this.keys.right = false; break;
            case 'ShiftLeft': this.keys.shift = false; break;
        }
    }
    
    onMouseMove(event) {
        if (!this.controlsEnabled) return;
        
        const movementX = event.movementX || 0;
        const movementY = event.movementY || 0;
        
        this.euler.setFromQuaternion(this.camera.quaternion);
        this.euler.y -= movementX * this.mouseSensitivity;
        this.euler.x -= movementY * this.mouseSensitivity;
        
        // Limit vertical look
        this.euler.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.euler.x));
        
        this.camera.quaternion.setFromEuler(this.euler);
    }
    
    update(deltaTime) {
        if (!this.controlsEnabled) return;
        
        const speed = this.keys.shift ? this.moveSpeed * 2 : this.moveSpeed;
        
        this.velocity.x = 0;
        this.velocity.z = 0;
        
        this.direction.z = Number(this.keys.forward) - Number(this.keys.backward); // W-S
        this.direction.x = Number(this.keys.right) - Number(this.keys.left);    // D-A
        this.direction.z = -this.direction.z; // Invert Z for correct forward/backward
        this.direction.x = -this.direction.x; // Invert X for correct left/right strafing
        this.direction.normalize();
        
        if (this.keys.forward || this.keys.backward) {
            this.velocity.add(this.getForwardVector().multiplyScalar(this.direction.z * speed * deltaTime));
        }
        
        if (this.keys.left || this.keys.right) {
            this.velocity.add(this.getSideVector().multiplyScalar(this.direction.x * speed * deltaTime));
        }
        
        this.camera.position.add(this.velocity);
        
        // Keep player above ground
        this.camera.position.y = Math.max(1.8, this.camera.position.y);
        
        // Boundary limits
        this.camera.position.x = Math.max(-95, Math.min(95, this.camera.position.x));
        this.camera.position.z = Math.max(-95, Math.min(95, this.camera.position.z));
    }
    
    getForwardVector() {
        this.camera.getWorldDirection(this.direction);
        this.direction.y = 0;
        this.direction.normalize();
        return this.direction;
    }
    
    getSideVector() {
        this.camera.getWorldDirection(this.direction);
        this.direction.y = 0;
        this.direction.normalize();
        this.direction.cross(this.camera.up);
        return this.direction;
    }
    
    enableControls() {
        this.controlsEnabled = true;
    }
    
    disableControls() {
        this.controlsEnabled = false;
    }
}