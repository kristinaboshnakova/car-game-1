/**
 * CITY QUEST — ЦЯЛАТА ЛОГИКА НА ИГРАТА
 * -------------------------------------------------------------
 * Играта работи само с JavaScript и Canvas 2D, без библиотеки.
 * Раздели:
 * 1. Настройки, герои и нива
 * 2. HTML елементи и запазване на прогреса
 * 3. Меню, бутони и управление
 * 4. Игрова логика и сблъсъци
 * 5. Рисуване на град, обекти и автомобил
 * 6. Главен цикъл с requestAnimationFrame
 */

"use strict";

// 1. НАСТРОЙКИ -------------------------------------------------
const WIDTH = 480;
const HEIGHT = 720;
const ROAD_LEFT = 108;
const ROAD_RIGHT = 372;
const LANE_WIDTH = (ROAD_RIGHT - ROAD_LEFT) / 3;
const MAX_LEVEL = 50;
const SAVE_KEY = "cityQuestSave_v2";
const OLD_SAVE_KEY = "cityQuestSave_v1";

const HEROES = {
    nova: {
        name: "Нова",
        color: "#6be9d5",
        dark: "#218a87",
        maxHealth: 3,
        moveMultiplier: 1,
        bonus: "Балансиран шофьор"
    },
    max: {
        name: "Макс",
        color: "#ffad6a",
        dark: "#b75d2f",
        maxHealth: 4,
        moveMultiplier: 0.92,
        bonus: "+1 сърце"
    },
    luna: {
        name: "Луна",
        color: "#c69bfa",
        dark: "#714bad",
        maxHealth: 3,
        moveMultiplier: 1.18,
        bonus: "+18% маневреност"
    }
};

const DISTRICTS = [
    "Първи километри",
    "Слънчев булевард",
    "Зелен квартал",
    "Градски център",
    "Неонови улици",
    "Индустриална зона",
    "Мостът на града",
    "Големият пръстен",
    "Скоростна отсечка",
    "Шампионски маршрут"
];

// Всяко ниво има отделно име, цел за звезди и дължина на маршрута.
const LEVELS = Array.from({ length: MAX_LEVEL }, (_, index) => {
    const number = index + 1;
    return {
        number,
        title: DISTRICTS[Math.min(9, Math.floor(index / 5))],
        stars: Math.min(22, 5 + Math.floor(index / 3)),
        distance: 1400 + index * 85,
        speed: Math.min(325, 172 + index * 3.1),
        obstacleChance: Math.min(0.8, 0.29 + index * 0.009)
    };
});

// 2. ЕЛЕМЕНТИ И ЗАПАЗВАНЕ --------------------------------------
const $ = (id) => document.getElementById(id);
const canvas = $("gameCanvas");
const ctx = canvas.getContext("2d");

const ui = {
    menu: $("homeScreen"),
    game: $("gameScreen"),
    grid: $("levelGrid"),
    progress: $("progressLabel"),
    levelDescription: $("levelDescription"),
    bestScore: $("bestScoreLabel"),
    gameLevel: $("gameLevelTitle"),
    sideLevel: $("gameLevelTitle"),
    starCounter: $("starCounter"),
    distanceCounter: $("distanceCounter"),
    healthCounter: $("healthCounter"),
    scoreCounter: $("scoreCounter"),
    shieldCounter: $("shieldCounter"),
    starBar: $("starBar"),
    distanceBar: $("distanceBar"),
    overlay: $("gameOverlay"),
    overlaySymbol: $("overlaySymbol"),
    overlayTitle: $("overlayTitle"),
    overlayText: $("overlayText"),
    overlayActions: $("overlayActions")
};

// Опции за персонализиране на шофьора и автомобила.
const SKINS = ["#f2c49a", "#d99365", "#9f6247", "#603e31", "#f7d6be"];
const HAIR_COLORS = ["#241c25", "#71422e", "#d6ab5e", "#d24f73", "#a7b4d1", "#d5e6f3"];
const OUTFIT_COLORS = ["#75e6cd", "#ef7599", "#789cfa", "#f0bd63", "#bb94f5", "#f6f7fb"];
const HAIR_STYLES = ["Къса", "Дълга", "Конска опашка", "Къдрава", "Ирокез", "Без коса"];
const OUTFITS = ["Яке", "Суитшърт", "Състезателен", "Тениска"];
const CAR_COLORS = ["#65e7ca", "#ff735f", "#679af3", "#f8c85e", "#e3ecfb", "#ad8ce7", "#232a37"];
const CARS = {
    street: { id: "street", name: "STREET", description: "Градски класик", icon: "🚗", handling: 1 },
    sport: { id: "sport", name: "TURBO", description: "Спортен автомобил", icon: "🏎️", handling: 1.12 },
    suv: { id: "suv", name: "RANGER", description: "Голям и стабилен", icon: "🚙", handling: 0.93 },
    van: { id: "van", name: "VAN", description: "Градски ван", icon: "🚐", handling: 0.97 }
};
const DEFAULT_AVATAR = {
    name: "Нова",
    base: "nova",
    skin: 1,
    hair: 2,
    hairColor: 3,
    outfit: 0,
    outfitColor: 0
};

function loadSave() {
    try {
        const data = JSON.parse(localStorage.getItem(SAVE_KEY) || localStorage.getItem(OLD_SAVE_KEY) || "{}");
        return {
            unlocked: Math.min(MAX_LEVEL, Math.max(1, Number(data.unlocked) || 1)),
            best: typeof data.best === "object" && data.best !== null ? data.best : {},
            hero: HEROES[data.hero] ? data.hero : "nova",
            avatar: { ...DEFAULT_AVATAR, ...(data.avatar || {}) },
            car: CARS[data.car] ? data.car : "street",
            carColor: CAR_COLORS.includes(data.carColor) ? data.carColor : CAR_COLORS[0]
        };
    } catch (error) {
        // Ако браузърът забрани localStorage, играта продължава без запис.
        return { unlocked: 1, best: {}, hero: "nova", avatar: { ...DEFAULT_AVATAR }, car: "street", carColor: CAR_COLORS[0] };
    }
}

const save = loadSave();
let selectedLevel = Math.min(save.unlocked, MAX_LEVEL);
let selectedHero = save.hero;
let currentScreen = "home";
let muted = false;
let audioContext = null;

function saveProgress() {
    try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    } catch (error) {
        // Частен режим може да блокира записването: не прекъсваме играта.
    }
}

