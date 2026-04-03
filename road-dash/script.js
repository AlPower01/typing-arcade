"use strict";

/*
  Racing Dash
  ----------
  Open `index.html` in a browser or launch it inside the Typing Arcade shell later.
  The car auto-drives forward. One word obstacle appears at a time in the current lane.
  Type the full word before impact to swerve into a safe lane. Miss it and you crash.
*/

const BEST_SCORE_KEY = "typing-arcade-road-dash-best-score";
const POST_MESSAGE_CLOSE = "road-dash:close";
const BACKGROUND_PATH = "./images/26c480ad-4ab8-4fd2-a306-2bf0c9a7af7a.png";
const CAR_PATH = "./images/car.png";
const LEFT_TREE_PATH = "./images/left_tree.png";
const RIGHT_TREE_PATH = "./images/right_tree.png";
const TICK_PATH = "./images/tick.png";
const BOOM_PATH = "./images/boom.png";
const DING_PATH = "./images/ding.mp3";
const MOTOR_LOOP_PATH = "./images/engine.mp3";
const CRASH_SOUND_PATH = "./images/car_crash.mp3";
const HEART_ICON_PATH = "../images/heart.svg";

const CONFIG = {
  width: 1320,
  height: 780,
  laneCount: 3,
  lives: 3,
  carY: 600,
  crashFlashMs: 380,
  clearDelayMs: 280,
  spawnDelayMs: 440,
  baseApproachSpeed: 0.16,
  baseRoadSpeed: 190,
  carLaneSmoothing: 7.5,
  skyStars: 42,
  levelEverySuccesses: 2,
};

const ROAD_ART = {
  width: 2048,
  height: 1365,
  horizonY: 610,
  roadTopLeftX: 989,
  roadTopRightX: 1061,
  roadBottomLeftX: 217,
  roadBottomRightX: 1831,
  laneRatios: [0.2, 0.5, 0.8],
  carY: 1210,
};

const WORDS_BY_LENGTH = {
  3: ["sun", "arc", "jam", "zip", "gas", "lap", "pop", "cab", "fog", "run", "tap", "ram", "jet", "mix", "cop", "pit", "rim", "log", "map", "van"],
  4: ["dash", "turn", "gear", "drum", "beam", "road", "spin", "lamp", "glow", "snap", "burn", "clap", "grid", "tune", "lane", "coast", "wave", "pace"],
  5: ["shift", "curve", "turbo", "laser", "flare", "drift", "rally", "crank", "speed", "brake", "sweep", "spark", "night", "track", "ocean", "shore"],
  6: ["rocket", "signal", "chrome", "thrive", "magnet", "thunder", "violet", "street", "planet", "engine", "racing", "summit", "harbor", "sunset"],
  7: ["highway", "burnout", "control", "scanner", "seventh", "igniter", "vectors", "traffic", "jackpot", "glimmer", "coastal", "turbine"],
  8: ["overdrive", "headlamp", "midnight", "slipstream", "autobahn", "roadster", "flashing", "wildfire", "seabreeze", "coastline"],
};

