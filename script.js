// Estado do jogo
let gameState = {
    points: 0,
    currentHp: 25,
    maxHp: 25,
    healPerClick: 0.1,
    pointsPerClick: 0,
    damagePerClick: 1,
    damagePerTick: 2,
    gameStartTime: Date.now(),
    isGameOver: false,

    // Sistema de inimigos
    enemies: [],
    nextEnemyId: 0,

    enemyTypes: {
        sword: {
            id: 'sword',
            name: 'Sword Enemy',
            image: 'sword_enemy.png',
            baseHealth: 3,
            damageAmount: 5,
            attackInterval: 3000, // 3s
            attackRange: 120, // raio em torno do cristal
            pointsOnDeath: 10,
            spawnStartMinute: 0,
            baseSpawnInterval: 10000, // ms
            healthIncreasePerMinute: 0.5,
            spawnIntervalDecreasePerMinute: 1000 // ms/min
        },
        bow: {
            id: 'bow',
            name: 'Bow Enemy',
            image: 'bow_enemy.png',
            baseHealth: 2.5,
            damageAmount: 2,
            attackInterval: 1500, // 1.5s
            attackRange: 200,
            pointsOnDeath: 15,
            spawnStartMinute: 2,
            baseSpawnInterval: 10000, // ms
            healthIncreasePerMinute: 0.25, // efetivado a cada 2 min via Math.floor
            spawnIntervalDecreasePerMinute: 1500 // ms/min
        }
    },

    currentEnemyHealth: {
        sword: 3,
        bow: 2.5
    },
    currentSpawnInterval: {
        sword: 10000,
        bow: 10000
    },
    maxEnemiesPerType: {
        sword: 4,
        bow: 4
    },
    lastSpawnTime: {
        sword: 0,
        bow: 0
    },

    // Upgrades
    upgrades: {
        maxHp: { level: 0, baseCost: 50, costMultiplier: 1.25, effect: 5 },
        healPower: { level: 0, baseCost: 60, costMultiplier: 1.25, effect: 0.1 },
        pointsPerClick: { level: 0, baseCost: 100, costMultiplier: 1.25, effect: 1 },
        damagePerClick: { level: 0, baseCost: 100, costMultiplier: 1.5, effect: 0.5 }
    }
};

// Elementos DOM
const elements = {
    crystal: document.getElementById("crystal"),
    clickEffect: document.getElementById("clickEffect"),
    points: document.getElementById("points"),
    time: document.getElementById("time"),
    currentHp: document.getElementById("currentHp"),
    maxHp: document.getElementById("maxHp"),
    healthFill: document.getElementById("healthFill"),
    damagePerTick: document.getElementById("damagePerTick"),
    damageTimer: document.getElementById("damageTimer"),
    gameOver: document.getElementById("gameOver"),
    finalTime: document.getElementById("finalTime"),
    finalPoints: document.getElementById("finalPoints"),
    enemiesContainer: document.getElementById("enemiesContainer"),
    toggleUpgrades: document.getElementById("toggleUpgrades"),
    toggleStats: document.getElementById("toggleStats"),
    toggleMusic: document.getElementById("toggleMusic"),
    upgradesSidebar: document.getElementById("upgradesSidebar"),
    statsSidebar: document.getElementById("statsSidebar"),
    closeUpgrades: document.getElementById("closeUpgrades"),
    closeStats: document.getElementById("closeStats"),
    backgroundMusic: document.getElementById("backgroundMusic"),
    maxHpLevel: document.getElementById("maxHpLevel"),
    maxHpCost: document.getElementById("maxHpCost"),
    buyMaxHp: document.getElementById("buyMaxHp"),
    healPowerLevel: document.getElementById("healPowerLevel"),
    healPowerCost: document.getElementById("healPowerCost"),
    buyHealPower: document.getElementById("buyHealPower"),
    pointsPerClickLevel: document.getElementById("pointsPerClickLevel"),
    pointsPerClickCost: document.getElementById("pointsPerClickCost"),
    buyPointsPerClick: document.getElementById("buyPointsPerClick"),
    damagePerClickLevel: document.getElementById("damagePerClickLevel"),
    damagePerClickCost: document.getElementById("damagePerClickCost"),
    buyDamagePerClick: document.getElementById("buyDamagePerClick"),
    statHealPerClick: document.getElementById("statHealPerClick"),
    statPointsPerClick: document.getElementById("statPointsPerClick"),
    statDamagePerClick: document.getElementById("statDamagePerClick"),
    statMaxHp: document.getElementById("statMaxHp"),
    statActiveEnemies: document.getElementById("statActiveEnemies"),
    statEnemyHealth: document.getElementById("statEnemyHealth"),
    statSpawnTime: document.getElementById("statSpawnTime")
};

