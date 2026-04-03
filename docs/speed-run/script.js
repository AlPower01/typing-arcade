"use strict";

const MUSIC_STORAGE_KEY = "typing-arcade-music-enabled";
const LEADERBOARD_STORAGE_KEY = "typing-arcade-best-scores-v2";
const LEADERBOARD_GAME_ID = "speed-run";
const HEART_ICON_PATH = "../images/heart.svg";
const LEADERBOARD_LIMIT = 6;

/*
  Speed Run
  Replace assets by editing ASSET_PATHS below.
  Missing assets fall back gracefully:
  - no background => gradient sky
  - no effect audio => synthesized Web Audio tones

  TODO: Swap these filenames when you add final art or sound.
*/

const ASSET_PATHS = {
  // TODO: Replace if you add a different dedicated background image for Speed Run.
  background: "./images/bg.png",
  // TODO: Replace if you add different background music for Speed Run.
  backgroundMusic: "./images/bg_music.mp3",
  // TODO: Replace if you add a different fail sound for Speed Run.
  completeSound: "./images/complete.mp3",
  // TODO: Replace if you add a different crash sound for Speed Run.
  crashSound: "./images/crash.mp3",
  // TODO: Replace if you add a different completion effect for Speed Run.
  boom: "./images/boom.png",
  // TODO: Replace if you add a different firing sound for Speed Run.
  bulletSound: "./images/bullet.mp3",
  // TODO: Replace if you add a different projectile image for Speed Run.
  bullet: "./images/bullet.png",
  // TODO: Replace these if you add final running sprites for the player.
  run1: "./images/run1.png",
  run2: "./images/run2.png",
};

const CONFIG = {
  lives: 3,
  groundHeight: 168,
  player: {
    x: 138,
    width: 122,
    height: 122,
    runBobSpeed: 0.014,
  },
  obstacle: {
    width: 124,
    height: 134,
    startSpeed: 170,
    maxSpeed: 360,
    speedRampPerSecond: 3.5,
    spawnDelayStart: 2100,
    spawnDelayMin: 1300,
    spawnRampPerSecond: 5,
  },
  scorePerJump: 140,
  streakBonus: 20,
  flashDuration: 0.14,
  shakeDuration: 0.16,
  alphabet: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  background: {
    scrollFactor: 0.2,
    minTileWidth: 520,
  },
};

const WORD_BANK = {
  2: ["GO", "UP", "IN", "ON", "BY", "TO", "AT", "WE", "DO", "SO", "MY", "NO"],
  3: ["RUN", "HOP", "ZIP", "TAP", "BOX", "FOX", "SKY", "JET", "DIP", "LAP", "RAY", "NOD"],
  4: ["JUMP", "DASH", "TYPE", "WIND", "PLAY", "GLOW", "RACE", "FAST", "TURN", "LANE", "GRID", "SPIN"],
  5: ["SHIFT", "TRACK", "BLAZE", "PIXEL", "ROBOT", "SPEED", "BOOST", "FLASH", "DRIVE", "QUICK", "LEVEL", "LIGHT"],
  6: ["SPRING", "ROCKET", "BLASTER", "TYPING", "RHYTHM", "SHADOW", "TARGET", "THRUST", "CHARGE", "STRIDE", "PHOTON", "VECTOR"],
  7: ["BOOSTER", "CIRCUIT", "GRAVITY", "JETPACK", "MARQUEE", "ROOFTOP", "TURBINE", "SKYLINE", "HOTWIRE", "SLIPWAY", "GLIDERS", "OVERLAP"],
};

const ui = {
  canvas: document.getElementById("gameCanvas"),
  score: document.getElementById("scoreValue"),
  lives: document.getElementById("livesValue"),
  nextWord: document.getElementById("nextWordValue"),
  startOverlay: document.getElementById("startOverlay"),
  gameOverOverlay: document.getElementById("gameOverOverlay"),
  gameOverTitle: document.getElementById("gameOverTitle"),
  gameOverSummary: document.getElementById("gameOverSummary"),
  nameEntryOverlay: document.getElementById("nameEntryOverlay"),
  nameEntrySummary: document.getElementById("nameEntrySummary"),
  nameEntryForm: document.getElementById("nameEntryForm"),
  nameEntryInput: document.getElementById("nameEntryInput"),
  startButton: document.getElementById("startButton"),
  startBackButton: document.getElementById("startBackButton"),
  restartButton: document.getElementById("restartButton"),
  restartBackButton: document.getElementById("restartBackButton"),
  backButton: document.getElementById("backButton"),
  topbar: document.getElementById("topbar"),
};

