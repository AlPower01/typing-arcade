"use strict";

const MUSIC_STORAGE_KEY = "typing-arcade-music-enabled";
const LEADERBOARD_STORAGE_KEY = "typing-arcade-best-scores-v2";
const LEADERBOARD_GAME_ID = "falling-words";
const HEART_ICON_PATH = "../images/heart.svg";
const LEADERBOARD_LIMIT = 6;

/*
  Falling Letters
  Asset replacement:
  1. Update any filenames in ASSET_PATHS below.
  2. Keep files next to this game, or point the paths elsewhere.
  3. Missing assets fall back automatically:
     - no background => gradient sky
     - no cloud image => soft procedural clouds
     - no tick image => drawn checkmark
     - no boom image => animated burst
     - no ground image => painted ground strip

  TODO: Replace these placeholder filenames with your final art when ready.
*/

const ASSET_PATHS = {
  // TODO: Replace if your final background uses a different filename.
  background: "./bg-img.png",
  // TODO: Replace with your background music if provided.
  backgroundMusic: "./bg_music.mp3",
  // TODO: Replace with one or more cloud assets if you want clouds back later.
  clouds: [],
  // TODO: Replace with your correct-hit sound if provided.
  correctSound: "./correct.mp3",
  // TODO: Replace with your check/tick art if provided.
  tick: "./tick.png",
  // TODO: Replace with your explosion art if provided.
  boom: "./boom.png",
  // TODO: Replace with your crash sound if provided.
  crashSound: "./crash.mp3",
  // TODO: Replace with your fail sound if provided.
  completeSound: "./complete.mp3",
  // TODO: Replace with your ground art if provided.
  ground: "./assets/ground.png",
};

const CONFIG = {
  lives: 3,
  letterSize: 50,
  letterFont: '"Press Start 2P", "Courier New", monospace',
  startSpeed: 92,
  maxSpeed: 260,
  speedRampPerSecond: 2.4,
  spawnDelayStart: 1400,
  spawnDelayMin: 520,
  spawnRampPerSecond: 8,
  maxLettersStart: 1,
  maxLettersCap: 5,
  extraLaneEverySeconds: 16,
  scorePerHit: 100,
  streakBonus: 10,
  groundHeight: 108,
  skyPaddingTop: 88,
  sidePadding: 48,
  cloudCount: 0,
  cloudMinSpeed: 10,
  cloudMaxSpeed: 26,
  correctPopDuration: 0.28,
  boomDuration: 0.55,
  shakeDuration: 0.18,
  flashDuration: 0.16,
};

const WORD_BANK = {
  2: ["GO", "UP", "IN", "TO", "BY", "ON", "IT", "WE", "AT", "DO", "SO", "NO"],
  3: ["CAT", "DOG", "BOX", "RUN", "TAP", "ZIP", "SUN", "MAP", "JET", "SKY", "HOP", "RAY"],
  4: ["FAST", "TYPE", "JUMP", "WIND", "PLAY", "DASH", "GLOW", "RACE", "TURN", "LAMP", "GRID", "SPIN"],
  5: ["SPEED", "TRACK", "SHIFT", "PIXEL", "ROBOT", "BLAZE", "CLOUD", "LIGHT", "FLASH", "BOOST", "LEVEL", "QUICK"],
  6: ["TARGET", "RHYTHM", "SPRING", "ROCKET", "SHADOW", "VECTOR", "TYPING", "BLASTER", "PHOTON", "STRIDE", "THRUST", "CHARGE"],
  7: ["SKYLINE", "JETPACK", "CIRCUIT", "GRAVITY", "MARQUEE", "HOTWIRE", "TURBINE", "ROOFTOP", "BOOSTER", "SLIPWAY", "GLIDERS", "OVERLAP"],
};

