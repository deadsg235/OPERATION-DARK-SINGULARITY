import * as THREE from 'three';
import { Game } from './Game.js';

let game;

window.startGame = function() {
    try {
        console.log('Starting game...');
        document.getElementById('menu').style.display = 'none';
        game = new Game();
        console.log('Game created');
        game.init();
        console.log('Game initialized');
        game.start();
        console.log('Game started');
    } catch (error) {
        console.error('Game start error:', error);
        alert('Error: ' + error.message);
    }
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