"use strict";

const LEADERBOARD_STORAGE_KEY = "typing-arcade-best-scores-v2";
const LEADERBOARD_GAME_ID = "typing-dash";
const BEST_RUN_KEY = "typing-arcade-typing-dash-best-run";
const PLAYER_NAME_KEY = "typing-arcade-typing-dash-player-name";
const MODE_KEY = "50-word-dash-v1";
const LEADERBOARD_LIMIT = 10;
const TARGET_WORD_COUNT = 50;
const TARGET_CHARACTER_COUNT = 290;
function createPassage(text) {
  const passage = text.trim().split(/\s+/).slice(0, TARGET_WORD_COUNT).join(" ");

  if (passage.split(/\s+/).length !== TARGET_WORD_COUNT) {
    throw new Error(`Typing Dash passages must contain exactly ${TARGET_WORD_COUNT} words.`);
  }

  if (passage.length !== TARGET_CHARACTER_COUNT) {
    throw new Error(`Typing Dash passages must contain exactly ${TARGET_CHARACTER_COUNT} characters.`);
  }

  return passage;
}

const PASSAGE_BANK = [
  createPassage(`On Saturday morning, the park smelled like fresh grass and warm waffles from a nearby cart. Friends raced to the fountain, laughing whenever the spray caught the sun. A street drummer kept a bright beat while dogs chased tennis balls, and the whole square felt alive with easy weekend joys.`),
  createPassage(`After school, we biked to the hill behind the library and watched the town glow orange below us. Someone opened a bag of cinnamon doughnuts, someone else played a speaker, and the breeze carried every laugh farther than expected. By sunset, even the quietest person was smiling at the view.`),
  createPassage(`During the festival parade, lanterns bobbed above the crowd while a brass band marched past the bakery. Kids waved flags, elders clapped in time, and the mayor nearly lost his hat to the winds. When the last drumroll faded, everyone stayed smiling beneath the evening lights for us at dusk.`),
  createPassage(`The beach arcade woke up slowly, blinking neon signs into the salty morning air. We traded coins for tokens, argued over the claw machine, and cheered whenever someone finally won a plush shark. Outside, gulls circled above the boardwalk, and the sea kept rolling in like it knew our names.`),
];

const RUNNER_FRAMES = {
  idle: "./images/stand.png",
  running: ["./images/run1.png", "./images/run2.png", "./images/run3.png"],
};

const SOUND_PATHS = {
  click: "./images/click.mp3",
  bgMusic: "./images/bg_music.mp3",
  letsGo: "./images/letsgo.mp3",
};

const ui = {
  topbar: document.getElementById("topbar"),
  raceScene: document.getElementById("raceScene"),
  runner: document.getElementById("runner"),
  runnerSprite: document.getElementById("runnerSprite"),
  passagePanel: document.getElementById("passagePanel"),
  passageViewport: document.getElementById("passageViewport"),
  passageText: document.getElementById("passageText"),
  wordCountValue: document.getElementById("wordCountValue"),
  typingInput: document.getElementById("typingInput"),
  timeValue: document.getElementById("timeValue"),
  startOverlay: document.getElementById("startOverlay"),
  startButton: document.getElementById("startButton"),
  startBackButton: document.getElementById("startBackButton"),
  nameEntryOverlay: document.getElementById("nameEntryOverlay"),
  nameEntrySummary: document.getElementById("nameEntrySummary"),
  nameEntryForm: document.getElementById("nameEntryForm"),
  nameEntryInput: document.getElementById("nameEntryInput"),
  gameOverOverlay: document.getElementById("gameOverOverlay"),
  resultTimeValue: document.getElementById("resultTimeValue"),
  resultWpmValue: document.getElementById("resultWpmValue"),
  resultAccuracyValue: document.getElementById("resultAccuracyValue"),
  resultMistakesValue: document.getElementById("resultMistakesValue"),
  resultRankValue: document.getElementById("resultRankValue"),
  replayButton: document.getElementById("replayButton"),
  resultsBackButton: document.getElementById("resultsBackButton"),
};