// Звуците са кратки тонове, синтезирани от браузъра.
function playTone(frequency, duration = 0.09, type = "sine") {
    if (muted) {
        return;
    }
    try {
        const AudioClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioClass) {
            return;
        }
        audioContext ||= new AudioClass();
        if (audioContext.state === "suspended") {
            audioContext.resume().catch(() => {});
        }
        const oscillator = audioContext.createOscillator();
        const volume = audioContext.createGain();
        oscillator.type = type;
        oscillator.frequency.value = frequency;
        volume.gain.setValueAtTime(0.045, audioContext.currentTime);
        volume.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
        oscillator.connect(volume);
        volume.connect(audioContext.destination);
        oscillator.start();
        oscillator.stop(audioContext.currentTime + duration);
    } catch (error) {
        // Звукът е по желание и никога не трябва да спира играта.
    }
}

// 3. МЕНЮ И УПРАВЛЕНИЕ -----------------------------------------
function renderLevels() {
    ui.grid.innerHTML = "";
    for (const level of LEVELS) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "level-button";
        button.textContent = level.number;
        button.title = `Ниво ${level.number}: ${level.title}`;
        button.disabled = level.number > save.unlocked;
        if (level.number < save.unlocked) {
            button.classList.add("completed");
        }
        if (level.number === selectedLevel) {
            button.classList.add("active");
        }
        button.setAttribute("aria-label", `Ниво ${level.number}${button.disabled ? ", заключено" : ""}`);
        button.setAttribute("aria-pressed", String(level.number === selectedLevel));
        button.addEventListener("click", () => {
            selectedLevel = level.number;
            renderLevels();
            playTone(560);
        });
        ui.grid.appendChild(button);
    }
    const level = LEVELS[selectedLevel - 1];
    ui.progress.textContent = `${save.unlocked} / 50 отключени`;
    $("levelFeatureNumber").textContent = `НИВО ${String(selectedLevel).padStart(2, "0")}`;
    ui.levelDescription.textContent = `${level.title} • ${level.stars} ⭐`;
    ui.bestScore.textContent = `Рекорд: ${Number(save.best[selectedLevel]) || 0} т.`;
}

// Навигация: всяка секция е самостоятелен екран на приложението.
function showScreen(name) {
    if (name !== "game") {
        game.active = false;
        game.paused = false;
        releaseControls();
    }
    const screens = ["home", "avatar", "garage", "levels", "info", "game"];
    currentScreen = screens.includes(name) ? name : "home";
    for (const screen of screens) {
        const element = $(`${screen}Screen`);
        if (element) {
            element.classList.toggle("hidden", screen !== currentScreen);
        }
    }
    document.body.classList.toggle("playing", currentScreen === "game");
    document.querySelectorAll(".mobile-nav [data-screen]").forEach((button) => {
        button.classList.toggle("active", button.dataset.screen === currentScreen);
    });
    if (currentScreen === "levels" || currentScreen === "home") {
        renderLevels();
    }
    if (currentScreen === "avatar") {
        renderAvatarEditor();
    }
    if (currentScreen === "garage") {
        renderGarage();
    }
    $("headerProgress").textContent = `НИВО ${String(save.unlocked).padStart(2, "0")} / 50`;
    $("homeProgress").textContent = `${save.unlocked} / 50`;
    window.scrollTo(0, 0);
}

function showMenu() {
    showScreen("levels");
}

const keys = { left: false, right: false, up: false, down: false, jump: false };
const codeMap = {
    ArrowLeft: "left",
    KeyA: "left",
    ArrowRight: "right",
    KeyD: "right",
    ArrowUp: "up",
    KeyW: "up",
    ArrowDown: "down",
    KeyS: "down",
    Space: "jump"
};

function releaseControls() {
    Object.keys(keys).forEach((key) => { keys[key] = false; });
    document.querySelectorAll(".control-button").forEach((button) => {
        button.classList.remove("pressed");
    });
}

window.addEventListener("keydown", (event) => {
    const key = codeMap[event.code];
    if (key && !ui.game.classList.contains("hidden")) {
        event.preventDefault();
        keys[key] = true;
    }
    if ((event.code === "KeyP" || event.code === "Escape") && game.active && !event.repeat) {
        event.preventDefault();
        togglePause();
    }
});

window.addEventListener("keyup", (event) => {
    const key = codeMap[event.code];
    if (key) {
        keys[key] = false;
    }
});

window.addEventListener("blur", () => {
    releaseControls();
    if (game.active && !game.paused) {
        togglePause();
    }
});

// Pointer Events работят с докосване, мишка и стилус.
document.querySelectorAll("[data-control]").forEach((button) => {
    const key = button.dataset.control;
    button.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        button.setPointerCapture(event.pointerId);
        keys[key] = true;
        button.classList.add("pressed");
    });
    const stop = () => {
        keys[key] = false;
        button.classList.remove("pressed");
    };
    button.addEventListener("pointerup", stop);
    button.addEventListener("pointercancel", stop);
    button.addEventListener("lostpointercapture", stop);
});

// Действия в отделните екрани.
document.querySelectorAll("[data-screen]").forEach((button) => {
    button.addEventListener("click", () => showScreen(button.dataset.screen));
});
$("quickPlayButton").addEventListener("click", () => startLevel(Math.min(save.unlocked, MAX_LEVEL)));
$("startButton").addEventListener("click", () => startLevel(selectedLevel));
$("exitButton").addEventListener("click", showMenu);
$("pauseButton").addEventListener("click", togglePause);
$("soundButton").addEventListener("click", () => {
    muted = !muted;
    $("soundButton").innerHTML = muted ? '<i class="fa-solid fa-volume-xmark" aria-hidden="true" data-fallback="×"></i>' : '<i class="fa-solid fa-volume-high" aria-hidden="true" data-fallback="♪"></i>';
    $("soundButton").setAttribute("aria-label", muted ? "Включване на звука" : "Изключване на звука");
    if (!muted) {
        playTone(720);
    }
});

// 4. ИГРОВА ЛОГИКА ----------------------------------------------
const game = {
    active: false,
    paused: false,
    level: LEVELS[0],
    hero: HEROES.nova,
    car: CARS.street,
    jumping: 0,
    jumpCooldown: 0,
    birds: [],
    birdTimer: 4,
    cityTraffic: [],
    player: { x: 240, y: 575, width: 45, height: 77 },
    objects: [],
    particles: [],
    stars: 0,
    score: 0,
    health: 3,
    distance: 0,
    spawnTimer: 0,
    pickupTimer: 0,
    invulnerable: 0,
    shield: 0,
    worldOffset: 0,
    seconds: 0,
    finishTriggered: false
};