// Timers
let damageTimer = 5;
let gameTimer = 0;
let lastMinuteUpdate = 0; // Adicionado para controlar a atualização por minuto

// Utilitário: garante número válido
function ensureNumber(n, fallback) {
    return Number.isFinite(n) ? n : fallback;
}

// Custo do upgrade
function getUpgradeCost(upgradeType) {
    const u = gameState.upgrades[upgradeType];
    return Math.floor(u.baseCost * Math.pow(u.costMultiplier, u.level));
}
function buyUpgrade(upgradeType) {
    const u = gameState.upgrades[upgradeType];
    const cost = getUpgradeCost(upgradeType);
    if (gameState.points >= cost) {
        gameState.points -= cost;
        u.level++;

        // Aplica os efeitos conforme o tipo
        if (upgradeType === 'maxHp') {
            gameState.maxHp += u.effect;
            gameState.currentHp += u.effect;
        } else if (upgradeType === 'healPower') {
            gameState.healPerClick += u.effect;
        } else if (upgradeType === 'pointsPerClick') {
            gameState.pointsPerClick += u.effect;
        } else if (upgradeType === 'damagePerClick') {
            gameState.damagePerClick += u.effect;
        }

        updateDisplay();
    }
}

// Posição alvo em torno do cristal
function getEnemyPosition(index, total, attackRange) {
    const crystalRect = elements.crystal.getBoundingClientRect();
    const containerRect = elements.enemiesContainer.getBoundingClientRect();
    const cx = (crystalRect.left - containerRect.left) + crystalRect.width / 2;
    const cy = (crystalRect.top - containerRect.top) + crystalRect.height / 2;
    const angle = (index / Math.max(1, total)) * 2 * Math.PI;
    const r = attackRange;
    return { x: cx + Math.cos(angle) * r - 30, y: cy + Math.sin(angle) * r - 30 };
}

// Criação de inimigo
function createEnemy(type) {
    const t = gameState.enemyTypes[type];
    const enemy = {
        id: gameState.nextEnemyId++,
        type,
        health: gameState.currentEnemyHealth[type],
        maxHealth: gameState.currentEnemyHealth[type],
        damageAmount: t.damageAmount,
        attackInterval: t.attackInterval,
        attackRange: t.attackRange,
        pointsOnDeath: t.pointsOnDeath,
        lastAttack: 0,
        hasArrived: false,
        element: null,
        x: 0, y: 0, targetX: 0, targetY: 0,
        speed: 150
    };

    const el = document.createElement("div");
    el.className = `enemy ${type}`;
    el.innerHTML = `
        <img src="${t.image}" alt="${t.name}">
        <div class="enemy-health">
            <div class="enemy-health-bar"><div class="enemy-health-fill"></div></div>
        </div>`;
    el.addEventListener("click", () => attackEnemy(enemy.id));
    enemy.element = el;
    enemy.healthFill = el.querySelector(".enemy-health-fill");

    // Spawn inicial mais longe
    const spawnDistance = 450;
    const rect = elements.enemiesContainer.getBoundingClientRect();
    const side = Math.floor(Math.random() * 4);
    if (side === 0) { enemy.x = -spawnDistance; enemy.y = Math.random() * rect.height; }
    else if (side === 1) { enemy.x = rect.width + spawnDistance; enemy.y = Math.random() * rect.height; }
    else if (side === 2) { enemy.x = Math.random() * rect.width; enemy.y = -spawnDistance; }
    else { enemy.x = Math.random() * rect.width; enemy.y = rect.height + spawnDistance; }

    el.style.left = enemy.x + "px";
    el.style.top = enemy.y + "px";
    el.style.animation = "enemySpawn 0.5s ease-out";

    elements.enemiesContainer.appendChild(el);
    gameState.enemies.push(enemy);

    moveEnemyToPosition(enemy);
    updateEnemyDisplay(enemy);
}

