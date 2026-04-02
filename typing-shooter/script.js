"use strict";

const MUSIC_STORAGE_KEY = "typing-arcade-music-enabled";
const LEADERBOARD_STORAGE_KEY = "typing-arcade-best-scores-v2";
const LEADERBOARD_GAME_ID = "typing-shooter";
const PLAYER_NAME_KEY = "typing-arcade-typing-shooter-player-name";
const HEART_ICON_PATH = "../images/heart.svg";
const LEADERBOARD_LIMIT = 6;

const CONTENT_PATHS = {
  level: "./src/content/levels/level-01.json",
  instanceMap: "./src/content/instance-map.json",
  charactersManifest: "./src/content/manifests/characters.manifest.json",
  backgroundsManifest: "./src/content/manifests/backgrounds.manifest.json",
  effectsManifest: "./src/content/manifests/effects.manifest.json",
};

const CUSTOM_ASSET_PATHS = {
  bulletImage: "./assets/effects/bullets/bullet.png",
  bulletSound: "./assets/effects/bullets/bullet.mp3",
  boomImage: "./assets/effects/explosions/boom.png",
  crashSound: "./assets/effects/explosions/crash.mp3",
  backgroundMusic: "./assets/audio/music/bg_music.mp3",
};

const CONFIG = {
  lives: 3,
  background: {
    scrollSpeed: 120,
    minTileWidth: 1280,
    offsetY: 0,
    scaleBoost: 1.18,
  },
  player: {
    x: 132,
    y: 0.72,
    width: 188,
    height: 188,
    frameDurationMs: 90,
  },
  bullet: {
    speed: 980,
    width: 62,
    height: 30,
  },
  combat: {
    targetLockBias: 0.5,
    playerHitPadding: 28,
    pauseAfterBossDefeatMs: 900,
  },
  lane: {
    offsetY: 45,
  },
};

const PLAYER_FRAME_PATHS = [
  "./assets/characters/player/frame1.png",
  "./assets/characters/player/frame2.png",
  "./assets/characters/player/frame3.png",
];

const ENEMY_FRAME_PATHS = [
  "./assets/characters/enemies/enemy1_1.png",
  "./assets/characters/enemies/enemy1_2.png",
  "./assets/characters/enemies/enemy1_3.png",
  "./assets/characters/enemies/enemy1_4.png",
  "./assets/characters/enemies/enemy1_5.png",
  "./assets/characters/enemies/enemy1_6.png",
];

const ENEMY_FRAME_SETS = {
  enemy1: ENEMY_FRAME_PATHS,
  enemy2: [
    "./assets/characters/enemies/enmey2_1.png",
    "./assets/characters/enemies/enmey2_2.png",
    "./assets/characters/enemies/enmey2_3.png",
    "./assets/characters/enemies/enmey2_4.png",
    "./assets/characters/enemies/enmey2_5.png",
    "./assets/characters/enemies/enmey2_6.png",
  ],
  enemy3: [
    "./assets/characters/enemies/enemy3_1.png",
    "./assets/characters/enemies/enemy3_2.png",
    "./assets/characters/enemies/enemy3_3.png",
    "./assets/characters/enemies/enemy3_4.png",
    "./assets/characters/enemies/enemy3_5.png",
    "./assets/characters/enemies/enemy3_6.png",
  ],
};

const ui = {
  canvas: document.getElementById("gameCanvas"),
  score: document.getElementById("scoreValue"),
  lives: document.getElementById("livesValue"),
  wave: document.getElementById("waveValue"),
  target: document.getElementById("targetValue"),
  startOverlay: document.getElementById("startOverlay"),
  startButton: document.getElementById("startButton"),
  backButton: document.getElementById("backButton"),
  topbar: document.getElementById("topbar"),
  bossBanner: document.getElementById("bossBanner"),
  bossWord: document.getElementById("bossWordValue"),
  nameEntryOverlay: document.getElementById("nameEntryOverlay"),
  nameEntrySummary: document.getElementById("nameEntrySummary"),
  nameEntryForm: document.getElementById("nameEntryForm"),
  nameEntryInput: document.getElementById("nameEntryInput"),
  gameOverOverlay: document.getElementById("gameOverOverlay"),
  gameOverKicker: document.getElementById("gameOverKicker"),
  gameOverTitle: document.getElementById("gameOverTitle"),
  gameOverSummary: document.getElementById("gameOverSummary"),
  restartButton: document.getElementById("restartButton"),
  restartBackButton: document.getElementById("restartBackButton"),
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function shuffle(items) {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
}

function formatScore(score) {
  return Number(score || 0).toLocaleString("en-US");
}

function getStoredLeaderboard() {
  try {
    const raw = window.localStorage.getItem(LEADERBOARD_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    const entries = parsed?.[LEADERBOARD_GAME_ID];
    return Array.isArray(entries) ? entries : [];
  } catch {
    return [];
  }
}

function saveLeaderboard(entries) {
  let stored = {};

  try {
    const raw = window.localStorage.getItem(LEADERBOARD_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    stored = parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    stored = {};
  }

  stored[LEADERBOARD_GAME_ID] = entries;
  window.localStorage.setItem(LEADERBOARD_STORAGE_KEY, JSON.stringify(stored));
}

function postScoreUpdated() {
  if (window.parent && window.parent !== window) {
    window.parent.postMessage({ type: "typing-arcade:score-updated" }, "*");
  }
}

function getStoredPlayerName() {
  return window.localStorage.getItem(PLAYER_NAME_KEY) || "";
}

function normalizeAssetPath(path) {
  return `./${String(path || "").replace(/^\.?\/*/, "")}`;
}

async function loadJson(path) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to load ${path}`);
  }
  return response.json();
}

async function loadText(path) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to load ${path}`);
  }
  return response.text();
}

