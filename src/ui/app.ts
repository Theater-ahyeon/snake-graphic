import Phaser from "phaser";
import { CAMPAIGN_CHAPTERS, CAMPAIGN_LEVELS } from "../game/campaign/levels";
import { DEFAULT_MODE, GAME_MODES, type Direction, type GameModeId } from "../game/config";
import { SnakeEngine } from "../game/simulation/engine";
import type {
  CampaignProgress,
  GameRoute,
  RatingRank,
  ReplayRun,
  SnakeSnapshot
} from "../game/simulation/types";
import { GameScene, type ScenePreferences } from "../phaser/scenes/GameScene";

const SETTINGS_KEY = "neon-snake-ui-settings-v2";

type ReplaySource = "last" | "best" | "highlight";

interface StoredSettings {
  route: GameRoute;
  mode: GameModeId;
  effectsEnabled: boolean;
  sfxEnabled: boolean;
}

interface ReplayPlaybackState {
  run: ReplayRun | null;
  source: ReplaySource | null;
  frameIndex: number;
  playing: boolean;
  timerId: number | null;
}

function readStoredSettings(): StoredSettings {
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) {
      return {
        route: "campaign",
        mode: DEFAULT_MODE,
        effectsEnabled: true,
        sfxEnabled: true
      };
    }
    const parsed = JSON.parse(raw) as Partial<StoredSettings>;
    return {
      route: parsed.route === "sandbox" ? "sandbox" : "campaign",
      mode:
        parsed.mode === "zen" || parsed.mode === "arcade" || parsed.mode === "inferno"
          ? parsed.mode
          : DEFAULT_MODE,
      effectsEnabled: parsed.effectsEnabled ?? true,
      sfxEnabled: parsed.sfxEnabled ?? true
    };
  } catch {
    return {
      route: "campaign",
      mode: DEFAULT_MODE,
      effectsEnabled: true,
      sfxEnabled: true
    };
  }
}