function laneCenter(index) {
    return ROAD_LEFT + LANE_WIDTH * (index + 0.5);
}

function startLevel(number) {
    if (number < 1 || number > save.unlocked || number > MAX_LEVEL) {
        return;
    }
    selectedLevel = number;
    game.active = true;
    game.paused = false;
    game.finishTriggered = false;
    game.level = LEVELS[number - 1];
    game.hero = HEROES[save.avatar.base];
    game.car = CARS[save.car];
    game.jumping = 0;
    game.jumpCooldown = 0;
    game.birds = [];
    game.birdTimer = 3.5;
    game.player = { x: laneCenter(1), y: 565, width: 44, height: 78 };
    game.objects = [];
    game.particles = [];
    game.stars = 0;
    game.score = 0;
    game.health = game.hero.maxHealth;
    game.distance = 0;
    game.spawnTimer = 0.2;
    game.pickupTimer = 8;
    game.invulnerable = 1.5;
    game.shield = 0;
    game.worldOffset = 0;
    game.seconds = 0;
    releaseControls();
    ui.gameLevel.textContent = `НИВО ${String(number).padStart(2, "0")} / 50`;
    // Заглавието на нивото остава в екрана с картата.
    $("pauseButton").innerHTML = '<i class="fa-solid fa-pause" aria-hidden="true" data-fallback="Ⅱ"></i><span class="pause-label">Пауза</span>';
    showScreen("game");
    $("hudDriverName").textContent = save.avatar.name.toUpperCase();
    $("hudAvatar").innerHTML = avatarSVG(save.avatar);
    $("driverBadge").innerHTML = avatarSVG(save.avatar);
    ui.overlay.classList.add("hidden");
    updateHUD();
    window.scrollTo({ top: 0, behavior: "instant" });
    playTone(510, 0.14);
}

function updateHUD() {
    const progress = Math.min(1, game.distance / game.level.distance);
    const starProgress = Math.min(1, game.stars / game.level.stars);
    ui.starCounter.textContent = `${game.stars} / ${game.level.stars}`;
    ui.distanceCounter.textContent = `${Math.floor(progress * 100)}%`;
    ui.healthCounter.textContent = "♥ ".repeat(game.health).trim() || "0";
    ui.healthCounter.style.color = game.health === 1 ? "#ff808f" : "#f4f8ff";
    ui.scoreCounter.textContent = game.score.toLocaleString("bg-BG");
    ui.shieldCounter.textContent = game.shield > 0 ? "ON" : "—";
    ui.starBar.style.width = `${starProgress * 100}%`;
    ui.distanceBar.style.width = `${progress * 100}%`;
}

function spawnObjects() {
    const lane = Math.floor(Math.random() * 3);
    const spawnY = -100;
    // Когато нивото стане по-трудно, се появяват повече препятствия.
    const obstacle = Math.random() < game.level.obstacleChance;
    if (obstacle) {
        const type = Math.random() < 0.62 ? "traffic" : "barrier";
        game.objects.push({
            type,
            x: laneCenter(lane),
            y: spawnY,
            width: type === "traffic" ? 48 : 58,
            height: type === "traffic" ? 79 : 35,
            color: ["#f17983", "#86bcff", "#edb764"][Math.floor(Math.random() * 3)],
            counted: false
        });
        // Звездата е в друга лента: винаги има възможен безопасен маршрут.
        const safeLane = (lane + (Math.random() < 0.5 ? 1 : 2)) % 3;
        game.objects.push({ type: "star", x: laneCenter(safeLane), y: spawnY - 100, width: 31, height: 31, counted: false });
    } else {
        game.objects.push({ type: "star", x: laneCenter(lane), y: spawnY, width: 31, height: 31, counted: false });
        if (Math.random() < 0.27) {
            game.objects.push({ type: "star", x: laneCenter((lane + 1) % 3), y: spawnY - 64, width: 31, height: 31, counted: false });
        }
    }
}

function spawnPowerup() {
    const type = game.health < game.hero.maxHealth && Math.random() < 0.55 ? "health" : "shield";
    game.objects.push({
        type,
        x: laneCenter(Math.floor(Math.random() * 3)),
        y: -55,
        width: 34,
        height: 34,
        counted: false
    });
}

function intersects(a, b) {
    return Math.abs(a.x - b.x) < (a.width + b.width) * 0.42 &&
        Math.abs(a.y - b.y) < (a.height + b.height) * 0.42;
}

function createParticles(x, y, color, amount = 12) {
    for (let i = 0; i < amount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 35 + Math.random() * 120;
        game.particles.push({
            x,
            y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            radius: 2 + Math.random() * 3,
            life: 0.45 + Math.random() * 0.35,
            maxLife: 0.8,
            color
        });
    }
}

function collectObject(object) {
    object.counted = true;
    if (object.type === "star") {
        game.stars++;
        game.score += 100;
        createParticles(object.x, object.y, "#ffdb75", 12);
        playTone(650 + (game.stars % 5) * 100);
    } else if (object.type === "health") {
        game.health = Math.min(game.hero.maxHealth, game.health + 1);
        game.score += 35;
        createParticles(object.x, object.y, "#75e6a5", 15);
        playTone(800, 0.18);
    } else if (object.type === "shield") {
        game.shield = 1;
        game.score += 35;
        createParticles(object.x, object.y, "#8cc7ff", 16);
        playTone(890, 0.18);
    } else if (game.invulnerable <= 0) {
        if (game.shield > 0) {
            game.shield = 0;
            createParticles(object.x, object.y, "#8cc7ff", 20);
            playTone(370, 0.16, "triangle");
        } else {
            game.health--;
            createParticles(object.x, object.y, "#ff8b92", 19);
            playTone(160, 0.27, "sawtooth");
        }
        game.invulnerable = 1.4;
        if (game.health <= 0) {
            finishLevel(false);
        }
    }
}