class AssetManager {
  constructor() {
    this.images = new Map();
  }

  async loadImage(key, src) {
    const image = new Image();
    image.decoding = "async";

    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = reject;
      image.src = src;
    });

    this.images.set(key, image);
    return image;
  }

  get(key) {
    return this.images.get(key) || null;
  }

  async loadOptionalImage(key, src) {
    try {
      return await this.loadImage(key, src);
    } catch {
      return null;
    }
  }
}

class SoundManager {
  constructor() {
    this.context = null;
    this.musicEnabled = window.localStorage.getItem(MUSIC_STORAGE_KEY) !== "false";
    this.bulletAudio = this.createAudio(CUSTOM_ASSET_PATHS.bulletSound);
    this.crashAudio = this.createAudio(CUSTOM_ASSET_PATHS.crashSound);
    this.musicAudio = this.createAudio(CUSTOM_ASSET_PATHS.backgroundMusic);
    if (this.musicAudio) {
      this.musicAudio.loop = true;
      this.musicAudio.volume = 0.14;
    }
  }

  createAudio(src) {
    const audio = new Audio(src);
    audio.preload = "auto";
    audio.addEventListener("error", () => {
      audio.dataset.failed = "true";
    });
    return audio;
  }

  playAudioClip(audio, volume = 0.48) {
    if (!audio || audio.dataset.failed === "true") return false;

    try {
      const instance = audio.cloneNode();
      instance.volume = volume;
      const playPromise = instance.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(() => {});
      }
      return true;
    } catch {
      return false;
    }
  }

  playMusic() {
    if (!this.musicAudio || this.musicAudio.dataset.failed === "true" || !this.musicEnabled) return;
    this.musicAudio.volume = 0.14;
    this.musicAudio.play().catch(() => {});
  }

  pauseMusic() {
    if (!this.musicAudio) return;
    this.musicAudio.pause();
    this.musicAudio.currentTime = 0;
  }

  ensureContext() {
    if (!this.context) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return null;
      this.context = new AudioContextClass();
    }

    if (this.context.state === "suspended") {
      this.context.resume().catch(() => {});
    }

    return this.context;
  }

  playTone({ frequency, duration, type = "square", gain = 0.05, attack = 0.004, release = 0.06 }) {
    const context = this.ensureContext();
    if (!context) return;

    const oscillator = context.createOscillator();
    const gainNode = context.createGain();
    const startTime = context.currentTime;
    const endTime = startTime + duration;

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, startTime);
    gainNode.gain.setValueAtTime(0.0001, startTime);
    gainNode.gain.linearRampToValueAtTime(gain, startTime + attack);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, endTime + release);

    oscillator.connect(gainNode);
    gainNode.connect(context.destination);
    oscillator.start(startTime);
    oscillator.stop(endTime + release);
  }

  playLetterHit() {
    if (this.playAudioClip(this.bulletAudio)) {
      return;
    }

    this.playTone({
      frequency: 860,
      duration: 0.04,
      type: "square",
      gain: 0.03,
      attack: 0.002,
      release: 0.03,
    });
  }

  playEnemyExplosion() {
    const context = this.ensureContext();
    if (!context) return;

    const oscillator = context.createOscillator();
    const gainNode = context.createGain();
    const filter = context.createBiquadFilter();
    const startTime = context.currentTime;
    const endTime = startTime + 0.18;

    oscillator.type = "sawtooth";
    oscillator.frequency.setValueAtTime(120, startTime);
    oscillator.frequency.exponentialRampToValueAtTime(48, endTime);
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(820, startTime);

    gainNode.gain.setValueAtTime(0.0001, startTime);
    gainNode.gain.linearRampToValueAtTime(0.06, startTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, endTime + 0.08);

    oscillator.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(context.destination);
    oscillator.start(startTime);
    oscillator.stop(endTime + 0.08);
  }

  playBossExplosion() {
    this.playTone({
      frequency: 140,
      duration: 0.24,
      type: "sawtooth",
      gain: 0.07,
      attack: 0.004,
      release: 0.12,
    });
  }

  playPlayerHit() {
    if (this.playAudioClip(this.crashAudio, 0.54)) {
      return;
    }

    this.playTone({
      frequency: 180,
      duration: 0.11,
      type: "triangle",
      gain: 0.05,
      attack: 0.003,
      release: 0.08,
    });
  }

  silenceAll() {
    this.pauseMusic();
    if (this.context && this.context.state === "running") {
      this.context.suspend().catch(() => {});
    }
  }

  resumeIfNeeded() {
    if (this.musicEnabled) {
      this.playMusic();
    }
    if (document.visibilityState === "visible" && this.context && this.context.state === "suspended") {
      this.context.resume().catch(() => {});
    }
  }
}

