import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export class Player {
    constructor(camera, playerBody) {
        this.camera = camera;
        this.playerBody = playerBody;
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
    
    setupEventListeners() {
        document.addEventListener('keydown', (event) => this.onKeyDown(event));
        document.addEventListener('keyup', (event) => this.onKeyUp(event));
        document.addEventListener('mousemove', (event) => this.onMouseMove(event));
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
        
        // Apply forces to playerBody
        const inputVelocity = new CANNON.Vec3(0, 0, 0);

        const forwardVector = new THREE.Vector3();
        this.camera.getWorldDirection(forwardVector);
        forwardVector.y = 0;
        forwardVector.normalize();

        const sideVector = new THREE.Vector3();
        sideVector.crossVectors(this.camera.up, forwardVector);
        sideVector.normalize();

        if (this.keys.forward) {
            const forward = new CANNON.Vec3(-forwardVector.x * speed, 0, -forwardVector.z * speed);
            inputVelocity.vadd(forward);
        }
        if (this.keys.backward) {
            const backward = new CANNON.Vec3(forwardVector.x * speed, 0, forwardVector.z * speed);
            inputVelocity.vadd(backward);
        }
        if (this.keys.left) {
            const left = new CANNON.Vec3(sideVector.x * speed, 0, sideVector.z * speed);
            inputVelocity.vadd(left);
        }
        if (this.keys.right) {
            const right = new CANNON.Vec3(-sideVector.x * speed, 0, -sideVector.z * speed);
            inputVelocity.vadd(right);
        }

        this.playerBody.velocity.x = inputVelocity.x;
        this.playerBody.velocity.z = inputVelocity.z;
        
        // Synchronize camera with physics body
        this.camera.position.copy(this.playerBody.position);
        this.camera.position.y += 0.8; // Adjust camera height relative to body
        
        // Keep player above ground, using physics now
        // this.camera.position.y = Math.max(1.8, this.camera.position.y);
        
        // Boundary limits (handled by physics world boundaries now)
        // this.camera.position.x = Math.max(-95, Math.min(95, this.camera.position.x));
        // this.camera.position.z = Math.max(-95, Math.min(95, this.camera.position.z));
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