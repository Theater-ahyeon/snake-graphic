import {
  BOARD_SIZE,
  DIRECTION_VECTORS,
  type Direction,
  type GameMode,
  type GameModeId,
  type GameStatus,
  GAME_MODES,
  INNER_MAX,
  INNER_MIN,
  OBSTACLE_COUNT,
  OPPOSITE_DIRECTION
} from "../config";
import { CAMPAIGN_LEVELS, getLevelById } from "../campaign/levels";
import type {
  AchievementState,
  BossPatternKind,
  BossPatternState,
  CampaignLevelProgress,
  CampaignProgress,
  Cell,
  ChallengeDefinition,
  ChallengeState,
  EngineListener,
  FoodKind,
  FoodState,
  GameRoute,
  LevelDefinition,
  LevelObjective,
  LevelObjectiveProgress,
  ObjectiveStatus,
  RatingRank,
  ReplayBookmark,
  ReplayFrame,
  ReplayRun,
  ReplaySummary,
  SeasonChallengeProgress,
  SnakeSnapshot,
  StepEvent
} from "./types";

const SCORE_STORAGE_KEY = "neon-snake-best-scores";
const CAREER_STORAGE_KEY = "neon-snake-career";
const CAMPAIGN_STORAGE_KEY = "neon-snake-campaign-progress-v2";
const CAMPAIGN_REPLAY_STORAGE_KEY = "neon-snake-best-replays-v2";
const COMBO_WINDOW_MS = 3800;
const FRENZY_DURATION_MS = 6500;

interface CareerStats {
  totalRuns: number;
  totalScore: number;
  totalFoods: number;
  totalPlayTimeMs: number;
  bestComboEver: number;
  longestRunMs: number;
  unlockedAchievementIds: string[];
}

interface AchievementDefinition {
  id: string;
  title: string;
  description: string;
  isUnlocked: (snapshot: SnakeSnapshot) => boolean;
}

interface RunMetrics {
  pauseCount: number;
  frenzyActivations: number;
  bossHits: number;
  bossDefeated: boolean;
}

interface StoredCampaignReplayFrame {
  snake: Cell[];
  food: FoodState;
  direction: Direction;
  pendingDirection: Direction;
  score: number;
  foodsEaten: number;
  steps: number;
  combo: number;
  maxCombo: number;
  elapsedMs: number;
  status: GameStatus;
  tickMs: number;
  passiveGrowIn: number;
  bonusGrowthCharges: number;
  frenzyMs: number;
  lastCrashReason: string | null;
  boss: BossPatternState;
  level: SnakeSnapshot["level"];
}

interface StoredCampaignReplayRun {
  id: number;
  summary: ReplaySummary;
  frames: StoredCampaignReplayFrame[];
}

const CHALLENGE_LIBRARY: readonly ChallengeDefinition[] = [
  {
    id: "steady-nerve",
    title: "稳态神经",
    description: "单局内不暂停，率先冲到 120 分。",
    reward: "结果页会点亮零停顿徽记。"
  },
  {
    id: "frenzy-conductor",
    title: "狂热点火者",
    description: "单局内连续引爆 2 次狂热状态。",
    reward: "结算页会显示狂热掌控评价。"
  },
  {
    id: "boss-breaker",
    title: "核心粉碎者",
    description: "在一局中击破一次 Boss 障碍核心。",
    reward: "档案页会记录一次完整 Boss 击破。"
  },
  {
    id: "inferno-expedition",
    title: "炼狱远征",
    description: "在 Inferno Grid 模式中吃到 12 个食物。",
    reward: "赛季挑战页会解锁高压模式勋带。",
    modeHint: "仅在 Inferno Grid 模式下生效。"
  }
];

const ACHIEVEMENT_DEFS: AchievementDefinition[] = [
  {
    id: "first-bite",
    title: "初次吞食",
    description: "任意一局吃到第一颗能量果。",
    isUnlocked: (snapshot) => snapshot.foodsEaten >= 1
  },
  {
    id: "combo-artist",
    title: "连击艺术家",
    description: "单局最长连击达到 5 次。",
    isUnlocked: (snapshot) => snapshot.maxCombo >= 5
  },
  {
    id: "frenzy-runner",
    title: "狂热引擎",
    description: "成功触发一次狂热状态。",
    isUnlocked: (snapshot) =>
      snapshot.frenzyMs > 0 || snapshot.career.unlockedAchievementIds.includes("frenzy-runner")
  },
  {
    id: "score-hunter",
    title: "高分猎手",
    description: "单局得分达到 180 分。",
    isUnlocked: (snapshot) => snapshot.score >= 180
  },
  {
    id: "boss-breaker",
    title: "障碍征服者",
    description: "击破一次章节 Boss。",
    isUnlocked: (snapshot) =>
      snapshot.boss.phase === "defeated" ||
      snapshot.career.unlockedAchievementIds.includes("boss-breaker")
  },
  {
    id: "campaign-starter",
    title: "征程启航",
    description: "完成任意一个竞技关卡。",
    isUnlocked: (snapshot) =>
      Object.values(snapshot.campaign.levels).some((level) => level.completed)
  },
  {
    id: "inferno-master",
    title: "炼狱掌控者",
    description: "在 Inferno Grid 模式下单局达到 220 分。",
    isUnlocked: (snapshot) => snapshot.mode.id === "inferno" && snapshot.score >= 220
  }
];

function cloneCell(cell: Cell): Cell {
  return { x: cell.x, y: cell.y };
}

function cloneFood(food: FoodState): FoodState {
  return { ...food };
}

function cloneBoss(boss: BossPatternState): BossPatternState {
  return {
    ...boss,
    core: boss.core ? cloneCell(boss.core) : null,
    warningCells: boss.warningCells.map(cloneCell),
    hazardCells: boss.hazardCells.map(cloneCell),
    safeCells: boss.safeCells.map(cloneCell)
  };
}

function cloneObjective(objective: LevelObjectiveProgress): LevelObjectiveProgress {
  return { ...objective };
}

function cloneLevelState(level: SnakeSnapshot["level"]): SnakeSnapshot["level"] {
  if (!level) return null;
  return {
    ...level,
    definition: {
      ...level.definition,
      startSnake: level.definition.startSnake.map(cloneCell),
      obstacles: level.definition.obstacles.map(cloneCell),
      primaryObjective: { ...level.definition.primaryObjective },
      secondaryObjectives: level.definition.secondaryObjectives.map((objective) => ({ ...objective })),
      ratingThresholds: { ...level.definition.ratingThresholds },
      runtime: { ...level.definition.runtime },
      boss: level.definition.boss ? { ...level.definition.boss } : null,
      failConditions: [...level.definition.failConditions]
    },
    primary: cloneObjective(level.primary),
    secondary: level.secondary.map(cloneObjective)
  };
}

function cloneCampaignProgress(progress: CampaignProgress): CampaignProgress {
  const levels = Object.fromEntries(
    Object.entries(progress.levels).map(([levelId, level]) => [levelId, { ...level }])
  );
  return {
    levels,
    recentLevelId: progress.recentLevelId,
    seasonChallenges: progress.seasonChallenges.map((challenge) => ({ ...challenge }))
  };
}

