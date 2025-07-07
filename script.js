const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Responsive canvas sizing
function resizeCanvas() {
    const container = canvas.parentElement;
    const maxWidth = Math.min(800, window.innerWidth - 40);
    const maxHeight = Math.min(600, window.innerHeight * 0.6);
    
    // Maintain aspect ratio
    const aspectRatio = 800 / 600;
    let newWidth, newHeight;
    
    if (maxWidth / maxHeight > aspectRatio) {
        newHeight = maxHeight;
        newWidth = newHeight * aspectRatio;
    } else {
        newWidth = maxWidth;
        newHeight = newWidth / aspectRatio;
    }
    
    canvas.style.width = newWidth + 'px';
    canvas.style.height = newHeight + 'px';
}

// Initialize canvas size
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// Game state
let gameRunning = false;
let score = 0;
let lives = 3;
let level = 1;
let keys = {};
let alienDirection = 1;
let lastAlienShot = 0;

// Mobile touch controls
let touchControls = {
    left: false,
    right: false,
    fire: false
};

// Audio context for sound effects
let audioContext;
let backgroundMusic;

// Touch event handlers
function setupMobileControls() {
    const leftBtn = document.getElementById('leftBtn');
    const rightBtn = document.getElementById('rightBtn');
    const fireBtn = document.getElementById('fireBtn');
    
    // Left button
    leftBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        touchControls.left = true;
    });
    leftBtn.addEventListener('touchend', () => {
        touchControls.left = false;
    });
    
    // Right button
    rightBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        touchControls.right = true;
    });
    rightBtn.addEventListener('touchend', () => {
        touchControls.right = false;
    });
    
    // Fire button
    fireBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (gameRunning) {
            shoot();
        }
    });
    
    // Prevent context menu on long press
    document.addEventListener('contextmenu', (e) => {
        e.preventDefault();
    });
}

// Instructions toggle
function toggleInstructions() {
    const instructions = document.getElementById('instructions');
    instructions.style.display = instructions.style.display === 'none' ? 'block' : 'none';
}

document.getElementById('instructionsToggle').addEventListener('click', toggleInstructions);
document.getElementById('closeInstructions').addEventListener('click', toggleInstructions);

// Initialize audio
function initAudio() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
}

// Sound effects
function playShootSound() {
    if (!audioContext) return;
    
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(200, audioContext.currentTime + 0.1);
    
    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.1);
}

function playAlienHitSound() {
    if (!audioContext) return;
    
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.setValueAtTime(150, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(50, audioContext.currentTime + 0.3);
    
    gainNode.gain.setValueAtTime(0.15, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
}

function startBackgroundMusic() {
    if (!audioContext || backgroundMusic) return;
    
    const oscillator1 = audioContext.createOscillator();
    const oscillator2 = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator1.connect(gainNode);
    oscillator2.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator1.frequency.setValueAtTime(220, audioContext.currentTime);
    oscillator2.frequency.setValueAtTime(330, audioContext.currentTime);
    
    gainNode.gain.setValueAtTime(0.03, audioContext.currentTime);
    
    oscillator1.start();
    oscillator2.start();
    
    backgroundMusic = { osc1: oscillator1, osc2: oscillator2, gain: gainNode };
    
    const notes = [220, 247, 262, 294, 330, 294, 262, 247];
    let noteIndex = 0;
    
    setInterval(() => {
        if (gameRunning && backgroundMusic) {
            oscillator1.frequency.setValueAtTime(notes[noteIndex], audioContext.currentTime);
            oscillator2.frequency.setValueAtTime(notes[noteIndex] * 1.5, audioContext.currentTime);
            noteIndex = (noteIndex + 1) % notes.length;
        }
    }, 800);
}

function stopBackgroundMusic() {
    if (backgroundMusic) {
        backgroundMusic.osc1.stop();
        backgroundMusic.osc2.stop();
        backgroundMusic = null;
    }
}

// Game objects
let player = {
    x: 375,
    y: 520,
    width: 50,
    height: 30,
    speed: 5,
    shielded: false
};

let bullets = [];
let aliens = [];
let alienBullets = [];
let powerUps = [];
const POWER_UP_DURATION = 10000; // 10 seconds
let activePowerUp = null;
let powerUpEndTime = 0;

const BULLET_SPEED = 7;
const ALIEN_BULLET_SPEED = 3;
let ALIEN_SPEED = 1;
const ALIEN_DROP_SPEED = 20;

// Power-up types
const POWER_UP_TYPES = [
    { type: "doubleBullets", color: "#00ffff", effect: "Shoot two bullets at once" },
    { type: "shield", color: "#ffff00", effect: "Temporary invincibility" }
];

function createAliens() {
    aliens = [];
    const alienTypes = [
        { color: '#ff0000', points: 10, width: 40, height: 30 },
        { color: '#ff8800', points: 20, width: 45, height: 35 },
        { color: '#ff00ff', points: 30, width: 50, height: 40 }
    ];
    
    for (let row = 0; row < 5; row++) {
        for (let col = 0; col < 10; col++) {
            let alienType = 0;
            
            if (level >= 3 && row < 2) {
                alienType = 2;
            } else if (level >= 2 && row < 3) {
                alienType = 1;
            }
            
            const type = alienTypes[alienType];
            aliens.push({
                x: 100 + col * 60,
                y: 50 + row * 50,
                width: type.width,
                height: type.height,
                alive: true,
                type: alienType,
                color: type.color,
                points: type.points
            });
        }
    }
    alienDirection = 1;
}

// Spawn power-ups randomly
function spawnPowerUp() {
    if (Math.random() < 0.1) { // 10% chance to spawn a power-up
        powerUps.push({
            x: Math.random() * (canvas.width - 30),
            y: 0,
            width: 30,
            height: 30,
            type: POWER_UP_TYPES[Math.floor(Math.random() * POWER_UP_TYPES.length)]
        });
    }
}

// Apply power-up effect
function applyPowerUp(powerUp) {
    activePowerUp = powerUp.type;
    powerUpEndTime = Date.now() + POWER_UP_DURATION;

    if (powerUp.type === "shield") {
        player.shielded = true;
    }
}

// Update power-ups
function updatePowerUps() {
    for (let i = powerUps.length - 1; i >= 0; i--) {
        powerUps[i].y += 2; // Move power-ups down
        if (powerUps[i].y > canvas.height) {
            powerUps.splice(i, 1); // Remove power-up if it goes off-screen
        } else if (checkCollision(powerUps[i], player)) {
            applyPowerUp(powerUps[i].type);
            powerUps.splice(i, 1); // Remove power-up after collection
        }
    }

    // Handle active power-up expiration
    if (activePowerUp && Date.now() > powerUpEndTime) {
        if (activePowerUp === "shield") {
            player.shielded = false;
        }
        activePowerUp = null;
    }
}

// Input handling
document.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    
    if (e.code === 'Space' && gameRunning) {
        e.preventDefault();
        shoot();
    }
});

