import type { Direction, GameMode, GameModeId, GameStatus } from "../config";

export interface Cell {
  x: number;
  y: number;
}

export type GameRoute = "sandbox" | "campaign";

export type FoodKind = "normal" | "combo" | "surge" | "growth";

export type BossPatternKind = "none" | "pulse-core" | "laser-lattice" | "gravity-knot";

export type BossPhase = "dormant" | "warning" | "active" | "defeated";

export type ChallengeStatus = "inactive" | "running" | "completed" | "failed";

export type ObjectiveStatus = "pending" | "completed" | "failed";

export type RatingRank = "Bronze" | "Silver" | "Gold" | "S";

export type ReplayBookmarkType =
  | "boss-warning"
  | "boss-hit"
  | "boss-defeat"
  | "objective"
  | "milestone"
  | "death"
  | "victory";

export interface FoodState extends Cell {
  kind: FoodKind;
  label: string;
  baseValue: number;
}

export interface AchievementState {
  id: string;
  title: string;
  description: string;
  unlocked: boolean;
}

export interface CareerStats {
  totalRuns: number;
  totalScore: number;
  totalFoods: number;
  totalPlayTimeMs: number;
  bestComboEver: number;
  longestRunMs: number;
  unlockedAchievementIds: string[];
}

export interface BossPatternState {
  kind: BossPatternKind;
  phase: BossPhase;
  name: string;
  introScore: number;
  hp: number;
  maxHp: number;
  core: Cell | null;
  warningCells: Cell[];
  hazardCells: Cell[];
  safeCells: Cell[];
  turnsUntilShift: number;
  attackLabel: string;
  enraged: boolean;
}

export interface LevelObjective {
  id: string;
  label: string;
  description: string;
  metric: "score" | "foods" | "combo" | "surviveMs" | "bossHits" | "bossDefeat" | "noPause";
  target: number;
}

export interface LevelObjectiveProgress extends LevelObjective {
  current: number;
  status: ObjectiveStatus;
}

export interface LevelBossDefinition {
  kind: BossPatternKind;
  name: string;
  introScore: number;
  hp: number;
  moveEveryTurns: number;
  bonusScore: number;
}

export interface LevelRuntimeConfig {
  modeId: GameModeId;
  baseTickMs: number;
  minTickMs: number;
  speedRamp: number;
  growEvery: number;
  targetScore: number;
  timeLimitMs?: number;
  pauseLimit?: number;
  foodWeights?: Partial<Record<FoodKind, number>>;
}

export interface LevelDefinition {
  id: string;
  chapterId: string;
  chapterIndex: number;
  order: number;
  title: string;
  subtitle: string;
  description: string;
  accent: string;
  secondary: string;
  runtime: LevelRuntimeConfig;
  startSnake: Cell[];
  obstacles: Cell[];
  primaryObjective: LevelObjective;
  secondaryObjectives: LevelObjective[];
  failConditions: string[];
  ratingThresholds: Record<RatingRank, number>;
  boss: LevelBossDefinition | null;
}

export interface ChapterDefinition {
  id: string;
  index: number;
  title: string;
  subtitle: string;
  accent: string;
  secondary: string;
  levels: LevelDefinition[];
}

export interface ChallengeDefinition {
  id: string;
  title: string;
  description: string;
  reward: string;
  modeHint?: string;
}

export interface ChallengeState extends ChallengeDefinition {
  current: number;
  target: number;
  status: ChallengeStatus;
  progressLabel: string;
}

export interface ReplayBookmark {
  type: ReplayBookmarkType;
  label: string;
  frameIndex: number;
  elapsedMs: number;
}

export interface CampaignLevelProgress {
  unlocked: boolean;
  completed: boolean;
  bestRating: RatingRank | null;
  bestScore: number;
  bestTimeMs: number | null;
  bestCombo: number;
  plays: number;
}

export interface SeasonChallengeProgress {
  id: string;
  title: string;
  description: string;
  reward: string;
  current: number;
  target: number;
  completed: boolean;
}

export interface CampaignProgress {
  levels: Record<string, CampaignLevelProgress>;
  recentLevelId: string | null;
  seasonChallenges: SeasonChallengeProgress[];
}

export interface LevelRunState {
  definition: LevelDefinition;
  elapsedLimitMs: number | null;
  remainingMs: number | null;
  primary: LevelObjectiveProgress;
  secondary: LevelObjectiveProgress[];
  rating: RatingRank;
  completed: boolean;
}

export interface ReplayMeta {
  hasLastRun: boolean;
  hasHighlight: boolean;
  hasBestReplay: boolean;
  framesRecorded: number;
}

export interface SnakeSnapshot {
  boardSize: number;
  route: GameRoute;
  snake: Cell[];
  food: FoodState;
  obstacles: Cell[];
  direction: Direction;
  pendingDirection: Direction;
  score: number;
  scoreMultiplier: number;
  bestScore: number;
  foodsEaten: number;
  steps: number;
  combo: number;
  maxCombo: number;
  elapsedMs: number;
  status: GameStatus;
  mode: GameMode;
  tickMs: number;
  passiveGrowIn: number;
  bonusGrowthCharges: number;
  frenzyMs: number;
  lastCrashReason: string | null;
  streakWindowMs: number;
  runSeed: number;
  achievements: AchievementState[];
  career: CareerStats;
  boss: BossPatternState;
  challenge: ChallengeState | null;
  replay: ReplayMeta;
  level: LevelRunState | null;
  campaign: CampaignProgress;
}

export interface StepEvent {
  type: "reset" | "step" | "pause" | "mode";
  ate?: boolean;
  grew?: boolean;
  crashed?: boolean;
  victory?: boolean;
  newBest?: boolean;
  crashReason?: string | null;
  scoreDelta?: number;
  frenzyStarted?: boolean;
  foodKind?: FoodKind;
  unlockedIds?: string[];
  bossPhaseChanged?: BossPhase;
  bossDamaged?: boolean;
  bossDefeated?: boolean;
  challengeStatusChanged?: ChallengeStatus;
  challengeCompleted?: boolean;
  challengeFailed?: boolean;
  bookmarkLabel?: string;
}

export interface ReplayFrame {
  snapshot: SnakeSnapshot;
  event: StepEvent;
  elapsedMs: number;
}

export interface ReplaySummary {
  score: number;
  foodsEaten: number;
  maxCombo: number;
  durationMs: number;
  route: GameRoute;
  modeId: GameModeId;
  levelId: string | null;
  levelTitle: string | null;
  rating: RatingRank | null;
  challengeTitle: string | null;
  challengeCompleted: boolean;
  bookmarks: ReplayBookmark[];
}

export interface ReplayRun {
  id: number;
  frames: ReplayFrame[];
  summary: ReplaySummary;
}

export type EngineListener = (snapshot: SnakeSnapshot, event: StepEvent) => void;