class AssetManager {
  constructor(paths) {
    this.paths = paths;
    this.images = {
      background: null,
      boom: null,
      bullet: null,
      run1: null,
      run2: null,
    };
  }

  load() {
    this.images.background = this.loadOptionalImage(this.paths.background);
    this.images.boom = this.loadOptionalImage(this.paths.boom);
    this.images.bullet = this.loadOptionalImage(this.paths.bullet);
    this.images.run1 = this.loadOptionalImage(this.paths.run1);
    this.images.run2 = this.loadOptionalImage(this.paths.run2);
  }

  loadOptionalImage(src) {
    if (!src) return null;
    const image = new Image();
    image.decoding = "async";
    image.src = src;
    image.addEventListener("error", () => {
      image.dataset.failed = "true";
    });
    return image;
  }

  getImage(key) {
    const image = this.images[key];
    if (!image || image.dataset.failed === "true" || !image.complete) return null;
    return image;
  }
}

class SoundManager {
  constructor() {
    this.context = null;
    this.enabled = true;
    this.activeAudio = new Set();
    this.shotAudio = this.loadOptionalAudio(ASSET_PATHS.bulletSound);
    this.crashAudio = this.loadOptionalAudio(ASSET_PATHS.crashSound);
    this.completeAudio = this.loadOptionalAudio(ASSET_PATHS.completeSound);
    this.musicAudio = this.loadOptionalAudio(ASSET_PATHS.backgroundMusic);
    if (this.musicAudio) {
      this.musicAudio.loop = true;
      this.musicAudio.volume = 0.16;
    }
    this.musicEnabled = this.getStoredMusicEnabled();
  }

  getStoredMusicEnabled() {
    return window.localStorage.getItem(MUSIC_STORAGE_KEY) !== "false";
  }

  loadOptionalAudio(src) {
    if (!src) return null;
    const audio = new Audio(src);
    audio.preload = "auto";
    audio.addEventListener("error", () => {
      audio.dataset.failed = "true";
    });
    return audio;
  }

  playOptionalAudio(audio, volume = 0.7) {
    if (!audio || audio.dataset.failed === "true") return false;
    const instance = audio.cloneNode();
    instance.volume = volume;
    this.activeAudio.add(instance);
    instance.addEventListener("ended", () => {
      this.activeAudio.delete(instance);
    });
    instance.addEventListener("pause", () => {
      this.activeAudio.delete(instance);
    });
    instance.play().catch(() => {});
    return true;
  }

  playMusic() {
    if (!this.musicAudio || this.musicAudio.dataset.failed === "true" || !this.musicEnabled) return;
    this.musicAudio.volume = 0.16;
    this.musicAudio.play().catch(() => {});
  }

  pauseMusic() {
    if (!this.musicAudio) return;
    this.musicAudio.pause();
    this.musicAudio.currentTime = 0;
  }

  setMusicEnabled(enabled) {
    this.musicEnabled = enabled;
    window.localStorage.setItem(MUSIC_STORAGE_KEY, enabled ? "true" : "false");
    if (enabled) {
      this.playMusic();
      return;
    }
    this.pauseMusic();
  }

  silenceAll() {
    this.pauseMusic();
    for (const audio of this.activeAudio) {
      audio.pause();
      audio.currentTime = 0;
    }
    this.activeAudio.clear();
    if (this.context && this.context.state === "running") {
      this.context.suspend().catch(() => {});
    }
  }

  resumeIfNeeded() {
    if (this.context && this.context.state === "suspended" && document.visibilityState === "visible") {
      this.context.resume().catch(() => {});
    }
    if (this.musicEnabled) {
      this.playMusic();
    }
  }