const ui = {
  canvas: document.getElementById("gameCanvas"),
  scoreValue: document.getElementById("scoreValue"),
  livesValue: document.getElementById("livesValue"),
  progressValue: document.getElementById("progressValue"),
  startOverlay: document.getElementById("startOverlay"),
  startButton: document.getElementById("startButton"),
  startBackButton: document.getElementById("startBackButton"),
  backButton: document.getElementById("backButton"),
  gameOverOverlay: document.getElementById("gameOverOverlay"),
  gameOverSummary: document.getElementById("gameOverSummary"),
  bestScoreValue: document.getElementById("bestScoreValue"),
  dodgesValue: document.getElementById("dodgesValue"),
  levelValue: document.getElementById("levelValue"),
  restartButton: document.getElementById("restartButton"),
  gameOverBackButton: document.getElementById("gameOverBackButton"),
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function lerp(start, end, amount) {
  return start + (end - start) * amount;
}

function easeOutCubic(value) {
  return 1 - (1 - value) ** 3;
}

function choice(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function shuffle(items) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function getStoredBestScore() {
  return Number(window.localStorage.getItem(BEST_SCORE_KEY) || "0");
}

function setStoredBestScore(score) {
  window.localStorage.setItem(BEST_SCORE_KEY, String(score));
}

function renderLivesMarkup(count) {
  if (count <= 0) {
    return "0";
  }

  return Array.from({ length: count }, (_, index) =>
    `<img class="life-heart" src="${HEART_ICON_PATH}" alt="" aria-hidden="true" data-heart-index="${index}" />`,
  ).join("");
}

class RoadDashGame {
  constructor() {
    this.context = ui.canvas.getContext("2d");
    this.wordQueues = {};
    this.usedWords = new Set();
    this.images = {
      background: this.loadImage(BACKGROUND_PATH),
      car: this.loadImage(CAR_PATH),
      leftTree: this.loadImage(LEFT_TREE_PATH),
      rightTree: this.loadImage(RIGHT_TREE_PATH),
      tick: this.loadImage(TICK_PATH),
      boom: this.loadImage(BOOM_PATH),
    };
    this.sounds = {
      ding: this.createAudio(DING_PATH, { volume: 0.46 }),
      motor: this.createAudio(MOTOR_LOOP_PATH, { volume: 0.18, loop: true }),
      crash: this.createAudio(CRASH_SOUND_PATH, { volume: 0.5 }),
    };
    this.starField = Array.from({ length: CONFIG.skyStars }, () => ({
      x: Math.random(),
      y: Math.random() * 0.62,
      size: Math.random() * 1.8 + 0.7,
      alpha: Math.random() * 0.5 + 0.25,
    }));
    this.resize = this.resize.bind(this);
    this.loop = this.loop.bind(this);
    this.handleKeydown = this.handleKeydown.bind(this);
    this.bestScore = getStoredBestScore();
    this.reset();
    this.resize();
    window.addEventListener("resize", this.resize);
    window.addEventListener("keydown", this.handleKeydown);
    this.frame = window.requestAnimationFrame(this.loop);
  }

  loadImage(src) {
    const image = new Image();
    image.src = src;
    return image;
  }

  createAudio(src, options = {}) {
    const audio = new Audio(src);
    audio.preload = "auto";
    audio.loop = Boolean(options.loop);
    audio.volume = options.volume ?? 1;
    return audio;
  }

  playSound(name) {
    const sound = this.sounds?.[name];
    if (!sound) return;
    sound.currentTime = 0;
    sound.play().catch(() => {});
  }

  startMotor() {
    const motor = this.sounds?.motor;
    if (!motor) return;
    motor.currentTime = 0;
    motor.play().catch(() => {});
  }

  stopSounds() {
    Object.values(this.sounds || {}).forEach((sound) => {
      sound.pause();
      sound.currentTime = 0;
    });
  }

  reset() {
    this.stopSounds();
    this.running = false;
    this.gameOver = false;
    this.score = 0;
    this.lives = CONFIG.lives;
    this.successes = 0;
    this.level = 1;
    this.elapsedMs = 0;
    this.lastFrameTime = 0;
    this.shakeUntil = 0;
    this.flashUntil = 0;
    this.errorUntil = 0;
    this.roadScroll = 0;
    this.currentLane = 1;
    this.targetLane = 1;
    this.carLanePosition = 1;
    this.obstacle = null;
    this.spawnCooldown = 0;
    this.trees = [
      { side: "left", distance: 1.0 },
      { side: "left", distance: 0.82 },
      { side: "left", distance: 0.64 },
      { side: "right", distance: 1.0 },
      { side: "right", distance: 0.82 },
      { side: "right", distance: 0.64 },
    ];
    this.wordQueues = {};
    this.usedWords.clear();
    this.setStateLabel("Idle");
    this.updateHud();
    this.render();
  }

  start() {
    this.reset();
    this.running = true;
    ui.startOverlay.classList.remove("is-visible");
    ui.gameOverOverlay.classList.remove("is-visible");
    this.spawnNextObstacle();
    this.setStateLabel("Cruising");
    this.lastFrameTime = performance.now();
    this.startMotor();
  }

  restart() {
    this.start();
  }

  getCurrentLevel() {
    return 1 + Math.floor(this.successes / CONFIG.levelEverySuccesses);
  }

  getWordLengthTarget() {
    return clamp(3 + Math.floor(this.successes / 2), 3, 8);
  }

  getApproachSpeed() {
    return CONFIG.baseApproachSpeed + (this.level - 1) * 0.02;
  }

  getRoadSpeed() {
    return CONFIG.baseRoadSpeed + (this.level - 1) * 34;
  }

  getWordPool(length) {
    if (!this.wordQueues[length] || this.wordQueues[length].length === 0) {
      const pool = WORDS_BY_LENGTH[length] || WORDS_BY_LENGTH[8];
      this.wordQueues[length] = shuffle(pool.filter((word) => !this.usedWords.has(word)));
      if (this.wordQueues[length].length === 0) {
        this.wordQueues[length] = shuffle(pool);
        this.usedWords.clear();
      }
    }
    return this.wordQueues[length];
  }

  getNextWord() {
    const length = this.getWordLengthTarget();
    const pool = this.getWordPool(length);
    const nextWord = pool.shift() || choice(WORDS_BY_LENGTH[length]);
    this.usedWords.add(nextWord);
    return nextWord.toUpperCase();
  }

  spawnNextObstacle() {
    const lane = this.currentLane;
    this.level = this.getCurrentLevel();
    this.obstacle = {
      lane,
      word: this.getNextWord(),
      typedCount: 0,
      distance: 1.06,
      state: "approaching",
      clearTimer: 0,
      wobble: Math.random() * Math.PI * 2,
      boomScale: 0,
      hitAt: 0,
    };
    this.updateHud();
  }

  chooseSafeLane() {
    const candidates = Array.from({ length: CONFIG.laneCount }, (_, index) => index)
      .filter((index) => index !== this.currentLane);

    if (candidates.length === 0) return this.currentLane;

    const preferred = candidates.filter((index) => Math.abs(index - this.currentLane) === 1);
    return choice(preferred.length > 0 ? preferred : candidates);
  }

  completeObstacle() {
    if (!this.obstacle || this.obstacle.state !== "approaching") return;
    this.obstacle.state = "cleared";
    this.obstacle.clearTimer = CONFIG.clearDelayMs;
    this.obstacle.hitAt = performance.now();
    this.obstacle.distance = Math.max(this.obstacle.distance, 0.16);
    this.score += 100 + this.obstacle.word.length * 30;
    this.successes += 1;
    this.level = this.getCurrentLevel();
    this.playSound("ding");
    this.targetLane = this.chooseSafeLane();
    this.obstacle.avoidLane = this.targetLane;
    this.setStateLabel("Swerve");
    this.updateHud();
  }

  crash() {
    if (!this.obstacle || this.obstacle.state === "crashed") return;
    this.obstacle.state = "crashed";
    this.obstacle.hitAt = performance.now();
    this.obstacle.distance = Math.min(this.obstacle.distance, 0.12);
    this.shakeUntil = performance.now() + CONFIG.crashFlashMs;
    this.flashUntil = performance.now() + CONFIG.crashFlashMs;
    this.playSound("crash");
    this.lives -= 1;
    this.setStateLabel("Crash");
    this.updateHud();
    if (this.lives <= 0) {
      this.finishGame();
      return;
    }
    this.spawnCooldown = CONFIG.spawnDelayMs + 240;
  }

  finishGame() {
    this.running = false;
    this.gameOver = true;
    this.stopSounds();
    this.bestScore = Math.max(this.bestScore, this.score);
    setStoredBestScore(this.bestScore);
    ui.gameOverSummary.textContent = `Final score: ${this.score}`;
    ui.bestScoreValue.textContent = String(this.bestScore);
    ui.dodgesValue.textContent = String(this.successes);
    ui.levelValue.textContent = String(this.level);
    ui.gameOverOverlay.classList.add("is-visible");
    this.setStateLabel("Game Over");
  }

  setStateLabel(label) {
    this.stateLabel = label;
  }

  updateHud() {
    ui.scoreValue.textContent = String(this.score);
    ui.livesValue.innerHTML = renderLivesMarkup(this.lives);

    if (this.obstacle) {
      const typed = this.obstacle.word.slice(0, this.obstacle.typedCount);
      const rest = this.obstacle.word.slice(this.obstacle.typedCount);
      ui.progressValue.textContent = typed ? `${typed}${rest ? `·${rest}` : ""}` : this.obstacle.word;
    } else {
      ui.progressValue.textContent = "---";
    }
  }

  resize() {
    const panel = ui.canvas.parentElement;
    const displayWidth = panel.clientWidth;
    const displayHeight = ui.canvas.clientHeight;
    const ratio = window.devicePixelRatio || 1;
    ui.canvas.width = Math.floor(displayWidth * ratio);
    ui.canvas.height = Math.floor(displayHeight * ratio);
    this.context.setTransform(ratio, 0, 0, ratio, 0, 0);
    this.viewportWidth = displayWidth;
    this.viewportHeight = displayHeight;
    this.render();
  }

  handleKeydown(event) {
    if (!this.running || this.gameOver) return;
    if (document.activeElement && /input|textarea|select/i.test(document.activeElement.tagName)) return;
    if (!this.obstacle || this.obstacle.state !== "approaching") return;

    if (event.key === "Backspace") {
      event.preventDefault();
      this.obstacle.typedCount = Math.max(0, this.obstacle.typedCount - 1);
      this.updateHud();
      return;
    }

    if (!/^[a-z]$/i.test(event.key)) return;
    event.preventDefault();

    const expected = this.obstacle.word[this.obstacle.typedCount];
    if (event.key.toUpperCase() === expected) {
      this.obstacle.typedCount += 1;
      if (this.obstacle.typedCount >= this.obstacle.word.length) {
        this.completeObstacle();
      }
      this.updateHud();
      return;
    }

    this.errorUntil = performance.now() + 180;
  }

  update(deltaMs) {
    const now = performance.now();
    const deltaSeconds = deltaMs / 1000;
    this.elapsedMs += deltaMs;
    this.level = this.getCurrentLevel();
    this.roadScroll += this.getRoadSpeed() * deltaSeconds;
    this.carLanePosition = lerp(
      this.carLanePosition,
      this.targetLane,
      clamp(deltaSeconds * CONFIG.carLaneSmoothing, 0, 1),
    );
    this.updateTrees(deltaMs, deltaSeconds);

    if (this.spawnCooldown > 0) {
      this.spawnCooldown -= deltaMs;
      if (this.spawnCooldown <= 0 && !this.gameOver) {
        this.currentLane = this.targetLane;
        this.spawnNextObstacle();
      }
    }

    if (this.obstacle) {
      if (this.obstacle.state === "approaching") {
        const visualBoost = 1 + (1 - clamp(this.obstacle.distance, 0, 1)) * 1.55;
        this.obstacle.distance -= this.getApproachSpeed() * visualBoost * deltaSeconds;
        if (this.obstacle.distance <= 0.14) {
          this.crash();
        }
      } else if (this.obstacle.state === "cleared") {
        this.obstacle.clearTimer -= deltaMs;
        this.obstacle.distance -= this.getApproachSpeed() * 3.2 * deltaSeconds;
        if (this.obstacle.clearTimer <= 0 || this.obstacle.distance <= -0.12) {
          this.obstacle = null;
          this.spawnCooldown = CONFIG.spawnDelayMs;
          this.currentLane = this.targetLane;
          this.setStateLabel(`Level ${this.level}`);
          this.updateHud();
        }
      } else if (this.obstacle.state === "crashed") {
        this.obstacle.distance -= this.getApproachSpeed() * 2.8 * deltaSeconds;
        if (this.obstacle.distance <= -0.16) {
          this.obstacle = null;
          if (!this.gameOver) {
            this.currentLane = this.targetLane;
            this.spawnCooldown = Math.max(this.spawnCooldown, CONFIG.spawnDelayMs);
            this.setStateLabel(`Level ${this.level}`);
            this.updateHud();
          }
        }
      }
    }

    if (!this.gameOver && now > this.shakeUntil && this.obstacle?.state !== "approaching") {
      this.flashUntil = 0;
    }
  }

  updateTrees(deltaMs, deltaSeconds) {
    const travelSpeed = this.getApproachSpeed() * 0.94;

    this.trees.forEach((tree) => {
      tree.distance -= travelSpeed * deltaSeconds;
      if (tree.distance <= 0.46) {
        tree.distance = 1.0;
      }
    });
  }

  getRoadCenter(y) {
    const { left, right } = this.getRoadEdges(y);
    return (left + right) / 2;
  }

  getRoadWidth(y) {
    const { left, right } = this.getRoadEdges(y);
    return right - left;
  }

  getLaneX(laneIndex, y) {
    const { left, right } = this.getRoadEdges(y);
    const laneRatio = ROAD_ART.laneRatios[laneIndex] ?? 0.5;
    return lerp(left, right, laneRatio);
  }

  getSceneRect() {
    const image = this.images.background;
    if (!image?.naturalWidth) {
      return {
        drawX: 0,
        drawY: 0,
        drawWidth: this.viewportWidth,
        drawHeight: this.viewportHeight,
        scale: this.viewportWidth / ROAD_ART.width,
      };
    }

    const scale = Math.max(this.viewportWidth / image.naturalWidth, this.viewportHeight / image.naturalHeight);
    const drawWidth = image.naturalWidth * scale;
    const drawHeight = image.naturalHeight * scale;
    const drawX = (this.viewportWidth - drawWidth) / 2;
    const drawY = (this.viewportHeight - drawHeight) / 2;
    return { drawX, drawY, drawWidth, drawHeight, scale };
  }

  getRoadEdges(y) {
    const scene = this.getSceneRect();
    const sourceY = clamp((y - scene.drawY) / scene.scale, ROAD_ART.horizonY, ROAD_ART.carY);
    const amount = clamp((sourceY - ROAD_ART.horizonY) / (ROAD_ART.carY - ROAD_ART.horizonY), 0, 1);
    const left = scene.drawX + lerp(ROAD_ART.roadTopLeftX, ROAD_ART.roadBottomLeftX, amount) * scene.scale;
    const right = scene.drawX + lerp(ROAD_ART.roadTopRightX, ROAD_ART.roadBottomRightX, amount) * scene.scale;
    return { left, right, amount };
  }

  getHorizonY() {
    const scene = this.getSceneRect();
    return scene.drawY + ROAD_ART.horizonY * scene.scale;
  }

  drawBackground() {
    const ctx = this.context;
    const scene = this.getSceneRect();

    if (this.images.background?.complete && this.images.background.naturalWidth) {
      ctx.drawImage(this.images.background, scene.drawX, scene.drawY, scene.drawWidth, scene.drawHeight);
    } else {
      const sky = ctx.createLinearGradient(0, 0, 0, this.viewportHeight);
      sky.addColorStop(0, "#3c88ff");
      sky.addColorStop(1, "#16a6a2");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, this.viewportWidth, this.viewportHeight);
    }

    ctx.fillStyle = "rgba(255,255,255,0.035)";
    ctx.fillRect(0, 0, this.viewportWidth, this.viewportHeight);

    const horizonY = this.getHorizonY();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.98)";
    ctx.lineWidth = 8;
    ctx.setLineDash([54, 44]);
    ctx.lineDashOffset = -(this.roadScroll * 0.9);
    ctx.beginPath();
    for (let y = horizonY + 24; y <= this.viewportHeight; y += 10) {
      const centerX = this.getRoadCenter(y);
      if (y === horizonY + 24) {
        ctx.moveTo(centerX, y);
      } else {
        ctx.lineTo(centerX, y);
      }
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }

  drawTrees() {
    const ctx = this.context;
    const horizonY = this.getHorizonY();

    this.trees.forEach((tree) => {
      const amount = clamp(1 - tree.distance, 0, 1.2);
      const linearAmount = clamp(amount, 0, 1);
      const y = lerp(horizonY - 15, this.viewportHeight + 160, linearAmount);
      const { left, right, amount: roadAmount } = this.getRoadEdges(y);
      const shoulderOffset = lerp(0, 280, roadAmount);
      const x = tree.side === "left" ? left - shoulderOffset : right + shoulderOffset;
      const scale = lerp(0, 1.06, linearAmount);
      const image = tree.side === "left" ? this.images.leftTree : this.images.rightTree;

      if (!image?.complete || !image.naturalWidth || scale <= 0.001) return;

      const height = image.naturalHeight * scale;
      const width = image.naturalWidth * scale;
      const drawX = tree.side === "left" ? x - width * 0.92 : x - width * 0.08;
      const drawY = y - height;

      ctx.drawImage(image, drawX, drawY, width, height);
    });
  }

  drawObstacle() {
    if (!this.obstacle) return;

    const ctx = this.context;
    const amount = clamp(1 - this.obstacle.distance, 0, 1.2);
    const linearAmount = clamp(amount, 0, 1);
    const eased = clamp(linearAmount * 0.44 + linearAmount ** 1.85 * 0.56, 0, 1);
    const horizonY = this.getHorizonY();
    const y = lerp(horizonY + 3, CONFIG.carY - 104, eased);
    const obstacleLane = this.obstacle.state === "cleared" && typeof this.obstacle.avoidLane === "number"
      ? lerp(this.obstacle.lane, this.obstacle.avoidLane, clamp((performance.now() - this.obstacle.hitAt) / 220, 0, 1))
      : this.obstacle.lane;
    const x = this.getLaneX(obstacleLane, y);
    const scale = lerp(0.12, 1.73, linearAmount);
    const width = 210 * scale;
    const height = 126 * scale;
    const now = performance.now();

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.sin(this.obstacle.wobble + this.elapsedMs * 0.004) * 0.02);

    if (this.obstacle.state === "crashed") {
      const flash = clamp(1 - (now - this.obstacle.hitAt) / CONFIG.crashFlashMs, 0, 1);
      ctx.scale(1 + flash * 0.2, 1 + flash * 0.15);
    }

    const typed = this.obstacle.word.slice(0, this.obstacle.typedCount);
    const rest = this.obstacle.word.slice(this.obstacle.typedCount);
    ctx.font = `${Math.max(5, 32 * scale)}px "Press Start 2P", monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = Math.max(4, scale * 4.4);
    ctx.strokeStyle = "#122137";
    ctx.lineJoin = "round";
    ctx.miterLimit = 2;

    if (typed) {
      const full = `${typed}${rest}`;
      const fullWidth = ctx.measureText(full).width;
      let cursorX = -fullWidth / 2;
      for (const character of typed) {
        const widthChar = ctx.measureText(character).width;
        ctx.globalAlpha = 0.22;
        ctx.strokeText(character, cursorX + widthChar / 2, -height * 0.05);
        ctx.fillStyle = "#c6d3ff";
        ctx.fillText(character, cursorX + widthChar / 2, -height * 0.05);
        ctx.globalAlpha = 1;
        cursorX += widthChar;
      }
      for (const character of rest) {
        const widthChar = ctx.measureText(character).width;
        ctx.globalAlpha = 1;
        ctx.strokeText(character, cursorX + widthChar / 2, -height * 0.05);
        ctx.fillStyle = now < this.errorUntil ? "#ff8f8f" : "#fff9e4";
        ctx.fillText(character, cursorX + widthChar / 2, -height * 0.05);
        cursorX += widthChar;
      }
    } else {
      ctx.globalAlpha = 1;
      ctx.strokeText(this.obstacle.word, 0, -height * 0.05);
      ctx.fillStyle = now < this.errorUntil ? "#ff8f8f" : "#fff4d0";
      ctx.fillText(this.obstacle.word, 0, -height * 0.05);
    }

    if (this.obstacle.state === "cleared" || this.obstacle.state === "crashed") {
      const boom = clamp(1 - (now - this.obstacle.hitAt) / 260, 0, 1);
      if (boom > 0) {
        const image = this.obstacle.state === "crashed" ? this.images.boom : this.images.tick;
        if (image?.complete && image.naturalWidth) {
          ctx.globalAlpha = boom;
          const effectScale = this.obstacle.state === "crashed" ? 0.52 + (1 - boom) * 0.72 : 0.42 + (1 - boom) * 0.36;
          const effectWidth = image.naturalWidth * effectScale;
          const effectHeight = image.naturalHeight * effectScale;
          ctx.drawImage(image, -effectWidth / 2, -effectHeight / 2, effectWidth, effectHeight);
        } else {
          ctx.globalAlpha = boom * 0.9;
          ctx.strokeStyle = this.obstacle.state === "crashed" ? "#ff664d" : "#68ffbe";
          ctx.lineWidth = 6;
          ctx.beginPath();
          const radius = width * (0.3 + (1 - boom) * 0.55);
          for (let index = 0; index < 12; index += 1) {
            const angle = (Math.PI * 2 * index) / 12;
            ctx.moveTo(Math.cos(angle) * radius * 0.45, Math.sin(angle) * radius * 0.45);
            ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
          }
          ctx.stroke();
        }
      }
    }

    ctx.restore();
  }

  drawCar() {
    const ctx = this.context;
    const laneY = CONFIG.carY;
    const laneX = this.getLaneX(this.carLanePosition, laneY);
    const now = performance.now();
    const shake = now < this.shakeUntil ? Math.sin(now * 0.08) * 10 : 0;
    const bob = this.running && !this.gameOver ? Math.sin(this.elapsedMs * 0.026) * 3.5 : 0;

    ctx.save();
    ctx.translate(laneX + shake, laneY + bob);

    const carImage = this.images.car;
    const drawWidth = 310;
    const drawHeight = (carImage?.naturalWidth && carImage?.naturalHeight)
      ? (drawWidth * carImage.naturalHeight) / carImage.naturalWidth
      : 190;

    if (carImage?.complete && carImage.naturalWidth) {
      ctx.drawImage(carImage, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
    } else {
      ctx.fillStyle = "#ff9d31";
      ctx.fillRect(-120, -44, 240, 88);
    }

    ctx.restore();
  }

  drawRoadHud() {
    const ctx = this.context;
    const width = this.viewportWidth;
    const height = this.viewportHeight;
    ctx.fillStyle = "rgba(255, 255, 255, 0.04)";
    ctx.fillRect(0, 0, width, height);

    if (performance.now() < this.flashUntil) {
      ctx.fillStyle = "rgba(255, 94, 94, 0.12)";
      ctx.fillRect(0, 0, width, height);
    }
  }

  render() {
    const ctx = this.context;
    if (!ctx || !this.viewportWidth || !this.viewportHeight) return;

    ctx.clearRect(0, 0, this.viewportWidth, this.viewportHeight);
    this.drawBackground();
    this.drawTrees();
    this.drawObstacle();
    this.drawCar();
    this.drawRoadHud();
  }

  loop(timestamp) {
    if (!this.lastFrameTime) {
      this.lastFrameTime = timestamp;
    }

    const deltaMs = Math.min(timestamp - this.lastFrameTime, 34);
    this.lastFrameTime = timestamp;

    if (this.running && !this.gameOver) {
      this.update(deltaMs);
    }

    this.render();
    this.frame = window.requestAnimationFrame(this.loop);
  }
}

const game = new RoadDashGame();

function closeGame() {
  game.stopSounds();
  if (window.parent && window.parent !== window) {
    window.parent.postMessage({ type: POST_MESSAGE_CLOSE }, "*");
    return;
  }

  window.location.href = "../";
}

if (window.location.search.includes("embed=1")) {
  document.body.classList.add("is-embedded");
}

ui.startButton.addEventListener("click", () => game.start());
ui.startBackButton.addEventListener("click", closeGame);
ui.restartButton.addEventListener("click", () => game.restart());
ui.backButton.addEventListener("click", closeGame);
ui.gameOverBackButton.addEventListener("click", closeGame);