function moveEnemyToPosition(enemy) {
    const active = gameState.enemies.filter(e => e.element);
    const idx = active.indexOf(enemy);
    const pos = getEnemyPosition(idx, active.length, enemy.attackRange);
    enemy.targetX = pos.x; enemy.targetY = pos.y;
    function anim() {
        if (!enemy.element) return;
        const dx = enemy.targetX - enemy.x; const dy = enemy.targetY - enemy.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 2) { enemy.x = enemy.targetX; enemy.y = enemy.targetY; enemy.hasArrived = true; enemy.lastAttack = Date.now(); }
        else { const step = Math.min(dist, enemy.speed / 60); enemy.x += (dx / dist) * step; enemy.y += (dy / dist) * step; requestAnimationFrame(anim); }
        enemy.element.style.left = enemy.x + "px";
        enemy.element.style.top = enemy.y + "px";
    }
    requestAnimationFrame(anim);
}

function repositionAllEnemies() {
    gameState.enemies.forEach((enemy, index) => {
        if (enemy.element && enemy.hasArrived) {
            const pos = getEnemyPosition(index, gameState.enemies.length, enemy.attackRange);
            enemy.targetX = pos.x; enemy.targetY = pos.y;
            moveEnemyToPosition(enemy);
        }
    });
}

// Spawn por tipo usando lastSpawnTime separado
function spawnEnemy() {
    if (gameState.isGameOver) return;
    const now = Date.now();
    const minutes = Math.floor(gameTimer / 60);

    // Espada
    const swordType = gameState.enemyTypes.sword;
    const activeSwordEnemies = gameState.enemies.filter(e => e.type === 'sword').length;
    const swordInterval = ensureNumber(gameState.currentSpawnInterval.sword, swordType.baseSpawnInterval);
    if (now - gameState.lastSpawnTime.sword >= swordInterval) {
        if (activeSwordEnemies < gameState.maxEnemiesPerType.sword) {
            createEnemy('sword');
        }
        gameState.lastSpawnTime.sword = now; // Atualiza lastSpawnTime mesmo se não criar inimigo
    }

    // Arco (após minuto 2)
    const bowType = gameState.enemyTypes.bow;
    if (minutes >= bowType.spawnStartMinute) {
        const activeBowEnemies = gameState.enemies.filter(e => e.type === 'bow').length;
        const bowInterval = ensureNumber(gameState.currentSpawnInterval.bow, bowType.baseSpawnInterval);
        if (now - gameState.lastSpawnTime.bow >= bowInterval) {
            if (activeBowEnemies < gameState.maxEnemiesPerType.bow) {
                createEnemy('bow');
            }
            gameState.lastSpawnTime.bow = now; // Atualiza lastSpawnTime mesmo se não criar inimigo
        }
    }
}

function updateEnemyDisplay(enemy) {
    if (!enemy.element) return;
    const pct = (enemy.health / enemy.maxHealth) * 100;
    enemy.healthFill.style.width = Math.max(0, Math.min(100, pct)) + '%';
}

function attackEnemy(id) {
    if (gameState.isGameOver || gameState.damagePerClick === 0) return;
    const enemy = gameState.enemies.find(e => e.id === id);
    if (!enemy || !enemy.element) return;
    enemy.health -= gameState.damagePerClick;
    enemy.element.style.transform = 'scale(0.85)';
    setTimeout(() => { if (enemy.element) enemy.element.style.transform = 'scale(1)'; }, 120);
    if (enemy.health <= 0) { gameState.points += enemy.pointsOnDeath; removeEnemy(enemy.id); repositionAllEnemies(); }
    else { updateEnemyDisplay(enemy); }
    updateDisplay();
}