function updateGame(dt) {
    if (!game.active || game.paused) {
        return;
    }

    const player = game.player;
    const playerSpeed = 280 * game.hero.moveMultiplier * game.car.handling;
    // Диагоналното движение не трябва да бъде по-бързо.
    const dx = Number(keys.right) - Number(keys.left);
    const dy = Number(keys.down) - Number(keys.up);
    const factor = dx !== 0 && dy !== 0 ? Math.SQRT1_2 : 1;
    player.x += dx * playerSpeed * dt * factor;
    player.y += dy * playerSpeed * dt * factor;
    player.x = Math.max(ROAD_LEFT + 27, Math.min(ROAD_RIGHT - 27, player.x));
    player.y = Math.max(125, Math.min(HEIGHT - 85, player.y));

    // Скок: колата прелита за кратко над пропаст и наземни препятствия.
    game.jumpCooldown = Math.max(0, game.jumpCooldown - dt);
    if (keys.jump && game.jumping <= 0 && game.jumpCooldown <= 0) {
        game.jumping = 0.93;
        game.jumpCooldown = 1.35;
        playTone(510, 0.09, "triangle");
    }
    game.jumping = Math.max(0, game.jumping - dt);
    game.seconds += dt;
    game.invulnerable = Math.max(0, game.invulnerable - dt);
    game.distance += game.level.speed * dt;
    game.worldOffset += game.level.speed * dt;
    game.spawnTimer -= dt;
    game.birdTimer -= dt;
    if (game.level.number >= 3 && game.birdTimer <= 0) {
        // Ниско летяща птица преминава напречно през пътя.
        game.objects.push({
            type: "bird",
            x: Math.random() < 0.5 ? ROAD_LEFT + 35 : ROAD_RIGHT - 35,
            y: -35,
            width: 50,
            height: 34,
            vx: (Math.random() < 0.5 ? -1 : 1) * 78,
            counted: false
        });
        game.birdTimer = Math.max(2.5, 6.5 - game.level.number * 0.05) + Math.random() * 2;
    }
    game.pickupTimer -= dt;

    if (game.spawnTimer <= 0) {
        if (game.level.number >= 3 && game.distance > 150 && Math.random() < Math.min(0.2, 0.045 + game.level.number * 0.002)) {
            // Пропастта се появява само на по-високите нива. Преминава се със скок.
            game.objects.push({ type: "gap", x: WIDTH / 2, y: -95, width: ROAD_RIGHT - ROAD_LEFT, height: 66, counted: false });
        } else {
            spawnObjects();
        }
        // На по-високите нива предметите се появяват малко по-често.
        game.spawnTimer = Math.max(0.49, 0.98 - game.level.number * 0.006) + Math.random() * 0.19;
    }
    if (game.pickupTimer <= 0) {
        spawnPowerup();
        game.pickupTimer = 10 + Math.random() * 5;
    }

    for (const object of game.objects) {
        object.y += game.level.speed * dt;
        if (object.type === "bird") {
            object.x += object.vx * dt;
        }
        const airborne = game.jumping > 0.12;
        if (!object.counted && intersects(player, object) && !(airborne && ["gap", "traffic", "barrier", "bird"].includes(object.type))) {
            collectObject(object);
            if (!game.active) {
                break;
            }
        }
    }
    game.objects = game.objects.filter((object) => !object.counted && object.y < HEIGHT + 100);

    for (const particle of game.particles) {
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;
        particle.life -= dt;
    }
    game.particles = game.particles.filter((particle) => particle.life > 0);

    if (game.active && game.distance >= game.level.distance && game.stars >= game.level.stars) {
        finishLevel(true);
    }
    updateHUD();
}

function addOverlayButton(label, callback, primary = false) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = primary ? "primary-button" : "secondary-button";
    button.textContent = label;
    button.addEventListener("click", callback);
    ui.overlayActions.appendChild(button);
}

function showOverlay(symbol, title, message) {
    // Замяна на стандартните emoji в прозорците с Font Awesome икони.
    const overlayIcon = symbol.includes("⏸") ? "pause" : symbol.includes("🏁") || symbol.includes("🏆") ? "trophy" : symbol.includes("💥") || symbol.includes("❌") ? "triangle-exclamation" : "flag-checkered";
    ui.overlaySymbol.innerHTML = `<i class="fa-solid fa-${overlayIcon}" aria-hidden="true" data-fallback="★"></i>`;
    ui.overlayTitle.textContent = title;
    ui.overlayText.textContent = message;
    ui.overlayActions.innerHTML = "";
    ui.overlay.classList.remove("hidden");
    releaseControls();
}

function togglePause() {
    if (!game.active) {
        return;
    }
    game.paused = !game.paused;
    $("pauseButton").innerHTML = game.paused ? '<i class="fa-solid fa-play" aria-hidden="true" data-fallback="▶"></i><span class="pause-label">Продължи</span>' : '<i class="fa-solid fa-pause" aria-hidden="true" data-fallback="Ⅱ"></i><span class="pause-label">Пауза</span>';
    if (game.paused) {
        showOverlay("⏸️", "Пауза", "Играта е спряна. Продължи, когато си готов.");
        addOverlayButton("▶ Продължи", togglePause, true);
        addOverlayButton("↻ Рестартирай", () => startLevel(game.level.number));
        addOverlayButton("Към менюто", showMenu);
    } else {
        ui.overlay.classList.add("hidden");
        releaseControls();
    }
}

function finishLevel(won) {
    if (game.finishTriggered) {
        return;
    }
    game.finishTriggered = true;
    game.active = false;
    game.paused = false;
    if (won) {
        const healthBonus = game.health * 150;
        game.score += healthBonus;
        save.best[game.level.number] = Math.max(Number(save.best[game.level.number]) || 0, game.score);
        save.unlocked = Math.max(save.unlocked, Math.min(MAX_LEVEL, game.level.number + 1));
        saveProgress();
        playTone(920, 0.3);
        showOverlay("🏆", game.level.number === 50 ? "Ти си шампион!" : "Нивото е завършено!", `Събрани ${game.stars} звезди • ${game.score} точки • Бонус за живот: ${healthBonus}`);
        if (game.level.number < MAX_LEVEL) {
            addOverlayButton(`Следващо ниво → ${game.level.number + 1}`, () => startLevel(game.level.number + 1), true);
        } else {
            addOverlayButton("Играй отново", () => startLevel(50), true);
        }
    } else {
        showOverlay("💥", "Опитай отново!", `Събра ${game.stars} от ${game.level.stars} нужни звезди. Избягвай автомобилите и бариерите.`);
        addOverlayButton("↻ Опитай пак", () => startLevel(game.level.number), true);
    }
    addOverlayButton("Избор на ниво", showMenu);
}