class TypingShooterGame {
  constructor(content) {
    this.content = content;
    this.canvas = ui.canvas;
    this.ctx = this.canvas.getContext("2d");
    this.assets = new AssetManager();
    this.sounds = new SoundManager();
    this.playerName = getStoredPlayerName();
    this.leaderboard = getStoredLeaderboard();
    this.pendingResult = null;
    this.lastWordByPool = new Map();
    this.wordQueues = {};
    this.usedWords = new Set();
    this.wordStep = 0;
    this.targetEnemyId = null;
    this.animationFrame = 0;
    this.lastFrameTime = 0;
    this.playerFrameIndex = 0;
    this.playerFrameElapsed = 0;
    this.enemyFrameIndex = 0;
    this.enemyFrameElapsed = 0;
    this.enemyFrameSetIndex = 0;
    this.backgroundOffset = 0;
    this.resize();
    window.addEventListener("resize", () => this.resize());
  }

  async init() {
    const {
      manifests,
      level,
      instanceMap,
      enemyConfigs,
      bossConfig,
    } = this.content;

    const backgroundPath = normalizeAssetPath(manifests.backgrounds[level.backgroundId]);
    const playerKey = instanceMap.playerInstances[level.id].configId;
    const playerPath = manifests.characters[playerKey] ? normalizeAssetPath(manifests.characters[playerKey]) : null;
    const bulletPath = normalizeAssetPath(manifests.effects[instanceMap.playerInstances[level.id].bulletEffectId]);

    await Promise.all([
      this.assets.loadImage("background", backgroundPath),
      ...(playerPath ? [this.assets.loadOptionalImage("player", playerPath)] : []),
      ...PLAYER_FRAME_PATHS.map((path, index) => this.assets.loadImage(`player-frame:${index}`, path).catch(() => null)),
      ...Object.entries(ENEMY_FRAME_SETS).flatMap(([setKey, paths]) =>
        paths.map((path, index) => this.assets.loadImage(`enemy-custom-frame:${setKey}:${index}`, path).catch(() => null)),
      ),
      this.assets.loadOptionalImage("bullet-custom", CUSTOM_ASSET_PATHS.bulletImage),
      this.assets.loadOptionalImage("boom-custom", CUSTOM_ASSET_PATHS.boomImage),
      this.assets.loadImage("bullet", bulletPath),
      ...enemyConfigs.map((enemy) =>
        this.assets.loadImage(`enemy:${enemy.id}`, normalizeAssetPath(manifests.characters[enemy.spriteId])),
      ),
      this.assets.loadImage(`boss:${bossConfig.id}`, normalizeAssetPath(manifests.characters[bossConfig.spriteId])),
      ...Object.entries(manifests.effects).map(([effectId, effectPath]) =>
        this.assets
          .loadImage(`effect:${effectId}`, normalizeAssetPath(effectPath))
          .catch(() => null),
      ),
    ]);

    this.reset();
    this.render();
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    const previousWidth = this.width || rect.width;
    const previousHeight = this.height || rect.height;
    this.canvas.width = Math.round(rect.width * ratio);
    this.canvas.height = Math.round(rect.height * ratio);
    this.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    this.width = rect.width;
    this.height = rect.height;
    this.groundY = this.height * 0.78;

    if (!previousWidth || !previousHeight) return;

    const widthScale = this.width / previousWidth;

    if (Array.isArray(this.enemies)) {
      for (const enemy of this.enemies) {
        enemy.x *= widthScale;
        enemy.y = this.getGroundAlignedY(enemy.height);
        if (enemy.isBoss && typeof enemy.holdX === "number") {
          enemy.holdX *= widthScale;
        }
      }
    }

    if (Array.isArray(this.bullets)) {
      for (const bullet of this.bullets) {
        bullet.x *= widthScale;
        bullet.y *= this.height / previousHeight;
      }
    }

    if (Array.isArray(this.effects)) {
      for (const effect of this.effects) {
        effect.x *= widthScale;
        effect.y *= this.height / previousHeight;
      }
    }
  }