function removeEnemy(id) {
    const idx = gameState.enemies.findIndex(e => e.id === id);
    if (idx === -1) return;
    const enemy = gameState.enemies[idx];
    if (enemy.element) enemy.element.remove();
    gameState.enemies.splice(idx, 1);
}

function enemiesAttackCrystal() {
    if (gameState.isGameOver) return;
    const now = Date.now();
    gameState.enemies.forEach(enemy => {
        if (enemy.hasArrived && now - enemy.lastAttack >= enemy.attackInterval) {
            gameState.currentHp -= enemy.damageAmount;
            enemy.lastAttack = now;
            elements.crystal.style.filter = 'brightness(0.5)';
            setTimeout(() => { elements.crystal.style.filter = 'brightness(1)'; }, 200);
            if (gameState.currentHp <= 0) { gameState.currentHp = 0; gameOver(); return; }
        }
    });
}

// Atualizações por minuto, com clamps e fallback seguros
function updatePerMinuteMechanics() {
    const minutes = Math.floor(gameTimer / 60);

    // Garante que a atualização ocorra apenas uma vez por minuto
    if (minutes === lastMinuteUpdate) return;
    lastMinuteUpdate = minutes;

    // Espada
    const s = gameState.enemyTypes.sword;
    const swordHealth = s.baseHealth + (minutes * s.healthIncreasePerMinute);
    let swordInterval = s.baseSpawnInterval - (minutes * s.spawnIntervalDecreasePerMinute);
    swordInterval = Math.max(1500, swordInterval); // Mínimo de 1.5 segundos
    gameState.currentEnemyHealth.sword = ensureNumber(swordHealth, s.baseHealth);
    gameState.currentSpawnInterval.sword = ensureNumber(swordInterval, s.baseSpawnInterval);

    // Arco (vida cresce a cada 2 min)
    const b = gameState.enemyTypes.bow;
    if (minutes >= b.spawnStartMinute) {
        const bowHealth = b.baseHealth + (Math.floor(minutes / 2) * b.healthIncreasePerMinute);
        let bowInterval = b.baseSpawnInterval - (minutes * b.spawnIntervalDecreasePerMinute);
        bowInterval = Math.max(1000, bowInterval); // Mínimo de 1 segundo
        gameState.currentEnemyHealth.bow = ensureNumber(bowHealth, b.baseHealth);
        gameState.currentSpawnInterval.bow = ensureNumber(bowInterval, b.baseSpawnInterval);
    }

    // Aumenta capacidade maxima gradualmente até 8 por tipo
    // Isso pode ser ajustado para aumentar a cada minuto ou a cada X minutos
    // Por enquanto, mantido como estava, sem incremento automático aqui.
    // gameState.maxEnemiesPerType.sword = Math.min(8, gameState.maxEnemiesPerType.sword + 1);
    // gameState.maxEnemiesPerType.bow = Math.min(8, gameState.maxEnemiesPerType.bow + 1);
}

function updateDisplay() {
    elements.points.textContent = gameState.points;
    elements.currentHp.textContent = Math.ceil(gameState.currentHp);
    elements.maxHp.textContent = gameState.maxHp;
    elements.damagePerTick.textContent = gameState.damagePerTick;
    elements.damageTimer.textContent = damageTimer;

    const pct = (gameState.currentHp / gameState.maxHp) * 100;
    elements.healthFill.style.width = Math.max(0, Math.min(100, pct)) + '%';
    if (pct > 60) elements.healthFill.style.background = 'linear-gradient(90deg, #4ade80, #22c55e)';
    else if (pct > 30) elements.healthFill.style.background = 'linear-gradient(90deg, #fbbf24, #f59e0b)';
    else elements.healthFill.style.background = 'linear-gradient(90deg, #ef4444, #dc2626)';

    const min = Math.floor(gameTimer / 60); const sec = gameTimer % 60;
    elements.time.textContent = `${min}:${sec.toString().padStart(2,'0')}`;

    updateUpgradeDisplay();
    updateStatsDisplay();
}