// 5. РИСУВАНЕ --------------------------------------------------
function roundedRect(x, y, width, height, radius, fill) {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, radius);
    ctx.fill();
}

function drawCity() {
    const offset = game.worldOffset;
    const cycle = Math.floor(offset / 190);
    const roadside = ctx.createLinearGradient(0, 0, WIDTH, 0);
    roadside.addColorStop(0, "#233e52");
    roadside.addColorStop(0.5, "#44677b");
    roadside.addColorStop(1, "#263f53");
    ctx.fillStyle = roadside;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Повтарящи се квартали, сгради, зеленина и витрини.
    for (let i = -2; i < 7; i++) {
        const tile = cycle + i;
        const y = i * 190 + (offset % 190) - 190;
        const leftColor = ["#365f75", "#745a6a", "#536d77", "#4c647b"][((tile % 4) + 4) % 4];
        const rightColor = ["#72655a", "#426778", "#606a85", "#586f68"][((tile % 4) + 4) % 4];
        // Тротоари.
        roundedRect(79, y - 5, 27, 180, 3, "#9fb1ab");
        roundedRect(374, y - 5, 26, 180, 3, "#9fb1ab");
        roundedRect(8, y + 2, 67, 149, 7, leftColor);
        roundedRect(405, y + 14, 67, 145, 7, rightColor);
        // Прозорци на сградите.
        for (let row = 0; row < 4; row++) {
            for (let col = 0; col < 2; col++) {
                const glow = ((row * 7 + col + tile * 3) % 4) === 0;
                roundedRect(19 + col * 29, y + 17 + row * 31, 16, 17, 2, glow ? "#ffda91" : "#8bb1bf");
                roundedRect(416 + col * 29, y + 28 + row * 30, 16, 16, 2, glow ? "#ffda91" : "#99bed0");
            }
        }
        // Улични дървета по тротоара.
        drawTree(89, y + 164, tile);
        drawTree(393, y + 174, tile + 5);
    }

    // Динамични градски детайли: светещи витрини и движещи се пешеходци.
    for (let i = -2; i < 8; i++) {
        const scene = Math.floor(offset / 155) + i;
        const y = i * 155 + (offset % 155) - 120;
        if (scene % 3 === 0) {
            const glow = Math.sin(game.seconds * 4 + scene) > 0;
            roundedRect(12, y + 20, 59, 20, 4, glow ? "#ffb96d" : "#769cc6");
            ctx.fillStyle = "#15283e";
            ctx.font = "bold 10px system-ui";
            ctx.fillText("OPEN", 22, y + 34);
        }
        if (scene % 2 === 0) {
            const pedestrianX = 85 + Math.sin(game.seconds * 2 + scene) * 7;
            ctx.fillStyle = "#f3bf8b";
            ctx.beginPath();
            ctx.arc(pedestrianX, y + 55, 5, 0, Math.PI * 2);
            ctx.fill();
            roundedRect(pedestrianX - 4, y + 62, 8, 15, 3, "#ed7fa2");
        }
        if (scene % 4 === 1) {
            const pedestrianX = 392 + Math.sin(game.seconds * 1.7 + scene) * 5;
            ctx.fillStyle = "#a77754";
            ctx.beginPath();
            ctx.arc(pedestrianX, y + 30, 5, 0, Math.PI * 2);
            ctx.fill();
            roundedRect(pedestrianX - 4, y + 37, 8, 17, 3, "#ffd16c");
        }
    }

    // Асфалтът е с лек градиент за дълбочина.
    const road = ctx.createLinearGradient(ROAD_LEFT, 0, ROAD_RIGHT, 0);
    road.addColorStop(0, "#28384b");
    road.addColorStop(0.5, "#35485a");
    road.addColorStop(1, "#28384b");
    ctx.fillStyle = road;
    ctx.fillRect(ROAD_LEFT, 0, ROAD_RIGHT - ROAD_LEFT, HEIGHT);
    ctx.fillStyle = "#e2d78f";
    ctx.fillRect(ROAD_LEFT + 5, 0, 4, HEIGHT);
    ctx.fillRect(ROAD_RIGHT - 9, 0, 4, HEIGHT);

    // Прекъснати линии между трите ленти.
    for (let lane = 1; lane <= 2; lane++) {
        const x = ROAD_LEFT + LANE_WIDTH * lane;
        for (let y = (offset % 95) - 95; y < HEIGHT; y += 95) {
            roundedRect(x - 2, y, 4, 47, 2, "rgba(233, 242, 246, 0.62)");
        }
    }

    // Пешеходна пътека на всеки ~950 пиксела.
    if (Math.floor(offset / 950) >= 0) {
        const crossY = (offset % 950) - 105;
        for (let i = 0; i < 7; i++) {
            roundedRect(ROAD_LEFT + 14 + i * 37, crossY, 24, 44, 2, "rgba(244, 247, 236, 0.56)");
        }
    }
}

function drawTree(x, y, seed) {
    roundedRect(x - 3, y + 4, 6, 18, 2, "#755e49");
    ctx.fillStyle = seed % 2 === 0 ? "#45917a" : "#397d72";
    ctx.beginPath();
    ctx.arc(x, y, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(180, 245, 185, 0.22)";
    ctx.beginPath();
    ctx.arc(x - 4, y - 4, 6, 0, Math.PI * 2);
    ctx.fill();
}

function drawStar(x, y, pulse) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.sin(pulse) * 0.17);
    ctx.shadowColor = "#ffd678";
    ctx.shadowBlur = 18;
    ctx.fillStyle = "#ffe18a";
    ctx.strokeStyle = "#f4aa4e";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
        const radius = i % 2 === 0 ? 17 : 8;
        const angle = i * Math.PI / 5 - Math.PI / 2;
        const px = Math.cos(angle) * radius;
        const py = Math.sin(angle) * radius;
        if (i === 0) {
            ctx.moveTo(px, py);
        } else {
            ctx.lineTo(px, py);
        }
    }
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.stroke();
    ctx.restore();
}