  ensureContext() {
    if (!this.enabled) return null;
    if (!this.context) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) {
        this.enabled = false;
        return null;
      }
      this.context = new AudioContextClass();
    }
    if (this.context.state === "suspended") {
      this.context.resume().catch(() => {});
    }
    return this.context;
  }

  playShoot() {
    if (this.playOptionalAudio(this.shotAudio, 0.68)) {
      return;
    }

    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "square";
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.exponentialRampToValueAtTime(210, now + 0.1);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.08, now + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.11);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.12);
  }

  playHit() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(560, now);
    osc.frequency.exponentialRampToValueAtTime(320, now + 0.08);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.075, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.11);
  }

  playSuccess() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.exponentialRampToValueAtTime(440, now + 0.14);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.1, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.22);
  }

  playCrash() {
    if (this.playOptionalAudio(this.crashAudio, 0.78)) {
      return;
    }

    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.exponentialRampToValueAtTime(42, now + 0.26);

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(640, now);
    filter.frequency.exponentialRampToValueAtTime(90, now + 0.28);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.18, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.32);
  }

  playComplete() {
    return this.playOptionalAudio(this.completeAudio, 0.76);
  }
}

function getLeaderboardEntries(gameId) {
  try {
    const raw = window.localStorage.getItem(LEADERBOARD_STORAGE_KEY);
    const stored = raw ? JSON.parse(raw) : {};
    return Array.isArray(stored?.[gameId]) ? stored[gameId] : [];
  } catch {
    return [];
  }
}

function qualifiesForLeaderboard(gameId, score) {
  if (!Number.isFinite(score) || score <= 0) return false;
  const existingEntries = getLeaderboardEntries(gameId);
  return (
    existingEntries.length < LEADERBOARD_LIMIT ||
    Math.floor(score) > Math.min(...existingEntries.map((entry) => Number(entry.score) || 0))
  );
}

function saveLeaderboardEntry(gameId, score, name) {
  if (!Number.isFinite(score) || score <= 0) return;

  let nextEntries = null;

  try {
    const raw = window.localStorage.getItem(LEADERBOARD_STORAGE_KEY);
    const stored = raw ? JSON.parse(raw) : {};
    const next = { ...(stored && typeof stored === "object" ? stored : {}) };
    const existingEntries = Array.isArray(next[gameId]) ? next[gameId] : [];

    nextEntries = [
      ...existingEntries,
      {
        name,
        score: Math.floor(score),
        date: new Date().toISOString(),
      },
    ]
      .sort((a, b) => b.score - a.score)
      .slice(0, LEADERBOARD_LIMIT);

    next[gameId] = nextEntries;
    window.localStorage.setItem(LEADERBOARD_STORAGE_KEY, JSON.stringify(next));
  } catch {
    return;
  }

  if (window.parent && window.parent !== window) {
    window.parent.postMessage({ type: "typing-arcade:score-updated", gameId, entries: nextEntries }, "*");
  }
}

function renderLivesMarkup(count) {
  if (count <= 0) {
    return "0";
  }

  return Array.from({ length: count }, (_, index) =>
    `<img class="life-heart" src="${HEART_ICON_PATH}" alt="" aria-hidden="true" data-heart-index="${index}" />`,
  ).join("");
}