function updateUpgradeDisplay() {
    elements.maxHpLevel.textContent = gameState.upgrades.maxHp.level;
    elements.maxHpCost.textContent = getUpgradeCost('maxHp');
    elements.buyMaxHp.disabled = gameState.points < getUpgradeCost('maxHp');

    elements.healPowerLevel.textContent = gameState.upgrades.healPower.level;
    elements.healPowerCost.textContent = getUpgradeCost('healPower');
    elements.buyHealPower.disabled = gameState.points < getUpgradeCost('healPower');

    elements.pointsPerClickLevel.textContent = gameState.upgrades.pointsPerClick.level;
    elements.pointsPerClickCost.textContent = getUpgradeCost('pointsPerClick');
    elements.buyPointsPerClick.disabled = gameState.points < getUpgradeCost('pointsPerClick');

    elements.damagePerClickLevel.textContent = gameState.upgrades.damagePerClick.level;
    elements.damagePerClickCost.textContent = getUpgradeCost('damagePerClick');
    elements.buyDamagePerClick.disabled = gameState.points < getUpgradeCost('damagePerClick');
}

function updateStatsDisplay() {
    elements.statHealPerClick.textContent = gameState.healPerClick.toFixed(1);
    elements.statPointsPerClick.textContent = gameState.pointsPerClick;
    elements.statDamagePerClick.textContent = gameState.damagePerClick.toFixed(1);
    elements.statMaxHp.textContent = gameState.maxHp;
    elements.statActiveEnemies.textContent = gameState.enemies.length;
    const ehS = ensureNumber(gameState.currentEnemyHealth.sword, gameState.enemyTypes.sword.baseHealth);
    const ehB = ensureNumber(gameState.currentEnemyHealth.bow, gameState.enemyTypes.bow.baseHealth);
    const siS = ensureNumber(gameState.currentSpawnInterval.sword, gameState.enemyTypes.sword.baseSpawnInterval);
    const siB = ensureNumber(gameState.currentSpawnInterval.bow, gameState.enemyTypes.bow.baseSpawnInterval);
    elements.statEnemyHealth.textContent = `${ehS.toFixed(1)} (Sword) / ${ehB.toFixed(1)} (Bow)`;
    elements.statSpawnTime.textContent = `${(siS/1000).toFixed(1)}s (Sword) / ${(siB/1000).toFixed(1)}s (Bow)`;
}

function showClickEffect(heal, points) {
    let text = '';
    if (heal > 0) text += `+${heal.toFixed(1)} HP`;
    if (points > 0) { if (text) text += ', '; text += `+${points} pts`; }
    elements.clickEffect.textContent = text;
    elements.clickEffect.classList.remove('show');
    elements.clickEffect.offsetHeight; // reflow
    elements.clickEffect.classList.add('show');
    setTimeout(() => elements.clickEffect.classList.remove('show'), 600);
}

function clickCrystal() {
    if (gameState.isGameOver) return;
    const heal = gameState.healPerClick; const pts = gameState.pointsPerClick;
    gameState.currentHp = Math.min(gameState.currentHp + heal, gameState.maxHp);
    gameState.points += pts;
    showClickEffect(heal, pts);
    updateDisplay();
}

function applyDamage() {
    if (gameState.isGameOver) return;
    gameState.currentHp -= gameState.damagePerTick;
    if (gameState.currentHp <= 0) { gameState.currentHp = 0; gameOver(); }
    updateDisplay();
}

function increaseDamage() { gameState.damagePerTick += 1; updateDisplay(); }

