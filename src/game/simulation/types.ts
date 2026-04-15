import type { Direction, GameMode, GameStatus } from "../config";

export interface Cell {
  x: number;
  y: number;
}

export interface SnakeSnapshot {
  boardSize: number;
  snake: Cell[];
  food: Cell;
  obstacles: Cell[];
  direction: Direction;
  pendingDirection: Direction;
  score: number;
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
  lastCrashReason: string | null;
  streakWindowMs: number;
  runSeed: number;
}

export interface StepEvent {
  type: "reset" | "step" | "pause" | "mode";
  ate?: boolean;
  grew?: boolean;
  crashed?: boolean;
  newBest?: boolean;
  crashReason?: string | null;
}

export type EngineListener = (snapshot: SnakeSnapshot, event: StepEvent) => void;