  reset() {
    this.running = false;
    this.finished = false;
    this.score = 0;
    this.lives = this.content.level.lifeRules.startingLives || CONFIG.lives;
    this.wave = 1;
    this.elapsedSeconds = 0;
    this.spawnTimer = 0;
    this.bossBannerUntil = 0;
    this.targetEnemyId = null;
    this.combo = 0;
    this.enemies = [];
    this.bullets = [];
    this.effects = [];
    this.nextEnemyId = 1;
    this.lastFrameTime = 0;
    this.playerFrameIndex = 0;
    this.playerFrameElapsed = 0;
    this.enemyFrameIndex = 0;
    this.enemyFrameElapsed = 0;
    this.enemyFrameSetIndex = 0;
    this.backgroundOffset = 0;
    this.pendingResult = null;
    this.wordQueues = {};
    this.usedWords = new Set();
    this.wordStep = 0;
    this.lastWordByPool.clear();
    ui.gameOverOverlay.classList.remove("is-visible");
    ui.nameEntryOverlay.classList.remove("is-visible");
    ui.bossBanner.classList.remove("is-visible");
    this.updateHud();
  }

  start() {
    this.reset();
    this.running = true;
    this.sounds.playMusic();
    ui.startOverlay.classList.remove("is-visible");
    this.lastFrameTime = performance.now();
    this.tick(this.lastFrameTime);
  }

  tick = (timestamp) => {
    if (!this.running) return;

    const deltaMs = Math.min(40, timestamp - this.lastFrameTime || 16.67);
    const deltaSec = deltaMs / 1000;
    this.lastFrameTime = timestamp;
    this.elapsedSeconds += deltaSec;
    this.playerFrameElapsed += deltaMs;
    this.enemyFrameElapsed += deltaMs;
    this.backgroundOffset += CONFIG.background.scrollSpeed * deltaSec;

    if (this.playerFrameElapsed >= CONFIG.player.frameDurationMs) {
      this.playerFrameElapsed = 0;
      this.playerFrameIndex = (this.playerFrameIndex + 1) % PLAYER_FRAME_PATHS.length;
    }

    if (this.enemyFrameElapsed >= CONFIG.player.frameDurationMs) {
      this.enemyFrameElapsed = 0;
      this.enemyFrameIndex = (this.enemyFrameIndex + 1) % ENEMY_FRAME_PATHS.length;
    }

    this.updateSpawning(deltaSec);
    this.updateEnemies(deltaSec);
    this.updateBullets(deltaSec);
    this.updateEffects(deltaSec);
    this.updateBossState();
    this.updateHud();
    this.render();

    if (this.running) {
      this.animationFrame = window.requestAnimationFrame(this.tick);
    }
  };

  updateSpawning(deltaSec) {
    if (this.finished) return;

    const level = this.content.level;
    const spawnRules = level.spawnRules;
    const rate = spawnRules.baseRate + (this.elapsedSeconds / 24) * spawnRules.rateRampPerMinute;
    const spawnDelay = 1 / Math.max(0.55, rate);
    const activeEnemyCount = this.enemies.length;

    this.spawnTimer -= deltaSec;

    if (activeEnemyCount > 0 || this.spawnTimer > 0) return;

    this.spawnTimer = spawnDelay;
    this.spawnEnemy();
  }

  spawnEnemy() {
    const level = this.content.level;
    const availableIds = this.content.instanceMap.enemyInstances[level.id];
    const availableConfigs = availableIds.map((id) => this.content.enemyConfigMap[id]);
    const totalWeight = availableConfigs.reduce((sum, enemy) => sum + (enemy.spawnWeight || 1), 0);
    let pick = Math.random() * totalWeight;
    let chosen = availableConfigs[0];

    for (const enemy of availableConfigs) {
      pick -= enemy.spawnWeight || 1;
      if (pick <= 0) {
        chosen = enemy;
        break;
      }
    }

    const word = this.pickWordForDifficulty(chosen.wordDifficultyBias || 0);
    const laneIndex = 0;
    const laneY = this.getGroundAlignedY(160);
    let enemySet = "enemy1";

    if (this.elapsedSeconds >= 70) {
      const lateSets = ["enemy1", "enemy2", "enemy3"];
      enemySet = lateSets[Math.floor(Math.random() * lateSets.length)];
    } else if (this.elapsedSeconds >= 40) {
      enemySet = Math.random() > 0.5 ? "enemy2" : "enemy1";
    } else if (this.elapsedSeconds >= 20) {
      enemySet = "enemy2";
    }

    this.enemies.push({
      id: `enemy-${this.nextEnemyId++}`,
      configId: chosen.id,
      spriteKey: `enemy:${chosen.id}`,
      customEnemySet: enemySet,
      x: this.width + 80 + Math.random() * 120,
      y: laneY,
      width: 160,
      height: 160,
      speed: chosen.moveSpeed + Math.min(120, this.elapsedSeconds * 1.6),
      word,
      progress: 0,
      isBoss: false,
      laneIndex,
      flash: 0,
    });
  }

  getGroundAlignedY(height) {
    return this.groundY - height + CONFIG.lane.offsetY;
  }