function writeStoredSettings(settings: StoredSettings): void {
  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function formatTime(elapsedMs: number): string {
  const totalSeconds = Math.floor(elapsedMs / 1000);
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function directionLabel(direction: Direction): string {
  if (direction === "up") return "UP";
  if (direction === "down") return "DOWN";
  if (direction === "left") return "LEFT";
  return "RIGHT";
}

function rankValue(rank: RatingRank | null): number {
  if (rank === "S") return 4;
  if (rank === "Gold") return 3;
  if (rank === "Silver") return 2;
  if (rank === "Bronze") return 1;
  return 0;
}

function heatmapSvg(run: ReplayRun | null): string {
  const size = 20;
  const counts = Array.from({ length: size * size }, () => 0);
  if (run) {
    run.frames.forEach((frame) => {
      const head = frame.snapshot.snake[0];
      if (!head) return;
      counts[head.y * size + head.x] += 1;
    });
  }
  const max = Math.max(1, ...counts);
  const cells = counts
    .map((count, index) => {
      const x = index % size;
      const y = Math.floor(index / size);
      const alpha = count === 0 ? 0.04 : 0.12 + (count / max) * 0.8;
      const color = count === 0 ? "rgba(69,240,223,0.05)" : `rgba(255,107,107,${alpha.toFixed(2)})`;
      return `<rect x="${x * 12}" y="${y * 12}" width="11" height="11" rx="2" fill="${color}" />`;
    })
    .join("");
  return `<svg viewBox="0 0 240 240" xmlns="http://www.w3.org/2000/svg">${cells}</svg>`;
}

function topRecords(progress: CampaignProgress): Array<{
  id: string;
  title: string;
  bestScore: number;
  bestRating: RatingRank | null;
}> {
  return CAMPAIGN_LEVELS.map((level) => ({
    id: level.id,
    title: level.title,
    bestScore: progress.levels[level.id]?.bestScore ?? 0,
    bestRating: progress.levels[level.id]?.bestRating ?? null
  }))
    .filter((entry) => entry.bestScore > 0)
    .sort((left, right) => {
      const rankDiff = rankValue(right.bestRating) - rankValue(left.bestRating);
      if (rankDiff !== 0) return rankDiff;
      return right.bestScore - left.bestScore;
    })
    .slice(0, 4);
}

function routeTitle(route: GameRoute): string {
  return route === "campaign" ? "竞技征程" : "自由练习";
}

export function createSnakeExperience(root: HTMLElement): void {
  const params = new URLSearchParams(window.location.search);
  const storedSettings = readStoredSettings();
  const engine = new SnakeEngine();
  const preferences: ScenePreferences = {
    effectsEnabled: storedSettings.effectsEnabled,
    sfxEnabled: storedSettings.sfxEnabled
  };
  const playback: ReplayPlaybackState = {
    run: null,
    source: null,
    frameIndex: 0,
    playing: false,
    timerId: null
  };

  const initialRoute = params.get("route") === "sandbox" ? "sandbox" : storedSettings.route;
  const initialMode = (() => {
    const requested = params.get("mode");
    if (requested === "zen" || requested === "arcade" || requested === "inferno") {
      return requested;
    }
    return storedSettings.mode;
  })();
  const initialLevelId = params.get("level") ?? CAMPAIGN_LEVELS[0]?.id ?? "1-1";
  const shouldAutoStart = params.get("autostart") === "1";

  root.innerHTML = `
    <div class="experience experience--command">
      <div class="ambient ambient--a"></div>
      <div class="ambient ambient--b"></div>
      <div class="ambient ambient--c"></div>

      <header class="topbar">
        <div class="brand">
          <div class="brand__mark">NS</div>
          <div>
            <p class="eyebrow">Neon Snake Studio</p>
            <h1>竞技征程控制台</h1>
          </div>
        </div>
        <div class="topbar__actions">
          <button class="ghost-button" data-action="fullscreen">全屏展示</button>
          <button class="ghost-button" data-action="pause">暂停 / 继续</button>
          <button class="ghost-button" data-action="restart">重新开始</button>
        </div>
      </header>

      <main class="dashboard">
        <aside class="command-pane panel">
          <div class="panel__block">
            <p class="panel__label">入口模式</p>
            <div class="route-switch">
              <button class="route-chip" data-route="campaign">竞技征程</button>
              <button class="route-chip" data-route="sandbox">自由练习</button>
            </div>
          </div>
          <div class="panel__block">
            <p class="panel__label">模式选择</p>
            <div class="mode-grid" id="mode-grid"></div>
          </div>
          <div class="panel__block">
            <p class="panel__label">赛季挑战</p>
            <select class="challenge-select" id="challenge-select"></select>
          </div>
          <div class="panel__block selected-level" id="selected-level"></div>
          <div class="panel__block">
            <p class="panel__label">参数与控制</p>
            <div class="toggle-group">
              <label class="toggle">
                <input type="checkbox" id="toggle-effects" />
                <span>粒子与镜头动效</span>
              </label>
              <label class="toggle">
                <input type="checkbox" id="toggle-sfx" />
                <span>电子音效</span>
              </label>
            </div>
            <ul class="controls-list">
              <li>WASD / 方向键：控制方向</li>
              <li>Space / P：暂停或继续</li>
              <li>F：浏览器全屏</li>
              <li>移动端支持方向按钮与滑动控制</li>
            </ul>
            <button class="primary-button" id="start-button">开始本局</button>
          </div>
        </aside>

        <section class="stage-pane">
          <div class="panel stage-stage" id="campaign-view">
            <div class="stage-stage__header">
              <div>
                <p class="panel__label">章节地图</p>
                <h2>竞技征程</h2>
              </div>
              <div class="status-pill" id="route-pill">竞技征程</div>
            </div>
            <div class="campaign-map" id="campaign-map"></div>
          </div>

          <div class="panel arena-shell is-hidden" id="arena-shell">
            <div class="arena-hud arena-hud--top">
              <div>
                <p class="panel__label">当前战场</p>
                <h2 id="hud-title">Pulse Grid</h2>
              </div>
              <div class="arena-statline">
                <span class="status-pill" id="status-pill">待命</span>
                <span class="boss-pill" id="boss-pill">Boss 未激活</span>
              </div>
            </div>

            <div class="arena-grid">
              <div class="game-shell">
                <div id="game-root" class="game-root"></div>
              </div>
              <aside class="arena-hud arena-hud--side">
                <div class="side-card">
                  <p class="panel__label">运行指标</p>
                  <div class="metric-stack">
                    <div><span>得分</span><strong id="score-value">0</strong></div>
                    <div><span>时间</span><strong id="time-value">00:00</strong></div>
                    <div><span>节拍</span><strong id="speed-value">0 ms</strong></div>
                    <div><span>方向</span><strong id="direction-value">UP</strong></div>
                  </div>
                </div>
                <div class="side-card">
                  <p class="panel__label">核心信息</p>
                  <div class="metric-stack">
                    <div><span>食物</span><strong id="food-kind-value">能量果 x1</strong></div>
                    <div><span>倍率</span><strong id="multiplier-value">1x</strong></div>
                    <div><span>狂热</span><strong id="frenzy-value">未激活</strong></div>
                    <div><span>额外成长</span><strong id="bonus-grow-value">0</strong></div>
                  </div>
                </div>
                <div class="side-card">
                  <p class="panel__label">关卡目标</p>
                  <ul class="objective-list" id="objective-list"></ul>
                </div>
              </aside>
            </div>

            <div class="arena-hud arena-hud--bottom">
              <div class="replay-toolbar">
                <button class="ghost-button" id="replay-last">本局回放</button>
                <button class="ghost-button" id="replay-best">本关最佳</button>
                <button class="ghost-button" id="replay-highlight">最后 10 秒</button>
                <button class="ghost-button" id="replay-playpause">播放</button>
                <button class="ghost-button" id="replay-stop">返回直播</button>
              </div>
              <div class="replay-meta" id="replay-meta">直播画面</div>
            </div>

            <div class="result-overlay is-hidden" id="result-overlay">
              <div class="result-shell">
                <div class="result-shell__header">
                  <div>
                    <p class="panel__label">赛后分析</p>
                    <h3 id="result-title">本局结束</h3>
                  </div>
                  <div class="rank-badge" id="result-rank">Bronze</div>
                </div>
                <p class="result-shell__subtitle" id="result-subtitle"></p>
                <div class="result-grid">
                  <div><span>得分</span><strong id="result-score">0</strong></div>
                  <div><span>食物</span><strong id="result-foods">0</strong></div>
                  <div><span>连击</span><strong id="result-combo">0</strong></div>
                  <div><span>Boss 命中</span><strong id="result-boss-hits">0</strong></div>
                </div>
                <div class="analysis-grid">
                  <div class="analysis-card">
                    <p class="panel__label">路径热区</p>
                    <div class="heatmap" id="result-heatmap"></div>
                  </div>
                  <div class="analysis-card">
                    <p class="panel__label">关键事件时间线</p>
                    <div class="timeline" id="result-timeline"></div>
                  </div>
                </div>
                <div class="result-actions">
                  <button class="primary-button" id="result-restart">再来一局</button>
                  <button class="ghost-button" id="result-last">观看本局回放</button>
                  <button class="ghost-button" id="result-best">观看最佳回放</button>
                  <button class="ghost-button" id="result-highlight">观看最后 10 秒</button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <aside class="intel-pane panel">
          <div class="panel__block">
            <p class="panel__label">档案总览</p>
            <div class="archive-grid">
              <div><span>总局数</span><strong id="career-runs-value">0</strong></div>
              <div><span>总得分</span><strong id="career-score-value">0</strong></div>
              <div><span>总食物</span><strong id="career-foods-value">0</strong></div>
              <div><span>生涯连击</span><strong id="career-combo-value">0</strong></div>
            </div>
          </div>
          <div class="panel__block">
            <p class="panel__label">赛季挑战</p>
            <div class="season-list" id="season-list"></div>
          </div>
          <div class="panel__block">
            <p class="panel__label">关卡档案</p>
            <div class="recent-list" id="recent-list"></div>
          </div>
          <div class="panel__block">
            <p class="panel__label">成就档案</p>
            <div class="achievement-list" id="achievement-list"></div>
          </div>
        </aside>
      </main>

      <div class="touch-controls">
        <button class="touch-button touch-button--up" data-dir="up" aria-label="up">▲</button>
        <button class="touch-button touch-button--left" data-dir="left" aria-label="left">◀</button>
        <button class="touch-button touch-button--down" data-dir="down" aria-label="down">▼</button>
        <button class="touch-button touch-button--right" data-dir="right" aria-label="right">▶</button>
      </div>
    </div>
  `;

  const getById = <T extends HTMLElement>(id: string): T => {
    const element = root.querySelector<T>(`#${id}`);
    if (!element) throw new Error(`Missing #${id}`);
    return element;
  };

  const modeGrid = getById<HTMLDivElement>("mode-grid");
  const challengeSelect = getById<HTMLSelectElement>("challenge-select");
  const selectedLevel = getById<HTMLDivElement>("selected-level");
  const routePill = getById<HTMLElement>("route-pill");
  const campaignView = getById<HTMLElement>("campaign-view");
  const campaignMap = getById<HTMLDivElement>("campaign-map");
  const arenaShell = getById<HTMLElement>("arena-shell");
  const gameRoot = getById<HTMLElement>("game-root");
  const startButton = getById<HTMLButtonElement>("start-button");
  const hudTitle = getById<HTMLElement>("hud-title");
  const statusPill = getById<HTMLElement>("status-pill");
  const bossPill = getById<HTMLElement>("boss-pill");
  const scoreValue = getById<HTMLElement>("score-value");
  const timeValue = getById<HTMLElement>("time-value");
  const speedValue = getById<HTMLElement>("speed-value");
  const directionValue = getById<HTMLElement>("direction-value");
  const foodKindValue = getById<HTMLElement>("food-kind-value");
  const multiplierValue = getById<HTMLElement>("multiplier-value");
  const frenzyValue = getById<HTMLElement>("frenzy-value");
  const bonusGrowValue = getById<HTMLElement>("bonus-grow-value");
  const objectiveList = getById<HTMLUListElement>("objective-list");
  const replayMeta = getById<HTMLElement>("replay-meta");
  const replayLast = getById<HTMLButtonElement>("replay-last");
  const replayBest = getById<HTMLButtonElement>("replay-best");
  const replayHighlight = getById<HTMLButtonElement>("replay-highlight");
  const replayPlayPause = getById<HTMLButtonElement>("replay-playpause");
  const replayStop = getById<HTMLButtonElement>("replay-stop");
  const resultOverlay = getById<HTMLElement>("result-overlay");
  const resultTitle = getById<HTMLElement>("result-title");
  const resultRank = getById<HTMLElement>("result-rank");
  const resultSubtitle = getById<HTMLElement>("result-subtitle");
  const resultScore = getById<HTMLElement>("result-score");
  const resultFoods = getById<HTMLElement>("result-foods");
  const resultCombo = getById<HTMLElement>("result-combo");
  const resultBossHits = getById<HTMLElement>("result-boss-hits");
  const resultHeatmap = getById<HTMLElement>("result-heatmap");
  const resultTimeline = getById<HTMLElement>("result-timeline");
  const resultRestart = getById<HTMLButtonElement>("result-restart");
  const resultLast = getById<HTMLButtonElement>("result-last");
  const resultBest = getById<HTMLButtonElement>("result-best");
  const resultHighlight = getById<HTMLButtonElement>("result-highlight");
  const careerRunsValue = getById<HTMLElement>("career-runs-value");
  const careerScoreValue = getById<HTMLElement>("career-score-value");
  const careerFoodsValue = getById<HTMLElement>("career-foods-value");
  const careerComboValue = getById<HTMLElement>("career-combo-value");
  const seasonList = getById<HTMLDivElement>("season-list");
  const recentList = getById<HTMLDivElement>("recent-list");
  const achievementList = getById<HTMLDivElement>("achievement-list");
  const effectsToggle = getById<HTMLInputElement>("toggle-effects");
  const sfxToggle = getById<HTMLInputElement>("toggle-sfx");

  const scene = new GameScene(engine, () => preferences);
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: gameRoot,
    width: gameRoot.clientWidth || 880,
    height: gameRoot.clientHeight || 720,
    backgroundColor: "#07101b",
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: "100%",
      height: "100%"
    },
    scene: [scene]
  });

  effectsToggle.checked = preferences.effectsEnabled;
  sfxToggle.checked = preferences.sfxEnabled;

  const persistSettings = (route: GameRoute, mode: GameModeId): void => {
    writeStoredSettings({
      route,
      mode,
      effectsEnabled: preferences.effectsEnabled,
      sfxEnabled: preferences.sfxEnabled
    });
  };

  const stopReplay = (): void => {
    if (playback.timerId !== null) {
      window.clearInterval(playback.timerId);
      playback.timerId = null;
    }
    playback.playing = false;
    playback.run = null;
    playback.source = null;
    playback.frameIndex = 0;
    scene.setPresentation(null);
    refreshReplayControls();
    updateUi(engine.getSnapshot());
  };

  const refreshReplayControls = (): void => {
    replayPlayPause.textContent = playback.playing ? "暂停回放" : "播放";
    if (!playback.run) {
      replayMeta.textContent = "直播画面";
      return;
    }
    const sourceLabel =
      playback.source === "last"
        ? "本局"
        : playback.source === "best"
          ? "最佳"
          : "最后 10 秒";
    replayMeta.textContent = `回放中：${sourceLabel} · ${playback.frameIndex + 1}/${playback.run.frames.length}`;
  };

  const setReplayFrame = (frameIndex: number): void => {
    if (!playback.run) return;
    playback.frameIndex = Math.max(0, Math.min(frameIndex, playback.run.frames.length - 1));
    scene.setPresentation(playback.run.frames[playback.frameIndex].snapshot);
    refreshReplayControls();
  };

  const startReplay = (run: ReplayRun | null, source: ReplaySource): void => {
    if (!run || run.frames.length === 0) return;
    stopReplay();
    playback.run = run;
    playback.source = source;
    playback.playing = true;
    setReplayFrame(0);
    playback.timerId = window.setInterval(() => {
      if (!playback.run) return;
      if (playback.frameIndex >= playback.run.frames.length - 1) {
        playback.playing = false;
        if (playback.timerId !== null) {
          window.clearInterval(playback.timerId);
          playback.timerId = null;
        }
        refreshReplayControls();
        return;
      }
      setReplayFrame(playback.frameIndex + 1);
    }, 90);
  };

  const renderChallenges = (): void => {
    challengeSelect.innerHTML = engine
      .getChallengeCatalog()
      .map(
        (challenge) =>
          `<option value="${challenge.id}" ${engine.getSelectedChallengeId() === challenge.id ? "selected" : ""}>${challenge.title}</option>`
      )
      .join("");
  };

  const renderModes = (snapshot: SnakeSnapshot): void => {
    modeGrid.innerHTML = Object.values(GAME_MODES)
      .map(
        (mode) => `
          <button class="mode-card ${snapshot.route === "sandbox" && snapshot.mode.id === mode.id ? "is-active" : ""}" data-mode="${mode.id}">
            <span class="mode-card__title">${mode.name}</span>
            <span class="mode-card__tagline">${mode.tagline}</span>
            <span class="mode-card__meta">目标分：${mode.targetScore} · 每 ${mode.growEvery} 步成长</span>
          </button>
        `
      )
      .join("");
  };

  const renderCampaignMap = (snapshot: SnakeSnapshot): void => {
    campaignMap.innerHTML = CAMPAIGN_CHAPTERS.map((chapter) => {
      const nodes = chapter.levels
        .map((level) => {
          const progress = snapshot.campaign.levels[level.id];
          const locked = !progress?.unlocked;
          const selected = snapshot.level?.definition.id === level.id || (!snapshot.level && snapshot.campaign.recentLevelId === level.id);
          return `
            <button class="level-node ${selected ? "is-selected" : ""} ${locked ? "is-locked" : ""}" data-level="${level.id}" ${locked ? "disabled" : ""}>
              <span class="level-node__id">${level.id}</span>
              <strong>${level.title}</strong>
              <span>${progress?.bestRating ?? "未完成"} · ${progress?.bestScore ?? 0} 分</span>
            </button>
          `;
        })
        .join("");

      return `
        <section class="chapter-card" style="--chapter-accent:${chapter.accent}; --chapter-secondary:${chapter.secondary};">
          <div class="chapter-card__header">
            <div>
              <p class="panel__label">Chapter ${chapter.index}</p>
              <h3>${chapter.title}</h3>
            </div>
            <span>${chapter.subtitle}</span>
          </div>
          <div class="chapter-card__levels">${nodes}</div>
        </section>
      `;
    }).join("");
  };

  const renderSelectedLevel = (snapshot: SnakeSnapshot): void => {
    const selectedId = snapshot.level?.definition.id ?? snapshot.campaign.recentLevelId ?? initialLevelId;
    const level = CAMPAIGN_LEVELS.find((entry) => entry.id === selectedId) ?? CAMPAIGN_LEVELS[0];
    const progress = snapshot.campaign.levels[level.id];
    selectedLevel.innerHTML = `
      <p class="panel__label">${snapshot.route === "campaign" ? "当前关卡" : "自由练习"}</p>
      <h3>${snapshot.route === "campaign" ? `${level.id} · ${level.title}` : snapshot.mode.name}</h3>
      <p class="selected-level__text">${snapshot.route === "campaign" ? level.description : snapshot.mode.description}</p>
      <div class="selected-level__meta">
        <span>最佳评级：${progress?.bestRating ?? "未完成"}</span>
        <span>最佳分数：${progress?.bestScore ?? 0}</span>
      </div>
    `;
  };

  const renderArchive = (snapshot: SnakeSnapshot): void => {
    careerRunsValue.textContent = String(snapshot.career.totalRuns);
    careerScoreValue.textContent = String(snapshot.career.totalScore);
    careerFoodsValue.textContent = String(snapshot.career.totalFoods);
    careerComboValue.textContent = String(snapshot.career.bestComboEver);

    seasonList.innerHTML = snapshot.campaign.seasonChallenges
      .map(
        (challenge) => `
          <article class="season-item ${challenge.completed ? "is-complete" : ""}">
            <div>
              <strong>${challenge.title}</strong>
              <span>${challenge.description}</span>
            </div>
            <em>${challenge.current}/${challenge.target}</em>
          </article>
        `
      )
      .join("");

    recentList.innerHTML = topRecords(snapshot.campaign)
      .map(
        (record) => `
          <article class="record-item">
            <div>
              <strong>${record.id} · ${record.title}</strong>
              <span>${record.bestRating ?? "未评级"}</span>
            </div>
            <em>${record.bestScore}</em>
          </article>
        `
      )
      .join("");

    achievementList.innerHTML = snapshot.achievements
      .map(
        (achievement) => `
          <article class="achievement-item ${achievement.unlocked ? "is-unlocked" : ""}">
            <strong>${achievement.title}</strong>
            <span>${achievement.description}</span>
          </article>
        `
      )
      .join("");
  };

  const renderArena = (snapshot: SnakeSnapshot): void => {
    const showingReplay = playback.run !== null;
    const shouldShowArena = showingReplay || snapshot.route === "sandbox" || snapshot.status !== "idle";
    arenaShell.classList.toggle("is-hidden", !shouldShowArena);
    campaignView.classList.toggle("is-hidden", shouldShowArena && snapshot.route === "campaign" && snapshot.status !== "idle");
    if (!shouldShowArena && snapshot.route === "campaign") {
      campaignView.classList.remove("is-hidden");
    }

    routePill.textContent = routeTitle(snapshot.route);
    hudTitle.textContent = snapshot.level ? `${snapshot.level.definition.id} · ${snapshot.level.definition.title}` : snapshot.mode.name;
    statusPill.textContent =
      showingReplay
        ? "回放中"
        : snapshot.status === "playing"
          ? "进行中"
          : snapshot.status === "paused"
            ? "已暂停"
            : snapshot.status === "victory"
              ? "任务完成"
              : snapshot.status === "gameover"
                ? "任务失败"
                : "待命";
    bossPill.textContent =
      snapshot.boss.kind === "none"
        ? "Boss 未激活"
        : `${snapshot.boss.name} · ${snapshot.boss.phase === "active" ? snapshot.boss.attackLabel : snapshot.boss.phase === "warning" ? "预警中" : snapshot.boss.phase === "defeated" ? "已击破" : "待机"}`;

    scoreValue.textContent = String(snapshot.score);
    timeValue.textContent = formatTime(snapshot.elapsedMs);
    speedValue.textContent = `${snapshot.tickMs} ms`;
    directionValue.textContent = directionLabel(snapshot.direction);
    foodKindValue.textContent = `${snapshot.food.label} x${snapshot.scoreMultiplier}`;
    multiplierValue.textContent = `${snapshot.scoreMultiplier}x`;
    frenzyValue.textContent = snapshot.frenzyMs > 0 ? `${(snapshot.frenzyMs / 1000).toFixed(1)} s` : "未激活";
    bonusGrowValue.textContent = String(snapshot.bonusGrowthCharges);

    objectiveList.innerHTML = snapshot.level
      ? [snapshot.level.primary, ...snapshot.level.secondary]
          .map(
            (objective) => `
              <li class="objective objective--${objective.status}">
                <div>
                  <strong>${objective.label}</strong>
                  <span>${objective.description}</span>
                </div>
                <em>${objective.current}/${objective.target}</em>
              </li>
            `
          )
          .join("")
      : `
          <li class="objective">
            <div>
              <strong>自由练习</strong>
              <span>适合刷分、试玩和演示基础玩法。</span>
            </div>
            <em>${snapshot.mode.targetScore} 目标分</em>
          </li>
        `;
  };

  const renderResult = (snapshot: SnakeSnapshot): void => {
    const run = engine.getLastReplay();
    const bestReplay = snapshot.level ? engine.getBestReplay(snapshot.level.definition.id) : null;
    const highlightReplay = engine.getHighlightReplay();
    const completed = snapshot.status === "victory" || snapshot.status === "gameover";
    resultOverlay.classList.toggle("is-hidden", !completed || playback.run !== null);
    if (!completed) return;

    const rank = snapshot.level ? snapshot.level.rating : "Bronze";
    resultTitle.textContent = snapshot.status === "victory" ? "关卡完成" : "任务终止";
    resultRank.textContent = rank;
    resultRank.dataset.rank = rank;
    resultSubtitle.textContent = snapshot.status === "victory" ? "目标达成，复盘报告已生成。" : snapshot.lastCrashReason ?? "本局结束";
    resultScore.textContent = String(snapshot.score);
    resultFoods.textContent = String(snapshot.foodsEaten);
    resultCombo.textContent = String(snapshot.maxCombo);
    resultBossHits.textContent = String(run?.summary.bookmarks.filter((bookmark) => bookmark.type === "boss-hit").length ?? 0);
    resultHeatmap.innerHTML = heatmapSvg(run);
    resultTimeline.innerHTML = (run?.summary.bookmarks ?? [])
      .map(
        (bookmark) => `
          <article class="timeline-item">
            <strong>${bookmark.label}</strong>
            <span>${formatTime(bookmark.elapsedMs)}</span>
          </article>
        `
      )
      .join("");

    resultLast.disabled = !run;
    resultBest.disabled = !bestReplay;
    resultHighlight.disabled = !highlightReplay;
  };

  const updateUi = (snapshot: SnakeSnapshot): void => {
    root.querySelectorAll<HTMLElement>("[data-route]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.route === snapshot.route);
    });
    renderModes(snapshot);
    renderChallenges();
    renderCampaignMap(snapshot);
    renderSelectedLevel(snapshot);
    renderArena(snapshot);
    renderArchive(snapshot);
    renderResult(snapshot);
    refreshReplayControls();
  };

  const resizeObserver = new ResizeObserver(() => {
    game.scale.resize(gameRoot.clientWidth || 880, gameRoot.clientHeight || 720);
  });
  resizeObserver.observe(gameRoot);

  const toggleFullscreen = async (): Promise<void> => {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }
    await root.requestFullscreen();
  };

  challengeSelect.addEventListener("change", () => engine.setChallenge(challengeSelect.value));
  effectsToggle.addEventListener("change", () => {
    preferences.effectsEnabled = effectsToggle.checked;
    persistSettings(engine.getRoute(), engine.getSnapshot().mode.id);
  });
  sfxToggle.addEventListener("change", () => {
    preferences.sfxEnabled = sfxToggle.checked;
    persistSettings(engine.getRoute(), engine.getSnapshot().mode.id);
  });

  root.querySelectorAll<HTMLElement>("[data-action='fullscreen']").forEach((button) => {
    button.addEventListener("click", () => void toggleFullscreen());
  });
  root.querySelectorAll<HTMLElement>("[data-action='pause']").forEach((button) => {
    button.addEventListener("click", () => engine.togglePause());
  });
  root.querySelectorAll<HTMLElement>("[data-action='restart']").forEach((button) => {
    button.addEventListener("click", () => {
      stopReplay();
      engine.startNewRun();
    });
  });

  startButton.addEventListener("click", () => {
    stopReplay();
    engine.startNewRun();
  });
  resultRestart.addEventListener("click", () => {
    stopReplay();
    engine.startNewRun();
  });

  replayLast.addEventListener("click", () => startReplay(engine.getLastReplay(), "last"));
  replayBest.addEventListener("click", () => {
    const snapshot = engine.getSnapshot();
    if (!snapshot.level) return;
    startReplay(engine.getBestReplay(snapshot.level.definition.id), "best");
  });
  replayHighlight.addEventListener("click", () => startReplay(engine.getHighlightReplay(), "highlight"));
  replayStop.addEventListener("click", () => stopReplay());
  replayPlayPause.addEventListener("click", () => {
    if (!playback.run) return;
    if (!playback.playing) {
      playback.playing = true;
      playback.timerId = window.setInterval(() => {
        if (!playback.run) return;
        if (playback.frameIndex >= playback.run.frames.length - 1) {
          playback.playing = false;
          if (playback.timerId !== null) {
            window.clearInterval(playback.timerId);
            playback.timerId = null;
          }
          refreshReplayControls();
          return;
        }
        setReplayFrame(playback.frameIndex + 1);
      }, 90);
    } else {
      playback.playing = false;
      if (playback.timerId !== null) {
        window.clearInterval(playback.timerId);
        playback.timerId = null;
      }
    }
    refreshReplayControls();
  });

  resultLast.addEventListener("click", () => startReplay(engine.getLastReplay(), "last"));
  resultBest.addEventListener("click", () => {
    const snapshot = engine.getSnapshot();
    if (!snapshot.level) return;
    startReplay(engine.getBestReplay(snapshot.level.definition.id), "best");
  });
  resultHighlight.addEventListener("click", () => startReplay(engine.getHighlightReplay(), "highlight"));

  root.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    const route = target.closest<HTMLElement>("[data-route]")?.dataset.route as GameRoute | undefined;
    const mode = target.closest<HTMLElement>("[data-mode]")?.dataset.mode as GameModeId | undefined;
    const levelId = target.closest<HTMLElement>("[data-level]")?.dataset.level;

    if (route) {
      stopReplay();
      engine.setRoute(route);
      persistSettings(route, engine.getSnapshot().mode.id);
      updateUi(engine.getSnapshot());
      return;
    }

    if (mode) {
      stopReplay();
      engine.setRoute("sandbox");
      engine.setMode(mode);
      persistSettings("sandbox", mode);
      updateUi(engine.getSnapshot());
      return;
    }

    if (levelId) {
      stopReplay();
      engine.selectLevel(levelId);
      persistSettings("campaign", engine.getSnapshot().mode.id);
      updateUi(engine.getSnapshot());
    }
  });

  root.querySelectorAll<HTMLButtonElement>("[data-dir]").forEach((button) => {
    button.addEventListener("click", () => engine.queueDirection(button.dataset.dir as Direction));
  });

  let startX = 0;
  let startY = 0;
  gameRoot.addEventListener(
    "pointerdown",
    (event) => {
      startX = event.clientX;
      startY = event.clientY;
    },
    { passive: true }
  );
  gameRoot.addEventListener(
    "pointerup",
    (event) => {
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      if (Math.abs(dx) < 24 && Math.abs(dy) < 24) return;
      if (Math.abs(dx) > Math.abs(dy)) {
        engine.queueDirection(dx > 0 ? "right" : "left");
      } else {
        engine.queueDirection(dy > 0 ? "down" : "up");
      }
    },
    { passive: true }
  );

  window.addEventListener("keydown", (event) => {
    if (event.key.toLowerCase() === "f") {
      void toggleFullscreen();
    }
  });

  engine.selectLevel(initialLevelId);
  engine.setMode(initialMode);
  engine.setRoute(initialRoute);
  engine.subscribe((snapshot) => updateUi(snapshot));
  updateUi(engine.getSnapshot());

  if (shouldAutoStart) {
    queueMicrotask(() => engine.startNewRun());
  }
}