function gameOver() {
    gameState.isGameOver = true;
    const total = Math.floor((Date.now() - gameState.gameStartTime) / 1000);
    const m = Math.floor(total/60); const s = total % 60;
    elements.finalTime.textContent = `${m}:${s.toString().padStart(2,'0')}`;
    elements.finalPoints.textContent = gameState.points;
    elements.gameOver.style.display = 'flex';
    elements.backgroundMusic.pause();
}

function restartGame() {
    gameState.enemies.forEach(e => { if (e.element) e.element.remove(); });
    gameState = {
        points: 0, currentHp: 25, maxHp: 25,
        healPerClick: 0.1, pointsPerClick: 0, damagePerClick: 1,
        damagePerTick: 2, gameStartTime: Date.now(), isGameOver: false,
        enemies: [], nextEnemyId: 0,
        enemyTypes: gameState.enemyTypes, // mantém definições
        currentEnemyHealth: { sword: 3, bow: 2.5 },
        currentSpawnInterval: {
            sword: gameState.enemyTypes.sword.baseSpawnInterval,
            bow: gameState.enemyTypes.bow.baseSpawnInterval
        },
        maxEnemiesPerType: { sword: 4, bow: 4 },
        lastSpawnTime: { sword: 0, bow: 0 },
        upgrades: {
            maxHp: { level: 0, baseCost: 50, costMultiplier: 1.25, effect: 5 },
            healPower: { level: 0, baseCost: 60, costMultiplier: 1.25, effect: 0.1 },
            pointsPerClick: { level: 0, baseCost: 100, costMultiplier: 1.25, effect: 1 },
            damagePerClick: { level: 0, baseCost: 100, costMultiplier: 1.5, effect: 0.5 }
        }
    };
    damageTimer = 5; gameTimer = 0;
    lastMinuteUpdate = 0; // Resetar para garantir que updatePerMinuteMechanics seja chamado no próximo minuto
    elements.gameOver.style.display = 'none';
    elements.backgroundMusic.play();
    updateDisplay();
}

// Sidebars
elements.crystal.addEventListener('click', clickCrystal);
elements.toggleUpgrades.addEventListener('click', () => toggleSidebar(elements.upgradesSidebar));
elements.toggleStats.addEventListener('click', () => toggleSidebar(elements.statsSidebar));
elements.closeUpgrades.addEventListener('click', () => elements.upgradesSidebar.classList.remove('open'));
elements.closeStats.addEventListener('click', () => elements.statsSidebar.classList.remove('open'));
function toggleSidebar(sidebar){ if (sidebar.classList.contains('open')) sidebar.classList.remove('open'); else { elements.upgradesSidebar.classList.remove('open'); elements.statsSidebar.classList.remove('open'); sidebar.classList.add('open'); } }

// Música
elements.toggleMusic.addEventListener('click', () => {
    if (elements.backgroundMusic.paused) { elements.backgroundMusic.play(); elements.toggleMusic.textContent = '🎵 Música'; }
    else { elements.backgroundMusic.pause(); elements.toggleMusic.textContent = '🔇 Música'; }
});

// Upgrades
elements.buyMaxHp.addEventListener('click', () => buyUpgrade('maxHp'));
elements.buyHealPower.addEventListener('click', () => buyUpgrade('healPower'));
elements.buyPointsPerClick.addEventListener('click', () => buyUpgrade('pointsPerClick'));
elements.buyDamagePerClick.addEventListener('click', () => buyUpgrade('damagePerClick'));

// Loop principal (1s)
setInterval(() => {
    if (gameState.isGameOver) return;
    gameTimer++; damageTimer--;
    if (damageTimer <= 0) { applyDamage(); damageTimer = 5; }
    if (gameTimer > 0 && gameTimer % 300 === 0) increaseDamage();
    
    // Chamar a função de atualização de mecânicas por minuto
    updatePerMinuteMechanics();
    
    spawnEnemy();
    enemiesAttackCrystal();
    updateDisplay();
}, 1000);

// Inicialização
updateDisplay();
try { elements.backgroundMusic.play(); } catch (e) { /* autoplay pode falhar até interação do usuário */ }