  pickWordForDifficulty(bias) {
    const level = this.content.level;
    const targetLength = clamp(
      level.difficultyRules.startWordLength + Math.floor(this.wordStep / 2) + Math.max(0, bias),
      level.difficultyRules.startWordLength,
      level.difficultyRules.maxWordLength,
    );
    const candidateWords = [];
    const poolIds = [...new Set([...level.wordPools.early, ...level.wordPools.mid, ...level.wordPools.late])];

    for (const poolId of poolIds) {
      const words = this.content.wordLists[poolId] || [];
      for (const word of words) {
        if (this.usedWords.has(word)) continue;
        candidateWords.push({ poolId, word });
      }
    }

    if (candidateWords.length === 0) {
      return "type";
    }

    const preferredLengths = [
      targetLength,
      Math.max(level.difficultyRules.startWordLength, targetLength - 1),
      Math.min(level.difficultyRules.maxWordLength, targetLength + 1),
      Math.max(level.difficultyRules.startWordLength, targetLength - 2),
      Math.min(level.difficultyRules.maxWordLength, targetLength + 2),
    ];

    let candidateEntry = null;
    for (const length of preferredLengths) {
      candidateEntry = candidateWords.find(({ word }) => word.length === length) || null;
      if (candidateEntry) break;
    }

    if (!candidateEntry) {
      candidateEntry = candidateWords.reduce((best, entry) => {
        if (!best) return entry;
        return Math.abs(entry.word.length - targetLength) < Math.abs(best.word.length - targetLength) ? entry : best;
      }, null);
    }

    if (!candidateEntry) {
      return "type";
    }

    this.usedWords.add(candidateEntry.word);
    this.wordStep += 1;
    this.lastWordByPool.set(candidateEntry.poolId, candidateEntry.word);
    return candidateEntry.word;
  }

  updateEnemies(deltaSec) {
    const hitPadding = CONFIG.combat.playerHitPadding;

    for (const enemy of this.enemies) {
      enemy.x -= enemy.speed * deltaSec;
      enemy.flash = Math.max(0, enemy.flash - deltaSec * 4);
    }

    for (let index = this.enemies.length - 1; index >= 0; index -= 1) {
      const enemy = this.enemies[index];
      if (enemy.x + enemy.width * 0.4 <= CONFIG.player.x + hitPadding) {
        this.handleEnemyReachPlayer(enemy);
        this.enemies.splice(index, 1);
      }
    }
  }

  updateBullets(deltaSec) {
    for (let index = this.bullets.length - 1; index >= 0; index -= 1) {
      const bullet = this.bullets[index];
      const enemy = this.enemies.find((item) => item.id === bullet.targetId);
      if (!enemy) {
        this.bullets.splice(index, 1);
        continue;
      }

      bullet.endX = enemy.x + enemy.width * 0.4;
      bullet.impactX = enemy.x + enemy.width * 0.5;
      bullet.impactY = enemy.y + enemy.height * 0.38;

      const step = bullet.speed * deltaSec;

      if (bullet.x >= bullet.endX - Math.max(2, CONFIG.bullet.width * 0.15)) {
        this.resolveBulletImpact(bullet, enemy);
        this.bullets.splice(index, 1);
        continue;
      }

      bullet.x += step;
    }
  }

  updateEffects(deltaSec) {
    for (let index = this.effects.length - 1; index >= 0; index -= 1) {
      const effect = this.effects[index];
      effect.life -= deltaSec;
      if (effect.life <= 0) {
        this.effects.splice(index, 1);
      }
    }
  }

  updateBossState() {
    if (this.bossBannerUntil) {
      ui.bossBanner.classList.remove("is-visible");
      this.bossBannerUntil = 0;
    }
  }

  handleKeyDown(event) {
    if (!this.running || this.finished) return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (ui.nameEntryOverlay.classList.contains("is-visible")) return;

    const key = event.key;
    if (!/^[a-zA-Z]$/.test(key)) return;

    event.preventDefault();

    const letter = key.toLowerCase();
    let target = this.getCurrentTarget();

    if (!target) {
      target = this.acquireTarget(letter);
    }

    if (!target) {
      return;
    }

    const expected = target.word[target.progress]?.toLowerCase();
    if (expected !== letter) {
      return;
    }

    this.targetEnemyId = target.id;
    target.progress += 1;
    target.flash = 1;
    this.score += this.content.level.scoringRules.pointsPerLetterHit;
    const isFinalHit = target.progress >= target.word.length;
    this.spawnBullet(target, isFinalHit);
    this.sounds.playLetterHit();
  }

  getCurrentTarget() {
    return this.enemies.find((enemy) => enemy.id === this.targetEnemyId) || null;
  }

  acquireTarget(letter) {
    const matching = this.enemies
      .filter((enemy) => enemy.word[enemy.progress]?.toLowerCase() === letter)
      .sort((a, b) => {
        const aScore = a.x - (a.isBoss ? 40 : 0);
        const bScore = b.x - (b.isBoss ? 40 : 0);
        return aScore - bScore;
      });

    if (matching.length === 0) return null;
    this.targetEnemyId = matching[0].id;
    return matching[0];
  }