document.addEventListener('keyup', (e) => {
    keys[e.code] = false;
});

// Modify bullet shooting for double bullets
function shoot() {
    if (bullets.length < 3) {
        bullets.push({
            x: player.x + player.width / 2 - 2,
            y: player.y,
            width: 4,
            height: 10
        });
        if (activePowerUp === "doubleBullets") {
            bullets.push({
                x: player.x + player.width / 2 + 10,
                y: player.y,
                width: 4,
                height: 10
            });
        }
        playShootSound();
    }
}

function alienShoot() {
    const now = Date.now();
    if (now - lastAlienShot > 1000) {
        const aliveAliens = aliens.filter(alien => alien.alive);
        if (aliveAliens.length > 0 && Math.random() < 0.3) {
            const alien = aliveAliens[Math.floor(Math.random() * aliveAliens.length)];
            alienBullets.push({
                x: alien.x + alien.width / 2 - 2,
                y: alien.y + alien.height,
                width: 4,
                height: 10
            });
            lastAlienShot = now;
        }
    }
}

function checkCollision(rect1, rect2) {
    return rect1.x < rect2.x + rect2.width &&
           rect1.x + rect1.width > rect2.x &&
           rect1.y < rect2.y + rect2.height &&
           rect1.y + rect1.height > rect2.y;
}

function update() {
    if (!gameRunning) return;
    
    // Move player (keyboard or touch)
    if ((keys['ArrowLeft'] || touchControls.left) && player.x > 0) {
        player.x -= player.speed;
    }
    if ((keys['ArrowRight'] || touchControls.right) && player.x < canvas.width - player.width) {
        player.x += player.speed;
    }
    
    // Update bullets
    for (let i = bullets.length - 1; i >= 0; i--) {
        bullets[i].y -= BULLET_SPEED;
        if (bullets[i].y < 0) {
            bullets.splice(i, 1);
        }
    }
    
    // Update alien bullets
    for (let i = alienBullets.length - 1; i >= 0; i--) {
        alienBullets[i].y += ALIEN_BULLET_SPEED;
        if (alienBullets[i].y > canvas.height) {
            alienBullets.splice(i, 1);
        }
    }
    
    // Move aliens
    const aliveAliens = aliens.filter(alien => alien.alive);
    
    if (aliveAliens.length > 0) {
        let shouldDrop = false;
        for (let alien of aliveAliens) {
            if ((alien.x <= 0 && alienDirection < 0) || 
                (alien.x + alien.width >= canvas.width && alienDirection > 0)) {
                shouldDrop = true;
                break;
            }
        }
        
        if (shouldDrop) {
            alienDirection *= -1;
            for (let alien of aliens) {
                if (alien.alive) {
                    alien.y += ALIEN_DROP_SPEED;
                }
            }
        } else {
            for (let alien of aliens) {
                if (alien.alive) {
                    alien.x += ALIEN_SPEED * alienDirection;
                }
            }
        }
    }
    
    // Check collisions: player bullets vs aliens
    for (let i = bullets.length - 1; i >= 0; i--) {
        for (let j = 0; j < aliens.length; j++) {
            if (aliens[j].alive && checkCollision(bullets[i], aliens[j])) {
                aliens[j].alive = false;
                bullets.splice(i, 1);
                score += aliens[j].points;
                updateScore();
                playAlienHitSound();
                break;
            }
        }
    }
    
    // Check collisions: alien bullets vs player
    for (let i = alienBullets.length - 1; i >= 0; i--) {
        if (checkCollision(alienBullets[i], player)) {
            if (!player.shielded) {
                alienBullets.splice(i, 1);
                lives--;
                updateLives();

                if (lives <= 0) {
                    gameOver();
                    return;
                }
            } else {
                alienBullets.splice(i, 1); // Shield absorbs the hit
            }
        }
    }
    
    // Check if aliens reached bottom
    for (let alien of aliens) {
        if (alien.alive && alien.y + alien.height >= player.y - 10) {
            gameOver();
            return;
        }
    }
    
    // Check if all aliens destroyed
    if (aliveAliens.length === 0) {
        setTimeout(() => {
            if (gameRunning) {
                level++;
                updateLevel();
                createAliens();
                ALIEN_SPEED = Math.min(ALIEN_SPEED + 0.5, 3);
            }
        }, 1000);
    }
    
    // Update power-ups
    updatePowerUps();

    alienShoot();
}

