import React, { useEffect, useMemo, useRef, useState } from "react";
import logo from "./images/logo.png";
import wallpaper from "./images/wallpaper.png";
import homeMusic from "./images/bg_music.mp3";
import activateSound from "./images/activate.mp3";

const MUSIC_STORAGE_KEY = "typing-arcade-music-enabled";
const LEADERBOARD_STORAGE_KEY = "typing-arcade-best-scores-v2";
const LEADERBOARD_LIMIT = 6;
const LEADERBOARD_VISIBLE_ROWS = 5;

function getStoredMusicEnabled() {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(MUSIC_STORAGE_KEY) !== "false";
}

function getStoredBestScores() {
  if (typeof window === "undefined") return {};

  try {
    const raw = window.localStorage.getItem(LEADERBOARD_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function getStoredLeaderboardEntries(gameId, storedScores) {
  const entries = storedScores?.[gameId];
  return Array.isArray(entries) ? entries : [];
}

function getWrappedIndex(index, length) {
  return ((index % length) + length) % length;
}

const typingGames = [
  {
    id: "speed-run",
    title: "Speed Run",
    thumbnail: "/images/games/speed_thumb.png",
    metric: "score",
  },
  {
    id: "falling-words",
    title: "Falling Words",
    thumbnail: "/images/games/falling_thumb.png",
    metric: "score",
  },
  {
    id: "memory-typing",
    title: "Memory Typing",
    thumbnail: "/images/games/zombie_thumb.png",
    metric: "score",
  },
  {
    id: "typing-shooter",
    title: "Typing Shooter",
    thumbnail: "/images/games/typing_shooter.png",
    metric: "score",
  },
  {
    id: "typing-dash",
    title: "Typing Dash",
    thumbnail: "/images/games/typing_dash.png",
    metric: "time",
  },
];

function formatScore(score) {
  return score.toLocaleString("en-US");
}

function formatMetric(entry, metric) {
  if (metric === "time") {
    const ms = Number(entry.timeMs || 0);
    return ms > 0 ? `${(ms / 1000).toFixed(3)}s` : "--";
  }

  return formatScore(Number(entry.score || 0));
}

function formatLeaderboardDate(dateString) {
  if (!dateString) return "--";

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "--";

  return new Intl.DateTimeFormat("en-IE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function GameTile({ game, isActive, onPlay, onSelect }) {
  const thumbnailRef = useRef(null);

  return (
    <article className={`game-tile ${isActive ? "is-active" : "is-inactive"}`}>
      <button
        ref={thumbnailRef}
        type="button"
        className="thumbnail-button"
        onClick={() => {
          if (isActive) {
            onPlay(game.id, thumbnailRef.current?.getBoundingClientRect() || null);
            return;
          }
          onSelect();
        }}
        aria-label={isActive ? `Play ${game.title}` : `Select ${game.title}`}
      >
        <img className="card-thumbnail" src={game.thumbnail} alt={game.title} />
      </button>
      <div className="tile-footer">
        {isActive ? (
          <button
            type="button"
            className="arcade-button primary"
            onClick={() => onPlay(game.id, thumbnailRef.current?.getBoundingClientRect() || null)}
          >
            Play Game
          </button>
        ) : (
          <div className="tile-footer-spacer" aria-hidden="true" />
        )}
      </div>
    </article>
  );
}

function LeaderboardPanel({ game }) {
  const rows = Array.from({ length: LEADERBOARD_VISIBLE_ROWS }, (_, index) => game.topScores[index] || null);

  return (
    <section className="leaderboard-panel" aria-label={`${game.title} leaderboard`}>
      <div className="panel-header">
        <span className="panel-title">{game.title}</span>
      </div>
      <div className="leaderboard-list" role="list">
        <div className="leaderboard-head">
          <span className="head-rank">Rank</span>
          <span className="head-player">Player</span>
          <span className="head-date">Date</span>
          <span className="head-score">{game.metric === "time" ? "Time" : "Score"}</span>
        </div>
        {rows.map((entry, index) => (
          <div className={`leaderboard-row ${entry ? "" : "is-empty"}`} role="listitem" key={`${game.id}-row-${index}`}>
            <span className="rank-cell">{index + 1}</span>
            <span className="player-cell">{entry?.name || "---"}</span>
            <span className="date-cell">{entry ? formatLeaderboardDate(entry.date) : "--"}</span>
            <span className="score-cell">{entry ? formatMetric(entry, game.metric) : "--"}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function ArcadeStatsPanel({ game, allScores }) {
  const activeEntries = game.topScores;
  const totalEntries = Object.values(allScores || {}).reduce(
    (sum, entries) => sum + (Array.isArray(entries) ? entries.length : 0),
    0,
  );
  const topEntry = activeEntries[0] || null;
  const mostRecentEntry = [...activeEntries]
    .filter((entry) => entry?.date)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
  const filledBoards = Object.values(allScores || {}).filter((entries) => Array.isArray(entries) && entries.length > 0).length;

  const stats = [
    {
      label: "Total Plays Logged",
      value: String(totalEntries),
    },
    {
      label: "Active Boards",
      value: `${filledBoards}/${typingGames.length}`,
    },
    {
      label: topEntry ? "Current Top Player" : "Current Top Player",
      value: topEntry?.name || "--",
    },
    {
      label: topEntry ? (game.metric === "time" ? "Best Time" : "Best Score") : game.metric === "time" ? "Best Time" : "Best Score",
      value: topEntry ? formatMetric(topEntry, game.metric) : "--",
    },
    {
      label: "Latest Result",
      value: mostRecentEntry ? formatLeaderboardDate(mostRecentEntry.date) : "--",
    },
    {
      label: "Selected Game",
      value: game.title,
    },
  ];

  return (
    <aside className="stats-panel" aria-label="Arcade stats">
      <div className="panel-header">
        <span className="panel-title">Arcade Stats</span>
      </div>
      <div className="stats-grid">
        {stats.map((stat) => (
          <div className="stat-tile" key={stat.label}>
            <span className="stat-label">{stat.label}</span>
            <strong className="stat-value">{stat.value}</strong>
          </div>
        ))}
      </div>
    </aside>
  );
}

export default function ArcadeLauncher() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [activeModalGame, setActiveModalGame] = useState(null);
  const [launchStyle, setLaunchStyle] = useState(null);
  const [musicEnabled, setMusicEnabled] = useState(getStoredMusicEnabled);
  const [bestScores, setBestScores] = useState(getStoredBestScores);
  const musicRef = useRef(null);
  const hasMountedRef = useRef(false);
  const games = useMemo(
    () =>
      typingGames.map((game) => ({
        ...game,
        topScores: getStoredLeaderboardEntries(game.id, bestScores).slice(0, LEADERBOARD_LIMIT),
      })),
    [bestScores],
  );
  const activeGame = games[activeIndex];

  useEffect(() => {
    const handleMessage = (event) => {
      if (
        event.data?.type === "falling-letters:close" ||
        event.data?.type === "speed-run:close" ||
        event.data?.type === "memory-typing:close" ||
        event.data?.type === "typing-dash:close" ||
        event.data?.type === "typing-shooter:close"
      ) {
        setActiveModalGame(null);
        return;
      }

      if (event.data?.type === "typing-arcade:score-updated") {
        setBestScores(getStoredBestScores());
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  useEffect(() => {
    const audio = musicRef.current;
    window.localStorage.setItem(MUSIC_STORAGE_KEY, musicEnabled ? "true" : "false");
    if (!audio) return;

    if (musicEnabled && !activeModalGame && document.visibilityState === "visible") {
      audio.volume = 0.15;
      audio.play().catch(() => {});
      return;
    }

    audio.pause();
    audio.currentTime = 0;
  }, [musicEnabled, activeModalGame]);

  useEffect(() => {
    const handleStorage = (event) => {
      if (event.key === MUSIC_STORAGE_KEY) {
        setMusicEnabled(event.newValue !== "false");
      }

      if (event.key === LEADERBOARD_STORAGE_KEY) {
        setBestScores(getStoredBestScores());
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  useEffect(() => {
    const handleVisibilityChange = () => {
      const audio = musicRef.current;
      if (!audio) return;

      if (document.visibilityState !== "visible") {
        audio.pause();
        audio.currentTime = 0;
        return;
      }

      if (musicEnabled && !activeModalGame) {
        audio.volume = 0.15;
        audio.play().catch(() => {});
      }
    };

    window.addEventListener("visibilitychange", handleVisibilityChange);
    return () => window.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [musicEnabled, activeModalGame]);

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }

    if (document.visibilityState !== "visible" || activeModalGame) return;

    const audio = new Audio(activateSound);
    audio.volume = 0.42;
    audio.play().catch(() => {});
  }, [activeIndex, activeModalGame]);

  const onPlayGame = (gameId, sourceRect = null) => {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const targetWidth = Math.min(1240, viewportWidth - 40);
    const targetHeight = Math.min(860, viewportHeight - 40);

    if (sourceRect) {
      const sourceCenterX = sourceRect.left + sourceRect.width / 2;
      const sourceCenterY = sourceRect.top + sourceRect.height / 2;
      const targetCenterX = viewportWidth / 2;
      const targetCenterY = viewportHeight / 2;

      setLaunchStyle({
        "--launch-translate-x": `${sourceCenterX - targetCenterX}px`,
        "--launch-translate-y": `${sourceCenterY - targetCenterY}px`,
        "--launch-scale-x": `${Math.max(0.12, sourceRect.width / targetWidth)}`,
        "--launch-scale-y": `${Math.max(0.12, sourceRect.height / targetHeight)}`,
      });
    } else {
      setLaunchStyle(null);
    }

    setActiveModalGame(gameId);
  };

  return (
    <>
      <style>{styles}</style>
      <div className="mobile-blocker" role="dialog" aria-modal="true" aria-labelledby="mobile-blocker-title">
        <div className="mobile-blocker-card">
          <p className="mobile-blocker-kicker">Typing Arcade</p>
          <h2 id="mobile-blocker-title">Sorry, this doesn&apos;t work on mobile.</h2>
          <p>Use a larger screen to play the arcade games properly.</p>
        </div>
      </div>
      <main className="typing-arcade-app">
        <audio ref={musicRef} src={homeMusic} loop />
        <div className="pixel-room" />
        <div className="scanlines" />
        <div className="vignette" />

        <img className="arcade-logo" src={logo} alt="Typing Arcade" />

        <section className="arcade-stage">
          <section className="games-strip" aria-label="Typing games">
            {games.map((game, index) => (
              <GameTile
                key={game.id}
                game={game}
                isActive={index === activeIndex}
                onPlay={onPlayGame}
                onSelect={() => setActiveIndex(index)}
              />
            ))}
          </section>

          <section className="bottom-panels">
            <LeaderboardPanel game={activeGame} />
            <ArcadeStatsPanel game={activeGame} allScores={bestScores} />
          </section>
        </section>

        {activeModalGame ? (
          <div className="game-modal" role="dialog" aria-modal="true" aria-label="Typing game">
            <div className="game-modal-backdrop" onClick={() => setActiveModalGame(null)} />
            <div className={`game-modal-panel ${launchStyle ? "is-launching" : ""}`} style={launchStyle || undefined}>
              <iframe
                className="game-modal-frame"
                src={
                  activeModalGame === "falling-words"
                    ? "/falling-letters/index.html?embed=1"
                    : activeModalGame === "speed-run"
                      ? "/speed-run/index.html?embed=1"
                    : activeModalGame === "typing-dash"
                      ? "/typing-dash/index.html?embed=1"
                    : activeModalGame === "typing-shooter"
                      ? "/typing-shooter/index.html?embed=1"
                    : "/memory-typing/index.html?embed=1"
                }
                title={
                  activeModalGame === "falling-words"
                    ? "Falling Letters"
                    : activeModalGame === "speed-run"
                      ? "Speed Run"
                    : activeModalGame === "typing-dash"
                      ? "Typing Dash"
                    : activeModalGame === "typing-shooter"
                      ? "Typing Shooter"
                    : "Memory Typing"
                }
              />
            </div>
          </div>
        ) : null}

      </main>
    </>
  );
}

const styles = `
  :root {
    color-scheme: dark;
    --text: #f8efd5;
    --muted: #d8c5a2;
    --shadow: 0 24px 80px rgba(0, 0, 0, 0.52);
    --page-max: 1320px;
    --page-gutter: 24px;
  }

  * {
    box-sizing: border-box;
  }

  body {
    margin: 0;
    color: var(--text);
    font-family: "Trebuchet MS", "Avenir Next", "Segoe UI", sans-serif;
    background: #070912;
  }

  button,
  input,
  textarea,
  select {
    font: inherit;
  }

  .typing-arcade-app {
    position: relative;
    min-height: 100vh;
    overflow: hidden;
    padding: 28px var(--page-gutter) 72px;
    isolation: isolate;
  }

  .pixel-room {
    position: absolute;
    inset: 0;
    z-index: -5;
    background:
      linear-gradient(rgba(11, 8, 6, 0.64), rgba(5, 6, 17, 0.92)),
      radial-gradient(circle at 50% 24%, rgba(255, 212, 134, 0.12), transparent 20%),
      url("${wallpaper}") center top / cover no-repeat;
    transform: scale(1.02);
  }

  .scanlines {
    position: absolute;
    inset: 0;
    z-index: -4;
    background: repeating-linear-gradient(
      180deg,
      rgba(255,255,255,0.03) 0 2px,
      transparent 2px 4px
    );
    opacity: 0.1;
    pointer-events: none;
  }

  .vignette {
    position: absolute;
    inset: 0;
    z-index: -3;
    background: radial-gradient(circle at center, transparent 45%, rgba(0,0,0,0.42) 100%);
    pointer-events: none;
  }

  .arcade-logo,
  .arcade-stage {
    width: min(var(--page-max), calc(100vw - (var(--page-gutter) * 2)));
    margin-left: auto;
    margin-right: auto;
  }

  .arcade-logo {
    display: block;
    width: min(320px, 70vw);
    margin-bottom: 10px;
    filter: drop-shadow(0 12px 24px rgba(0, 0, 0, 0.36));
  }

  .arcade-stage {
    max-width: 1180px;
    position: relative;
    border-radius: 28px;
    border: 4px solid #27150f;
    background:
      linear-gradient(180deg, rgba(71, 37, 18, 0.32), rgba(18, 10, 8, 0.12)),
      linear-gradient(180deg, #39201a 0%, #1d1111 18%, #0b0f22 52%, #090b18 100%);
    box-shadow:
      0 28px 54px rgba(0,0,0,0.42),
      inset 0 2px 0 rgba(255, 220, 171, 0.08),
      inset 0 -4px 0 rgba(0, 0, 0, 0.3),
      inset 0 0 0 2px rgba(123, 71, 38, 0.44),
      inset 0 0 0 8px rgba(13, 15, 31, 0.88);
    padding: 26px 22px 24px;
  }

  .arcade-stage::before {
    content: "";
    position: absolute;
    inset: 12px;
    border-radius: 20px;
    border: 1px solid rgba(255, 211, 142, 0.1);
    background:
      linear-gradient(180deg, rgba(255,255,255,0.02), transparent 22%),
      repeating-linear-gradient(
        180deg,
        rgba(255,255,255,0.015) 0 2px,
        transparent 2px 4px
      );
    pointer-events: none;
  }

  .arcade-stage::after {
    content: "";
    position: absolute;
    left: 50%;
    bottom: 10px;
    width: 180px;
    height: 10px;
    transform: translateX(-50%);
    border-radius: 999px;
    background: linear-gradient(90deg, rgba(255, 197, 90, 0.18), rgba(255, 197, 90, 0.5), rgba(255, 197, 90, 0.18));
    box-shadow: 0 0 22px rgba(255, 180, 63, 0.22);
    pointer-events: none;
  }

  .games-strip {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    align-items: start;
    gap: 10px;
    margin-bottom: 20px;
  }

  .game-tile {
    display: block;
    width: 100%;
    transition: transform 260ms ease, opacity 260ms ease, filter 260ms ease;
  }

  .game-tile.is-active {
    transform: translateY(-4px) scale(1.02);
    opacity: 1;
    z-index: 2;
  }

  .game-tile.is-inactive {
    transform: translateY(28px) scale(0.88);
    opacity: 0.48;
    filter: saturate(0.84);
  }

  .thumbnail-button {
    display: block;
    width: 100%;
    padding: 0;
    margin: 0;
    border: 0;
    border-radius: 20px;
    background: transparent;
    cursor: pointer;
    transition: transform 180ms ease, filter 180ms ease;
  }

  .thumbnail-button:focus-visible {
    outline: 2px solid rgba(255, 211, 107, 0.8);
    outline-offset: 4px;
    border-radius: 24px;
  }

  .thumbnail-button:hover {
    transform: translateY(-1px);
  }

  .card-thumbnail {
    display: block;
    width: 100%;
    height: 380px;
    object-fit: cover;
    object-position: center;
    border-radius: 20px;
    box-shadow: 0 12px 24px rgba(0, 0, 0, 0.2);
  }

  .game-tile.is-active .thumbnail-button {
    filter: drop-shadow(0 0 18px rgba(255, 176, 66, 0.22));
  }

  .game-tile.is-active .card-thumbnail {
    box-shadow:
      0 0 0 1px rgba(255, 214, 122, 0.55),
      0 0 18px rgba(255, 176, 66, 0.16),
      0 16px 32px rgba(0, 0, 0, 0.28);
  }

  .tile-footer {
    display: grid;
    min-height: 60px;
    padding-top: 4px;
  }

  .tile-footer-spacer {
    height: 44px;
  }

  .arcade-button {
    min-height: 48px;
    width: 100%;
    padding: 0 18px;
    border: 3px solid #5e2e08;
    border-radius: 12px;
    background: #f4b23b;
    color: #2f1200;
    font-family: "Courier New", "Lucida Console", monospace;
    font-size: 0.92rem;
    font-weight: 700;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    cursor: pointer;
    box-shadow:
      inset 0 2px 0 rgba(255, 236, 188, 0.28),
      inset 0 -4px 0 rgba(152, 73, 11, 0.34),
      0 6px 0 #6a3208,
      0 14px 22px rgba(0, 0, 0, 0.24);
    transition: transform 120ms ease, box-shadow 120ms ease, filter 120ms ease;
  }

  .arcade-button.primary {
    position: relative;
  }

  .arcade-button.primary::before,
  .arcade-button.primary::after {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    font-size: 0.88rem;
    opacity: 0.72;
    content: ">";
  }

  .arcade-button.primary::before {
    left: 12px;
  }

  .arcade-button.primary::after {
    right: 12px;
    transform: translateY(-50%) scaleX(-1);
  }

  .arcade-button:hover,
  .arcade-button:focus-visible {
    transform: translateY(-2px);
    filter: brightness(1.03);
    outline: none;
    box-shadow:
      inset 0 2px 0 rgba(255, 236, 188, 0.3),
      inset 0 -4px 0 rgba(152, 73, 11, 0.36),
      0 8px 0 #6a3208,
      0 18px 28px rgba(0, 0, 0, 0.26);
  }

  .arcade-button:active {
    transform: translateY(3px);
    box-shadow:
      inset 0 2px 0 rgba(255, 236, 188, 0.2),
      inset 0 -3px 0 rgba(152, 73, 11, 0.3),
      0 2px 0 #6a3208,
      0 8px 14px rgba(0, 0, 0, 0.2);
  }

  .leaderboard-panel {
    margin: 0;
    padding: 0;
  }

  .bottom-panels {
    display: grid;
    grid-template-columns: minmax(0, 1.15fr) minmax(320px, 0.85fr);
    gap: 18px;
    align-items: start;
  }

  .panel-header {
    display: flex;
    justify-content: flex-start;
    padding: 0 8px 10px;
  }

  .leaderboard-panel,
  .stats-panel {
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .panel-title {
    color: #fff1ad;
    font-family: "Courier New", "Lucida Console", monospace;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    font-size: 0.96rem;
    text-align: center;
  }

  .leaderboard-list {
    display: grid;
    flex: 1 1 auto;
    border: 3px solid rgba(143, 153, 219, 0.4);
    border-radius: 12px;
    overflow: hidden;
    background:
      linear-gradient(180deg, rgba(22, 25, 58, 0.96), rgba(9, 12, 30, 0.96));
    box-shadow:
      inset 0 0 0 2px rgba(25, 30, 69, 0.96),
      inset 0 0 0 5px rgba(7, 9, 22, 0.92),
      0 14px 28px rgba(0, 0, 0, 0.28);
  }

  .leaderboard-head {
    display: grid;
    grid-template-columns: 44px 1fr minmax(140px, 170px) minmax(90px, 120px);
    gap: 20px;
    align-items: center;
    padding: 10px 14px;
    color: #b5bddc;
    font-family: "Courier New", "Lucida Console", monospace;
    font-size: 0.72rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    background: rgba(18, 22, 48, 0.96);
    border-bottom: 1px solid rgba(85, 96, 160, 0.28);
  }

  .leaderboard-empty {
    padding: 22px 14px;
    color: #b5bddc;
    text-align: center;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-size: 0.8rem;
    font-family: "Courier New", "Lucida Console", monospace;
  }

  .head-rank {
    text-align: left;
  }

  .head-date {
    text-align: center;
  }

  .head-score {
    text-align: right;
  }

  .leaderboard-row {
    display: grid;
    grid-template-columns: 44px 1fr minmax(140px, 170px) minmax(90px, 120px);
    gap: 20px;
    align-items: center;
    padding: 11px 14px;
    font-variant-numeric: tabular-nums;
    text-transform: uppercase;
    font-size: 0.88rem;
    background: rgba(8, 10, 28, 0.9);
    border-top: 1px solid rgba(85, 96, 160, 0.26);
  }

  .leaderboard-row:first-child {
    border-top: 0;
  }

  .leaderboard-row:nth-child(even) {
    background: rgba(11, 13, 36, 0.96);
  }

  .leaderboard-row:first-child .player-cell,
  .leaderboard-row:first-child .rank-cell,
  .leaderboard-row:first-child .score-cell {
    color: #ffd36b;
  }

  .leaderboard-row.is-empty {
    color: #7f88b0;
  }

  .player-cell,
  .score-cell,
  .date-cell,
  .rank-cell {
    font-family: "Courier New", "Lucida Console", monospace;
  }

  .rank-cell {
    color: #98a2cc;
  }

  .score-cell {
    text-align: right;
    color: #ffd27b;
  }

  .date-cell {
    text-align: center;
    color: #b5bddc;
  }

  .stats-panel {
    padding: 0;
  }

  .stats-grid {
    display: grid;
    flex: 1 1 auto;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
    border: 3px solid rgba(143, 153, 219, 0.4);
    border-radius: 12px;
    overflow: hidden;
    background:
      linear-gradient(180deg, rgba(22, 25, 58, 0.96), rgba(9, 12, 30, 0.96));
    box-shadow:
      inset 0 0 0 2px rgba(25, 30, 69, 0.96),
      inset 0 0 0 5px rgba(7, 9, 22, 0.92),
      0 14px 28px rgba(0, 0, 0, 0.28);
    padding: 14px;
  }

  .stat-tile {
    min-height: 92px;
    padding: 12px 14px;
    border-radius: 12px;
    border: 1px solid rgba(89, 100, 168, 0.26);
    background: rgba(11, 14, 36, 0.92);
    display: grid;
    align-content: start;
    gap: 10px;
  }

  .stat-label {
    color: #99a7dc;
    font-family: "Courier New", "Lucida Console", monospace;
    font-size: 0.68rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    line-height: 1.45;
  }

  .stat-value {
    color: #fff1ba;
    font-size: 1.08rem;
    line-height: 1.2;
  }

  .game-modal {
    position: fixed;
    inset: 0;
    z-index: 30;
    display: grid;
    place-items: center;
    padding: 20px;
  }

  .game-modal-backdrop {
    position: absolute;
    inset: 0;
    background: rgba(5, 8, 20, 0.78);
    backdrop-filter: blur(10px);
  }

  .game-modal-panel {
    position: relative;
    width: min(1240px, 100%);
    height: min(860px, calc(100vh - 40px));
    border-radius: 24px;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.12);
    box-shadow: 0 30px 90px rgba(0, 0, 0, 0.45);
    background: rgba(7, 10, 20, 0.96);
  }

  .game-modal-panel.is-launching {
    animation: modal-launch 320ms cubic-bezier(0.2, 0.8, 0.2, 1);
  }

  .game-modal-frame {
    width: 100%;
    height: 100%;
    border: 0;
    display: block;
    background: #0b1738;
  }

  @keyframes modal-launch {
    from {
      opacity: 0.42;
      transform:
        translate(var(--launch-translate-x, 0), var(--launch-translate-y, 0))
        scale(var(--launch-scale-x, 0.24), var(--launch-scale-y, 0.24));
    }
    to {
      opacity: 1;
      transform: translate(0, 0) scale(1, 1);
    }
  }

  @media (max-width: 900px) {
    .games-strip {
      display: flex;
      gap: 10px;
      overflow-x: auto;
      padding-bottom: 10px;
      scroll-snap-type: x proximity;
      -webkit-overflow-scrolling: touch;
    }

    .games-strip::-webkit-scrollbar {
      height: 8px;
    }

    .games-strip::-webkit-scrollbar-thumb {
      background: rgba(255, 214, 138, 0.25);
      border-radius: 999px;
    }

    .game-tile {
      flex: 0 0 min(300px, 42vw);
      scroll-snap-align: start;
    }

    .card-thumbnail {
      height: 320px;
    }

    .bottom-panels {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 720px) {
    .typing-arcade-app {
      padding: 22px var(--page-gutter) 56px;
    }

    .arcade-stage {
      padding: 18px 14px 20px;
      border-radius: 20px;
    }

    .games-strip {
      gap: 8px;
      margin-bottom: 16px;
    }

    .game-tile {
      flex-basis: min(240px, 68vw);
    }

    .game-tile.is-inactive {
      transform: translateY(16px) scale(0.86);
    }

    .game-modal {
      padding: 10px;
    }

    .game-modal-panel {
      height: min(860px, calc(100vh - 20px));
      border-radius: 18px;
    }

    .leaderboard-row {
      font-size: 0.92rem;
      padding: 11px 12px;
    }

    .leaderboard-head,
    .leaderboard-row {
      grid-template-columns: 36px 1fr minmax(116px, 144px) minmax(74px, 96px);
      gap: 12px;
    }

    .stats-grid {
      grid-template-columns: 1fr;
    }

    .card-thumbnail {
      height: 220px;
    }
  }

  .mobile-blocker {
    position: fixed;
    inset: 0;
    z-index: 4000;
    display: none;
    align-items: center;
    justify-content: center;
    padding: 24px;
    background: rgba(8, 10, 22, 0.9);
    backdrop-filter: blur(14px);
  }

  .mobile-blocker-card {
    width: min(420px, 100%);
    padding: 28px 24px;
    text-align: center;
    border-radius: 24px;
    border: 2px solid rgba(255, 214, 126, 0.34);
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.01)),
      linear-gradient(180deg, rgba(22, 25, 58, 0.98), rgba(8, 10, 28, 0.98));
    box-shadow:
      0 26px 68px rgba(0, 0, 0, 0.4),
      inset 0 0 0 1px rgba(255, 255, 255, 0.04);
  }

  .mobile-blocker-kicker {
    margin: 0 0 10px;
    color: #ffd879;
    font-family: "Courier New", "Lucida Console", monospace;
    font-size: 0.78rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
  }

  .mobile-blocker-card h2 {
    margin: 0 0 10px;
    color: #fff1ba;
    font-size: clamp(1.5rem, 6vw, 2rem);
    line-height: 1.15;
  }

  .mobile-blocker-card p:last-child {
    margin: 0;
    color: #cbd3f1;
  }

  @media (max-width: 820px) {
    .mobile-blocker {
      display: flex;
    }

    .typing-arcade-app {
      visibility: hidden;
      pointer-events: none;
    }
  }
`;
