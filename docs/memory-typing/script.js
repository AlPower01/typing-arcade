"use strict";

/*
  Memory Typing
  Edit the config and word bank below to tune difficulty.
  The game uses a simple memorize -> type -> validate loop.
*/

const CONFIG = {
  allowRetries: false,
  maxWordCount: 5,
  memorizeTimeStart: 4000,
  memorizeTimeMin: 3200,
  memorizeTimeStep: 250,
  feedbackDuration: 1000,
  bestScoreKey: "typing-arcade-memory-typing-best-score",
  musicEnabledKey: "typing-arcade-music-enabled",
};
const LEADERBOARD_STORAGE_KEY = "typing-arcade-best-scores-v2";
const LEADERBOARD_GAME_ID = "memory-typing";
const LEADERBOARD_LIMIT = 6;

const ASSET_PATHS = {
  type: "./images/type.mp3",
  correct: "./images/correct.mp3",
  bgMusic: "./images/bg_music.mp3",
  timer: "./images/timer.mp3",
};

const WORD_BANK = {
  3: ["sun", "box", "tap", "zip", "cat", "dog", "map", "run", "jam", "fox"],
  4: ["blue", "tree", "lamp", "play", "wind", "jump", "star", "book", "game", "rock"],
  5: ["apple", "train", "paper", "cloud", "light", "robot", "smile", "track", "pixel", "grape"],
  6: ["rocket", "planet", "silver", "forest", "memory", "bridge", "button", "guitar", "violet", "shadow"],
};

const ROUND_PLAN = [
  { wordCount: 1, wordLength: 3 },
  { wordCount: 1, wordLength: 4 },
  { wordCount: 2, wordLength: 3 },
  { wordCount: 1, wordLength: 5 },
  { wordCount: 2, wordLength: 4 },
  { wordCount: 3, wordLength: 3 },
  { wordCount: 2, wordLength: 5 },
  { wordCount: 3, wordLength: 4 },
  { wordCount: 4, wordLength: 3 },
  { wordCount: 3, wordLength: 5 },
  { wordCount: 4, wordLength: 4 },
  { wordCount: 5, wordLength: 3 },
  { wordCount: 4, wordLength: 5 },
  { wordCount: 5, wordLength: 4 },
  { wordCount: 5, wordLength: 5 },
  { wordCount: 5, wordLength: 6 },
];