class SpeedRunGame {
  constructor(canvas, assets, sound) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.assets = assets;
    this.sound = sound;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = 0;
    this.height = 0;
    this.groundY = 0;
    this.animationFrame = 0;
    this.lastFrameTime = 0;
    this.wordQueues = {};
    this.usedWords = new Set();
    this.reset();
    this.resize();
  }

  reset() {
    this.started = false;
    this.running = false;
    this.gameOver = false;
    this.elapsed = 0;
    this.score = 0;
    this.lives = CONFIG.lives;
    this.streak = 0;
    this.bestStreak = 0;
    this.spawnTimer = CONFIG.obstacle.spawnDelayStart;
    this.shakeTime = 0;
    this.flashTime = 0;
    this.effects = [];
    this.backgroundOffset = 0;
    this.pendingLeaderboardScore = null;
    ui.nameEntryInput.value = "";
    ui.nameEntryOverlay.classList.remove("is-visible");
    this.wordQueues = {};
    this.usedWords = new Set();
    this.player = {
      x: CONFIG.player.x,
      y: 0,
      width: CONFIG.player.width,
      height: CONFIG.player.height,
      pose: "run",
    };
    this.obstacles = [];
    this.placePlayerOnGround();
    this.updateHud();
  }

  start() {
    this.reset();
    this.sound.ensureContext();
    this.sound.playMusic();
    this.started = true;
    this.running = true;
    ui.startOverlay.classList.remove("is-visible");
    ui.gameOverOverlay.classList.remove("is-visible");
    ui.nameEntryOverlay.classList.remove("is-visible");
  }

  restart() {
    this.start();
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.width = rect.width;
    this.height = rect.height;
    this.canvas.width = Math.floor(rect.width * this.dpr);
    this.canvas.height = Math.floor(rect.height * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.groundY = this.height - CONFIG.groundHeight;
    this.placePlayerOnGround();
  }

  placePlayerOnGround() {
    if (!this.player) return;
    this.player.y = this.groundY - this.player.height;
    this.player.pose = "run";
  }

  updateHud() {
    ui.score.textContent = String(this.score);
    ui.lives.innerHTML = renderLivesMarkup(this.lives);
    const currentObstacle = this.obstacles.find((obstacle) => !obstacle.resolved);
    ui.nextWord.textContent = currentObstacle ? currentObstacle.word.toUpperCase() : "--";
  }

  getLevel() {
    return 1 + Math.floor(this.elapsed / 12000);
  }

  getWordLength() {
    const level = this.getLevel();
    if (level <= 1) return 2;
    if (level === 2) return 3;
    if (level === 3) return 4;
    if (level === 4) return 5;
    if (level === 5) return 6;
    return 7;
  }

  getWordQueue(length) {
    if (!this.wordQueues[length] || this.wordQueues[length].length === 0) {
      const pool = [...(WORD_BANK[length] || WORD_BANK[7] || [])].filter((word) => !this.usedWords.has(word));
      for (let index = pool.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [pool[index], pool[swapIndex]] = [pool[swapIndex], pool[index]];
      }
      this.wordQueues[length] = pool;
    }

    return this.wordQueues[length];
  }

  getSpeed() {
    return Math.min(
      CONFIG.obstacle.maxSpeed,
      CONFIG.obstacle.startSpeed + (this.elapsed / 1000) * CONFIG.obstacle.speedRampPerSecond
    );
  }

  getSpawnDelay() {
    return Math.max(
      CONFIG.obstacle.spawnDelayMin,
      CONFIG.obstacle.spawnDelayStart - (this.elapsed / 1000) * CONFIG.obstacle.spawnRampPerSecond
    );
  }

  pickWord() {
    const targetLength = this.getWordLength();
    const lengths = Object.keys(WORD_BANK).map(Number).sort((a, b) => a - b);
    const preferredLengths = [
      targetLength,
      ...lengths.filter((length) => length > targetLength),
      ...lengths.filter((length) => length < targetLength).reverse(),
    ];

    for (const length of preferredLengths) {
      const queue = this.getWordQueue(length);
      if (queue.length === 0) continue;
      const nextWord = queue.shift();
      this.usedWords.add(nextWord);
      return nextWord;
    }

    const fallback = WORD_BANK[targetLength]?.[0] || WORD_BANK[2][0];
    this.usedWords.add(fallback);
    return fallback;
  }

  getObstacleLetterLayout(obstacle) {
    const letterSize = Math.max(20, 42 - obstacle.word.length * 2);
    const spacing = letterSize + 12;
    const totalWidth = Math.max(0, obstacle.word.length * spacing - 12);
    const textStartX = obstacle.x + (obstacle.width - totalWidth) / 2;
    return { letterSize, spacing, textStartX };
  }

  spawnObstacle() {
    const word = this.pickWord();
    this.obstacles = [];
    this.obstacles.push({
      word,
      x: this.width + 80,
      y: this.groundY,
      width: CONFIG.obstacle.width + Math.max(0, word.length - 1) * 26,
      height: CONFIG.obstacle.height,
      speed: this.getSpeed(),
      progress: 0,
      promptWindow: false,
      resolved: false,
      hitPulse: 0,
      scale: 1,
    });
  }

  handleKey(key) {
    if (!this.running || this.gameOver) return;
    if (!/^[a-z]$/i.test(key)) return;

    const normalized = key.toUpperCase();
    const obstacle = this.obstacles[0];

    if (!obstacle || obstacle.resolved || obstacle.word[obstacle.progress] !== normalized) {
      this.streak = 0;
      this.updateHud();
      return;
    }

    const targetIndex = obstacle.progress;
    const { spacing, textStartX } = this.getObstacleLetterLayout(obstacle);
    const targetX = textStartX + targetIndex * spacing;
    const targetY = this.groundY - obstacle.height / 2;
    const muzzle = this.getMuzzlePoint();

    obstacle.progress += 1;
    obstacle.hitPulse = 1;
    this.effects.push({
      type: "shot",
      startX: muzzle.x,
      startY: muzzle.y,
      x: targetX,
      y: targetY,
      age: 0,
      duration: 0.12,
    });
    this.effects.push({
      type: "impact",
      x: targetX,
      y: targetY,
      age: 0,
      duration: 0.14,
    });
    this.sound.playShoot();
    this.sound.playHit();

    if (obstacle.progress >= obstacle.word.length) {
      const boomX = obstacle.x + obstacle.width / 2;
      const boomY = this.groundY - obstacle.height / 2;
      this.obstacles.shift();
      this.spawnTimer = this.getSpawnDelay();
      this.score += CONFIG.scorePerJump + this.streak * CONFIG.streakBonus;
      this.streak += 1;
      this.bestStreak = Math.max(this.bestStreak, this.streak);
      this.effects.push({
        type: "success",
        x: boomX,
        y: boomY,
        age: 0,
        duration: 0.32,
      });
    }

    this.updateHud();
  }

  missObstacle(obstacleIndex) {
    this.obstacles.splice(obstacleIndex, 1);
    this.lives -= 1;
    this.streak = 0;
    this.shakeTime = CONFIG.shakeDuration;
    this.flashTime = CONFIG.flashDuration;
    this.sound.playCrash();
    this.effects.push({
      type: "crash",
      x: this.player.x + this.player.width * 0.8,
      y: this.groundY - this.player.height * 0.2,
      age: 0,
      duration: 0.42,
    });
    this.updateHud();

    if (this.lives <= 0) {
      this.endGame();
    }
  }

  endGame() {
    this.running = false;
    this.gameOver = true;
    this.sound.playComplete();
    ui.gameOverTitle.textContent = "Run Over";
    ui.gameOverSummary.textContent = `Score ${this.score} • Best streak ${this.bestStreak}`;

    if (qualifiesForLeaderboard(LEADERBOARD_GAME_ID, this.score)) {
      this.pendingLeaderboardScore = this.score;
      ui.nameEntrySummary.textContent = `Score ${this.score} made the leaderboard.`;
      ui.nameEntryInput.value = "";
      ui.nameEntryOverlay.classList.add("is-visible");
      window.setTimeout(() => ui.nameEntryInput.focus(), 0);
      return;
    }

    ui.gameOverOverlay.classList.add("is-visible");
  }

  update(deltaMs) {
    const dt = deltaMs / 1000;
    this.updateEffects(dt);

    if (!this.running || this.gameOver) {
      this.shakeTime = Math.max(0, this.shakeTime - dt);
      this.flashTime = Math.max(0, this.flashTime - dt);
      return;
    }

    this.elapsed += deltaMs;
    this.spawnTimer -= deltaMs;
    this.backgroundOffset += this.getSpeed() * CONFIG.background.scrollFactor * dt;

    if (this.spawnTimer <= 0 && this.obstacles.length === 0) {
      this.spawnObstacle();
      this.spawnTimer += this.getSpawnDelay();
    }

    for (let index = this.obstacles.length - 1; index >= 0; index -= 1) {
      const obstacle = this.obstacles[index];
      obstacle.x -= obstacle.speed * dt;
      obstacle.hitPulse = Math.max(0, obstacle.hitPulse - dt * 5.2);
      const obstacleHeight = obstacle.height;

      const collisionX = obstacle.x < this.player.x + this.player.width - 10;
      const collisionY = this.player.y + this.player.height > this.groundY - obstacleHeight + 12;

      if (collisionX && collisionY) {
        this.missObstacle(index);
      } else if (obstacle.x + obstacle.width < -40) {
        this.obstacles.splice(index, 1);
      }
    }

    this.shakeTime = Math.max(0, this.shakeTime - dt);
    this.flashTime = Math.max(0, this.flashTime - dt);
    this.updateHud();
  }

  updateEffects(dt) {
    for (let index = this.effects.length - 1; index >= 0; index -= 1) {
      this.effects[index].age += dt;
      if (this.effects[index].age >= this.effects[index].duration) {
        this.effects.splice(index, 1);
      }
    }
  }

  getMuzzlePoint() {
    return {
      x: this.player.x + this.player.width * 0.84,
      y: this.player.y + this.player.height * 0.42,
    };
  }

  render() {
    const shakeX = this.shakeTime > 0 ? randomBetween(-5, 5) : 0;
    const shakeY = this.shakeTime > 0 ? randomBetween(-3, 3) : 0;

    this.ctx.save();
    this.ctx.translate(shakeX, shakeY);
    this.ctx.clearRect(-20, -20, this.width + 40, this.height + 40);

    this.renderBackground();
    this.renderTrack();
    this.renderObstacles();
    this.renderPlayer();
    this.renderEffects();

    this.ctx.restore();
  }

  renderBackground() {
    const bg = this.assets.getImage("background");
    if (bg) {
      this.drawScrollingBackground(bg);
      return;
    }

    const gradient = this.ctx.createLinearGradient(0, 0, 0, this.height);
    gradient.addColorStop(0, "#7fc9ff");
    gradient.addColorStop(0.65, "#cbefff");
    gradient.addColorStop(1, "#eefbff");
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, this.width, this.height);
  }

  drawScrollingBackground(image) {
    const scale = this.height / image.height;
    const tileWidth = Math.max(CONFIG.background.minTileWidth, image.width * scale);
    const offset = this.backgroundOffset % tileWidth;
    const startX = -offset;

    for (let x = startX - tileWidth; x < this.width + tileWidth; x += tileWidth) {
      this.ctx.drawImage(image, x, 0, tileWidth, this.height);
    }
  }

  renderTrack() {
    this.ctx.fillStyle = "#182235";
    this.ctx.fillRect(0, this.groundY, this.width, this.height - this.groundY);
    this.ctx.fillStyle = "#2b3954";
    this.ctx.fillRect(0, this.groundY, this.width, 12);

    this.ctx.fillStyle = "#050608";
    this.ctx.fillRect(0, this.groundY + 18, this.width, 44);

    const dashOffset = (80 - (this.elapsed * 0.35) % 80) % 80;
    this.ctx.fillStyle = "rgba(94, 90, 81, 0.34)";
    for (let x = -80 + dashOffset; x < this.width + 80; x += 80) {
      this.ctx.fillRect(x, this.groundY + 32, 34, 8);
    }

    if (this.flashTime > 0) {
      this.ctx.save();
      this.ctx.globalAlpha = (this.flashTime / CONFIG.flashDuration) * 0.28;
      this.ctx.fillStyle = "#ffd06b";
      this.ctx.fillRect(0, this.groundY - 8, this.width, 20);
      this.ctx.restore();
    }
  }

  renderPlayer() {
    const bob = Math.sin(this.elapsed * CONFIG.player.runBobSpeed) * 1.5;
    const x = this.player.x;
    const y = this.player.y + bob;
    const frameIndex = Math.sin(this.elapsed * 0.03) > 0 ? 0 : 1;
    const frame = this.assets.getImage(frameIndex === 0 ? "run1" : "run2");

    if (frame) {
      this.ctx.drawImage(frame, x, y, this.player.width, this.player.height);
      return;
    }

    const stride = frameIndex;
    this.ctx.save();
    this.ctx.translate(x, y);
    this.ctx.fillStyle = "#27325f";
    this.ctx.fillRect(12, 26, 46, 34);
    this.ctx.fillStyle = "#f4f8ff";
    this.ctx.fillRect(8, 10, 50, 36);
    this.ctx.fillStyle = "#1a2445";
    this.ctx.fillRect(44, 18, 12, 10);
    this.ctx.fillStyle = "#ff9f59";
    this.ctx.fillRect(58, 24, 12, 8);
    this.ctx.fillStyle = "#ffd66d";
    this.ctx.fillRect(54, 26, 20, 6);
    this.ctx.fillStyle = "#5f3a18";
    this.ctx.fillRect(60, 32, 6, 8);

    this.ctx.fillStyle = "#27325f";
    this.ctx.fillRect(18, 58 + stride * 4, 8, 18 - stride * 4);
    this.ctx.fillRect(42, 58 + (1 - stride) * 4, 8, 18 - (1 - stride) * 4);

    this.ctx.restore();
  }

  renderObstacles() {
    this.ctx.textAlign = "left";
    this.ctx.textBaseline = "middle";

    for (const obstacle of this.obstacles) {
      const baseX = obstacle.x;
      const baseY = this.groundY - obstacle.height;
      const pulseScale = 1 + obstacle.hitPulse * 0.16;
      const { letterSize, spacing, textStartX } = this.getObstacleLetterLayout(obstacle);

      this.ctx.save();
      this.ctx.translate(baseX + obstacle.width / 2, baseY + obstacle.height / 2);
      this.ctx.scale(pulseScale, pulseScale);
      this.ctx.translate(-(baseX + obstacle.width / 2), -(baseY + obstacle.height / 2));

      this.ctx.fillStyle = "#242830";
      this.ctx.fillRect(baseX, baseY, obstacle.width, obstacle.height);
      this.ctx.fillStyle = "#343a44";
      this.ctx.fillRect(baseX + 6, baseY + 6, Math.max(0, obstacle.width - 12), Math.max(0, obstacle.height - 12));

      this.ctx.font = `700 ${letterSize}px "Press Start 2P", monospace`;
      this.ctx.strokeStyle = "rgba(8, 10, 18, 0.72)";
      this.ctx.lineWidth = 8;

      for (let index = 0; index < obstacle.word.length; index += 1) {
        const letter = obstacle.word[index];
        const x = textStartX + index * spacing;
        const y = baseY + obstacle.height / 2;
        const typed = index < obstacle.progress;

        this.ctx.save();
        this.ctx.globalAlpha = typed ? 0.16 : 1;
        this.ctx.strokeText(letter, x, y);
        this.ctx.fillStyle = typed ? "#8692a1" : "#d7dbe1";
        this.ctx.fillText(letter, x, y);
        this.ctx.restore();
      }
      this.ctx.restore();
    }
  }

  renderEffects() {
    const boomImage = this.assets.getImage("boom");
    const bulletImage = this.assets.getImage("bullet");

    for (const effect of this.effects) {
      const progress = effect.age / effect.duration;
      const alpha = 1 - progress;
      this.ctx.save();
      this.ctx.globalAlpha = alpha;
      this.ctx.translate(effect.x, effect.y);

      if (effect.type === "shot") {
        const tipX = effect.startX + (effect.x - effect.startX) * progress;
        const tipY = effect.startY + (effect.y - effect.startY) * progress;
        const angle = Math.atan2(effect.y - effect.startY, effect.x - effect.startX);

        this.ctx.restore();
        this.ctx.save();
        this.ctx.globalAlpha = alpha;

        if (bulletImage) {
          this.ctx.translate(tipX, tipY);
          this.ctx.rotate(angle);
          this.ctx.drawImage(bulletImage, -20, -9, 40, 18);
        } else {
          this.ctx.strokeStyle = "#ffe37e";
          this.ctx.lineWidth = 3;
          this.ctx.beginPath();
          this.ctx.moveTo(effect.startX, effect.startY);
          this.ctx.lineTo(tipX, tipY);
          this.ctx.stroke();
          this.ctx.fillStyle = "#fff7c4";
          this.ctx.beginPath();
          this.ctx.arc(tipX, tipY, 4, 0, Math.PI * 2);
          this.ctx.fill();
        }
      } else if (effect.type === "impact" && boomImage) {
        const size = 30 + progress * 22;
        this.ctx.drawImage(boomImage, -size / 2, -size / 2, size, size);
      } else if (effect.type === "impact") {
        const radius = 6 + progress * 12;
        this.ctx.strokeStyle = "#ffd15d";
        this.ctx.lineWidth = 3;
        for (let i = 0; i < 6; i += 1) {
          const angle = (Math.PI * 2 * i) / 6;
          this.ctx.beginPath();
          this.ctx.moveTo(Math.cos(angle) * radius * 0.3, Math.sin(angle) * radius * 0.3);
          this.ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
          this.ctx.stroke();
        }
      } else if (effect.type === "success" && boomImage) {
        const size = 46 + progress * 44;
        this.ctx.drawImage(boomImage, -size / 2, -size / 2, size, size);
      } else if (effect.type === "success") {
        this.ctx.strokeStyle = "#ffd15d";
        this.ctx.lineWidth = 4;
        const radius = 12 + progress * 22;
        for (let i = 0; i < 10; i += 1) {
          const angle = (Math.PI * 2 * i) / 10;
          this.ctx.beginPath();
          this.ctx.moveTo(Math.cos(angle) * radius * 0.25, Math.sin(angle) * radius * 0.25);
          this.ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
          this.ctx.stroke();
        }
      } else if (effect.type === "crash" && boomImage) {
        const size = 62 + progress * 54;
        this.ctx.drawImage(boomImage, -size / 2, -size / 2, size, size);
      } else {
        this.ctx.strokeStyle = "#ff7a59";
        this.ctx.lineWidth = 4;
        const radius = 16 + progress * 26;
        for (let i = 0; i < 8; i += 1) {
          const angle = (Math.PI * 2 * i) / 8;
          this.ctx.beginPath();
          this.ctx.moveTo(Math.cos(angle) * radius * 0.35, Math.sin(angle) * radius * 0.35);
          this.ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
          this.ctx.stroke();
        }
      }

      this.ctx.restore();
    }
  }

  frame = (timestamp) => {
    if (!this.lastFrameTime) {
      this.lastFrameTime = timestamp;
    }

    const delta = Math.min(32, timestamp - this.lastFrameTime);
    this.lastFrameTime = timestamp;
    this.update(delta);
    this.render();
    this.animationFrame = window.requestAnimationFrame(this.frame);
  };

  startLoop() {
    cancelAnimationFrame(this.animationFrame);
    this.animationFrame = window.requestAnimationFrame(this.frame);
  }
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

