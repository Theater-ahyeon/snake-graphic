import Phaser from "phaser";
import {
  DEFAULT_MODE,
  GAME_MODES,
  type Direction,
  type GameModeId
} from "../game/config";
import { SnakeEngine } from "../game/simulation/engine";
import type { SnakeSnapshot } from "../game/simulation/types";
import { GameScene, type ScenePreferences } from "../phaser/scenes/GameScene";

function formatTime(elapsedMs: number): string {
  const totalSeconds = Math.floor(elapsedMs / 1000);
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function missionStatus(snapshot: SnakeSnapshot): Array<{ label: string; done: boolean }> {
  return [
    {
      label: `得分达到 ${snapshot.mode.targetScore}`,
      done: snapshot.score >= snapshot.mode.targetScore
    },
    { label: "连续吃到 8 颗能量果", done: snapshot.foodsEaten >= 8 },
    { label: "连击达到 3 次", done: snapshot.maxCombo >= 3 }
  ];
}

export function createSnakeExperience(root: HTMLElement): void {
  const engine = new SnakeEngine();
  const preferences: ScenePreferences = {
    effectsEnabled: true,
    sfxEnabled: true
  };

  root.innerHTML = `
    <div class="experience">
      <div class="ambient ambient--a"></div>
      <div class="ambient ambient--b"></div>
      <div class="ambient ambient--c"></div>

      <header class="topbar">
        <div class="brand">
          <div class="brand__mark">NS</div>
          <div>
            <p class="eyebrow">Course Project Edition</p>
            <h1>Neon Snake Studio</h1>
          </div>
        </div>
        <div class="topbar__actions">
          <button class="ghost-button" data-action="toggle-pause">暂停 / 继续</button>
          <button class="ghost-button" data-action="restart">重新开始</button>
        </div>
      </header>

      <main class="layout">
        <section class="panel briefing">
          <div class="panel__label">Visual Direction</div>
          <h2 class="briefing__title">一个适合答辩展示的高质感图形化贪吃蛇项目</h2>
          <p class="briefing__text">
            这个版本强调完整度、节奏感和视觉表现：保留经典规则，同时加入模式切换、分层 HUD、响应式布局、
            细腻粒子反馈和本地最高分记录。
          </p>

          <div class="mode-grid" id="mode-grid">
            ${Object.values(GAME_MODES)
              .map(
                (mode) => `
                  <button class="mode-card" data-mode="${mode.id}">
                    <span class="mode-card__title">${mode.name}</span>
                    <span class="mode-card__tagline">${mode.tagline}</span>
                    <span class="mode-card__meta">被动增长：每 ${mode.growEvery} 步</span>
                  </button>
                `
              )
              .join("")}
          </div>

          <div class="briefing__focus">
            <div>
              <p class="panel__label">Selected Mode</p>
              <h3 id="mode-name">Arcade Pulse</h3>
            </div>
            <p id="mode-description" class="briefing__focus-text"></p>
          </div>

          <div class="controls-card">
            <div>
              <p class="panel__label">Controls</p>
              <ul class="controls-list">
                <li>方向键 / WASD：控制蛇移动</li>
                <li>空格 / P：暂停或继续</li>
                <li>触屏设备：使用下方方向盘</li>
              </ul>
            </div>
            <div class="toggle-group">
              <label class="toggle">
                <input type="checkbox" id="toggle-effects" checked />
                <span>粒子与镜头动效</span>
              </label>
              <label class="toggle">
                <input type="checkbox" id="toggle-sfx" checked />
                <span>极简电子音效</span>
              </label>
            </div>
          </div>

          <div class="briefing__footer">
            <button class="primary-button" id="start-button">开始本局</button>
            <p class="briefing__caption">
              目标：完成单人游戏、实时记分、精致界面与稳定操作逻辑。
            </p>
          </div>
        </section>

        <section class="panel arena">
          <div class="arena__header">
            <div>
              <p class="panel__label">Live Arena</p>
              <h2>Pulse Grid</h2>
            </div>
            <div class="status-pill" id="status-pill">等待启动</div>
          </div>
          <div class="arena__viewport">
            <div id="game-root" class="game-root"></div>
            <div class="arena__overlay" id="arena-overlay">
              <div class="arena__overlay-card">
                <p class="panel__label">Mission Brief</p>
                <h3>让蛇在霓虹方格中持续生长</h3>
                <p>
                  障碍物固定出现，边界不可穿越。每吃到一枚能量果加 10 分，
                  同时保留课程作业要求中的“按固定步数被动增长”机制。
                </p>
              </div>
            </div>
            <div class="result-card is-hidden" id="result-card">
              <p class="panel__label">Run Complete</p>
              <h3 id="result-title">本局结束</h3>
              <p id="result-subtitle" class="result-card__subtitle"></p>
              <div class="result-stats">
                <div><span>得分</span><strong id="result-score">0</strong></div>
                <div><span>食物</span><strong id="result-foods">0</strong></div>
                <div><span>最长连击</span><strong id="result-combo">0</strong></div>
              </div>
              <button class="primary-button" id="result-restart">再来一局</button>
            </div>
          </div>
          <div class="arena__footer">
            <span>边框、障碍与被动增长机制均对齐课程要求</span>
            <span id="seed-value">Seed #000000</span>
          </div>
        </section>

        <aside class="telemetry">
          <section class="panel telemetry__card">
            <p class="panel__label">Scoreboard</p>
            <div class="metric-row">
              <div><span>当前分数</span><strong id="score-value">0</strong></div>
              <div><span>最高分</span><strong id="best-value">0</strong></div>
            </div>
            <div class="metric-row">
              <div><span>已吃食物</span><strong id="foods-value">0</strong></div>
              <div><span>最长连击</span><strong id="combo-value">0</strong></div>
            </div>
          </section>

          <section class="panel telemetry__card">
            <p class="panel__label">Run Vitals</p>
            <div class="vital-grid">
              <div><span>运行时间</span><strong id="time-value">00:00</strong></div>
              <div><span>移动节拍</span><strong id="speed-value">145 ms</strong></div>
              <div><span>被动增长倒计时</span><strong id="grow-value">10</strong></div>
              <div><span>当前方向</span><strong id="direction-value">UP</strong></div>
            </div>
          </section>

          <section class="panel telemetry__card">
            <p class="panel__label">Mission Tracker</p>
            <ul class="mission-list" id="mission-list"></ul>
          </section>

          <section class="panel telemetry__card telemetry__note">
            <p class="panel__label">Design Notes</p>
            <p>
              游戏画面采用发光网格、分层玻璃态 HUD 与程序化粒子效果，
              适合直接拿去课堂展示、录屏或继续扩展为完整小组项目。
            </p>
          </section>
        </aside>
      </main>

      <div class="touch-controls">
        <button class="touch-button touch-button--up" data-dir="up">▲</button>
        <button class="touch-button touch-button--left" data-dir="left">◀</button>
        <button class="touch-button touch-button--down" data-dir="down">▼</button>
        <button class="touch-button touch-button--right" data-dir="right">▶</button>
      </div>
    </div>
  `;

  const getById = <T extends HTMLElement>(id: string): T => {
    const element = root.querySelector<T>(`#${id}`);
    if (!element) {
      throw new Error(`Missing element #${id}`);
    }
    return element;
  };

  const modeName = getById<HTMLElement>("mode-name");
  const modeDescription = getById<HTMLElement>("mode-description");
  const statusPill = getById<HTMLElement>("status-pill");
  const startButton = getById<HTMLButtonElement>("start-button");
  const scoreValue = getById<HTMLElement>("score-value");
  const bestValue = getById<HTMLElement>("best-value");
  const foodsValue = getById<HTMLElement>("foods-value");
  const comboValue = getById<HTMLElement>("combo-value");
  const timeValue = getById<HTMLElement>("time-value");
  const speedValue = getById<HTMLElement>("speed-value");
  const growValue = getById<HTMLElement>("grow-value");
  const directionValue = getById<HTMLElement>("direction-value");
  const missionList = getById<HTMLUListElement>("mission-list");
  const seedValue = getById<HTMLElement>("seed-value");
  const resultCard = getById<HTMLElement>("result-card");
  const resultTitle = getById<HTMLElement>("result-title");
  const resultSubtitle = getById<HTMLElement>("result-subtitle");
  const resultScore = getById<HTMLElement>("result-score");
  const resultFoods = getById<HTMLElement>("result-foods");
  const resultCombo = getById<HTMLElement>("result-combo");
  const resultRestart = getById<HTMLButtonElement>("result-restart");
  const arenaOverlay = getById<HTMLElement>("arena-overlay");
  const gameRoot = getById<HTMLElement>("game-root");
  const effectsToggle = getById<HTMLInputElement>("toggle-effects");
  const sfxToggle = getById<HTMLInputElement>("toggle-sfx");

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: gameRoot,
    width: gameRoot.clientWidth || 780,
    height: gameRoot.clientHeight || 780,
    transparent: false,
    backgroundColor: "#08111d",
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: "100%",
      height: "100%"
    },
    scene: [new GameScene(engine, () => preferences)]
  });

  const updateModeUi = (modeId: GameModeId): void => {
    const mode = GAME_MODES[modeId];
    root.style.setProperty("--mode-accent", mode.accent);
    root.style.setProperty("--mode-secondary", mode.secondary);
    modeName.textContent = mode.name;
    modeDescription.textContent = mode.description;
    root.querySelectorAll<HTMLElement>("[data-mode]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.mode === modeId);
    });
  };

  const updateSnapshotUi = (snapshot: SnakeSnapshot): void => {
    scoreValue.textContent = String(snapshot.score);
    bestValue.textContent = String(snapshot.bestScore);
    foodsValue.textContent = String(snapshot.foodsEaten);
    comboValue.textContent = String(snapshot.maxCombo);
    timeValue.textContent = formatTime(snapshot.elapsedMs);
    speedValue.textContent = `${snapshot.tickMs} ms`;
    growValue.textContent = String(snapshot.passiveGrowIn);
    directionValue.textContent = snapshot.direction.toUpperCase();
    seedValue.textContent = `Seed #${String(snapshot.runSeed).padStart(6, "0")}`;

    missionList.innerHTML = missionStatus(snapshot)
      .map(
        (mission) => `
          <li class="mission ${mission.done ? "mission--done" : ""}">
            <span class="mission__dot"></span>
            <span>${mission.label}</span>
          </li>
        `
      )
      .join("");

    if (snapshot.status === "idle") {
      statusPill.textContent = "等待启动";
      startButton.textContent = "开始本局";
      arenaOverlay.classList.remove("is-hidden");
      resultCard.classList.add("is-hidden");
    } else if (snapshot.status === "playing") {
      statusPill.textContent = "运行中";
      startButton.textContent = "重新开局";
      arenaOverlay.classList.add("is-hidden");
      resultCard.classList.add("is-hidden");
    } else if (snapshot.status === "paused") {
      statusPill.textContent = "已暂停";
      startButton.textContent = "重新开局";
      arenaOverlay.classList.add("is-hidden");
      resultCard.classList.add("is-hidden");
    } else {
      statusPill.textContent = "本局结束";
      startButton.textContent = "再次挑战";
      resultCard.classList.remove("is-hidden");
      resultTitle.textContent = "Run Complete";
      resultSubtitle.textContent = snapshot.lastCrashReason ?? "本局已结束";
      resultScore.textContent = String(snapshot.score);
      resultFoods.textContent = String(snapshot.foodsEaten);
      resultCombo.textContent = String(snapshot.maxCombo);
    }
  };

  root.querySelectorAll<HTMLButtonElement>("[data-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      const mode = button.dataset.mode as GameModeId;
      engine.setMode(mode);
      updateModeUi(mode);
    });
  });

  root.querySelectorAll<HTMLButtonElement>("[data-dir]").forEach((button) => {
    button.addEventListener("click", () => {
      engine.queueDirection(button.dataset.dir as Direction);
    });
  });

  root.querySelectorAll<HTMLButtonElement>("[data-action='toggle-pause']").forEach((button) => {
    button.addEventListener("click", () => engine.togglePause());
  });

  root.querySelectorAll<HTMLButtonElement>("[data-action='restart']").forEach((button) => {
    button.addEventListener("click", () => engine.startNewRun());
  });

  startButton.addEventListener("click", () => engine.startNewRun());
  resultRestart.addEventListener("click", () => engine.startNewRun());

  effectsToggle.addEventListener("change", () => {
    preferences.effectsEnabled = effectsToggle.checked;
  });

  sfxToggle.addEventListener("change", () => {
    preferences.sfxEnabled = sfxToggle.checked;
  });

  engine.subscribe((snapshot) => {
    updateModeUi(snapshot.mode.id);
    updateSnapshotUi(snapshot);
  });

  updateModeUi(DEFAULT_MODE);
  engine.setMode(DEFAULT_MODE);

  const resizeObserver = new ResizeObserver(() => {
    game.scale.resize(gameRoot.clientWidth || 780, gameRoot.clientHeight || 780);
  });
  resizeObserver.observe(gameRoot);
}