// Render power-ups
function renderPowerUps() {
    for (let powerUp of powerUps) {
        ctx.fillStyle = powerUp.type.color;
        ctx.fillRect(powerUp.x, powerUp.y, powerUp.width, powerUp.height);
        ctx.strokeStyle = "#ffffff";
        ctx.strokeRect(powerUp.x, powerUp.y, powerUp.width, powerUp.height);
    }
}

// Modify player rendering for shield effect
function renderPlayer() {
    ctx.fillStyle = player.shielded ? "#00ffff" : "#00ff00";
    ctx.fillRect(player.x, player.y, player.width, player.height);
    ctx.strokeStyle = "#ffffff";
    ctx.strokeRect(player.x, player.y, player.width, player.height);
}

function render() {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Render player
    renderPlayer();
    
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.strokeRect(player.x, player.y, player.width, player.height);
    
    if (!gameRunning) return;
    
    ctx.fillStyle = '#ffff00';
    for (let bullet of bullets) {
        ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
    }
    
    for (let alien of aliens) {
        if (alien.alive) {
            ctx.fillStyle = alien.color;
            
            if (alien.type === 0) {
                ctx.fillRect(alien.x, alien.y, alien.width, alien.height);
            } else if (alien.type === 1) {
                ctx.beginPath();
                ctx.roundRect(alien.x, alien.y, alien.width, alien.height, 5);
                ctx.fill();
            } else if (alien.type === 2) {
                ctx.beginPath();
                ctx.moveTo(alien.x + alien.width / 2, alien.y);
                ctx.lineTo(alien.x + alien.width, alien.y + alien.height / 2);
                ctx.lineTo(alien.x + alien.width / 2, alien.y + alien.height);
                ctx.lineTo(alien.x, alien.y + alien.height / 2);
                ctx.closePath();
                ctx.fill();
            }
            
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1;
            if (alien.type === 2) {
                ctx.beginPath();
                ctx.moveTo(alien.x + alien.width / 2, alien.y);
                ctx.lineTo(alien.x + alien.width, alien.y + alien.height / 2);
                ctx.lineTo(alien.x + alien.width / 2, alien.y + alien.height);
                ctx.lineTo(alien.x, alien.y + alien.height / 2);
                ctx.closePath();
                ctx.stroke();
            } else {
                ctx.strokeRect(alien.x, alien.y, alien.width, alien.height);
            }
        }
    }
    
    ctx.fillStyle = '#ff00ff';
    for (let bullet of alienBullets) {
        ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
    }

    // Render power-ups
    renderPowerUps();
}

function gameLoop() {
    update();
    render();
    if (Math.random() < 0.01) { // Random chance to spawn a power-up
        spawnPowerUp();
    }
    requestAnimationFrame(gameLoop);
}

function updateScore() {
    document.getElementById('score').textContent = score;
}

function updateLives() {
    document.getElementById('lives').textContent = lives;
}


function updateLevel() {
    document.getElementById('level').textContent = level;
    lives++; // Add one life when a level is passed
    updateLives();
}


function gameOver() {
    gameRunning = false;
    stopBackgroundMusic();
    document.getElementById('finalScore').textContent = score;
    document.getElementById('gameOverScreen').style.display = 'block';
}

function startNewGame() {
    initAudio();
    
    gameRunning = true;
    score = 0;
    lives = 3;
    level = 1;
    bullets = [];
    alienBullets = [];
    powerUps = [];
    player.x = 375;
    player.y = 520;
    alienDirection = 1;
    lastAlienShot = 0;
    ALIEN_SPEED = 1;
    activePowerUp = null;
    powerUpEndTime = 0;
    
    createAliens();
    updateScore();
    updateLives();
    updateLevel();
    
    startBackgroundMusic();
    
    document.getElementById('gameOverScreen').style.display = 'none';
}

// Initialize
setupMobileControls();
createAliens();
startNewGame();
gameLoop();