  spawnBullet(enemy, isFinalHit = false) {
    const startX = CONFIG.player.x + 96;
    const startY = this.getGroundAlignedY(CONFIG.player.height) + CONFIG.player.height * 0.54;
    const endX = enemy.x + enemy.width * 0.4;
    const impactX = enemy.x + enemy.width * 0.5;
    const impactY = enemy.y + enemy.height * 0.38;

    this.bullets.push({
      targetId: enemy.id,
      isFinalHit,
      x: startX,
      y: startY,
      endX,
      impactX,
      impactY,
      speed: CONFIG.bullet.speed,
    });
  }

  resolveBulletImpact(bullet, enemy) {
    this.spawnEffect(bullet.isFinalHit ? "death" : "hit", bullet.impactX, bullet.impactY);

    if (bullet.isFinalHit) {
      this.destroyEnemy(enemy, { playEffect: false });
    }
  }

  spawnEffect(type, x, y) {
    const effectId = this.content.instanceMap.effectInstances[this.content.level.id][type === "hit" ? "hit" : "death"];

    this.effects.push({
      type,
      imageKey: `effect:${effectId}`,
      customImageKey: "boom-custom",
      x,
      y,
      size: 96,
      life: type === "hit" ? 0.18 : 0.32,
      maxLife: type === "hit" ? 0.18 : 0.32,
    });
  }

  destroyEnemy(enemy, options = {}) {
    const { playEffect = true } = options;
    this.score += this.content.level.scoringRules.pointsPerEnemyKill;
    if (playEffect) {
      this.spawnEffect("death", enemy.x + enemy.width * 0.45, enemy.y + enemy.height * 0.52);
    }
    this.sounds.playEnemyExplosion();
    this.enemies = this.enemies.filter((item) => item.id !== enemy.id);
    if (this.targetEnemyId === enemy.id) {
      this.targetEnemyId = null;
    }
    this.spawnTimer = Math.max(this.spawnTimer, 0.3);
  }

  handleEnemyReachPlayer(enemy) {
    this.sounds.playPlayerHit();
    this.lives -= this.content.level.lifeRules.damageOnEnemyReachPlayer || 1;
    this.spawnEffect("death", CONFIG.player.x + 24, enemy.y + enemy.height * 0.5);
    if (this.targetEnemyId === enemy.id) {
      this.targetEnemyId = null;
    }
    this.spawnTimer = Math.max(this.spawnTimer, 0.45);
    if (this.lives <= 0) {
      this.endRun(false);
    }
  }

  updateHud() {
    ui.score.textContent = formatScore(this.score);
    ui.wave.textContent = String(1 + Math.floor(this.elapsedSeconds / 20));
    ui.target.textContent = this.getCurrentTarget()?.word.toUpperCase() || "--";
    this.renderLives();
  }

  renderLives() {
    ui.lives.innerHTML = "";
    for (let index = 0; index < this.lives; index += 1) {
      const icon = document.createElement("img");
      icon.src = HEART_ICON_PATH;
      icon.alt = "";
      icon.width = 22;
      icon.height = 22;
      ui.lives.appendChild(icon);
    }
  }

  buildResult() {
    return {
      name: "",
      score: this.score,
      date: new Date().toISOString(),
    };
  }

  qualifiesForLeaderboard(result) {
    if (this.leaderboard.length < LEADERBOARD_LIMIT) return true;
    return result.score > Number(this.leaderboard[this.leaderboard.length - 1].score || 0);
  }

  saveResult(result) {
    const nextEntries = [...this.leaderboard, result]
      .sort((a, b) => Number(b.score || 0) - Number(a.score || 0))
      .slice(0, LEADERBOARD_LIMIT);

    this.leaderboard = nextEntries;
    saveLeaderboard(nextEntries);
    postScoreUpdated();
  }

  endRun(victory) {
    if (this.finished) return;
    this.finished = true;
    this.running = false;
    this.sounds.pauseMusic();
    window.cancelAnimationFrame(this.animationFrame);

    const result = this.buildResult();
    if (this.qualifiesForLeaderboard(result)) {
      this.pendingResult = { result, victory };
      ui.nameEntrySummary.textContent = `You scored ${formatScore(result.score)} and made the top ${LEADERBOARD_LIMIT}.`;
      ui.nameEntryInput.value = this.playerName;
      ui.nameEntryOverlay.classList.add("is-visible");
      window.requestAnimationFrame(() => {
        ui.nameEntryInput.focus();
        ui.nameEntryInput.select();
      });
      return;
    }

    this.showResults(victory, result.score);
  }