const assets = new AssetManager(ASSET_PATHS);
assets.load();
const sound = new SoundManager();

const game = new SpeedRunGame(ui.canvas, assets, sound);
game.startLoop();

const isEmbedded = new URLSearchParams(window.location.search).get("embed") === "1";

if (isEmbedded) {
  ui.topbar.style.display = "none";
  document.body.classList.add("is-embedded");
}

function goBackToArcade() {
  sound.pauseMusic();
  if (window.parent && window.parent !== window) {
    window.parent.postMessage({ type: "speed-run:close" }, "*");
    return;
  }

  window.location.href = "../";
}

window.addEventListener("resize", () => {
  game.resize();
});

window.addEventListener("pagehide", () => {
  sound.silenceAll();
});

window.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") {
    sound.silenceAll();
    return;
  }

  sound.resumeIfNeeded();
});

window.addEventListener("storage", (event) => {
  if (event.key !== MUSIC_STORAGE_KEY) return;
  sound.setMusicEnabled(event.newValue !== "false");
});

window.addEventListener("keydown", (event) => {
  if (ui.nameEntryOverlay.classList.contains("is-visible")) {
    return;
  }

  const target = event.target;
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    return;
  }

  if (/^[a-z]$/i.test(event.key)) {
    event.preventDefault();
    game.handleKey(event.key);
  }
});

ui.startButton.addEventListener("click", () => {
  game.start();
});

ui.nameEntryForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!Number.isFinite(game.pendingLeaderboardScore) || game.pendingLeaderboardScore <= 0) return;

  const name = (ui.nameEntryInput.value.trim() || "PLAYER").slice(0, 12).toUpperCase();
  saveLeaderboardEntry(LEADERBOARD_GAME_ID, game.pendingLeaderboardScore, name || "PLAYER");
  game.pendingLeaderboardScore = null;
  ui.nameEntryOverlay.classList.remove("is-visible");
  ui.gameOverOverlay.classList.add("is-visible");
});

ui.restartButton.addEventListener("click", () => {
  game.restart();
});

ui.backButton.addEventListener("click", goBackToArcade);
ui.startBackButton.addEventListener("click", goBackToArcade);
ui.restartBackButton.addEventListener("click", goBackToArcade);