function getStoredPlayerName() {
  return window.localStorage.getItem(PLAYER_NAME_KEY) || "";
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

function getStoredBestRun() {
  try {
    const raw = window.localStorage.getItem(BEST_RUN_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
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

function saveBestRun(entry) {
  window.localStorage.setItem(BEST_RUN_KEY, JSON.stringify(entry));
}

function formatTime(ms) {
  return `${(ms / 1000).toFixed(3)}s`;
}

function formatAccuracy(value) {
  return `${value.toFixed(1)}%`;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function shuffle(array) {
  const items = [...array];
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
  }
  return items;
}

function postScoreUpdated() {
  if (window.parent && window.parent !== window) {
    window.parent.postMessage({ type: "typing-arcade:score-updated" }, "*");
  }
}

class TypingDashGame {
  constructor() {
    this.passageQueue = shuffle(PASSAGE_BANK);
    this.leaderboard = getStoredLeaderboard();
    this.bestRun = getStoredBestRun();
    this.playerName = getStoredPlayerName();
    this.pendingResult = null;
    this.runnerFrameIndex = 0;
    this.runnerFrameElapsed = 0;
    this.lastTypingAt = 0;
    this.audioContext = null;
    this.sounds = {
      click: this.createAudio(SOUND_PATHS.click),
      bgMusic: this.createAudio(SOUND_PATHS.bgMusic),
      letsGo: this.createAudio(SOUND_PATHS.letsGo),
    };
    if (this.sounds.bgMusic) {
      this.sounds.bgMusic.loop = true;
      this.sounds.bgMusic.volume = 0.14;
    }
    this.preloadRunnerFrames();
    this.resetRace();
    ui.raceScene.classList.add("is-preview");
  }

  createAudio(src) {
    const audio = new Audio(src);
    audio.preload = "auto";
    return audio;
  }

  preloadRunnerFrames() {
    [RUNNER_FRAMES.idle, ...RUNNER_FRAMES.running].forEach((src) => {
      const image = new Image();
      image.src = src;
    });
  }

  resetRace() {
    this.stopRaceAudio();
    this.passage = this.getNextPassage();
    this.inputValue = "";
    this.started = false;
    this.finished = false;
    this.startTime = 0;
    this.elapsedMs = 0;
    this.timerFrame = 0;
    this.mistakes = 0;
    this.correctKeyCount = 0;
    this.errorFlashUntil = 0;
    this.backgroundPan = 0;
    this.lastFrameTime = 0;
    this.runnerFrameIndex = 0;
    this.runnerFrameElapsed = 0;
    this.lastTypingAt = 0;
    ui.typingInput.value = "";
    ui.typingInput.disabled = true;
    ui.raceScene.dataset.scene = "start";
    ui.runner.classList.remove("is-running");
    this.setRunnerSprite("idle");
    ui.raceScene.style.setProperty("--runner-progress", "0");
    ui.raceScene.style.setProperty("--runner-bob-ms", "260ms");
    ui.raceScene.style.setProperty("--bg-pan", "0px");
    ui.timeValue.textContent = "0.000s";
    ui.nameEntryOverlay.classList.remove("is-visible");
    ui.gameOverOverlay.classList.remove("is-visible");
    this.renderPassage();
  }

  getNextPassage() {
    if (this.passageQueue.length === 0) {
      this.passageQueue = shuffle(PASSAGE_BANK);
    }
    return this.passageQueue.shift();
  }

  loadRace() {
    this.resetRace();
    this.ensureAudio();
    ui.raceScene.classList.remove("is-preview");
    ui.startOverlay.classList.remove("is-visible");
    ui.typingInput.disabled = false;
    ui.typingInput.focus();
  }

  beginTimer() {
    if (this.started) return;
    this.started = true;
    ui.runner.classList.add("is-running");
    this.setRunnerSprite("running", 0);
    this.startRaceAudio();
    this.startTime = performance.now();
    this.lastFrameTime = this.startTime;
    this.tickTimer();
  }

  tickTimer = () => {
    if (!this.started || this.finished) return;
    const now = performance.now();
    const deltaMs = now - this.lastFrameTime;
    this.lastFrameTime = now;
    this.elapsedMs = now - this.startTime;
    ui.timeValue.textContent = formatTime(this.elapsedMs);
    if (this.errorFlashUntil && now > this.errorFlashUntil) {
      this.errorFlashUntil = 0;
      this.renderPassage();
    }
    this.updateRaceVisuals(deltaMs);
    this.timerFrame = window.requestAnimationFrame(this.tickTimer);
  };

  handleInput(nextValue) {
    if (this.finished) return;

    const inputChanged = nextValue !== this.inputValue;
    if (inputChanged) {
      this.lastTypingAt = performance.now();
      if (this.started) {
        ui.runner.classList.add("is-running");
        this.runnerFrameIndex = (this.runnerFrameIndex + 1) % RUNNER_FRAMES.running.length;
        this.runnerFrameElapsed = 0;
        this.setRunnerSprite("running", this.runnerFrameIndex);
      }
    }

    if (!this.started && nextValue.length > 0) {
      this.beginTimer();
    }

    if (nextValue.length < this.inputValue.length) {
      this.inputValue = nextValue;
      ui.typingInput.value = this.inputValue;
      this.renderPassage();
      this.updateRaceVisuals(0);
      return;
    }

    if (nextValue.length > this.inputValue.length) {
      const appended = nextValue.slice(this.inputValue.length);
      let acceptedValue = this.inputValue;

      for (let index = 0; index < appended.length; index += 1) {
        const expectedChar = this.passage[acceptedValue.length];
        const typedChar = appended[index];

        if (typedChar === expectedChar) {
          acceptedValue += typedChar;
          this.correctKeyCount += 1;
          this.errorFlashUntil = 0;
          this.playKeyClick();
        } else {
          this.mistakes += 1;
          this.errorFlashUntil = performance.now() + 180;
          this.playWrongKey();
        }
      }

      this.inputValue = acceptedValue;
      ui.typingInput.value = this.inputValue;
    } else {
      this.inputValue = nextValue;
    }

    this.renderPassage();
    this.updateRaceVisuals(0);

    if (this.inputValue === this.passage) {
      this.finishRace();
    }
  }

  finishRace() {
    this.finished = true;
    this.elapsedMs = performance.now() - this.startTime;
    this.stopRaceAudio();
    ui.timeValue.textContent = formatTime(this.elapsedMs);
    ui.runner.classList.remove("is-running");
    this.setRunnerSprite("idle");
    window.cancelAnimationFrame(this.timerFrame);

    const result = this.buildResult();
    this.updateBestRun(result);

    if (this.qualifiesForLeaderboard(result)) {
      this.openNameEntry(result);
    } else {
      this.showResults(result, "--");
    }
  }

  buildResult() {
    const minutes = Math.max(this.elapsedMs / 60000, 1 / 60000);
    const wpm = Math.round((this.correctKeyCount / 5) / minutes);
    const totalKeystrokes = this.correctKeyCount + this.mistakes;
    const accuracy = totalKeystrokes === 0 ? 100 : (this.correctKeyCount / totalKeystrokes) * 100;

    return {
      timeMs: Math.round(this.elapsedMs),
      wpm,
      accuracy: Number(accuracy.toFixed(1)),
      mistakes: this.mistakes,
      date: new Date().toISOString(),
      mode: MODE_KEY,
    };
  }

  qualifiesForLeaderboard(result) {
    const modeEntries = this.leaderboard.filter((entry) => entry.mode === MODE_KEY);
    if (modeEntries.length < LEADERBOARD_LIMIT) return true;
    return result.timeMs < modeEntries[modeEntries.length - 1].timeMs;
  }

  saveResult(result) {
    const nextEntries = [...this.leaderboard.filter((entry) => entry.mode === MODE_KEY), result]
      .sort((a, b) => a.timeMs - b.timeMs)
      .slice(0, LEADERBOARD_LIMIT);

    this.leaderboard = nextEntries;
    saveLeaderboard(nextEntries);
    postScoreUpdated();

    const rank = nextEntries.findIndex(
      (entry) =>
        entry.date === result.date &&
        entry.name === result.name &&
        entry.timeMs === result.timeMs &&
        entry.mistakes === result.mistakes,
    );

    return rank === -1 ? LEADERBOARD_LIMIT : rank + 1;
  }

  updateBestRun(result) {
    if (!this.bestRun || result.timeMs < this.bestRun.timeMs) {
      this.bestRun = result;
      saveBestRun(result);
    }
  }

  openNameEntry(result) {
    this.pendingResult = result;
    ui.nameEntrySummary.textContent = `You finished in ${formatTime(result.timeMs)} and made the top ${LEADERBOARD_LIMIT}.`;
    ui.nameEntryInput.value = this.playerName;
    ui.nameEntryOverlay.classList.add("is-visible");
    window.requestAnimationFrame(() => {
      ui.nameEntryInput.focus();
      ui.nameEntryInput.select();
    });
  }

  confirmNameEntry(rawName) {
    if (!this.pendingResult) return;

    this.playerName = (rawName.trim() || "PLAYER").slice(0, 12).toUpperCase();
    window.localStorage.setItem(PLAYER_NAME_KEY, this.playerName);

    const namedResult = {
      ...this.pendingResult,
      name: this.playerName,
    };

    const rank = this.saveResult(namedResult);
    this.pendingResult = null;
    ui.nameEntryOverlay.classList.remove("is-visible");
    this.showResults(namedResult, rank);
  }

  showResults(result, rank) {
    ui.resultTimeValue.textContent = formatTime(result.timeMs);
    ui.resultWpmValue.textContent = String(result.wpm);
    ui.resultAccuracyValue.textContent = formatAccuracy(result.accuracy);
    ui.resultMistakesValue.textContent = String(result.mistakes);
    ui.resultRankValue.textContent =
      rank === "--" ? "Leaderboard rank: --" : `Leaderboard rank: #${rank}`;
    ui.gameOverOverlay.classList.add("is-visible");
  }

  renderPassage() {
    ui.passageText.innerHTML = "";
    const fragment = document.createDocumentFragment();
    const currentIndex = this.getCurrentIndex();

    for (let index = 0; index < this.passage.length; index += 1) {
      const span = document.createElement("span");
      span.className = "char";
      span.textContent = this.passage[index];

      if (index < this.inputValue.length) {
        span.classList.add(this.inputValue[index] === this.passage[index] ? "is-correct" : "is-incorrect");
      } else if (index === currentIndex && !this.finished) {
        span.classList.add("is-current");
        if (this.errorFlashUntil > performance.now()) {
          span.classList.add("is-blocked");
        }
        span.setAttribute("data-current-char", "true");
      }

      fragment.appendChild(span);
    }

    ui.passageText.appendChild(fragment);
    ui.wordCountValue.textContent = String(this.getTypedWordCount());
    this.syncPassageScroll();
  }

  syncPassageScroll() {
    const currentChar = ui.passageText.querySelector("[data-current-char]");
    if (!currentChar) {
      ui.passageViewport.scrollLeft = this.finished ? ui.passageViewport.scrollWidth : 0;
      return;
    }

    const targetScroll = Math.max(0, currentChar.offsetLeft - ui.passageViewport.clientWidth * 0.24);
    ui.passageViewport.scrollLeft = targetScroll;
  }

  getCurrentIndex() {
    const limit = Math.min(this.inputValue.length, this.passage.length);
    for (let index = 0; index < limit; index += 1) {
      if (this.inputValue[index] !== this.passage[index]) {
        return index;
      }
    }
    return limit;
  }

  getTypedWordCount() {
    const currentIndex = this.getCurrentIndex();
    const typedPrefix = this.passage.slice(0, currentIndex).trim();
    return typedPrefix ? typedPrefix.split(/\s+/).length : 0;
  }

  updateRaceVisuals(deltaMs = 0) {
    const currentIndex = this.getCurrentIndex();
    const typedWords = this.getTypedWordCount();
    const progress = clamp(typedWords / TARGET_WORD_COUNT, 0, 1);
    const minutes = Math.max(this.elapsedMs / 60000, 1 / 60000);
    const liveWpm = this.started ? Math.round((currentIndex / 5) / minutes) : 0;
    const bobMs = clamp(360 - liveWpm * 2, 150, 360);
    const frameMs = clamp(260 - liveWpm * 1.1, 90, 260);
    let scene = "middle";
    let sceneProgress = 0;

    if (progress < 0.32) {
      scene = "start";
      sceneProgress = progress / 0.32;
    } else if (progress < 0.82) {
      scene = "middle";
      sceneProgress = (progress - 0.32) / 0.5;
    } else {
      scene = "finish";
      sceneProgress = (progress - 0.82) / 0.18;
    }

    if (this.started && !this.finished && deltaMs > 0) {
      this.backgroundPan += deltaMs;
      this.runnerFrameElapsed += deltaMs;
      ui.runner.classList.add("is-running");

      if (this.runnerFrameElapsed >= frameMs) {
        this.runnerFrameElapsed = 0;
        this.runnerFrameIndex = (this.runnerFrameIndex + 1) % RUNNER_FRAMES.running.length;
        this.setRunnerSprite("running", this.runnerFrameIndex);
      }
    }

    const speedBoost = clamp(liveWpm / 120, 0, 1);
    const sceneOffset = (-340 * clamp(sceneProgress, 0, 1)) - speedBoost * 120;

    ui.raceScene.dataset.scene = scene;
    ui.raceScene.style.setProperty("--runner-progress", progress.toFixed(4));
    ui.raceScene.style.setProperty("--runner-bob-ms", `${bobMs}ms`);
    ui.raceScene.style.setProperty("--bg-pan", `${sceneOffset.toFixed(2)}px`);
  }

  setRunnerSprite(mode, frameIndex = 0) {
    const nextSrc = mode === "running" ? RUNNER_FRAMES.running[frameIndex] : RUNNER_FRAMES.idle;
    if (ui.runnerSprite.getAttribute("src") !== nextSrc) {
      ui.runnerSprite.setAttribute("src", nextSrc);
    }
  }

  ensureAudio() {
    if (!this.audioContext) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return null;
      this.audioContext = new AudioContextClass();
    }

    if (this.audioContext.state === "suspended") {
      this.audioContext.resume().catch(() => {});
    }

    return this.audioContext;
  }

  playAudioClip(name) {
    const source = this.sounds[name];
    if (!source) return false;

    try {
      if (name === "bgMusic") {
        source.currentTime = 0;
        const playPromise = source.play();
        if (playPromise && typeof playPromise.catch === "function") {
          playPromise.catch(() => {});
        }
        return true;
      }

      const clip = source.cloneNode();
      clip.volume = name === "click" ? 0.38 : name === "letsGo" ? 0.58 : 0.42;
      const playPromise = clip.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(() => {});
      }
      return true;
    } catch {
      return false;
    }
  }

  playTone({ frequency, duration, type = "square", gain = 0.05, attack = 0.003, release = 0.06 }) {
    const context = this.ensureAudio();
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

  playKeyClick() {
    if (this.playAudioClip("click")) return;

    this.playTone({
      frequency: 980,
      duration: 0.04,
      type: "square",
      gain: 0.035,
      attack: 0.002,
      release: 0.035,
    });
  }

  playWrongKey() {
    this.playTone({
      frequency: 180,
      duration: 0.06,
      type: "sine",
      gain: 0.04,
      attack: 0.002,
      release: 0.05,
    });
  }

  startRaceAudio() {
    this.playAudioClip("letsGo");
    this.playAudioClip("bgMusic");
  }

  stopRaceAudio() {
    const music = this.sounds.bgMusic;
    if (!music) return;
    music.pause();
    music.currentTime = 0;
  }

  replay() {
    this.resetRace();
    this.ensureAudio();
    ui.typingInput.disabled = false;
    ui.typingInput.focus();
  }
}

const game = new TypingDashGame();
const isEmbedded = new URLSearchParams(window.location.search).get("embed") === "1";

if (isEmbedded) {
  ui.topbar.style.display = "none";
  document.body.classList.add("is-embedded");
}

function goBackToArcade() {
  game.stopRaceAudio();
  if (window.parent && window.parent !== window) {
    window.parent.postMessage({ type: "typing-dash:close" }, "*");
    return;
  }

  window.location.href = "../";
}

ui.startButton.addEventListener("click", () => {
  game.loadRace();
});

ui.startBackButton.addEventListener("click", goBackToArcade);
ui.resultsBackButton.addEventListener("click", goBackToArcade);

ui.nameEntryForm.addEventListener("submit", (event) => {
  event.preventDefault();
  game.confirmNameEntry(ui.nameEntryInput.value);
});

ui.typingInput.addEventListener("input", (event) => {
  game.handleInput(event.target.value);
});

ui.passagePanel.addEventListener("click", () => {
  if (!ui.typingInput.disabled) {
    ui.typingInput.focus();
  }
});

ui.replayButton.addEventListener("click", () => {
  game.replay();
});

window.addEventListener("pagehide", () => {
  game.stopRaceAudio();
});

window.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") {
    game.stopRaceAudio();
    return;
  }

  if (game.started && !game.finished) {
    game.playAudioClip("bgMusic");
  }
});