  confirmNameEntry(rawName) {
    if (!this.pendingResult) return;

    this.playerName = (rawName.trim() || "PLAYER").slice(0, 12).toUpperCase();
    window.localStorage.setItem(PLAYER_NAME_KEY, this.playerName);

    this.saveResult({
      ...this.pendingResult.result,
      name: this.playerName,
    });

    ui.nameEntryOverlay.classList.remove("is-visible");
    this.showResults(this.pendingResult.victory, this.pendingResult.result.score);
    this.pendingResult = null;
  }

  showResults(victory, score) {
    void victory;
    ui.gameOverKicker.textContent = "Mission Failed";
    ui.gameOverTitle.textContent = "Out of Lives";
    ui.gameOverSummary.textContent = `You reached wave ${1 + Math.floor(this.elapsedSeconds / 20)} and scored ${formatScore(score)} points.`;
    ui.gameOverOverlay.classList.add("is-visible");
  }

  render() {
    const ctx = this.ctx;
    const background = this.assets.get("background");

    ctx.clearRect(0, 0, this.width, this.height);

    if (background) {
      const scale = (this.height / background.height) * CONFIG.background.scaleBoost;
      const tileWidth = Math.max(CONFIG.background.minTileWidth, background.width * scale);
      const offset = ((this.backgroundOffset % tileWidth) + tileWidth) % tileWidth;

      for (let x = -offset; x < this.width + tileWidth; x += tileWidth) {
        ctx.drawImage(background, x, CONFIG.background.offsetY, tileWidth, this.height);
      }
    } else {
      const gradient = ctx.createLinearGradient(0, 0, 0, this.height);
      gradient.addColorStop(0, "#203672");
      gradient.addColorStop(0.6, "#1a3e30");
      gradient.addColorStop(1, "#12111d");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, this.width, this.height);
    }