function drawCar(x, y, width, height, color, enemy = false, carModel = CARS.street) {
    ctx.save();
    ctx.translate(x, y);
    // Сянка на автомобила.
    roundedRect(-width / 2 + 4, -height / 2 + 9, width, height, 12, "rgba(0, 0, 0, 0.25)");
    // Гуми.
    roundedRect(-width / 2 - 5, -height / 2 + 13, 9, 18, 3, "#111d2b");
    roundedRect(width / 2 - 4, -height / 2 + 13, 9, 18, 3, "#111d2b");
    roundedRect(-width / 2 - 5, height / 2 - 29, 9, 18, 3, "#111d2b");
    roundedRect(width / 2 - 4, height / 2 - 29, 9, 18, 3, "#111d2b");
    // Размери и силует според избрания тип автомобил.
    const bodyWidth = carModel.id === "suv" ? width + 8 : carModel.id === "sport" ? width + 4 : width;
    const corner = carModel.id === "van" ? 5 : carModel.id === "sport" ? 18 : 11;
    roundedRect(-bodyWidth / 2, -height / 2, bodyWidth, height, corner, color);
    if (carModel.id === "sport") {
        roundedRect(-bodyWidth / 2 - 3, height / 2 - 16, bodyWidth + 6, 7, 2, "#142739");
    }
    if (carModel.id === "van") {
        roundedRect(-bodyWidth / 2 + 4, height / 2 - 30, bodyWidth - 8, 13, 3, "#284a60");
    }
    // Капак, стъкла и покрив.
    roundedRect(-width / 2 + 6, -height / 2 + 10, width - 12, 15, 4, "rgba(255, 255, 255, 0.23)");
    roundedRect(-width / 2 + 6, -height / 2 + 30, width - 12, 26, 6, "#18364d");
    roundedRect(-width / 2 + 9, -height / 2 + 33, width - 18, 7, 2, "#6da4b5");
    ctx.fillStyle = "rgba(255, 255, 255, 0.28)";
    ctx.fillRect(-2, -height / 2 + 7, 4, 14);
    // Фарове и стопове.
    roundedRect(-width / 2 + 5, -height / 2 + 2, 10, 5, 2, enemy ? "#fa9b8c" : "#fff1b0");
    roundedRect(width / 2 - 15, -height / 2 + 2, 10, 5, 2, enemy ? "#fa9b8c" : "#fff1b0");
    roundedRect(-width / 2 + 5, height / 2 - 7, 10, 4, 1, "#c54756");
    roundedRect(width / 2 - 15, height / 2 - 7, 10, 4, 1, "#c54756");
    ctx.restore();
}

function drawBarrier(object) {
    const { x, y } = object;
    roundedRect(x - 30, y - 18, 60, 37, 5, "#f7e0b8");
    ctx.save();
    ctx.beginPath();
    ctx.rect(x - 29, y - 17, 58, 35);
    ctx.clip();
    ctx.strokeStyle = "#ee8256";
    ctx.lineWidth = 10;
    for (let stripe = -60; stripe < 90; stripe += 25) {
        ctx.beginPath();
        ctx.moveTo(x + stripe, y - 23);
        ctx.lineTo(x + stripe + 40, y + 23);
        ctx.stroke();
    }
    ctx.restore();
    roundedRect(x - 25, y + 17, 8, 9, 1, "#25364b");
    roundedRect(x + 17, y + 17, 8, 9, 1, "#25364b");
}

