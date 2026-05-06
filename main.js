let game;
let poseController;

// UI Elements
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const hud = document.getElementById('hud');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const scoreEl = document.getElementById('score');
const speedEl = document.getElementById('speed');
const livesEl = document.getElementById('lives');
const finalScoreEl = document.getElementById('final-score');

// DOM Elements
const videoElement = document.getElementById('input_video');
const canvasElement = document.getElementById('output_canvas');

// Game Loop
let animationId;

function init() {
    // Initialize 3D Game
    game = new Game('game-container');
    
    // Initialize Pose Tracker
    poseController = new PoseController(
        videoElement, 
        canvasElement, 
        handlePoseEvent,
        () => {
            // Camera ready
            startBtn.textContent = 'START RUN';
            startBtn.disabled = false;
        }
    );

    startBtn.disabled = true;

    // Event Listeners
    startBtn.addEventListener('click', startGame);
    restartBtn.addEventListener('click', startGame);
    
    // Initial render loop for background
    requestAnimationFrame(renderBackground);
}

function renderBackground() {
    if (!game.isPlaying) {
        // Slowly move grid for effect
        if (game.roadGrid) {
            game.roadGrid.position.z += 0.05;
            if (game.roadGrid.position.z > 10) game.roadGrid.position.z = 0;
        }
        game.render();
        requestAnimationFrame(renderBackground);
    }
}

function handlePoseEvent(eventName) {
    if (!game.isPlaying) return;

    switch (eventName) {
        case 'jump':
            game.jump();
            break;
        case 'duck':
            game.duck();
            break;
        case 'leanLeft':
            game.setLane(-1);
            break;
        case 'leanRight':
            game.setLane(1);
            break;
        case 'leanCenter':
            game.setLane(0);
            break;
        case 'jog':
            game.jog();
            break;
        case 'idle':
            game.idle();
            break;
    }
}

function startGame() {
    startScreen.classList.remove('active');
    gameOverScreen.classList.remove('active');
    hud.classList.add('visible');
    
    game.start();
    livesEl.innerText = '3';
    scoreEl.innerText = '0';
    
    // Start main game loop
    if (animationId) cancelAnimationFrame(animationId);
    gameLoop();
}

function gameOver() {
    game.stop();
    cancelAnimationFrame(animationId);
    
    hud.classList.remove('visible');
    gameOverScreen.classList.add('active');
    finalScoreEl.innerText = Math.floor(game.score);
    
    requestAnimationFrame(renderBackground);
}

function gameLoop() {
    if (!game.isPlaying) return;

    // Update game logic
    game.update(
        (newScore) => { scoreEl.innerText = Math.floor(newScore); },
        () => { gameOver(); },
        (livesLeft) => { livesEl.innerText = livesLeft; }
    );
    
    // Update speed UI
    speedEl.innerText = (game.speed * 10).toFixed(1);

    // Gradually increase base speed to increase difficulty
    game.baseSpeed += 0.0001;
    
    game.render();
    
    animationId = requestAnimationFrame(gameLoop);
}

// Start application
init();
