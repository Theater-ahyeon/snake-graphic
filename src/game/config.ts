export const BOARD_SIZE = 20;
export const INNER_MIN = 1;
export const INNER_MAX = BOARD_SIZE - 2;
export const OBSTACLE_COUNT = 10;
export const SCORE_PER_FOOD = 10;

export type Direction = "up" | "down" | "left" | "right";
export type GameStatus = "idle" | "playing" | "paused" | "gameover" | "victory";
export type GameModeId = "zen" | "arcade" | "inferno";

export interface GameMode {
  id: GameModeId;
  name: string;
  tagline: string;
  description: string;
  accent: string;
  secondary: string;
  baseTickMs: number;
  minTickMs: number;
  speedRamp: number;
  growEvery: number;
  targetScore: number;
}

export const DIRECTION_VECTORS: Record<Direction, { x: number; y: number }> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 }
};

export const OPPOSITE_DIRECTION: Record<Direction, Direction> = {
  up: "down",
  down: "up",
  left: "right",
  right: "left"
};

export const GAME_MODES: Record<GameModeId, GameMode> = {
  zen: {
    id: "zen",
    name: "Zen Bloom",
    tagline: "优雅推进，适合展示细节与长线运营。",
    description:
      "基础速度更从容，被动增长节奏也更平滑，适合稳稳铺开蛇身并观察界面特效。",
    accent: "#00f5d4",
    secondary: "#7ae582",
    baseTickMs: 180,
    minTickMs: 95,
    speedRamp: 2.2,
    growEvery: 14,
    targetScore: 180
  },
  arcade: {
    id: "arcade",
    name: "Arcade Pulse",
    tagline: "节奏饱满，演示手感与策略的平衡版本。",
    description:
      "速度和增长均衡推进，更像正式课程展示中的主力模式，适合录屏和答辩演示。",
    accent: "#ffb703",
    secondary: "#ff7b00",
    baseTickMs: 145,
    minTickMs: 78,
    speedRamp: 3.1,
    growEvery: 10,
    targetScore: 220
  },
  inferno: {
    id: "inferno",
    name: "Inferno Grid",
    tagline: "高压高回报，追求强烈视觉冲击与极限反应。",
    description:
      "更快的节奏、更频繁的体型增长，配合更激进的光效与危险反馈，观赏性最强。",
    accent: "#ff4d6d",
    secondary: "#ffd166",
    baseTickMs: 120,
    minTickMs: 62,
    speedRamp: 4,
    growEvery: 7,
    targetScore: 260
  }
};

export const DEFAULT_MODE: GameModeId = "arcade";