class SoundManager {
  constructor() {
    this.context = null;
    this.enabled = true;
    this.activeAudio = new Set();
    this.correctAudio = this.loadOptionalAudio(ASSET_PATHS.correctSound);
    this.crashAudio = this.loadOptionalAudio(ASSET_PATHS.crashSound);
    this.completeAudio = this.loadOptionalAudio(ASSET_PATHS.completeSound);
    this.musicAudio = this.loadOptionalAudio(ASSET_PATHS.backgroundMusic);
    if (this.musicAudio) {
      this.musicAudio.loop = true;
      this.musicAudio.volume = 0.15;
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

  playOptionalAudio(audio, volume = 0.72) {
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

  playComplete() {
    return this.playOptionalAudio(this.completeAudio, 0.72);
  }

  playMusic() {
    if (!this.musicAudio || this.musicAudio.dataset.failed === "true" || !this.musicEnabled) return;
    this.musicAudio.volume = 0.15;
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

  playCorrect() {
    if (this.playOptionalAudio(this.correctAudio, 0.72)) {
      return;
    }

    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const gain = ctx.createGain();
    const oscA = ctx.createOscillator();
    const oscB = ctx.createOscillator();

    oscA.type = "triangle";
    oscA.frequency.setValueAtTime(740, now);
    oscA.frequency.exponentialRampToValueAtTime(980, now + 0.08);

    oscB.type = "sine";
    oscB.frequency.setValueAtTime(1110, now);
    oscB.frequency.exponentialRampToValueAtTime(1480, now + 0.08);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.16, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);

    oscA.connect(gain);
    oscB.connect(gain);
    gain.connect(ctx.destination);

    oscA.start(now);
    oscB.start(now);
    oscA.stop(now + 0.16);
    oscB.stop(now + 0.16);
  }

  playMiss() {
    if (this.playOptionalAudio(this.crashAudio, 0.74)) {
      return;
    }

    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const gain = ctx.createGain();
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(58, now + 0.24);

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(900, now);
    filter.frequency.exponentialRampToValueAtTime(180, now + 0.24);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.18, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.26);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.28);
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

const ui = {
  canvas: document.getElementById("gameCanvas"),
  score: document.getElementById("scoreValue"),
  lives: document.getElementById("livesValue"),
  level: document.getElementById("levelValue"),
  streak: document.getElementById("streakValue"),
  startOverlay: document.getElementById("startOverlay"),
  gameOverOverlay: document.getElementById("gameOverOverlay"),
  gameOverTitle: document.getElementById("gameOverTitle"),
  gameOverSummary: document.getElementById("gameOverSummary"),
  nameEntryOverlay: document.getElementById("nameEntryOverlay"),
  nameEntrySummary: document.getElementById("nameEntrySummary"),
  nameEntryForm: document.getElementById("nameEntryForm"),
  nameEntryInput: document.getElementById("nameEntryInput"),
  startButton: document.getElementById("startButton"),
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
      clouds: [],
      tick: null,
      boom: null,
      ground: null,
    };
  }

  load() {
    this.images.background = this.loadOptionalImage(this.paths.background);
    this.images.tick = this.loadOptionalImage(this.paths.tick);
    this.images.boom = this.loadOptionalImage(this.paths.boom);
    this.images.ground = this.loadOptionalImage(this.paths.ground);
    this.images.clouds = (this.paths.clouds || []).map((src) => this.loadOptionalImage(src));
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

  getCloudImage() {
    const ready = this.images.clouds.filter((image) => image && image.complete && image.dataset.failed !== "true");
    if (ready.length === 0) return null;
    return ready[Math.floor(Math.random() * ready.length)];
  }
}

class FallingLettersGame {
  constructor(canvas, assets, sound) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.assets = assets;
    this.sound = sound;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = 0;
    this.height = 0;
    this.groundY = 0;
    this.lastFrameTime = 0;
    this.animationFrame = 0;
    this.clouds = [];
    this.wordQueues = {};
    this.usedWords = new Set();
    this.reset();
    this.resize();
    this.seedClouds();
  }

  reset() {
    this.started = false;
    this.running = false;
    this.gameOver = false;
    this.score = 0;
    this.lives = CONFIG.lives;
    this.streak = 0;
    this.bestStreak = 0;
    this.elapsed = 0;
    this.spawnTimer = 0;
    this.nextSpawnDelay = CONFIG.spawnDelayStart;
    this.letters = [];
    this.effects = [];
    this.screenShake = 0;
    this.groundFlash = 0;
    this.lastFrameTime = 0;
    this.pendingLeaderboardScore = null;
    this.wordQueues = {};
    this.usedWords = new Set();
    ui.nameEntryInput.value = "";
    ui.nameEntryOverlay.classList.remove("is-visible");
    this.updateHud();
  }

  start() {
    this.reset();
    this.sound.ensureContext();
    this.sound.playMusic();
    this.started = true;
    this.running = true;
    this.gameOver = false;
    this.spawnTimer = this.nextSpawnDelay;
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

    if (this.clouds.length === 0) return;
    this.clouds.forEach((cloud) => {
      cloud.y = clamp(cloud.y, 24, this.groundY - 180);
    });
  }

  seedClouds() {
    if (CONFIG.cloudCount <= 0) {
      this.clouds = [];
      return;
    }

    this.clouds = Array.from({ length: CONFIG.cloudCount }, (_, index) => ({
      x: (index / CONFIG.cloudCount) * (this.width || 1200),
      y: 40 + Math.random() * 180,
      speed: randomBetween(CONFIG.cloudMinSpeed, CONFIG.cloudMaxSpeed),
      size: randomBetween(90, 180),
      opacity: randomBetween(0.22, 0.4),
      image: this.assets.getCloudImage(),
    }));
  }

  updateHud() {
    ui.score.textContent = String(this.score);
    ui.lives.innerHTML = renderLivesMarkup(this.lives);
    ui.level.textContent = String(this.getDifficultyLevel());
    ui.streak.textContent = `${this.streak}/${this.bestStreak}`;
  }

  getDifficultyLevel() {
    return 1 + Math.floor(this.elapsed / 12000);
  }

  getCurrentSpeed() {
    return Math.min(CONFIG.maxSpeed, CONFIG.startSpeed + (this.elapsed / 1000) * CONFIG.speedRampPerSecond);
  }

  getCurrentSpawnDelay() {
    return Math.max(CONFIG.spawnDelayMin, CONFIG.spawnDelayStart - (this.elapsed / 1000) * CONFIG.spawnRampPerSecond);
  }

  getCurrentMaxLetters() {
    const extra = Math.floor(this.elapsed / (CONFIG.extraLaneEverySeconds * 1000));
    return Math.min(CONFIG.maxLettersCap, CONFIG.maxLettersStart + extra);
  }

  getCurrentWordLength() {
    return clamp(2 + Math.floor(this.elapsed / 14000), 2, 7);
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

  getFontSpec(fontSize) {
    return `900 ${fontSize}px ${CONFIG.letterFont}`;
  }

  getWordMetrics(word, fontSize) {
    this.ctx.save();
    this.ctx.font = this.getFontSpec(fontSize);

    const tracking = Math.max(8, fontSize * 0.18);
    const characters = Array.from(word);
    const widths = characters.map((char) => Math.max(fontSize * 0.42, this.ctx.measureText(char).width));
    const totalWidth =
      widths.reduce((sum, width) => sum + width, 0) + Math.max(0, characters.length - 1) * tracking;

    this.ctx.restore();

    return {
      widths,
      tracking,
      totalWidth: Math.max(fontSize, totalWidth),
    };
  }

  pickWord() {
    const targetLength = this.getCurrentWordLength();
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

  spawnLetter() {
    if (this.letters.length >= this.getCurrentMaxLetters()) return;

    const word = this.pickWord();
    const size = clamp(CONFIG.letterSize - word.length * 2 + randomBetween(-2, 4), 28, CONFIG.letterSize);
    const metrics = this.getWordMetrics(word, size);
    const wordWidth = metrics.totalWidth;
    const x = randomBetween(CONFIG.sidePadding + wordWidth / 2, this.width - CONFIG.sidePadding - wordWidth / 2);
    const speed = this.getCurrentSpeed() * randomBetween(0.92, 1.08);

    this.letters.push({
      word,
      progress: 0,
      x,
      y: CONFIG.skyPaddingTop,
      size,
      width: wordWidth,
      speed,
      wobbleSeed: Math.random() * Math.PI * 2,
      wobbleAmp: randomBetween(4, 11),
    });
  }

  handleKey(key) {
    if (!this.running || this.gameOver) return;
    if (!/^[a-z]$/i.test(key)) return;

    const normalized = key.toUpperCase();
    const matching = this.letters
      .filter((letter) => letter.word[letter.progress] === normalized)
      .sort((a, b) => b.y - a.y);

    if (matching.length === 0) {
      this.streak = 0;
      this.updateHud();
      return;
    }

    this.sound.playCorrect();
    const target = matching[0];
    target.progress += 1;

    if (target.progress >= target.word.length) {
      const index = this.letters.indexOf(target);
      if (index !== -1) {
        this.letters.splice(index, 1);
      }

      this.score += CONFIG.scorePerHit + this.streak * CONFIG.streakBonus;
      this.streak += 1;
      this.bestStreak = Math.max(this.bestStreak, this.streak);
      this.effects.push({
        type: "tick",
        x: target.x,
        y: target.y,
        age: 0,
        duration: CONFIG.correctPopDuration,
      });
    }

    this.updateHud();
  }

  missLetter(letter, index) {
    this.letters.splice(index, 1);
    this.lives -= 1;
    this.streak = 0;
    this.screenShake = CONFIG.shakeDuration;
    this.groundFlash = CONFIG.flashDuration;
    this.sound.playMiss();
    this.effects.push({
      type: "boom",
      x: letter.x,
      y: this.groundY - 6,
      age: 0,
      duration: CONFIG.boomDuration,
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
    ui.gameOverTitle.textContent = "Out of Lives";
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

    this.updateClouds(dt);
    this.updateEffects(dt);

    if (!this.running || this.gameOver) {
      this.screenShake = Math.max(0, this.screenShake - dt);
      this.groundFlash = Math.max(0, this.groundFlash - dt);
      return;
    }

    this.elapsed += deltaMs;
    this.spawnTimer -= deltaMs;
    this.nextSpawnDelay = this.getCurrentSpawnDelay();

    while (this.spawnTimer <= 0) {
      this.spawnLetter();
      this.spawnTimer += this.nextSpawnDelay;
    }

    for (let index = this.letters.length - 1; index >= 0; index -= 1) {
      const letter = this.letters[index];
      letter.y += letter.speed * dt;

      if (letter.y + letter.size * 0.52 >= this.groundY) {
        this.missLetter(letter, index);
      }
    }

    this.screenShake = Math.max(0, this.screenShake - dt);
    this.groundFlash = Math.max(0, this.groundFlash - dt);
    this.updateHud();
  }

  updateClouds(dt) {
    for (const cloud of this.clouds) {
      cloud.x += cloud.speed * dt;
      if (cloud.x - cloud.size > this.width) {
        cloud.x = -cloud.size;
        cloud.y = 30 + Math.random() * 180;
        cloud.speed = randomBetween(CONFIG.cloudMinSpeed, CONFIG.cloudMaxSpeed);
        cloud.size = randomBetween(90, 180);
        cloud.opacity = randomBetween(0.22, 0.4);
        cloud.image = this.assets.getCloudImage();
      }
    }
  }

  updateEffects(dt) {
    for (let index = this.effects.length - 1; index >= 0; index -= 1) {
      this.effects[index].age += dt;
      if (this.effects[index].age >= this.effects[index].duration) {
        this.effects.splice(index, 1);
      }
    }
  }

  render() {
    const shakeX = this.screenShake > 0 ? randomBetween(-6, 6) : 0;
    const shakeY = this.screenShake > 0 ? randomBetween(-4, 4) : 0;

    this.ctx.save();
    this.ctx.translate(shakeX, shakeY);
    this.ctx.clearRect(-20, -20, this.width + 40, this.height + 40);

    this.renderBackground();
    this.renderClouds();
    this.renderGround();
    this.renderLetters();
    this.renderEffects();

    this.ctx.restore();
  }

  renderBackground() {
    const bgImage = this.assets.getImage("background");
    if (bgImage) {
      this.drawCoverImage(bgImage, 0, 0, this.width, this.groundY + CONFIG.groundHeight);
      return;
    }

    const gradient = this.ctx.createLinearGradient(0, 0, 0, this.height);
    gradient.addColorStop(0, "#89d2ff");
    gradient.addColorStop(0.62, "#b3ecff");
    gradient.addColorStop(1, "#f4fbff");
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, this.width, this.height);
  }

  renderClouds() {
    if (this.clouds.length === 0) return;

    for (const cloud of this.clouds) {
      if (cloud.image) {
        this.ctx.save();
        this.ctx.globalAlpha = cloud.opacity;
        this.ctx.drawImage(cloud.image, cloud.x, cloud.y, cloud.size, cloud.size * 0.56);
        this.ctx.restore();
      } else {
        this.ctx.save();
        this.ctx.globalAlpha = cloud.opacity;
        this.ctx.fillStyle = "#ffffff";
        this.drawFallbackCloud(cloud.x, cloud.y, cloud.size);
        this.ctx.restore();
      }
    }
  }

  renderGround() {
    const groundImage = this.assets.getImage("ground");
    if (groundImage) {
      this.drawCoverImage(groundImage, 0, this.groundY, this.width, this.height - this.groundY);
    } else {
      this.ctx.fillStyle = "#3d873e";
      this.ctx.fillRect(0, this.groundY, this.width, this.height - this.groundY);

      this.ctx.fillStyle = "#59a454";
      this.ctx.fillRect(0, this.groundY, this.width, 10);

      this.ctx.fillStyle = "rgba(255,255,255,0.08)";
      for (let x = 0; x < this.width; x += 28) {
        this.ctx.fillRect(x, this.groundY + 20, 12, 4);
      }
    }

    if (this.groundFlash > 0) {
      this.ctx.save();
      this.ctx.globalAlpha = this.groundFlash / CONFIG.flashDuration * 0.35;
      this.ctx.fillStyle = "#ffd06b";
      this.ctx.fillRect(0, this.groundY - 10, this.width, 18);
      this.ctx.restore();
    }
  }

  renderLetters() {
    this.ctx.textAlign = "left";
    this.ctx.textBaseline = "middle";

    for (const letter of this.letters) {
      const metrics = this.getWordMetrics(letter.word, letter.size);
      letter.width = metrics.totalWidth;
      const wobble = Math.sin(this.elapsed * 0.002 + letter.wobbleSeed) * letter.wobbleAmp;
      const drawX = clamp(letter.x + wobble, 24 + letter.width / 2, this.width - 24 - letter.width / 2);
      const drawY = letter.y;
      const startX = drawX - letter.width / 2;

      this.ctx.save();
      this.ctx.font = this.getFontSpec(letter.size);
      this.ctx.strokeStyle = "rgba(14, 31, 62, 0.58)";
      this.ctx.lineWidth = 12;
      let cursorX = startX;
      for (let index = 0; index < letter.word.length; index += 1) {
        const char = letter.word[index];
        const charX = cursorX;
        const typed = index < letter.progress;

        this.ctx.save();
        this.ctx.globalAlpha = typed ? 0.22 : 1;
        this.ctx.strokeText(char, charX, drawY);
        this.ctx.fillStyle = typed ? "#c6d3ff" : "#ffffff";
        this.ctx.fillText(char, charX, drawY);
        this.ctx.restore();

        cursorX += metrics.widths[index] + metrics.tracking;
      }
      this.ctx.restore();
    }
  }

  renderEffects() {
    for (const effect of this.effects) {
      if (effect.type === "tick") {
        this.renderTick(effect);
      } else {
        this.renderBoom(effect);
      }
    }
  }

  renderTick(effect) {
    const image = this.assets.getImage("tick");
    const progress = effect.age / effect.duration;
    const scale = 0.7 + progress * 0.5;
    const alpha = 1 - progress;

    this.ctx.save();
    this.ctx.globalAlpha = alpha;
    this.ctx.translate(effect.x, effect.y);
    this.ctx.scale(scale, scale);

    if (image) {
      this.ctx.drawImage(image, -24, -24, 48, 48);
    } else {
      this.ctx.strokeStyle = "#3fdd72";
      this.ctx.lineWidth = 6;
      this.ctx.lineCap = "round";
      this.ctx.beginPath();
      this.ctx.moveTo(-12, 2);
      this.ctx.lineTo(-2, 14);
      this.ctx.lineTo(16, -12);
      this.ctx.stroke();
    }

    this.ctx.restore();
  }

  renderBoom(effect) {
    const image = this.assets.getImage("boom");
    const progress = effect.age / effect.duration;
    const alpha = 1 - progress;
    const radius = 18 + progress * 34;

    this.ctx.save();
    this.ctx.globalAlpha = alpha;
    this.ctx.translate(effect.x, effect.y);

    if (image) {
      const size = 60 + progress * 40;
      this.ctx.drawImage(image, -size / 2, -size / 2, size, size);
    } else {
      this.ctx.strokeStyle = "#ff9a4d";
      this.ctx.fillStyle = "rgba(255, 196, 84, 0.32)";
      this.ctx.lineWidth = 4;
      this.ctx.beginPath();
      this.ctx.arc(0, 0, radius, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.stroke();

      for (let i = 0; i < 8; i += 1) {
        const angle = (Math.PI * 2 * i) / 8;
        const inner = radius * 0.4;
        const outer = radius * 1.08;
        this.ctx.beginPath();
        this.ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
        this.ctx.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
        this.ctx.stroke();
      }
    }

    this.ctx.restore();
  }

  drawFallbackCloud(x, y, size) {
    const h = size * 0.5;
    this.ctx.beginPath();
    this.ctx.arc(x + size * 0.24, y + h * 0.58, h * 0.42, Math.PI * 0.5, Math.PI * 1.5);
    this.ctx.arc(x + size * 0.44, y + h * 0.38, h * 0.52, Math.PI, Math.PI * 2);
    this.ctx.arc(x + size * 0.68, y + h * 0.54, h * 0.38, Math.PI * 1.5, Math.PI * 0.5);
    this.ctx.closePath();
    this.ctx.fill();
  }

  drawCoverImage(image, x, y, width, height) {
    const scale = Math.max(width / image.width, height / image.height);
    const drawWidth = image.width * scale;
    const drawHeight = image.height * scale;
    const offsetX = x + (width - drawWidth) / 2;
    const offsetY = y + (height - drawHeight) / 2;
    this.ctx.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);
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

const game = new FallingLettersGame(ui.canvas, assets, sound);
game.startLoop();

const isEmbedded = new URLSearchParams(window.location.search).get("embed") === "1";

if (isEmbedded) {
  ui.topbar.style.display = "none";
  document.body.classList.add("is-embedded");
}

function goBackToArcade() {
  sound.pauseMusic();
  if (window.parent && window.parent !== window) {
    window.parent.postMessage({ type: "falling-letters:close" }, "*");
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
ui.restartBackButton.addEventListener("click", goBackToArcade);