function drawPowerup(object) {
    const isHealth = object.type === "health";
    ctx.save();
    ctx.shadowColor = isHealth ? "#6ee8ac" : "#8ed2ff";
    ctx.shadowBlur = 18;
    ctx.fillStyle = isHealth ? "#47c78d" : "#569fe0";
    ctx.beginPath();
    ctx.arc(object.x, object.y, 19, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "white";
    ctx.font = "bold 24px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(isHealth ? "+" : "◆", object.x, object.y + 1);
    ctx.restore();
}

function drawObjects() {
    for (const object of game.objects) {
        if (object.type === "star") {
            drawStar(object.x, object.y, game.seconds * 5);
        } else if (object.type === "traffic") {
            drawCar(object.x, object.y, object.width, object.height, object.color, true);
        } else if (object.type === "barrier") {
            drawBarrier(object);
        } else if (object.type === "gap") {
            drawGap(object);
        } else if (object.type === "bird") {
            drawBird(object);
        } else {
            drawPowerup(object);
        }
    }
}

function drawPlayer() {
    if (game.invulnerable > 0 && Math.floor(game.invulnerable * 11) % 2 === 0) {
        ctx.globalAlpha = 0.5;
    }
    const jumpProgress = game.jumping > 0 ? Math.sin((1 - game.jumping / 0.93) * Math.PI) : 0;
    if (jumpProgress > 0) {
        ctx.fillStyle = `rgba(0, 0, 0, ${0.2 + jumpProgress * 0.1})`;
        ctx.beginPath();
        ctx.ellipse(game.player.x, game.player.y + 28, 29 + jumpProgress * 14, 12 + jumpProgress * 7, 0, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.save();
    ctx.translate(game.player.x, game.player.y - jumpProgress * 58);
    ctx.scale(1 + jumpProgress * 0.22, 1 + jumpProgress * 0.22);
    drawCar(0, 0, game.player.width, game.player.height, save.carColor, false, game.car);
    ctx.restore();
    ctx.globalAlpha = 1;
    if (game.shield > 0) {
        ctx.strokeStyle = "rgba(135, 220, 255, 0.85)";
        ctx.lineWidth = 4;
        ctx.shadowColor = "#77cfff";
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.ellipse(game.player.x, game.player.y, 33, 54, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
    }
    // Малък цветен индикатор над колата показва избрания герой.
    roundedRect(game.player.x - 15, game.player.y + 46, 30, 5, 2, game.hero.dark);
}

function drawParticles() {
    for (const particle of game.particles) {
        ctx.globalAlpha = Math.max(0, Math.min(1, particle.life / particle.maxLife));
        ctx.fillStyle = particle.color;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;
}

function renderGame() {
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    drawCity();
    drawObjects();
    drawPlayer();
    drawParticles();
    // Компактен надпис в горната част на пътя.
    roundedRect(165, 13, 150, 34, 10, "rgba(10, 23, 39, 0.75)");
    ctx.fillStyle = "#e6f9f5";
    ctx.font = "bold 14px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`⭐ ${game.stars} / ${game.level.stars}`, WIDTH / 2, 30);
}

// 6. ГЛАВЕН ЦИКЪЛ ----------------------------------------------
// requestAnimationFrame синхронизира рисуването с екрана.
// dt е ограничено до 0.04 сек., за да няма внезапни големи скокове.
let lastFrame = 0;
function animationLoop(timestamp) {
    const dt = Math.min(0.04, Math.max(0, (timestamp - lastFrame) / 1000));
    lastFrame = timestamp;
    if (!ui.game.classList.contains("hidden")) {
        if (game.active && !game.paused) {
            updateGame(dt);
        }
        renderGame();
    }
    requestAnimationFrame(animationLoop);
}

// 7. ПЕРСОНАЛИЗАЦИЯ НА ГЕРОЯ -------------------------------------
// SVG се генерира локално: не се свалят изображения и може да се редактира.
function avatarSVG(avatar) {
    const skin = SKINS[avatar.skin] || SKINS[0];
    const hair = HAIR_COLORS[avatar.hairColor] || HAIR_COLORS[0];
    const cloth = OUTFIT_COLORS[avatar.outfitColor] || OUTFIT_COLORS[0];
    const hairType = Number(avatar.hair);
    const outfitType = Number(avatar.outfit);
    const longHair = hairType === 1 || hairType === 2;
    let hairstyle = "";
    if (hairType === 0) {
        hairstyle = `<path d="M62 95 Q55 33 112 33 Q169 33 161 95 L150 77 Q133 59 113 64 Q85 58 74 89Z" fill="${hair}"/>`;
    } else if (hairType === 1) {
        hairstyle = `<path d="M61 96 Q46 29 113 26 Q179 28 165 100 L176 201 L151 196 L145 85 Q128 54 91 67 L80 201 L50 196Z" fill="${hair}"/>`;
    } else if (hairType === 2) {
        hairstyle = `<path d="M62 98 Q50 30 114 31 Q164 30 162 95 L145 83 Q116 53 85 69Z" fill="${hair}"/><path d="M150 46 Q200 31 177 94 Q163 121 183 149 Q147 136 159 100 Q169 69 150 46Z" fill="${hair}"/>`;
    } else if (hairType === 3) {
        hairstyle = Array.from({ length: 8 }, (_, i) => `<circle cx="${64 + (i % 4) * 29}" cy="${53 + Math.floor(i / 4) * 22}" r="23" fill="${hair}"/>`).join("");
    } else if (hairType === 4) {
        hairstyle = `<path d="M101 78 L96 20 L116 40 L125 10 L135 74Z" fill="${hair}"/>`;
    }
    const jacket = outfitType === 0 ? `<path d="M111 163 L89 191 L111 296 L134 191" fill="#17273b"/><path d="M111 170 L111 292" stroke="#f5f5f5" stroke-width="3"/>` : "";
    const hoodie = outfitType === 1 ? `<path d="M69 193 Q109 145 157 193" fill="none" stroke="#ffffff55" stroke-width="11"/>` : "";
    const racer = outfitType === 2 ? `<path d="M75 206 H148 M81 237 H143" stroke="#ffffffaa" stroke-width="8"/><path d="M111 183 V296" stroke="#ffffff" stroke-width="4"/>` : "";
    const shirt = outfitType === 3 ? `<path d="M92 171 Q110 197 132 171" fill="none" stroke="#ffffff77" stroke-width="7"/>` : "";
    return `<svg viewBox="0 0 220 340" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Персонализиран герой">
        <ellipse cx="110" cy="326" rx="79" ry="10" fill="#06152255"/>
        <path d="M85 272 L83 328 L107 328 L115 266 M128 266 L126 328 L150 328 L147 272" fill="#253a56" stroke="#1a2c42" stroke-width="5"/>
        <path d="M70 185 Q78 163 99 164 L122 164 Q145 161 153 185 L174 256 L151 266 L144 243 L151 301 L70 301 L77 243 L60 266 L43 255Z" fill="${cloth}" stroke="#152839" stroke-width="5"/>
        <path d="M56 259 L63 284 M162 259 L154 284" stroke="${skin}" stroke-width="18" stroke-linecap="round"/>
        ${jacket}${hoodie}${racer}${shirt}
        ${longHair ? `<path d="M64 83 Q40 128 64 200 L86 188 L84 93 M154 83 Q179 134 158 196 L139 182 L140 89" fill="${hair}"/>` : ""}
        <rect x="100" y="145" width="23" height="35" rx="10" fill="${skin}"/>
        <ellipse cx="111" cy="99" rx="54" ry="66" fill="${skin}"/>
        <ellipse cx="59" cy="107" rx="9" ry="15" fill="${skin}"/><ellipse cx="163" cy="107" rx="9" ry="15" fill="${skin}"/>
        ${hairstyle}
        <path d="M79 111 Q91 107 101 111 M123 111 Q134 107 144 111" stroke="#29242b" stroke-width="4" fill="none" stroke-linecap="round"/>
        <circle cx="91" cy="112" r="4" fill="#202a36"/><circle cx="134" cy="112" r="4" fill="#202a36"/>
        <path d="M110 118 L106 137 L116 137" stroke="#864e3d88" stroke-width="3" fill="none"/>
        <path d="M97 147 Q111 156 125 147" stroke="#7e4848" stroke-width="3" stroke-linecap="round" fill="none"/>
        </svg>`;
}

function makeChoice(containerId, options, selected, choose, swatch = false) {
    const root = $(containerId);
    root.replaceChildren();
    options.forEach((label, index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `option-button ${swatch ? "swatch" : ""} ${index === selected ? "selected" : ""}`;
        button.setAttribute("aria-pressed", String(index === selected));
        button.title = swatch ? `Цвят ${index + 1}` : label;
        button.setAttribute("aria-label", button.title);
        if (swatch) {
            button.style.setProperty("--swatch", label);
        } else {
            button.textContent = label;
        }
        button.addEventListener("click", () => {
            choose(index);
            saveProgress();
            renderAvatarEditor();
            playTone(520, 0.05);
        });
        root.appendChild(button);
    });
}

function renderAvatarEditor() {
    const a = save.avatar;
    $("heroNameInput").value = a.name;
    $("heroNamePreview").textContent = a.name.toUpperCase() || "МОЯТ ГЕРОЙ";
    $("avatarPreview").innerHTML = avatarSVG(a);
    makeChoice("baseChoices", ["Нова", "Макс", "Луна"], ["nova", "max", "luna"].indexOf(a.base), (i) => { a.base = ["nova", "max", "luna"][i]; });
    makeChoice("skinChoices", SKINS, a.skin, (i) => { a.skin = i; }, true);
    makeChoice("hairChoices", HAIR_STYLES, a.hair, (i) => { a.hair = i; });
    makeChoice("hairColorChoices", HAIR_COLORS, a.hairColor, (i) => { a.hairColor = i; }, true);
    makeChoice("outfitChoices", OUTFITS, a.outfit, (i) => { a.outfit = i; });
    makeChoice("outfitColorChoices", OUTFIT_COLORS, a.outfitColor, (i) => { a.outfitColor = i; }, true);
}

$("heroNameInput").addEventListener("input", (event) => {
    save.avatar.name = event.target.value.slice(0, 16);
    $("heroNamePreview").textContent = save.avatar.name.toUpperCase() || "МОЯТ ГЕРОЙ";
    saveProgress();
});

// 8. ГАРАЖ -----------------------------------------------------
function renderGarage() {
    const choices = $("carChoices");
    choices.replaceChildren();
    Object.values(CARS).forEach((car) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `car-option ${car.id === save.car ? "selected" : ""}`;
        // Иконата е само визуална; характеристиките на автомобила не се променят.
        const carIcon = { street: "car-side", sport: "car", suv: "truck-monster", van: "van-shuttle" }[car.id];
        button.innerHTML = `<span><i class="fa-solid fa-${carIcon}" aria-hidden="true" data-fallback="▰"></i></span><strong>${car.name}</strong><small>${car.description}</small>`;
        button.setAttribute("aria-pressed", String(car.id === save.car));
        button.addEventListener("click", () => {
            save.car = car.id;
            saveProgress();
            renderGarage();
            playTone(580, 0.07);
        });
        choices.appendChild(button);
    });
    const colors = $("carColorChoices");
    colors.replaceChildren();
    CAR_COLORS.forEach((color) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `option-button swatch ${save.carColor === color ? "selected" : ""}`;
        button.style.setProperty("--swatch", color);
        button.setAttribute("aria-label", `Боя ${color}`);
        button.setAttribute("aria-pressed", String(save.carColor === color));
        button.addEventListener("click", () => {
            save.carColor = color;
            saveProgress();
            renderGarage();
        });
        colors.appendChild(button);
    });
    const car = CARS[save.car];
    $("carPreviewTitle").textContent = car.name;
    $("carPreviewSubtitle").textContent = car.description;
    const preview = $("carPreviewCanvas");
    const previewContext = preview.getContext("2d");
    previewContext.clearRect(0, 0, preview.width, preview.height);
    previewContext.save();
    previewContext.translate(220, 144);
    previewContext.rotate(-0.23);
    previewContext.scale(2.35, 2.35);
    // Използваме същата функция за рисуване, като временно сменим контекста.
    drawCarPreview(previewContext, save.carColor, car);
    previewContext.restore();
}

function drawCarPreview(g, color, car) {
    g.shadowColor = "#010e1fb0";
    g.shadowBlur = 18;
    g.shadowOffsetY = 15;
    g.fillStyle = "#131f30";
    g.fillRect(-34, -62, 18, 28);
    g.fillRect(16, -62, 18, 28);
    g.fillRect(-34, 32, 18, 28);
    g.fillRect(16, 32, 18, 28);
    g.shadowBlur = 0;
    g.shadowOffsetY = 0;
    g.fillStyle = color;
    g.beginPath();
    g.roundRect(-32, -65, 64, 130, car.id === "sport" ? 22 : car.id === "van" ? 6 : 15);
    g.fill();
    g.fillStyle = "#16334b";
    g.beginPath();
    g.roundRect(-26, -29, 52, 53, 7);
    g.fill();
    g.fillStyle = "#7ab1c6";
    g.fillRect(-23, -25, 46, 12);
    g.fillStyle = "#f5edbb";
    g.fillRect(-24, -61, 14, 7);
    g.fillRect(10, -61, 14, 7);
    g.fillStyle = "#f55f70";
    g.fillRect(-24, 56, 14, 5);
    g.fillRect(10, 56, 14, 5);
    if (car.id === "sport") {
        g.fillStyle = "#11283c";
        g.fillRect(-36, 43, 72, 10);
    }
}

// 9. ДОПЪЛНИТЕЛНИ ПРЕПЯТСТВИЯ ---------------------------------
function drawGap(object) {
    const y = object.y;
    ctx.fillStyle = "#091220";
    ctx.fillRect(ROAD_LEFT, y - 33, ROAD_RIGHT - ROAD_LEFT, 66);
    ctx.fillStyle = "#02070f";
    ctx.fillRect(ROAD_LEFT + 5, y - 23, ROAD_RIGHT - ROAD_LEFT - 10, 47);
    ctx.fillStyle = "#f8bb62";
    ctx.fillRect(ROAD_LEFT, y - 36, ROAD_RIGHT - ROAD_LEFT, 5);
    ctx.fillRect(ROAD_LEFT, y + 31, ROAD_RIGHT - ROAD_LEFT, 5);
    ctx.fillStyle = "#ffffff88";
    for (let x = ROAD_LEFT + 12; x < ROAD_RIGHT - 9; x += 30) {
        ctx.fillRect(x, y - 39, 14, 2);
        ctx.fillRect(x, y + 37, 14, 2);
    }
}

function drawBird(object) {
    const t = game.seconds * 13;
    const flap = Math.sin(t) * 14;
    ctx.save();
    ctx.translate(object.x, object.y);
    ctx.strokeStyle = "#182637";
    ctx.lineCap = "round";
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(-24, -flap);
    ctx.quadraticCurveTo(-12, -20, 0, 1);
    ctx.quadraticCurveTo(12, -20, 24, -flap);
    ctx.stroke();
    ctx.fillStyle = "#f0a96b";
    ctx.beginPath();
    ctx.moveTo(0, 4);
    ctx.lineTo(-5, -2);
    ctx.lineTo(5, -2);
    ctx.fill();
    ctx.restore();
}

// Инициализация: подготви менюто и стартирай плавното рисуване.
renderLevels();
showScreen("home");
requestAnimationFrame(animationLoop);

// Само визуален резервен вариант: ако шрифтът Font Awesome от CDN не е
// достъпен (например при игра без интернет), показваме семпъл символ.
// Когато шрифтът се зареди, остават само истинските Font Awesome икони.
if (document.fonts && document.fonts.load) {
    document.fonts.load('900 16px "Font Awesome 6 Free"').then((loadedFonts) => {
        if (loadedFonts.length > 0) {
            document.documentElement.classList.add("fa-loaded");
        }
    }).catch(() => {});
}