const ui = {
  wordDisplay: document.getElementById("wordDisplay"),
  phaseBanner: document.getElementById("phaseBanner"),
  countdown: document.getElementById("countdownValue"),
  answerForm: document.getElementById("answerForm"),
  answerInput: document.getElementById("answerInput"),
  feedback: document.getElementById("feedback"),
  score: document.getElementById("scoreValue"),
  round: document.getElementById("roundValue"),
  best: document.getElementById("bestValue"),
  mode: document.getElementById("modeValue"),
  startOverlay: document.getElementById("startOverlay"),
  gameOverOverlay: document.getElementById("gameOverOverlay"),
  gameOverTitle: document.getElementById("gameOverTitle"),
  gameOverSummary: document.getElementById("gameOverSummary"),
  answerReveal: document.getElementById("answerReveal"),
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

class SoundController {
  constructor() {
    this.musicEnabled = window.localStorage.getItem(CONFIG.musicEnabledKey) !== "false";
    this.players = {
      type: this.createAudio(ASSET_PATHS.type, 0.45),
      correct: this.createAudio(ASSET_PATHS.correct, 0.58),
      bgMusic: this.createAudio(ASSET_PATHS.bgMusic, 0.18, true),
      timer: this.createAudio(ASSET_PATHS.timer, 0.42),
    };
  }

  createAudio(src, volume, loop = false) {
    const audio = new Audio(src);
    audio.preload = "auto";
    audio.volume = volume;
    audio.loop = loop;
    return audio;
  }

  cloneAndPlay(src, volume) {
    if (!this.musicEnabled || document.hidden) return;
    const audio = new Audio(src);
    audio.volume = volume;
    audio.play().catch(() => {});
  }

  playType() {
    this.cloneAndPlay(ASSET_PATHS.type, 0.45);
  }

  playCorrect() {
    this.cloneAndPlay(ASSET_PATHS.correct, 0.58);
  }

  playTimerTick() {
    if (!this.musicEnabled || document.hidden) return;
    const timer = this.players.timer;
    timer.pause();
    timer.currentTime = 0;
    timer.play().catch(() => {});
  }

  stopTimerTick() {
    const timer = this.players.timer;
    timer.pause();
    timer.currentTime = 0;
  }

  playMusic() {
    if (!this.musicEnabled || document.hidden) return;
    const music = this.players.bgMusic;
    music.currentTime = 0;
    music.play().catch(() => {});
  }

  stopMusic() {
    const music = this.players.bgMusic;
    music.pause();
    music.currentTime = 0;
  }

  silenceAll() {
    Object.values(this.players).forEach((audio) => {
      audio.pause();
      audio.currentTime = 0;
    });
  }

  resumeMusicIfAllowed(isPlaying) {
    if (isPlaying) {
      this.playMusic();
    }
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

class MemoryTypingGame {
  constructor() {
    this.sound = new SoundController();
    this.wordQueues = {};
    this.reset();
    this.updateHud();
  }

  reset() {
    this.score = 0;
    this.round = 1;
    this.bestScore = Number(window.localStorage.getItem(CONFIG.bestScoreKey) || 0);
    this.sequence = [];
    this.wordQueues = {};
    this.phase = "idle";
    this.phaseTimeout = 0;
    this.countdownInterval = 0;
    this.retriesLeft = CONFIG.allowRetries ? 1 : 0;
    this.pendingLeaderboardScore = null;
    this.updateHud();
    this.clearFeedback();
    this.renderWords([]);
    ui.answerReveal.hidden = true;
    ui.answerReveal.textContent = "";
    ui.answerInput.value = "";
    ui.nameEntryInput.value = "";
    ui.answerForm.classList.remove("is-visible");
    ui.nameEntryOverlay.classList.remove("is-visible");
  }

  start() {
    this.reset();
    ui.startOverlay.classList.remove("is-visible");
    ui.gameOverOverlay.classList.remove("is-visible");
    this.sound.playMusic();
    this.beginRound();
  }

  restart() {
    this.start();
  }

  getRoundSpec() {
    if (this.round - 1 < ROUND_PLAN.length) {
      return ROUND_PLAN[this.round - 1];
    }

    return {
      wordCount: CONFIG.maxWordCount,
      wordLength: 6,
    };
  }

  getMemorizeTime() {
    return Math.max(CONFIG.memorizeTimeMin, CONFIG.memorizeTimeStart - (this.round - 1) * CONFIG.memorizeTimeStep);
  }

  getWordQueue(length) {
    if (!this.wordQueues[length] || this.wordQueues[length].length === 0) {
      const pool = [...(WORD_BANK[length] || WORD_BANK[6])];
      for (let index = pool.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [pool[index], pool[swapIndex]] = [pool[swapIndex], pool[index]];
      }
      this.wordQueues[length] = pool;
    }

    return this.wordQueues[length];
  }

  pickSequence() {
    const { wordCount, wordLength } = this.getRoundSpec();
    const sequence = [];
    const used = new Set();

    while (sequence.length < wordCount) {
      const queue = this.getWordQueue(wordLength);
      if (queue.length === 0) break;

      const nextWord = queue.shift();
      if (used.has(nextWord)) {
        continue;
      }

      used.add(nextWord);
      sequence.push(nextWord);
    }

    return sequence;
  }

  beginRound() {
    window.clearTimeout(this.phaseTimeout);
    window.clearInterval(this.countdownInterval);
    this.sound.stopTimerTick();
    this.sequence = this.pickSequence();
    this.phase = "memorize";
    ui.answerInput.value = "";
    ui.answerForm.classList.remove("is-visible");
    this.setFeedback("", "");
    this.renderWords(this.sequence);
    ui.phaseBanner.textContent = "Memorize...";

    const memorizeMs = this.getMemorizeTime();
    let remainingSeconds = Math.ceil(memorizeMs / 1000);
    ui.countdown.textContent = String(remainingSeconds);
    this.sound.playTimerTick();

    this.countdownInterval = window.setInterval(() => {
      remainingSeconds -= 1;
      ui.countdown.textContent = String(Math.max(0, remainingSeconds));
      if (remainingSeconds > 0) {
        this.sound.playTimerTick();
      }
    }, 1000);

    this.phaseTimeout = window.setTimeout(() => {
      window.clearInterval(this.countdownInterval);
      this.sound.stopTimerTick();
      this.enterTypingPhase();
    }, memorizeMs);
  }

  enterTypingPhase() {
    this.sound.stopTimerTick();
    this.phase = "typing";
    this.renderWords([]);
    ui.phaseBanner.textContent = "Type Now!";
    ui.countdown.textContent = "";
    ui.answerForm.classList.add("is-visible");
    ui.answerInput.focus();
  }

  submitAnswer(rawValue) {
    if (this.phase !== "typing") return;

    const normalizedInput = rawValue
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);

    const expected = this.sequence.map((word) => word.toLowerCase());
    const isCorrect =
      normalizedInput.length === expected.length &&
      normalizedInput.every((word, index) => word === expected[index]);

    if (isCorrect) {
      this.handleSuccess();
      return;
    }

    this.handleFailure(normalizedInput, expected);
  }

  handleSuccess() {
    this.phase = "feedback";
    this.sound.playCorrect();
    this.score += 1;
    this.bestScore = Math.max(this.bestScore, this.score);
    window.localStorage.setItem(CONFIG.bestScoreKey, String(this.bestScore));
    this.updateHud();
    this.setFeedback("Correct sequence", "is-good");
    ui.phaseBanner.textContent = "Locked In";
    ui.answerForm.classList.remove("is-visible");
    this.renderWords(this.sequence);

    this.phaseTimeout = window.setTimeout(() => {
      this.round += 1;
      this.beginRound();
    }, CONFIG.feedbackDuration);
  }

  handleFailure(inputWords, expectedWords) {
    this.phase = "feedback";
    const expectedText = expectedWords.join(" ");
    const receivedText = inputWords.join(" ");

    if (CONFIG.allowRetries && this.retriesLeft > 0) {
      this.retriesLeft -= 1;
      this.setFeedback(`Wrong order. Try again: ${expectedText}`, "is-bad");
      ui.phaseBanner.textContent = "Try Again";
      ui.answerInput.focus();
      this.phase = "typing";
      return;
    }

    this.setFeedback(`Expected: ${expectedText}${receivedText ? ` | You typed: ${receivedText}` : ""}`, "is-bad");
    ui.answerForm.classList.remove("is-visible");
    this.renderWords(this.sequence);
    this.endGame(expectedText, receivedText);
  }

  endGame(expectedText = "", receivedText = "") {
    this.phase = "gameover";
    ui.phaseBanner.textContent = "Round Over";
    ui.countdown.textContent = "";
    ui.gameOverTitle.textContent = "Game Over";
    ui.gameOverSummary.textContent = `Score ${this.score} • Round ${this.round} • Best ${this.bestScore}`;
    if (expectedText) {
      ui.answerReveal.hidden = false;
      ui.answerReveal.textContent = `Answer: ${expectedText}${receivedText ? ` | You typed: ${receivedText}` : ""}`;
    } else {
      ui.answerReveal.hidden = true;
      ui.answerReveal.textContent = "";
    }

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

  renderWords(words) {
    ui.wordDisplay.innerHTML = "";
    if (words.length === 0) return;

    const fragment = document.createDocumentFragment();
    for (const word of words) {
      const chip = document.createElement("span");
      chip.className = "memory-word";
      chip.textContent = word;
      fragment.appendChild(chip);
    }
    ui.wordDisplay.appendChild(fragment);
  }

  setFeedback(message, className) {
    ui.feedback.textContent = message;
    ui.feedback.className = `feedback ${className}`.trim();
  }

  clearFeedback() {
    this.setFeedback("", "");
  }

  updateHud() {
    ui.score.textContent = String(this.score);
    ui.round.textContent = String(this.round);
    ui.best.textContent = String(this.bestScore);
    const { wordCount, wordLength } = this.getRoundSpec();
    ui.mode.textContent = `${wordCount}x${wordLength}`;
  }
}

const game = new MemoryTypingGame();
const isEmbedded = new URLSearchParams(window.location.search).get("embed") === "1";

if (isEmbedded) {
  ui.topbar.style.display = "none";
  document.body.classList.add("is-embedded");
}

function goBackToArcade() {
  game.sound.silenceAll();
  if (window.parent && window.parent !== window) {
    window.parent.postMessage({ type: "memory-typing:close" }, "*");
    return;
  }

  window.location.href = "../";
}

ui.answerForm.addEventListener("submit", (event) => {
  event.preventDefault();
  game.submitAnswer(ui.answerInput.value);
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

ui.answerInput.addEventListener("keydown", (event) => {
  if (game.phase !== "typing") return;
  if (event.key.length !== 1) return;
  if (!/[a-z ]/i.test(event.key)) return;
  game.sound.playType();
});

ui.startButton.addEventListener("click", () => {
  game.start();
});

ui.restartButton.addEventListener("click", () => {
  game.restart();
});

ui.backButton.addEventListener("click", goBackToArcade);
ui.startBackButton.addEventListener("click", goBackToArcade);
ui.restartBackButton.addEventListener("click", goBackToArcade);

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    game.sound.silenceAll();
    return;
  }

  game.sound.resumeMusicIfAllowed(game.phase !== "idle" && game.phase !== "gameover");
});

window.addEventListener("pagehide", () => {
  game.sound.silenceAll();
});
