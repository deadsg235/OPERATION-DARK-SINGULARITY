import * as THREE from 'three';
import { Game } from './Game.js';

let game;

window.startGame = function() {
    document.getElementById('menu').style.display = 'none';
    game = new Game();
    game.init();
    game.start();
    
    // Request pointer lock for FPS controls
    document.body.requestPointerLock();
};

// Handle pointer lock
document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement === document.body) {
        if (game) game.enableControls();
    } else {
        if (game) game.disableControls();
    }
});

// Handle window resize
window.addEventListener('resize', () => {
    if (game) game.onWindowResize();
});