function deepCloneSnapshot(snapshot: SnakeSnapshot): SnakeSnapshot {
  return {
    ...snapshot,
    snake: snapshot.snake.map(cloneCell),
    food: cloneFood(snapshot.food),
    obstacles: snapshot.obstacles.map(cloneCell),
    achievements: snapshot.achievements.map((achievement) => ({ ...achievement })),
    career: {
      ...snapshot.career,
      unlockedAchievementIds: [...snapshot.career.unlockedAchievementIds]
    },
    boss: cloneBoss(snapshot.boss),
    replay: { ...snapshot.replay },
    campaign: cloneCampaignProgress(snapshot.campaign),
    challenge: snapshot.challenge ? { ...snapshot.challenge } : null,
    level: cloneLevelState(snapshot.level)
  };
}

function cellKey(cell: Cell): string {
  return `${cell.x},${cell.y}`;
}

function mulberry32(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let next = Math.imul(value ^ (value >>> 15), 1 | value);
    next ^= next + Math.imul(next ^ (next >>> 7), 61 | next);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

function readBestScores(): Record<GameModeId, number> {
  try {
    const raw = window.localStorage.getItem(SCORE_STORAGE_KEY);
    if (!raw) return { zen: 0, arcade: 0, inferno: 0 };
    const parsed = JSON.parse(raw) as Partial<Record<GameModeId, number>>;
    return {
      zen: parsed.zen ?? 0,
      arcade: parsed.arcade ?? 0,
      inferno: parsed.inferno ?? 0
    };
  } catch {
    return { zen: 0, arcade: 0, inferno: 0 };
  }
}

function writeBestScores(scores: Record<GameModeId, number>): void {
  window.localStorage.setItem(SCORE_STORAGE_KEY, JSON.stringify(scores));
}

function readCareerStats(): CareerStats {
  try {
    const raw = window.localStorage.getItem(CAREER_STORAGE_KEY);
    if (!raw) {
      return {
        totalRuns: 0,
        totalScore: 0,
        totalFoods: 0,
        totalPlayTimeMs: 0,
        bestComboEver: 0,
        longestRunMs: 0,
        unlockedAchievementIds: []
      };
    }
    const parsed = JSON.parse(raw) as Partial<CareerStats>;
    return {
      totalRuns: parsed.totalRuns ?? 0,
      totalScore: parsed.totalScore ?? 0,
      totalFoods: parsed.totalFoods ?? 0,
      totalPlayTimeMs: parsed.totalPlayTimeMs ?? 0,
      bestComboEver: parsed.bestComboEver ?? 0,
      longestRunMs: parsed.longestRunMs ?? 0,
      unlockedAchievementIds: parsed.unlockedAchievementIds ?? []
    };
  } catch {
    return {
      totalRuns: 0,
      totalScore: 0,
      totalFoods: 0,
      totalPlayTimeMs: 0,
      bestComboEver: 0,
      longestRunMs: 0,
      unlockedAchievementIds: []
    };
  }
}

function writeCareerStats(stats: CareerStats): void {
  window.localStorage.setItem(CAREER_STORAGE_KEY, JSON.stringify(stats));
}

function createInitialCampaignLevels(): Record<string, CampaignLevelProgress> {
  return Object.fromEntries(
    CAMPAIGN_LEVELS.map((level, index) => [
      level.id,
      {
        unlocked: index === 0,
        completed: false,
        bestRating: null,
        bestScore: 0,
        bestTimeMs: null,
        bestCombo: 0,
        plays: 0
      }
    ])
  );
}

function computeSeasonChallenges(levels: Record<string, CampaignLevelProgress>): SeasonChallengeProgress[] {
  const completedLevels = Object.values(levels).filter((level) => level.completed).length;
  const completedBossLevels = CAMPAIGN_LEVELS.filter(
    (level) => level.boss && levels[level.id]?.completed
  ).length;
  const bestCombo = Math.max(0, ...Object.values(levels).map((level) => level.bestCombo));

  return [
    {
      id: "season-clear-3",
      title: "赛季演练",
      description: "完成 3 个竞技关卡。",
      reward: "解锁赛季进程徽章。",
      current: Math.min(completedLevels, 3),
      target: 3,
      completed: completedLevels >= 3
    },
    {
      id: "season-boss-2",
      title: "首领猎手",
      description: "击破 2 个章节 Boss。",
      reward: "解锁 Boss 战纪念勋带。",
      current: Math.min(completedBossLevels, 2),
      target: 2,
      completed: completedBossLevels >= 2
    },
    {
      id: "season-combo-8",
      title: "高压连击",
      description: "任意竞技关卡打出 8 连击。",
      reward: "解锁连击专家头衔。",
      current: Math.min(bestCombo, 8),
      target: 8,
      completed: bestCombo >= 8
    }
  ];
}

function readCampaignProgress(): CampaignProgress {
  const fallbackLevels = createInitialCampaignLevels();
  try {
    const raw = window.localStorage.getItem(CAMPAIGN_STORAGE_KEY);
    if (!raw) {
      return {
        levels: fallbackLevels,
        recentLevelId: CAMPAIGN_LEVELS[0]?.id ?? null,
        seasonChallenges: computeSeasonChallenges(fallbackLevels)
      };
    }

    const parsed = JSON.parse(raw) as Partial<CampaignProgress>;
    const levels = createInitialCampaignLevels();
    Object.keys(levels).forEach((levelId) => {
      const storedLevel = parsed.levels?.[levelId];
      if (!storedLevel) return;
      levels[levelId] = {
        unlocked: storedLevel.unlocked ?? levels[levelId].unlocked,
        completed: storedLevel.completed ?? false,
        bestRating: storedLevel.bestRating ?? null,
        bestScore: storedLevel.bestScore ?? 0,
        bestTimeMs: storedLevel.bestTimeMs ?? null,
        bestCombo: storedLevel.bestCombo ?? 0,
        plays: storedLevel.plays ?? 0
      };
    });

    return {
      levels,
      recentLevelId: parsed.recentLevelId ?? CAMPAIGN_LEVELS[0]?.id ?? null,
      seasonChallenges: computeSeasonChallenges(levels)
    };
  } catch {
    return {
      levels: fallbackLevels,
      recentLevelId: CAMPAIGN_LEVELS[0]?.id ?? null,
      seasonChallenges: computeSeasonChallenges(fallbackLevels)
    };
  }
}

function writeCampaignProgress(progress: CampaignProgress): void {
  window.localStorage.setItem(
    CAMPAIGN_STORAGE_KEY,
    JSON.stringify({
      levels: progress.levels,
      recentLevelId: progress.recentLevelId
    })
  );
}

function createFoodState(kind: FoodKind, x: number, y: number): FoodState {
  if (kind === "combo") {
    return { x, y, kind, label: "连击果", baseValue: 15 };
  }
  if (kind === "surge") {
    return { x, y, kind, label: "脉冲核", baseValue: 12 };
  }
  if (kind === "growth") {
    return { x, y, kind, label: "增殖果", baseValue: 10 };
  }
  return { x, y, kind, label: "能量果", baseValue: 10 };
}

function createBossState(kind: BossPatternKind = "none"): BossPatternState {
  return {
    kind,
    phase: "dormant",
    name: kind === "none" ? "No Boss" : "Sentinel Core",
    introScore: Number.MAX_SAFE_INTEGER,
    hp: 0,
    maxHp: 0,
    core: null,
    warningCells: [],
    hazardCells: [],
    safeCells: [],
    turnsUntilShift: 0,
    attackLabel: "未激活",
    enraged: false
  };
}

function createRunMetrics(): RunMetrics {
  return {
    pauseCount: 0,
    frenzyActivations: 0,
    bossHits: 0,
    bossDefeated: false
  };
}

function compareRatings(left: RatingRank | null, right: RatingRank | null): number {
  const order: RatingRank[] = ["Bronze", "Silver", "Gold", "S"];
  return (left ? order.indexOf(left) : -1) - (right ? order.indexOf(right) : -1);
}

function snapshotFromStoredFrame(
  frame: StoredCampaignReplayFrame,
  level: LevelDefinition,
  campaign: CampaignProgress,
  career: CareerStats,
  achievements: AchievementState[]
): SnakeSnapshot {
  return {
    boardSize: BOARD_SIZE,
    route: "campaign",
    snake: frame.snake.map(cloneCell),
    food: cloneFood(frame.food),
    obstacles: level.obstacles.map(cloneCell),
    direction: frame.direction,
    pendingDirection: frame.pendingDirection,
    score: frame.score,
    scoreMultiplier: frame.frenzyMs > 0 ? 2 : 1,
    bestScore: frame.score,
    foodsEaten: frame.foodsEaten,
    steps: frame.steps,
    combo: frame.combo,
    maxCombo: frame.maxCombo,
    elapsedMs: frame.elapsedMs,
    status: frame.status,
    mode: GAME_MODES[level.runtime.modeId],
    tickMs: frame.tickMs,
    passiveGrowIn: frame.passiveGrowIn,
    bonusGrowthCharges: frame.bonusGrowthCharges,
    frenzyMs: frame.frenzyMs,
    lastCrashReason: frame.lastCrashReason,
    streakWindowMs: 0,
    runSeed: 0,
    achievements: achievements.map((achievement) => ({ ...achievement })),
    career: { ...career, unlockedAchievementIds: [...career.unlockedAchievementIds] },
    boss: cloneBoss(frame.boss),
    challenge: null,
    replay: {
      hasLastRun: true,
      hasHighlight: false,
      hasBestReplay: true,
      framesRecorded: 0
    },
    level: cloneLevelState(frame.level),
    campaign: cloneCampaignProgress(campaign)
  };
}

function readStoredCampaignReplays(): Record<string, StoredCampaignReplayRun> {
  try {
    const raw = window.localStorage.getItem(CAMPAIGN_REPLAY_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, StoredCampaignReplayRun>;
  } catch {
    return {};
  }
}

function writeStoredCampaignReplays(payload: Record<string, StoredCampaignReplayRun>): void {
  window.localStorage.setItem(CAMPAIGN_REPLAY_STORAGE_KEY, JSON.stringify(payload));
}

function challengeById(id: string): ChallengeDefinition {
  return CHALLENGE_LIBRARY.find((challenge) => challenge.id === id) ?? CHALLENGE_LIBRARY[0];
}

export class SnakeEngine {
  private listeners = new Set<EngineListener>();

  private route: GameRoute = "campaign";

  private status: GameStatus = "idle";

  private mode: GameMode = GAME_MODES.arcade;

  private selectedLevelId = CAMPAIGN_LEVELS[0]?.id ?? "1-1";

  private currentLevel: LevelDefinition | null = null;

  private snake: Cell[] = [];

  private obstacles: Cell[] = [];

  private food: FoodState = createFoodState("normal", 10, 4);

  private direction: Direction = "up";

  private pendingDirection: Direction = "up";

  private accumulatorMs = 0;

  private elapsedMs = 0;

  private score = 0;

  private foodsEaten = 0;

  private steps = 0;

  private combo = 0;

  private maxCombo = 0;

  private comboWindowMs = 0;

  private frenzyMs = 0;

  private bonusGrowthCharges = 0;

  private bestScores = readBestScores();

  private career = readCareerStats();

  private campaign = readCampaignProgress();

  private storedReplays = readStoredCampaignReplays();

  private lastCrashReason: string | null = null;

  private tickMs = GAME_MODES.arcade.baseTickMs;

  private runSeed = Math.floor(Math.random() * 1_000_000);

  private boss = createBossState();

  private selectedChallengeId = CHALLENGE_LIBRARY[0].id;

  private runMetrics = createRunMetrics();

  private replayFrames: ReplayFrame[] = [];

  private replayBookmarks: ReplayBookmark[] = [];

  private lastReplayRun: ReplayRun | null = null;

  private lastHighlightRun: ReplayRun | null = null;

  private replayRecording = false;

  private replaySerial = 0;

  subscribe(listener: EngineListener): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot(), { type: "reset" });
    return () => this.listeners.delete(listener);
  }

  setRoute(route: GameRoute): void {
    this.route = route;
    this.status = "idle";
    this.currentLevel = route === "campaign" ? getLevelById(this.selectedLevelId) : null;
    this.notify({ type: "mode" });
  }

  getRoute(): GameRoute {
    return this.route;
  }

  setMode(modeId: GameModeId): void {
    this.mode = GAME_MODES[modeId];
    this.bestScores = readBestScores();
    this.notify({ type: "mode" });
  }

  getChallengeCatalog(): ChallengeDefinition[] {
    return CHALLENGE_LIBRARY.map((challenge) => ({ ...challenge }));
  }

  getSelectedChallengeId(): string {
    return this.selectedChallengeId;
  }

  setChallenge(challengeId: string): void {
    if (this.status === "playing" || this.status === "paused") return;
    this.selectedChallengeId = challengeId;
    this.notify({ type: "mode" });
  }

  selectLevel(levelId: string): void {
    this.selectedLevelId = levelId;
    this.currentLevel = getLevelById(levelId);
    this.route = "campaign";
    this.status = "idle";
    this.campaign.recentLevelId = levelId;
    this.notify({ type: "mode" });
  }

  getCampaignProgress(): CampaignProgress {
    this.campaign.seasonChallenges = computeSeasonChallenges(this.campaign.levels);
    return cloneCampaignProgress(this.campaign);
  }

  getLastReplay(): ReplayRun | null {
    if (!this.lastReplayRun) return null;
    return {
      ...this.lastReplayRun,
      frames: this.lastReplayRun.frames.map((frame) => ({
        snapshot: deepCloneSnapshot(frame.snapshot),
        event: { ...frame.event },
        elapsedMs: frame.elapsedMs
      })),
      summary: {
        ...this.lastReplayRun.summary,
        bookmarks: this.lastReplayRun.summary.bookmarks.map((bookmark) => ({ ...bookmark }))
      }
    };
  }

  getHighlightReplay(): ReplayRun | null {
    if (!this.lastHighlightRun) return null;
    return {
      ...this.lastHighlightRun,
      frames: this.lastHighlightRun.frames.map((frame) => ({
        snapshot: deepCloneSnapshot(frame.snapshot),
        event: { ...frame.event },
        elapsedMs: frame.elapsedMs
      })),
      summary: {
        ...this.lastHighlightRun.summary,
        bookmarks: this.lastHighlightRun.summary.bookmarks.map((bookmark) => ({ ...bookmark }))
      }
    };
  }

  getBestReplay(levelId: string): ReplayRun | null {
    const stored = this.storedReplays[levelId];
    if (!stored) return null;
    const level = getLevelById(levelId);
    const snapshotBase = this.getSnapshot();
    return {
      id: stored.id,
      summary: {
        ...stored.summary,
        bookmarks: stored.summary.bookmarks.map((bookmark) => ({ ...bookmark }))
      },
      frames: stored.frames.map((frame) => ({
        snapshot: snapshotFromStoredFrame(
          frame,
          level,
          snapshotBase.campaign,
          snapshotBase.career,
          snapshotBase.achievements
        ),
        event: { type: "step" },
        elapsedMs: frame.elapsedMs
      }))
    };
  }

  getSnapshot(): SnakeSnapshot {
    const level = this.route === "campaign" ? this.currentLevel ?? getLevelById(this.selectedLevelId) : null;
    const mode = level ? GAME_MODES[level.runtime.modeId] : this.mode;
    const growEvery = level?.runtime.growEvery ?? mode.growEvery;
    const stepsIntoCycle = this.steps % growEvery;
    const passiveGrowIn = stepsIntoCycle === 0 ? growEvery : growEvery - stepsIntoCycle;

    const snapshot: SnakeSnapshot = {
      boardSize: BOARD_SIZE,
      route: this.route,
      snake: this.snake.map(cloneCell),
      food: cloneFood(this.food),
      obstacles: this.obstacles.map(cloneCell),
      direction: this.direction,
      pendingDirection: this.pendingDirection,
      score: this.score,
      scoreMultiplier: this.getScoreMultiplier(),
      bestScore: this.bestScores[mode.id] ?? 0,
      foodsEaten: this.foodsEaten,
      steps: this.steps,
      combo: this.combo,
      maxCombo: this.maxCombo,
      elapsedMs: this.elapsedMs,
      status: this.status,
      mode,
      tickMs: this.tickMs,
      passiveGrowIn,
      bonusGrowthCharges: this.bonusGrowthCharges,
      frenzyMs: this.frenzyMs,
      lastCrashReason: this.lastCrashReason,
      streakWindowMs: this.comboWindowMs,
      runSeed: this.runSeed,
      achievements: [],
      career: { ...this.career, unlockedAchievementIds: [...this.career.unlockedAchievementIds] },
      boss: cloneBoss(this.boss),
      challenge: null,
      replay: {
        hasLastRun: this.lastReplayRun !== null,
        hasHighlight: this.lastHighlightRun !== null,
        hasBestReplay: level ? Boolean(this.storedReplays[level.id]) : false,
        framesRecorded: this.replayFrames.length
      },
      level: null,
      campaign: this.getCampaignProgress()
    };

    snapshot.achievements = ACHIEVEMENT_DEFS.map((achievement) => ({
      id: achievement.id,
      title: achievement.title,
      description: achievement.description,
      unlocked:
        snapshot.career.unlockedAchievementIds.includes(achievement.id) ||
        achievement.isUnlocked(snapshot)
    }));
    snapshot.level = level ? this.buildLevelState(level, snapshot) : null;
    snapshot.challenge = this.evaluateChallenge(snapshot);
    return snapshot;
  }

  startNewRun(): void {
    if (this.route === "campaign") {
      this.startLevelRun();
      return;
    }
    this.initializeRun(null);
  }

  startLevelRun(): void {
    this.route = "campaign";
    this.currentLevel = getLevelById(this.selectedLevelId);
    this.initializeRun(this.currentLevel);
  }

  togglePause(): void {
    if (this.status === "playing") {
      this.status = "paused";
      this.runMetrics.pauseCount += 1;
      this.notify({ type: "pause" });
      return;
    }
    if (this.status === "paused") {
      this.status = "playing";
      this.notify({ type: "pause" });
    }
  }

  queueDirection(next: Direction): void {
    if (this.status !== "playing") return;
    if (next === this.pendingDirection) return;
    if (OPPOSITE_DIRECTION[this.pendingDirection] === next) return;
    this.pendingDirection = next;
  }

  update(deltaMs: number): void {
    if (this.status !== "playing") return;
    this.elapsedMs += deltaMs;
    this.accumulatorMs += deltaMs;
    this.comboWindowMs = Math.max(0, this.comboWindowMs - deltaMs);
    this.frenzyMs = Math.max(0, this.frenzyMs - deltaMs);
    if (this.comboWindowMs <= 0) {
      this.combo = 0;
    }

    if (this.currentLevel?.runtime.timeLimitMs && this.elapsedMs >= this.currentLevel.runtime.timeLimitMs) {
      this.finishRun("gameover", "倒计时耗尽，未能完成主目标", {
        type: "step",
        crashed: true,
        crashReason: "倒计时耗尽，未能完成主目标",
        bookmarkLabel: "时间耗尽"
      });
      return;
    }

    while (this.accumulatorMs >= this.tickMs && this.status === "playing") {
      this.accumulatorMs -= this.tickMs;
      this.step();
    }
  }

  private initializeRun(level: LevelDefinition | null): void {
    const runtimeMode = level ? GAME_MODES[level.runtime.modeId] : this.mode;
    this.status = "playing";
    this.currentLevel = level;
    this.accumulatorMs = 0;
    this.elapsedMs = 0;
    this.score = 0;
    this.foodsEaten = 0;
    this.steps = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.comboWindowMs = 0;
    this.frenzyMs = 0;
    this.bonusGrowthCharges = 0;
    this.direction = "up";
    this.pendingDirection = "up";
    this.tickMs = level?.runtime.baseTickMs ?? runtimeMode.baseTickMs;
    this.lastCrashReason = null;
    this.runSeed = Math.floor(Math.random() * 1_000_000);
    this.runMetrics = createRunMetrics();
    this.replayFrames = [];
    this.replayBookmarks = [];
    this.replayRecording = true;
    this.snake = (level?.startSnake ?? [
      { x: 10, y: 11 },
      { x: 10, y: 12 },
      { x: 10, y: 13 }
    ]).map(cloneCell);
    this.obstacles = level ? level.obstacles.map(cloneCell) : this.generateSandboxObstacles(this.runSeed);
    this.boss = level && level.boss ? this.createBossFromLevel(level) : createBossState();
    this.food = this.spawnFood(this.runSeed + 71);
    this.notify({ type: "reset" });
  }

  private createBossFromLevel(level: LevelDefinition): BossPatternState {
    if (!level.boss) {
      return createBossState();
    }
    return {
      kind: level.boss.kind,
      phase: "dormant",
      name: level.boss.name,
      introScore: level.boss.introScore,
      hp: level.boss.hp,
      maxHp: level.boss.hp,
      core: null,
      warningCells: [],
      hazardCells: [],
      safeCells: [],
      turnsUntilShift: 0,
      attackLabel: "待机锁定",
      enraged: false
    };
  }

  private step(): void {
    if (OPPOSITE_DIRECTION[this.direction] !== this.pendingDirection) {
      this.direction = this.pendingDirection;
    }

    const vector = DIRECTION_VECTORS[this.direction];
    const head = this.snake[0];
    const nextHead = { x: head.x + vector.x, y: head.y + vector.y };
    const ate = nextHead.x === this.food.x && nextHead.y === this.food.y;
    const growEvery = this.currentLevel?.runtime.growEvery ?? this.mode.growEvery;
    const passiveGrowth = (this.steps + 1) % growEvery === 0;
    const bonusGrowth = this.bonusGrowthCharges > 0;
    const grew = ate || passiveGrowth || bonusGrowth;

    if (this.isCollision(nextHead, grew)) {
      this.finishRun("gameover", this.describeCrash(nextHead), {
        type: "step",
        crashed: true,
        crashReason: this.describeCrash(nextHead),
        bookmarkLabel: "碰撞"
      });
      return;
    }

    const nextSnake = [nextHead, ...this.snake.map(cloneCell)];
    if (!grew) {
      nextSnake.pop();
    }
    this.snake = nextSnake;
    this.steps += 1;

    if (bonusGrowth && !ate) {
      this.bonusGrowthCharges -= 1;
    }

    let scoreDelta = 0;
    let frenzyStarted = false;
    let foodKind: FoodKind | undefined;
    let bossDamaged = false;
    let bossDefeated = false;
    let bossPhaseChanged: StepEvent["bossPhaseChanged"];
    let bookmarkLabel: string | undefined;

    if (ate) {
      foodKind = this.food.kind;
      const reward = this.applyFoodReward(this.food);
      scoreDelta += reward.scoreDelta;
      frenzyStarted = reward.frenzyStarted;
      this.food = this.spawnFood(this.runSeed + this.steps * 19 + this.foodsEaten * 7);
    }

    const bossUpdate = this.updateBossState(ate);
    bossDamaged = bossUpdate.bossDamaged;
    bossDefeated = bossUpdate.bossDefeated;
    bossPhaseChanged = bossUpdate.bossPhaseChanged;
    if (bossUpdate.scoreBonus > 0) {
      scoreDelta += bossUpdate.scoreBonus;
      frenzyStarted = true;
    }
    bookmarkLabel = bossUpdate.bookmarkLabel;

    if (this.score > (this.bestScores[(this.currentLevel ? GAME_MODES[this.currentLevel.runtime.modeId] : this.mode).id] ?? 0)) {
      const key = (this.currentLevel ? GAME_MODES[this.currentLevel.runtime.modeId] : this.mode).id;
      this.bestScores[key] = this.score;
      writeBestScores(this.bestScores);
    }

    const snapshot = this.getSnapshot();
    const challengeStatus = snapshot.challenge?.status;
    const levelState = snapshot.level;
    if (this.currentLevel && levelState?.completed) {
      this.finishRun("victory", `${this.currentLevel.title} 完成`, {
        type: "step",
        victory: true,
        ate,
        grew,
        scoreDelta,
        frenzyStarted,
        foodKind,
        bossDamaged,
        bossDefeated,
        bossPhaseChanged,
        challengeStatusChanged: challengeStatus,
        challengeCompleted: challengeStatus === "completed",
        bookmarkLabel: bookmarkLabel ?? "关卡完成"
      });
      return;
    }

    const unlockedIds = this.syncAchievements();
    this.tickMs = this.computeTickMs();

    this.notify({
      type: "step",
      ate,
      grew,
      scoreDelta,
      frenzyStarted,
      foodKind,
      unlockedIds,
      bossDamaged,
      bossDefeated,
      bossPhaseChanged,
      challengeStatusChanged: challengeStatus,
      challengeCompleted: challengeStatus === "completed",
      challengeFailed: challengeStatus === "failed",
      bookmarkLabel
    });
  }

  private applyFoodReward(food: FoodState): { scoreDelta: number; frenzyStarted: boolean } {
    this.foodsEaten += 1;
    const comboGain = food.kind === "combo" ? 2 : 1;
    this.combo = this.comboWindowMs > 0 ? this.combo + comboGain : comboGain;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    this.comboWindowMs = COMBO_WINDOW_MS + (food.kind === "combo" ? 1200 : 0);

    let frenzyStarted = false;
    if (food.kind === "surge") {
      frenzyStarted = this.frenzyMs <= 0;
      this.frenzyMs = Math.max(this.frenzyMs, FRENZY_DURATION_MS + 1200);
    }
    if (food.kind === "growth") {
      this.bonusGrowthCharges += 2;
    }
    if (this.combo >= 3 && this.frenzyMs <= 0) {
      frenzyStarted = true;
      this.frenzyMs = FRENZY_DURATION_MS;
    }
    if (frenzyStarted) {
      this.runMetrics.frenzyActivations += 1;
    }

    const scoreDelta = food.baseValue * this.getScoreMultiplier();
    this.score += scoreDelta;
    return { scoreDelta, frenzyStarted };
  }

  private getScoreMultiplier(): number {
    return this.frenzyMs > 0 ? 2 : 1;
  }

  private computeTickMs(): number {
    const runtime = this.currentLevel?.runtime;
    const baseTick = runtime?.baseTickMs ?? this.mode.baseTickMs;
    const minTick = runtime?.minTickMs ?? this.mode.minTickMs;
    const speedRamp = runtime?.speedRamp ?? this.mode.speedRamp;
    const scorePressure = Math.floor(this.score / 10) * speedRamp;
    const comboPressure = Math.min(this.combo, 7) * 1.35;
    const frenzyPressure = this.frenzyMs > 0 ? 14 : 0;
    const bossPressure = this.boss.phase === "active" ? (this.boss.enraged ? 18 : 10) : 0;
    return Math.max(minTick, Math.round(baseTick - scorePressure - comboPressure - frenzyPressure - bossPressure));
  }

  private isCollision(nextHead: Cell, grew: boolean): boolean {
    if (
      nextHead.x <= INNER_MIN - 1 ||
      nextHead.y <= INNER_MIN - 1 ||
      nextHead.x >= INNER_MAX + 1 ||
      nextHead.y >= INNER_MAX + 1
    ) {
      return true;
    }
    if (this.obstacles.some((cell) => cell.x === nextHead.x && cell.y === nextHead.y)) {
      return true;
    }
    if (this.getActiveHazardCells().some((cell) => cell.x === nextHead.x && cell.y === nextHead.y)) {
      return true;
    }
    const body = grew ? this.snake : this.snake.slice(0, -1);
    return body.some((cell) => cell.x === nextHead.x && cell.y === nextHead.y);
  }

  private describeCrash(nextHead: Cell): string {
    if (
      nextHead.x <= INNER_MIN - 1 ||
      nextHead.y <= INNER_MIN - 1 ||
      nextHead.x >= INNER_MAX + 1 ||
      nextHead.y >= INNER_MAX + 1
    ) {
      return "撞上了能量边界";
    }
    if (this.obstacles.some((cell) => cell.x === nextHead.x && cell.y === nextHead.y)) {
      return "撞上了固定障碍";
    }
    if (this.getActiveHazardCells().some((cell) => cell.x === nextHead.x && cell.y === nextHead.y)) {
      return "被 Boss 电场吞没";
    }
    return "咬到了自己的尾迹";
  }

  private generateSandboxObstacles(seed: number): Cell[] {
    const rng = mulberry32(seed + 97);
    const occupied = new Set(this.snake.map(cellKey));
    const obstacles: Cell[] = [];
    while (obstacles.length < OBSTACLE_COUNT) {
      const cell = {
        x: INNER_MIN + Math.floor(rng() * (INNER_MAX - INNER_MIN + 1)),
        y: INNER_MIN + Math.floor(rng() * (INNER_MAX - INNER_MIN + 1))
      };
      if (occupied.has(cellKey(cell))) continue;
      occupied.add(cellKey(cell));
      obstacles.push(cell);
    }
    return obstacles;
  }

  private pickFoodKind(seed: number): FoodKind {
    const runtimeWeights = this.currentLevel?.runtime.foodWeights;
    const rng = mulberry32(seed + this.score + this.foodsEaten * 11);
    if (runtimeWeights) {
      const weights: Record<FoodKind, number> = {
        normal: runtimeWeights.normal ?? 0.56,
        combo: runtimeWeights.combo ?? 0.16,
        surge: runtimeWeights.surge ?? 0.16,
        growth: runtimeWeights.growth ?? 0.12
      };
      const total = Object.values(weights).reduce((sum, value) => sum + value, 0);
      const roll = rng() * total;
      let cursor = 0;
      for (const kind of ["normal", "combo", "surge", "growth"] as FoodKind[]) {
        cursor += weights[kind];
        if (roll <= cursor) return kind;
      }
    }

    const roll = rng();
    if (this.foodsEaten >= 2 && roll > 0.82) return "combo";
    if (this.foodsEaten >= 4 && roll > 0.68) return "surge";
    if (this.foodsEaten >= 3 && roll > 0.55) return "growth";
    return "normal";
  }

  private spawnFood(seed: number): FoodState {
    const rng = mulberry32(seed + this.runSeed);
    const occupied = new Set([
      ...this.snake.map(cellKey),
      ...this.obstacles.map(cellKey),
      ...this.getReservedBossCells().map(cellKey)
    ]);
    const candidates: Cell[] = [];
    for (let x = INNER_MIN; x <= INNER_MAX; x += 1) {
      for (let y = INNER_MIN; y <= INNER_MAX; y += 1) {
        const cell = { x, y };
        if (!occupied.has(cellKey(cell))) {
          candidates.push(cell);
        }
      }
    }
    const selected = candidates[Math.floor(rng() * candidates.length)] ?? { x: INNER_MIN, y: INNER_MIN };
    return createFoodState(this.pickFoodKind(seed), selected.x, selected.y);
  }

  private buildLevelState(level: LevelDefinition, snapshot: SnakeSnapshot): SnakeSnapshot["level"] {
    const primary = this.buildObjectiveProgress(level.primaryObjective, snapshot);
    const secondary = level.secondaryObjectives.map((objective) => this.buildObjectiveProgress(objective, snapshot));
    const rating = this.computeRating(level, snapshot.score);
    const completed = primary.status === "completed";
    return {
      definition: level,
      elapsedLimitMs: level.runtime.timeLimitMs ?? null,
      remainingMs: level.runtime.timeLimitMs ? Math.max(0, level.runtime.timeLimitMs - snapshot.elapsedMs) : null,
      primary,
      secondary,
      rating,
      completed
    };
  }

  private buildObjectiveProgress(objective: LevelObjective, snapshot: SnakeSnapshot): LevelObjectiveProgress {
    let current = 0;
    let status: ObjectiveStatus = "pending";
    switch (objective.metric) {
      case "score":
        current = snapshot.score;
        break;
      case "foods":
        current = snapshot.foodsEaten;
        break;
      case "combo":
        current = snapshot.maxCombo;
        break;
      case "surviveMs":
        current = snapshot.elapsedMs;
        break;
      case "bossHits":
        current = this.runMetrics.bossHits;
        break;
      case "bossDefeat":
        current = this.runMetrics.bossDefeated ? 1 : 0;
        break;
      case "noPause":
        current = this.runMetrics.pauseCount === 0 ? 1 : 0;
        if (this.runMetrics.pauseCount > 0) {
          status = "failed";
        }
        break;
    }

    if (current >= objective.target && status !== "failed") {
      status = "completed";
    } else if (
      status === "pending" &&
      snapshot.status !== "playing" &&
      snapshot.status !== "paused" &&
      objective.metric !== "noPause"
    ) {
      status = "failed";
    }

    return {
      ...objective,
      current,
      status
    };
  }

  private computeRating(level: LevelDefinition, score: number): RatingRank {
    if (score >= level.ratingThresholds.S) return "S";
    if (score >= level.ratingThresholds.Gold) return "Gold";
    if (score >= level.ratingThresholds.Silver) return "Silver";
    return "Bronze";
  }

  private updateBossState(ate: boolean): {
    bossDamaged: boolean;
    bossDefeated: boolean;
    bossPhaseChanged?: StepEvent["bossPhaseChanged"];
    scoreBonus: number;
    bookmarkLabel?: string;
  } {
    if (!this.currentLevel?.boss) {
      return { bossDamaged: false, bossDefeated: false, scoreBonus: 0 };
    }

    if (this.boss.phase === "dormant" && this.score >= this.boss.introScore) {
      this.enterBossWarning();
      return {
        bossDamaged: false,
        bossDefeated: false,
        bossPhaseChanged: "warning",
        scoreBonus: 0,
        bookmarkLabel: `${this.boss.name} 锁定`
      };
    }

    if (this.boss.phase === "warning") {
      this.boss.turnsUntilShift -= 1;
      if (this.boss.turnsUntilShift <= 0) {
        this.activateBoss();
        return {
          bossDamaged: false,
          bossDefeated: false,
          bossPhaseChanged: "active",
          scoreBonus: 0,
          bookmarkLabel: `${this.boss.name} 出击`
        };
      }
      return { bossDamaged: false, bossDefeated: false, scoreBonus: 0 };
    }

    if (this.boss.phase !== "active") {
      return { bossDamaged: false, bossDefeated: false, scoreBonus: 0 };
    }

    let scoreBonus = 0;
    let bossDamaged = false;
    let bossDefeated = false;
    let bookmarkLabel: string | undefined;

    if (ate) {
      this.boss.hp -= 1;
      this.runMetrics.bossHits += 1;
      bossDamaged = true;
      bookmarkLabel = `${this.boss.name} 受击`;
      if (this.boss.hp <= 0) {
        this.boss.phase = "defeated";
        this.boss.hazardCells = [];
        this.boss.warningCells = [];
        this.boss.safeCells = [];
        this.boss.attackLabel = "核心熄灭";
        this.runMetrics.bossDefeated = true;
        bossDefeated = true;
        scoreBonus = this.currentLevel.boss.bonusScore;
        this.score += scoreBonus;
        this.frenzyMs = Math.max(this.frenzyMs, FRENZY_DURATION_MS + 1000);
        this.runMetrics.frenzyActivations += 1;
        bookmarkLabel = `${this.boss.name} 击破`;
        return {
          bossDamaged,
          bossDefeated,
          bossPhaseChanged: "defeated",
          scoreBonus,
          bookmarkLabel
        };
      }
      this.boss.enraged = this.boss.hp <= 1;
    }

    this.boss.turnsUntilShift -= 1;
    if (this.boss.turnsUntilShift <= 0) {
      this.enterBossWarning();
      return {
        bossDamaged,
        bossDefeated,
        bossPhaseChanged: "warning",
        scoreBonus,
        bookmarkLabel: bookmarkLabel ?? `${this.boss.name} 转场`
      };
    }

    return { bossDamaged, bossDefeated, scoreBonus, bookmarkLabel };
  }

  private enterBossWarning(): void {
    const core = this.pickBossCore();
    const pattern = this.buildBossPattern(core, "warning");
    this.boss.phase = "warning";
    this.boss.core = core;
    this.boss.warningCells = pattern.warningCells;
    this.boss.hazardCells = [];
    this.boss.safeCells = pattern.safeCells;
    this.boss.turnsUntilShift = 2;
    this.boss.attackLabel = this.boss.kind === "gravity-knot" ? "安全区收缩预警" : "危险区预警";
  }

  private activateBoss(): void {
    const core = this.boss.core ?? this.pickBossCore();
    const pattern = this.buildBossPattern(core, "active");
    this.boss.phase = "active";
    this.boss.core = core;
    this.boss.warningCells = pattern.warningCells;
    this.boss.hazardCells = pattern.hazardCells;
    this.boss.safeCells = pattern.safeCells;
    this.boss.turnsUntilShift = this.currentLevel?.boss?.moveEveryTurns ?? 3;
    this.boss.attackLabel =
      this.boss.kind === "laser-lattice"
        ? "整列扫线"
        : this.boss.kind === "gravity-knot"
          ? "安全区坍缩"
          : "十字电场";
  }

  private pickBossCore(): Cell {
    const rng = mulberry32(this.runSeed + this.steps * 17 + this.score * 13);
    const candidates: Cell[] = [];
    for (let x = INNER_MIN + 1; x <= INNER_MAX - 1; x += 1) {
      for (let y = INNER_MIN + 1; y <= INNER_MAX - 1; y += 1) {
        const cell = { x, y };
        const reserved = this.buildBossPattern(cell, "warning").warningCells;
        const overlaps = reserved.some(
          (entry) =>
            this.obstacles.some((obstacle) => obstacle.x === entry.x && obstacle.y === entry.y) ||
            this.snake.some((segment) => segment.x === entry.x && segment.y === entry.y)
        );
        if (!overlaps) {
          candidates.push(cell);
        }
      }
    }
    return candidates[Math.floor(rng() * candidates.length)] ?? { x: 10, y: 10 };
  }

  private buildBossPattern(core: Cell, stage: "warning" | "active"): Pick<BossPatternState, "warningCells" | "hazardCells" | "safeCells"> {
    if (this.boss.kind === "laser-lattice") {
      const cells: Cell[] = [];
      for (let x = INNER_MIN; x <= INNER_MAX; x += 1) {
        cells.push({ x, y: core.y });
      }
      for (let y = INNER_MIN; y <= INNER_MAX; y += 1) {
        cells.push({ x: core.x, y });
      }
      const unique = cells.filter((cell, index) => cells.findIndex((entry) => entry.x === cell.x && entry.y === cell.y) === index);
      return {
        warningCells: stage === "warning" ? unique : [],
        hazardCells: stage === "active" ? unique : [],
        safeCells: []
      };
    }

    if (this.boss.kind === "gravity-knot") {
      const radius = stage === "warning" ? 7 - this.runMetrics.bossHits : 6 - this.runMetrics.bossHits;
      const safeCells: Cell[] = [];
      const hazardCells: Cell[] = [];
      const warningCells: Cell[] = [];
      for (let x = INNER_MIN; x <= INNER_MAX; x += 1) {
        for (let y = INNER_MIN; y <= INNER_MAX; y += 1) {
          const cell = { x, y };
          const distance = Math.max(Math.abs(x - core.x), Math.abs(y - core.y));
          if (distance <= radius) {
            safeCells.push(cell);
          } else if (stage === "active") {
            hazardCells.push(cell);
          } else if (distance === radius + 1) {
            warningCells.push(cell);
          }
        }
      }
      return { warningCells, hazardCells, safeCells };
    }

    const offsets = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 }
    ];
    const cross = offsets
      .map((offset) => ({ x: core.x + offset.x, y: core.y + offset.y }))
      .filter((cell) => cell.x >= INNER_MIN && cell.x <= INNER_MAX && cell.y >= INNER_MIN && cell.y <= INNER_MAX);
    return {
      warningCells: stage === "warning" ? cross : [],
      hazardCells: stage === "active" ? cross : [],
      safeCells: []
    };
  }

  private getReservedBossCells(): Cell[] {
    if (this.boss.phase === "warning") {
      return this.boss.warningCells;
    }
    return [];
  }

  private getActiveHazardCells(): Cell[] {
    if (this.boss.phase !== "active") return [];
    return this.boss.hazardCells;
  }

  private finishRun(status: GameStatus, message: string, baseEvent: StepEvent): void {
    this.status = status;
    this.lastCrashReason = message;
    this.comboWindowMs = 0;
    this.frenzyMs = 0;
    this.finalizePersistentState(status === "victory");
    this.notify(baseEvent);
  }

  private finalizePersistentState(victory: boolean): void {
    this.career = {
      ...this.career,
      totalRuns: this.career.totalRuns + 1,
      totalScore: this.career.totalScore + this.score,
      totalFoods: this.career.totalFoods + this.foodsEaten,
      totalPlayTimeMs: this.career.totalPlayTimeMs + this.elapsedMs,
      bestComboEver: Math.max(this.career.bestComboEver, this.maxCombo),
      longestRunMs: Math.max(this.career.longestRunMs, this.elapsedMs),
      unlockedAchievementIds: [...this.career.unlockedAchievementIds]
    };
    this.syncAchievements();
    writeCareerStats(this.career);

    if (!this.currentLevel) {
      return;
    }

    const record = this.campaign.levels[this.currentLevel.id] ?? {
      unlocked: true,
      completed: false,
      bestRating: null,
      bestScore: 0,
      bestTimeMs: null,
      bestCombo: 0,
      plays: 0
    };
    const rating = victory ? this.computeRating(this.currentLevel, this.score) : record.bestRating;
    const updated: CampaignLevelProgress = {
      unlocked: true,
      completed: record.completed || victory,
      bestRating:
        victory && compareRatings(rating, record.bestRating) > 0 ? rating : record.bestRating,
      bestScore: Math.max(record.bestScore, this.score),
      bestTimeMs:
        victory && (record.bestTimeMs === null || this.elapsedMs < record.bestTimeMs)
          ? this.elapsedMs
          : record.bestTimeMs,
      bestCombo: Math.max(record.bestCombo, this.maxCombo),
      plays: record.plays + 1
    };
    this.campaign.levels[this.currentLevel.id] = updated;
    this.campaign.recentLevelId = this.currentLevel.id;

    if (victory) {
      const currentIndex = CAMPAIGN_LEVELS.findIndex((level) => level.id === this.currentLevel?.id);
      const nextLevel = CAMPAIGN_LEVELS[currentIndex + 1];
      if (nextLevel && this.campaign.levels[nextLevel.id]) {
        this.campaign.levels[nextLevel.id].unlocked = true;
      }
      const existingReplay = this.storedReplays[this.currentLevel.id];
      const nextSummary = this.buildReplaySummary();
      const shouldStoreReplay =
        !existingReplay ||
        compareRatings(nextSummary.rating, existingReplay.summary.rating) > 0 ||
        (nextSummary.rating === existingReplay.summary.rating &&
          nextSummary.score > existingReplay.summary.score) ||
        (nextSummary.rating === existingReplay.summary.rating &&
          nextSummary.score === existingReplay.summary.score &&
          nextSummary.durationMs < existingReplay.summary.durationMs);
      if (shouldStoreReplay) {
        this.storedReplays[this.currentLevel.id] = this.serializeCampaignReplay(nextSummary);
        writeStoredCampaignReplays(this.storedReplays);
      }
    }

    this.campaign.seasonChallenges = computeSeasonChallenges(this.campaign.levels);
    writeCampaignProgress(this.campaign);
  }

  private buildReplaySummary(): ReplaySummary {
    return {
      score: this.score,
      foodsEaten: this.foodsEaten,
      maxCombo: this.maxCombo,
      durationMs: this.elapsedMs,
      route: this.route,
      modeId: (this.currentLevel ? this.currentLevel.runtime.modeId : this.mode.id),
      levelId: this.currentLevel?.id ?? null,
      levelTitle: this.currentLevel?.title ?? null,
      rating: this.currentLevel ? this.computeRating(this.currentLevel, this.score) : null,
      challengeTitle: this.getSnapshot().challenge?.title ?? null,
      challengeCompleted: this.getSnapshot().challenge?.status === "completed",
      bookmarks: this.replayBookmarks.map((bookmark) => ({ ...bookmark }))
    };
  }

  private serializeCampaignReplay(summary: ReplaySummary): StoredCampaignReplayRun {
    return {
      id: ++this.replaySerial,
      summary: { ...summary, bookmarks: summary.bookmarks.map((bookmark) => ({ ...bookmark })) },
      frames: this.replayFrames.map((frame) => ({
        snake: frame.snapshot.snake.map(cloneCell),
        food: cloneFood(frame.snapshot.food),
        direction: frame.snapshot.direction,
        pendingDirection: frame.snapshot.pendingDirection,
        score: frame.snapshot.score,
        foodsEaten: frame.snapshot.foodsEaten,
        steps: frame.snapshot.steps,
        combo: frame.snapshot.combo,
        maxCombo: frame.snapshot.maxCombo,
        elapsedMs: frame.snapshot.elapsedMs,
        status: frame.snapshot.status,
        tickMs: frame.snapshot.tickMs,
        passiveGrowIn: frame.snapshot.passiveGrowIn,
        bonusGrowthCharges: frame.snapshot.bonusGrowthCharges,
        frenzyMs: frame.snapshot.frenzyMs,
        lastCrashReason: frame.snapshot.lastCrashReason,
        boss: cloneBoss(frame.snapshot.boss),
        level: cloneLevelState(frame.snapshot.level)
      }))
    };
  }

  private syncAchievements(): string[] {
    const snapshot = this.getSnapshot();
    const unlockedIds: string[] = [];
    for (const achievement of ACHIEVEMENT_DEFS) {
      if (this.career.unlockedAchievementIds.includes(achievement.id)) continue;
      if (achievement.isUnlocked(snapshot)) {
        this.career.unlockedAchievementIds.push(achievement.id);
        unlockedIds.push(achievement.id);
      }
    }
    return unlockedIds;
  }

  private evaluateChallenge(snapshot: SnakeSnapshot): ChallengeState {
    const definition = challengeById(this.selectedChallengeId);
    if (definition.id === "steady-nerve") {
      const completed = snapshot.score >= 120 && this.runMetrics.pauseCount === 0;
      const failed = this.runMetrics.pauseCount > 0 && !completed;
      return {
        ...definition,
        current: Math.min(snapshot.score, 120),
        target: 120,
        status: completed ? "completed" : failed ? "failed" : "running",
        progressLabel: failed ? "本局已暂停，挑战失败" : `${Math.min(snapshot.score, 120)} / 120 分`
      };
    }
    if (definition.id === "frenzy-conductor") {
      const completed = this.runMetrics.frenzyActivations >= 2;
      return {
        ...definition,
        current: Math.min(this.runMetrics.frenzyActivations, 2),
        target: 2,
        status: completed ? "completed" : snapshot.status === "gameover" ? "failed" : "running",
        progressLabel: `${Math.min(this.runMetrics.frenzyActivations, 2)} / 2 次狂热`
      };
    }
    if (definition.id === "boss-breaker") {
      const completed = this.runMetrics.bossDefeated;
      return {
        ...definition,
        current: Math.min(this.runMetrics.bossHits, this.currentLevel?.boss?.hp ?? 3),
        target: this.currentLevel?.boss?.hp ?? 3,
        status: completed ? "completed" : snapshot.status === "gameover" ? "failed" : "running",
        progressLabel: completed ? "Boss 已击破" : `${this.runMetrics.bossHits} 次命中`
      };
    }
    if (snapshot.mode.id !== "inferno") {
      return {
        ...definition,
        current: 0,
        target: 12,
        status: "inactive",
        progressLabel: definition.modeHint ?? "当前模式下不生效"
      };
    }
    const completed = snapshot.foodsEaten >= 12;
    return {
      ...definition,
      current: Math.min(snapshot.foodsEaten, 12),
      target: 12,
      status: completed ? "completed" : snapshot.status === "gameover" ? "failed" : "running",
      progressLabel: `${Math.min(snapshot.foodsEaten, 12)} / 12 个食物`
    };
  }

  private notify(event: StepEvent): void {
    const snapshot = this.getSnapshot();

    if (event.bookmarkLabel) {
      this.replayBookmarks.push({
        type: event.victory
          ? "victory"
          : event.crashed
            ? "death"
            : event.bossDefeated
              ? "boss-defeat"
              : event.bossDamaged
                ? "boss-hit"
                : event.bossPhaseChanged === "warning"
                  ? "boss-warning"
                  : event.challengeCompleted
                    ? "objective"
                    : "milestone",
        label: event.bookmarkLabel,
        frameIndex: this.replayFrames.length,
        elapsedMs: snapshot.elapsedMs
      });
    }

    if (this.replayRecording) {
      this.replayFrames.push({
        snapshot: deepCloneSnapshot(snapshot),
        event: { ...event },
        elapsedMs: snapshot.elapsedMs
      });
      if (snapshot.status === "gameover" || snapshot.status === "victory") {
        const summary = this.buildReplaySummary();
        this.lastReplayRun = {
          id: ++this.replaySerial,
          frames: this.replayFrames.map((frame) => ({
            snapshot: deepCloneSnapshot(frame.snapshot),
            event: { ...frame.event },
            elapsedMs: frame.elapsedMs
          })),
          summary
        };
        const highlightFrames = this.lastReplayRun.frames.filter(
          (frame) => frame.elapsedMs >= Math.max(0, snapshot.elapsedMs - 10_000)
        );
        this.lastHighlightRun = {
          id: ++this.replaySerial,
          frames: highlightFrames,
          summary: {
            ...summary,
            bookmarks: summary.bookmarks.filter(
              (bookmark) => bookmark.elapsedMs >= Math.max(0, snapshot.elapsedMs - 10_000)
            )
          }
        };
        this.replayRecording = false;
      }
    }

    this.listeners.forEach((listener) => listener(snapshot, event));
  }
}