    this.drawSceneChrome(ctx);
    this.drawPlayer(ctx);
    this.drawEnemies(ctx);
    this.drawBullets(ctx);
    this.drawEffects(ctx);
  }

  drawSceneChrome(ctx) {
    void ctx;
  }

  drawPlayer(ctx) {
    const image = this.assets.get(`player-frame:${this.playerFrameIndex}`) || this.assets.get("player");
    const bob = this.running && !this.finished ? Math.sin(performance.now() * 0.012) * 4 : 0;
    const x = CONFIG.player.x;
    const y = this.getGroundAlignedY(CONFIG.player.height) + bob;

    ctx.save();
    if (image) {
      ctx.drawImage(image, x, y, CONFIG.player.width, CONFIG.player.height);
    } else {
      ctx.fillStyle = "#ffd56a";
      ctx.fillRect(x + 18, y + 12, 54, 82);
    }
    ctx.restore();
  }

  drawEnemies(ctx) {
    const target = this.getCurrentTarget();

    for (const enemy of this.enemies) {
      const customEnemyImage = this.assets.get(`enemy-custom-frame:${enemy.customEnemySet || "enemy1"}:${this.enemyFrameIndex}`);
      const image = customEnemyImage || this.assets.get(enemy.spriteKey);
      const y = enemy.y;

      ctx.save();
      if (image) {
        ctx.drawImage(image, enemy.x, y, enemy.width, enemy.height);
      } else {
        ctx.fillStyle = enemy.isBoss ? "#b85d5d" : "#7e93e8";
        ctx.fillRect(enemy.x, y + 18, enemy.width, enemy.height - 18);
      }
      ctx.restore();

      this.drawWord(ctx, enemy, target?.id === enemy.id);
    }
  }

  drawWord(ctx, enemy, isTarget) {
    const x = Math.round(enemy.x + enemy.width * 0.5);
    const y = Math.round(enemy.y - 32);
    const word = enemy.word.toUpperCase();

    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = '700 30px "Courier New", "Lucida Console", monospace';
    ctx.letterSpacing = "0px";
    ctx.lineJoin = "round";
    ctx.lineWidth = 6;
    const metrics = ctx.measureText(word);
    const paddingX = 20;
    const tagWidth = Math.ceil(metrics.width + paddingX * 2);
    const tagHeight = 42;
    const tagX = Math.round(x - tagWidth / 2);
    const tagY = Math.round(y - tagHeight / 2);

    ctx.fillStyle = isTarget ? "rgba(22, 16, 45, 0.92)" : "rgba(14, 19, 37, 0.88)";
    ctx.strokeStyle = isTarget ? "rgba(255, 208, 116, 0.88)" : "rgba(150, 164, 219, 0.34)";
    ctx.beginPath();
    ctx.roundRect(tagX, tagY, tagWidth, tagHeight, 12);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = "rgba(8, 10, 19, 0.9)";
    ctx.strokeText(word, x, y + 1);
    ctx.fillStyle = "#f8f1e2";
    ctx.fillText(word, x, y + 1);

    if (enemy.progress > 0) {
      const typedWord = word.slice(0, enemy.progress);
      const typedWidth = ctx.measureText(typedWord).width;
      ctx.save();
      ctx.beginPath();
      ctx.rect(Math.round(x - metrics.width / 2) - 1, tagY, Math.ceil(typedWidth) + 2, tagHeight);
      ctx.clip();
      ctx.fillStyle = "#7c87aa";
      ctx.fillText(word, x, y + 1);
      ctx.restore();
    }

    if (isTarget && enemy.progress < word.length) {
      const typedWidth = ctx.measureText(word.slice(0, enemy.progress)).width;
      const currentChar = word[enemy.progress];
      const currentWidth = ctx.measureText(currentChar).width;
      const currentCenterX = Math.round(x - metrics.width / 2 + typedWidth + currentWidth / 2);
      ctx.fillStyle = "#fff0ad";
      ctx.fillText(currentChar, currentCenterX, y + 1);
    }
    ctx.restore();
  }

  drawBullets(ctx) {
    const bulletImage = this.assets.get("bullet-custom") || this.assets.get("bullet");

    for (const bullet of this.bullets) {
      ctx.save();
      ctx.translate(bullet.x, bullet.y);
      if (bulletImage) {
        ctx.drawImage(bulletImage, -CONFIG.bullet.width * 0.5, -CONFIG.bullet.height * 0.5, CONFIG.bullet.width, CONFIG.bullet.height);
      } else {
        ctx.fillStyle = "#ffe48f";
        ctx.fillRect(-12, -2, 24, 4);
      }
      ctx.restore();
    }
  }

  drawEffects(ctx) {
    for (const effect of this.effects) {
      const image =
        (effect.customImageKey ? this.assets.get(effect.customImageKey) : null) || this.assets.get(effect.imageKey);
      const progress = effect.life / effect.maxLife;

      ctx.save();
      ctx.globalAlpha = clamp(progress, 0, 1);
      if (image) {
        ctx.drawImage(image, effect.x - effect.size * 0.5, effect.y - effect.size * 0.5, effect.size, effect.size);
      } else {
        ctx.fillStyle = "rgba(255, 221, 151, 0.72)";
        ctx.beginPath();
        ctx.arc(effect.x, effect.y, effect.size * 0.16, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }
}

async function loadContent() {
  const [level, instanceMap, characters, backgrounds, effects] = await Promise.all([
    loadJson(CONTENT_PATHS.level),
    loadJson(CONTENT_PATHS.instanceMap),
    loadJson(CONTENT_PATHS.charactersManifest),
    loadJson(CONTENT_PATHS.backgroundsManifest),
    loadJson(CONTENT_PATHS.effectsManifest),
  ]);

  const enemyConfigs = await Promise.all(
    level.enemyPool.map((enemyId) => loadJson(`./src/content/enemies/${enemyId}.json`)),
  );
  const bossConfig = await loadJson(`./src/content/bosses/${level.bossId.replace(/_/g, "-")}.json`);

  const poolIds = [...new Set([...level.wordPools.early, ...level.wordPools.mid, ...level.wordPools.late, ...level.wordPools.boss])];
  const wordListEntries = await Promise.all(
    poolIds.map(async (poolId) => [poolId, (await loadText(`./src/content/wordlists/${poolId}.txt`)).trim().split(/\s+/)]),
  );

  return {
    level,
    instanceMap,
    manifests: {
      characters,
      backgrounds,
      effects,
    },
    enemyConfigs,
    enemyConfigMap: Object.fromEntries(enemyConfigs.map((enemy) => [enemy.id, enemy])),
    bossConfig,
    wordLists: Object.fromEntries(wordListEntries),
  };
}

const isEmbedded = new URLSearchParams(window.location.search).get("embed") === "1";
let game = null;

if (isEmbedded) {
  ui.topbar.style.display = "none";
  document.body.classList.add("is-embedded");
}

function goBackToArcade() {
  if (window.parent && window.parent !== window) {
    window.parent.postMessage({ type: "typing-shooter:close" }, "*");
    return;
  }
  window.location.href = "../";
}

document.addEventListener("visibilitychange", () => {
  if (!game) return;
  if (document.visibilityState !== "visible") {
    game.sounds.silenceAll();
    return;
  }
  game.sounds.resumeIfNeeded();
});

window.addEventListener("keydown", (event) => {
  if (!game) return;
  game.handleKeyDown(event);
});

ui.startButton.addEventListener("click", () => {
  if (game) {
    game.start();
  }
});

ui.restartButton.addEventListener("click", () => {
  if (!game) return;
  ui.gameOverOverlay.classList.remove("is-visible");
  game.start();
});

ui.backButton.addEventListener("click", goBackToArcade);
ui.restartBackButton.addEventListener("click", goBackToArcade);

ui.nameEntryForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (game) {
    game.confirmNameEntry(ui.nameEntryInput.value);
  }
});

loadContent()
  .then(async (content) => {
    game = new TypingShooterGame(content);
    await game.init();
  })
  .catch((error) => {
    console.error(error);
    ui.startOverlay.classList.add("is-visible");
    ui.startOverlay.querySelector(".overlay-card p").textContent = "Failed to load Typing Shooter assets.";
    ui.startButton.disabled = true;
  });
