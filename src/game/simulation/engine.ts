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
  OPPOSITE_DIRECTION,
  SCORE_PER_FOOD
} from "../config";
import type { Cell, EngineListener, SnakeSnapshot, StepEvent } from "./types";

const STORAGE_KEY = "neon-snake-best-scores";
const COMBO_WINDOW_MS = 3800;

function cloneCell(cell: Cell): Cell {
  return { x: cell.x, y: cell.y };
}

function cellKey(cell: Cell): string {
  return `${cell.x},${cell.y}`;
}

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let value = Math.imul(t ^ (t >>> 15), 1 | t);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function readBestScores(): Record<GameModeId, number> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
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
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(scores));
}

export class SnakeEngine {
  private listeners = new Set<EngineListener>();

  private status: GameStatus = "idle";

  private mode: GameMode = GAME_MODES.arcade;

  private snake: Cell[] = [];

  private obstacles: Cell[] = [];

  private food: Cell = { x: 10, y: 4 };

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

  private bestScores = readBestScores();

  private lastCrashReason: string | null = null;

  private tickMs = GAME_MODES.arcade.baseTickMs;

  private runSeed = Math.floor(Math.random() * 1_000_000);

  subscribe(listener: EngineListener): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot(), { type: "reset" });
    return () => this.listeners.delete(listener);
  }

  setMode(modeId: GameModeId): void {
    this.mode = GAME_MODES[modeId];
    this.bestScores = readBestScores();
    this.notify({ type: "mode" });
  }

  getSnapshot(): SnakeSnapshot {
    const stepsIntoCycle = this.steps % this.mode.growEvery;
    return {
      boardSize: BOARD_SIZE,
      snake: this.snake.map(cloneCell),
      food: cloneCell(this.food),
      obstacles: this.obstacles.map(cloneCell),
      direction: this.direction,
      pendingDirection: this.pendingDirection,
      score: this.score,
      bestScore: this.bestScores[this.mode.id] ?? 0,
      foodsEaten: this.foodsEaten,
      steps: this.steps,
      combo: this.combo,
      maxCombo: this.maxCombo,
      elapsedMs: this.elapsedMs,
      status: this.status,
      mode: this.mode,
      tickMs: this.tickMs,
      passiveGrowIn:
        stepsIntoCycle === 0 ? this.mode.growEvery : this.mode.growEvery - stepsIntoCycle,
      lastCrashReason: this.lastCrashReason,
      streakWindowMs: this.comboWindowMs,
      runSeed: this.runSeed
    };
  }

  startNewRun(): void {
    this.status = "playing";
    this.accumulatorMs = 0;
    this.elapsedMs = 0;
    this.score = 0;
    this.foodsEaten = 0;
    this.steps = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.comboWindowMs = 0;
    this.direction = "up";
    this.pendingDirection = "up";
    this.tickMs = this.mode.baseTickMs;
    this.lastCrashReason = null;
    this.runSeed = Math.floor(Math.random() * 1_000_000);
    this.snake = [
      { x: 10, y: 11 },
      { x: 10, y: 12 },
      { x: 10, y: 13 }
    ];
    this.obstacles = this.generateObstacles(this.runSeed);
    this.food = this.spawnFood(this.runSeed + 77);
    this.notify({ type: "reset" });
  }

  togglePause(): void {
    if (this.status === "playing") {
      this.status = "paused";
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
    const reference = this.pendingDirection;
    if (next === reference) return;
    if (OPPOSITE_DIRECTION[reference] === next) return;
    this.pendingDirection = next;
  }

  update(deltaMs: number): void {
    if (this.status !== "playing") return;
    this.elapsedMs += deltaMs;
    this.accumulatorMs += deltaMs;
    this.comboWindowMs = Math.max(0, this.comboWindowMs - deltaMs);
    if (this.comboWindowMs <= 0) {
      this.combo = 0;
    }

    while (this.accumulatorMs >= this.tickMs && this.status === "playing") {
      this.accumulatorMs -= this.tickMs;
      this.step();
    }
  }

  private step(): void {
    if (OPPOSITE_DIRECTION[this.direction] !== this.pendingDirection) {
      this.direction = this.pendingDirection;
    }

    const vector = DIRECTION_VECTORS[this.direction];
    const currentHead = this.snake[0];
    const nextHead = { x: currentHead.x + vector.x, y: currentHead.y + vector.y };
    const ate = nextHead.x === this.food.x && nextHead.y === this.food.y;
    const passiveGrowth = (this.steps + 1) % this.mode.growEvery === 0;
    const grew = ate || passiveGrowth;

    if (this.isCollision(nextHead, grew)) {
      this.status = "gameover";
      this.lastCrashReason = this.describeCrash(nextHead);
      this.comboWindowMs = 0;
      this.notify({ type: "step", crashed: true, crashReason: this.lastCrashReason });
      return;
    }

    const nextSnake = [nextHead, ...this.snake.map(cloneCell)];
    if (!grew) {
      nextSnake.pop();
    }
    this.snake = nextSnake;
    this.steps += 1;

    let newBest = false;
    if (ate) {
      this.score += SCORE_PER_FOOD;
      this.foodsEaten += 1;
      this.combo = this.comboWindowMs > 0 ? this.combo + 1 : 1;
      this.maxCombo = Math.max(this.maxCombo, this.combo);
      this.comboWindowMs = COMBO_WINDOW_MS;
      if (this.score > (this.bestScores[this.mode.id] ?? 0)) {
        this.bestScores[this.mode.id] = this.score;
        writeBestScores(this.bestScores);
        newBest = true;
      }
      this.food = this.spawnFood(this.runSeed + this.steps * 13 + this.foodsEaten * 23);
    }

    this.tickMs = Math.max(
      this.mode.minTickMs,
      this.mode.baseTickMs - Math.floor(this.score / 10) * this.mode.speedRamp
    );
    this.notify({ type: "step", ate, grew, newBest });
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

    const bodyToCheck = grew ? this.snake : this.snake.slice(0, -1);
    return bodyToCheck.some((cell) => cell.x === nextHead.x && cell.y === nextHead.y);
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
      return "撞上了障碍核心";
    }
    return "咬到了自己的尾迹";
  }

  private generateObstacles(seed: number): Cell[] {
    const rng = mulberry32(seed + this.mode.growEvery * 97);
    const occupied = new Set(this.snake.map(cellKey));
    const obstacles: Cell[] = [];

    while (obstacles.length < OBSTACLE_COUNT) {
      const candidate = {
        x: INNER_MIN + Math.floor(rng() * (INNER_MAX - INNER_MIN + 1)),
        y: INNER_MIN + Math.floor(rng() * (INNER_MAX - INNER_MIN + 1))
      };
      if (occupied.has(cellKey(candidate))) continue;
      if (
        Math.abs(candidate.x - this.snake[0].x) + Math.abs(candidate.y - this.snake[0].y) <
        4
      ) {
        continue;
      }
      occupied.add(cellKey(candidate));
      obstacles.push(candidate);
    }

    return obstacles;
  }

  private spawnFood(seed: number): Cell {
    const rng = mulberry32(seed + this.mode.targetScore);
    const occupied = new Set([
      ...this.snake.map(cellKey),
      ...this.obstacles.map(cellKey)
    ]);
    const available: Cell[] = [];

    for (let x = INNER_MIN; x <= INNER_MAX; x += 1) {
      for (let y = INNER_MIN; y <= INNER_MAX; y += 1) {
        const cell = { x, y };
        if (!occupied.has(cellKey(cell))) {
          available.push(cell);
        }
      }
    }

    if (available.length === 0) {
      return { x: INNER_MIN, y: INNER_MIN };
    }

    return available[Math.floor(rng() * available.length)];
  }

  private notify(event: StepEvent): void {
    const snapshot = this.getSnapshot();
    this.listeners.forEach((listener) => listener(snapshot, event));
  }
}
