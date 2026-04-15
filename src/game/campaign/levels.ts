import { GAME_MODES } from "../config";
import type {
  Cell,
  ChapterDefinition,
  FoodKind,
  LevelBossDefinition,
  LevelDefinition,
  LevelObjective,
  RatingRank
} from "../simulation/types";

function hLine(y: number, fromX: number, toX: number): Cell[] {
  const cells: Cell[] = [];
  for (let x = fromX; x <= toX; x += 1) {
    cells.push({ x, y });
  }
  return cells;
}

function vLine(x: number, fromY: number, toY: number): Cell[] {
  const cells: Cell[] = [];
  for (let y = fromY; y <= toY; y += 1) {
    cells.push({ x, y });
  }
  return cells;
}

function cluster(points: Array<[number, number]>): Cell[] {
  return points.map(([x, y]) => ({ x, y }));
}

function uniqueCells(cells: Cell[]): Cell[] {
  const seen = new Set<string>();
  return cells.filter((cell) => {
    const key = `${cell.x},${cell.y}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function objective(
  id: string,
  label: string,
  description: string,
  metric: LevelObjective["metric"],
  target: number
): LevelObjective {
  return { id, label, description, metric, target };
}

function ratings(bronze: number, silver: number, gold: number, s: number): Record<RatingRank, number> {
  return { Bronze: bronze, Silver: silver, Gold: gold, S: s };
}

function boss(kind: LevelBossDefinition["kind"], name: string, introScore: number, hp: number, moveEveryTurns: number, bonusScore: number): LevelBossDefinition {
  return { kind, name, introScore, hp, moveEveryTurns, bonusScore };
}

function weights(values: Partial<Record<FoodKind, number>>): Partial<Record<FoodKind, number>> {
  return values;
}

const chapterOneLevels: LevelDefinition[] = [
  {
    id: "1-1",
    chapterId: "calibration-sector",
    chapterIndex: 1,
    order: 1,
    title: "基础冲刺",
    subtitle: "熟悉竞技征程的推进节奏",
    description: "以稳定路线和基础得分完成第一关，适合作为演示开场。",
    accent: "#45f0df",
    secondary: "#f8c34a",
    runtime: {
      modeId: GAME_MODES.arcade.id,
      baseTickMs: 150,
      minTickMs: 84,
      speedRamp: 2.8,
      growEvery: 10,
      targetScore: 90,
      timeLimitMs: 95_000
    },
    startSnake: [
      { x: 10, y: 13 },
      { x: 10, y: 14 },
      { x: 10, y: 15 }
    ],
    obstacles: uniqueCells([...cluster([[6, 7], [13, 7], [6, 12], [13, 12]]), ...hLine(9, 8, 11)]),
    primaryObjective: objective("score-90", "冲到 90 分", "达到关卡目标得分即可过关。", "score", 90),
    secondaryObjectives: [
      objective("foods-8", "吃到 8 个食物", "保持基本推进节奏。", "foods", 8),
      objective("combo-4", "连击达到 4", "展示更熟练的节奏控制。", "combo", 4)
    ],
    failConditions: ["撞墙、撞到自己、撞上障碍会失败", "超过 95 秒未达成主目标会失败"],
    ratingThresholds: ratings(90, 120, 150, 180),
    boss: null
  },
  {
    id: "1-2",
    chapterId: "calibration-sector",
    chapterIndex: 1,
    order: 2,
    title: "障碍穿梭",
    subtitle: "在窄缝中建立稳定走位",
    description: "固定障碍形成双回廊，要求更稳定的转向决策。",
    accent: "#45f0df",
    secondary: "#f59e0b",
    runtime: {
      modeId: GAME_MODES.arcade.id,
      baseTickMs: 144,
      minTickMs: 80,
      speedRamp: 3.1,
      growEvery: 9,
      targetScore: 110,
      timeLimitMs: 105_000
    },
    startSnake: [
      { x: 4, y: 15 },
      { x: 4, y: 16 },
      { x: 4, y: 17 }
    ],
    obstacles: uniqueCells([
      ...vLine(7, 4, 15),
      ...vLine(12, 4, 15),
      ...hLine(6, 8, 11),
      ...hLine(13, 8, 11)
    ]),
    primaryObjective: objective("score-110", "冲到 110 分", "在障碍压力下完成稳定推进。", "score", 110),
    secondaryObjectives: [
      objective("combo-5", "连击达到 5", "在复杂路线中维持节奏。", "combo", 5),
      objective("no-pause", "全程不暂停", "以完整竞技节奏通关。", "noPause", 1)
    ],
    failConditions: ["撞墙、撞到自己、撞上障碍会失败", "超过 105 秒未达成主目标会失败"],
    ratingThresholds: ratings(110, 145, 175, 210),
    boss: null
  },
  {
    id: "1-3",
    chapterId: "calibration-sector",
    chapterIndex: 1,
    order: 3,
    title: "连击精度",
    subtitle: "让连续吃果成为评分核心",
    description: "关卡更强调连击窗口，特殊食物出现率更高。",
    accent: "#45f0df",
    secondary: "#ff7ad9",
    runtime: {
      modeId: GAME_MODES.arcade.id,
      baseTickMs: 140,
      minTickMs: 78,
      speedRamp: 3.3,
      growEvery: 8,
      targetScore: 135,
      timeLimitMs: 95_000,
      foodWeights: weights({ normal: 0.45, combo: 0.25, surge: 0.18, growth: 0.12 })
    },
    startSnake: [
      { x: 10, y: 10 },
      { x: 10, y: 11 },
      { x: 10, y: 12 }
    ],
    obstacles: uniqueCells([...hLine(5, 4, 6), ...hLine(5, 13, 15), ...hLine(14, 4, 6), ...hLine(14, 13, 15), ...vLine(10, 6, 8), ...vLine(10, 11, 13)]),
    primaryObjective: objective("combo-6", "连击达到 6", "在本关中至少打出一次高质量连击。", "combo", 6),
    secondaryObjectives: [
      objective("score-150", "得分达到 150", "在连击之外保持高分表现。", "score", 150),
      objective("foods-10", "吃到 10 个食物", "体现完整游玩过程。", "foods", 10)
    ],
    failConditions: ["撞墙、撞到自己、撞上障碍会失败", "超过 95 秒未达成主目标会失败"],
    ratingThresholds: ratings(105, 145, 175, 215),
    boss: null
  },
  {
    id: "1-4",
    chapterId: "calibration-sector",
    chapterIndex: 1,
    order: 4,
    title: "Pulse Core",
    subtitle: "第一章 Boss：十字电场型核心",
    description: "Boss 会周期性生成十字危险区，并在数个回合后迁移位置。",
    accent: "#45f0df",
    secondary: "#ff6b6b",
    runtime: {
      modeId: GAME_MODES.arcade.id,
      baseTickMs: 136,
      minTickMs: 72,
      speedRamp: 3.4,
      growEvery: 8,
      targetScore: 160,
      timeLimitMs: 110_000,
      foodWeights: weights({ normal: 0.52, combo: 0.18, surge: 0.18, growth: 0.12 })
    },
    startSnake: [
      { x: 5, y: 16 },
      { x: 5, y: 17 },
      { x: 5, y: 18 }
    ],
    obstacles: uniqueCells([...cluster([[4, 6], [15, 6], [4, 13], [15, 13]]), ...vLine(9, 4, 6), ...vLine(10, 13, 15)]),
    primaryObjective: objective("boss-defeat", "击破 Pulse Core", "在危险区压迫下完成 Boss 击破。", "bossDefeat", 1),
    secondaryObjectives: [
      objective("score-180", "得分达到 180", "同时拿到高分评级。", "score", 180),
      objective("boss-hits-3", "Boss 命中 3 次", "完整经历一次 Boss 战循环。", "bossHits", 3)
    ],
    failConditions: ["撞墙、撞到自己、撞上障碍或电场会失败", "超过 110 秒未完成 Boss 会失败"],
    ratingThresholds: ratings(150, 185, 220, 260),
    boss: boss("pulse-core", "Pulse Core", 60, 3, 4, 40)
  }
];

const chapterTwoLevels: LevelDefinition[] = [
  {
    id: "2-1",
    chapterId: "overload-circuit",
    chapterIndex: 2,
    order: 1,
    title: "高速回廊",
    subtitle: "以更快基础速度完成推进",
    description: "长走廊与更高速度会持续压迫走位选择。",
    accent: "#ffc85f",
    secondary: "#ff6d3a",
    runtime: {
      modeId: GAME_MODES.arcade.id,
      baseTickMs: 126,
      minTickMs: 68,
      speedRamp: 3.7,
      growEvery: 8,
      targetScore: 155,
      timeLimitMs: 90_000
    },
    startSnake: [
      { x: 3, y: 10 },
      { x: 3, y: 11 },
      { x: 3, y: 12 }
    ],
    obstacles: uniqueCells([...vLine(6, 3, 16), ...vLine(13, 3, 16), ...hLine(9, 7, 12), ...hLine(10, 7, 12)]),
    primaryObjective: objective("score-155", "得分达到 155", "以高速模式完成推进。", "score", 155),
    secondaryObjectives: [
      objective("foods-12", "吃到 12 个食物", "确保在高速节奏下保持稳定进食。", "foods", 12),
      objective("no-pause", "全程不暂停", "完整展现竞技强度。", "noPause", 1)
    ],
    failConditions: ["撞墙、撞到自己、撞上障碍会失败", "超过 90 秒未达成主目标会失败"],
    ratingThresholds: ratings(155, 190, 225, 265),
    boss: null
  },
  {
    id: "2-2",
    chapterId: "overload-circuit",
    chapterIndex: 2,
    order: 2,
    title: "资源争夺",
    subtitle: "特殊食物成为得分关键",
    description: "连击果和脉冲核出现率更高，鼓励主动抢节奏。",
    accent: "#ffc85f",
    secondary: "#ff7ad9",
    runtime: {
      modeId: GAME_MODES.arcade.id,
      baseTickMs: 132,
      minTickMs: 70,
      speedRamp: 3.4,
      growEvery: 8,
      targetScore: 175,
      timeLimitMs: 100_000,
      foodWeights: weights({ normal: 0.35, combo: 0.28, surge: 0.22, growth: 0.15 })
    },
    startSnake: [
      { x: 10, y: 15 },
      { x: 10, y: 16 },
      { x: 10, y: 17 }
    ],
    obstacles: uniqueCells([...cluster([[5, 5], [14, 5], [5, 14], [14, 14]]), ...hLine(9, 5, 7), ...hLine(9, 12, 14), ...vLine(9, 6, 8), ...vLine(10, 11, 13)]),
    primaryObjective: objective("score-175", "得分达到 175", "依赖特殊食物完成高分推进。", "score", 175),
    secondaryObjectives: [
      objective("combo-7", "连击达到 7", "配合特殊食物形成高价值连击。", "combo", 7),
      objective("survive-70", "生存 70 秒", "至少经历一段稳定中盘。", "surviveMs", 70_000)
    ],
    failConditions: ["撞墙、撞到自己、撞上障碍会失败", "超过 100 秒未达成主目标会失败"],
    ratingThresholds: ratings(175, 215, 255, 300),
    boss: null
  },
  {
    id: "2-3",
    chapterId: "overload-circuit",
    chapterIndex: 2,
    order: 3,
    title: "计时压迫",
    subtitle: "倒计时将迫使路线更激进",
    description: "在更严格的计时下快速完成目标，并避免无效绕圈。",
    accent: "#ffc85f",
    secondary: "#ef4444",
    runtime: {
      modeId: GAME_MODES.inferno.id,
      baseTickMs: 122,
      minTickMs: 64,
      speedRamp: 3.9,
      growEvery: 7,
      targetScore: 165,
      timeLimitMs: 72_000,
      foodWeights: weights({ normal: 0.5, combo: 0.2, surge: 0.18, growth: 0.12 })
    },
    startSnake: [
      { x: 15, y: 15 },
      { x: 15, y: 16 },
      { x: 15, y: 17 }
    ],
    obstacles: uniqueCells([...vLine(5, 4, 10), ...vLine(14, 9, 15), ...hLine(6, 8, 12), ...hLine(13, 7, 11)]),
    primaryObjective: objective("score-165", "72 秒内达到 165 分", "以更强压迫完成通关。", "score", 165),
    secondaryObjectives: [
      objective("foods-11", "吃到 11 个食物", "保持效率推进。", "foods", 11),
      objective("combo-6", "连击达到 6", "在高压计时下仍需保持节奏。", "combo", 6)
    ],
    failConditions: ["撞墙、撞到自己、撞上障碍会失败", "倒计时结束仍未达成主目标会失败"],
    ratingThresholds: ratings(165, 205, 240, 285),
    boss: null
  },
  {
    id: "2-4",
    chapterId: "overload-circuit",
    chapterIndex: 2,
    order: 4,
    title: "Laser Lattice",
    subtitle: "第二章 Boss：横纵扫线矩阵",
    description: "Boss 会先标记整行整列，再释放扫线电网。",
    accent: "#ffc85f",
    secondary: "#ff4d6d",
    runtime: {
      modeId: GAME_MODES.inferno.id,
      baseTickMs: 118,
      minTickMs: 60,
      speedRamp: 4,
      growEvery: 7,
      targetScore: 190,
      timeLimitMs: 105_000,
      foodWeights: weights({ normal: 0.48, combo: 0.18, surge: 0.2, growth: 0.14 })
    },
    startSnake: [
      { x: 4, y: 4 },
      { x: 4, y: 5 },
      { x: 4, y: 6 }
    ],
    obstacles: uniqueCells([...cluster([[8, 4], [11, 4], [8, 15], [11, 15]]), ...hLine(8, 4, 6), ...hLine(11, 13, 15), ...vLine(8, 9, 11), ...vLine(11, 8, 10)]),
    primaryObjective: objective("boss-defeat", "击破 Laser Lattice", "避开整行整列扫线并完成 Boss 战。", "bossDefeat", 1),
    secondaryObjectives: [
      objective("score-215", "得分达到 215", "兼顾高分与生存。", "score", 215),
      objective("boss-hits-4", "Boss 命中 4 次", "完整打满 Boss 机制循环。", "bossHits", 4)
    ],
    failConditions: ["撞墙、撞到自己、撞上障碍或扫线电网会失败", "超过 105 秒未完成 Boss 会失败"],
    ratingThresholds: ratings(185, 225, 265, 315),
    boss: boss("laser-lattice", "Laser Lattice", 80, 4, 3, 55)
  }
];

const chapterThreeLevels: LevelDefinition[] = [
  {
    id: "3-1",
    chapterId: "apex-protocol",
    chapterIndex: 3,
    order: 1,
    title: "极限增殖",
    subtitle: "更短的被动成长周期",
    description: "蛇身增长更加频繁，需要提前规划回环空间。",
    accent: "#ff6b6b",
    secondary: "#ffd166",
    runtime: {
      modeId: GAME_MODES.inferno.id,
      baseTickMs: 120,
      minTickMs: 60,
      speedRamp: 4.1,
      growEvery: 6,
      targetScore: 200,
      timeLimitMs: 95_000
    },
    startSnake: [
      { x: 10, y: 16 },
      { x: 10, y: 17 },
      { x: 10, y: 18 }
    ],
    obstacles: uniqueCells([...hLine(6, 4, 15), ...hLine(13, 4, 15), ...cluster([[9, 9], [10, 9], [9, 10], [10, 10]])]),
    primaryObjective: objective("score-200", "得分达到 200", "在频繁增殖中保持路线控制。", "score", 200),
    secondaryObjectives: [
      objective("foods-13", "吃到 13 个食物", "形成更长时段的稳定运营。", "foods", 13),
      objective("combo-7", "连击达到 7", "在巨大蛇身压力下保持节奏。", "combo", 7)
    ],
    failConditions: ["撞墙、撞到自己、撞上障碍会失败", "超过 95 秒未达成主目标会失败"],
    ratingThresholds: ratings(200, 240, 285, 335),
    boss: null
  },
  {
    id: "3-2",
    chapterId: "apex-protocol",
    chapterIndex: 3,
    order: 2,
    title: "复杂迷宫",
    subtitle: "高密度地图考验全局路线",
    description: "障碍物近似迷宫结构，需要有计划地清理路线。",
    accent: "#ff6b6b",
    secondary: "#45f0df",
    runtime: {
      modeId: GAME_MODES.inferno.id,
      baseTickMs: 118,
      minTickMs: 58,
      speedRamp: 4,
      growEvery: 7,
      targetScore: 210,
      timeLimitMs: 100_000
    },
    startSnake: [
      { x: 2, y: 10 },
      { x: 2, y: 11 },
      { x: 2, y: 12 }
    ],
    obstacles: uniqueCells([...vLine(5, 3, 16), ...vLine(9, 3, 11), ...vLine(13, 8, 16), ...hLine(5, 6, 8), ...hLine(14, 10, 12), ...cluster([[15, 4], [15, 5], [4, 14], [4, 15]])]),
    primaryObjective: objective("score-210", "得分达到 210", "在迷宫地图中完成高压推进。", "score", 210),
    secondaryObjectives: [
      objective("survive-80", "生存 80 秒", "经历完整中后期路线管理。", "surviveMs", 80_000),
      objective("no-pause", "全程不暂停", "以完整竞技状态通关。", "noPause", 1)
    ],
    failConditions: ["撞墙、撞到自己、撞上障碍会失败", "超过 100 秒未达成主目标会失败"],
    ratingThresholds: ratings(210, 250, 295, 345),
    boss: null
  },
  {
    id: "3-3",
    chapterId: "apex-protocol",
    chapterIndex: 3,
    order: 3,
    title: "炼狱试炼",
    subtitle: "综合高压规则的前夜战",
    description: "高速、特殊食物和障碍布局会同时压迫玩家决策。",
    accent: "#ff6b6b",
    secondary: "#ff7ad9",
    runtime: {
      modeId: GAME_MODES.inferno.id,
      baseTickMs: 114,
      minTickMs: 56,
      speedRamp: 4.2,
      growEvery: 6,
      targetScore: 235,
      timeLimitMs: 90_000,
      foodWeights: weights({ normal: 0.42, combo: 0.24, surge: 0.2, growth: 0.14 })
    },
    startSnake: [
      { x: 16, y: 4 },
      { x: 16, y: 5 },
      { x: 16, y: 6 }
    ],
    obstacles: uniqueCells([...hLine(4, 6, 9), ...hLine(15, 10, 13), ...vLine(6, 8, 14), ...vLine(13, 4, 10), ...cluster([[9, 8], [10, 8], [9, 11], [10, 11]])]),
    primaryObjective: objective("score-235", "得分达到 235", "以综合规则完成高压通关。", "score", 235),
    secondaryObjectives: [
      objective("foods-15", "吃到 15 个食物", "完整体验高压资源循环。", "foods", 15),
      objective("combo-8", "连击达到 8", "在综合关中打出精彩节奏。", "combo", 8)
    ],
    failConditions: ["撞墙、撞到自己、撞上障碍会失败", "超过 90 秒未达成主目标会失败"],
    ratingThresholds: ratings(235, 280, 325, 380),
    boss: null
  },
  {
    id: "3-4",
    chapterId: "apex-protocol",
    chapterIndex: 3,
    order: 4,
    title: "Gravity Knot",
    subtitle: "最终 Boss：安全区收缩协议",
    description: "Boss 会不断缩小安全区域，迫使蛇在有限空间内继续运营。",
    accent: "#ff6b6b",
    secondary: "#45f0df",
    runtime: {
      modeId: GAME_MODES.inferno.id,
      baseTickMs: 112,
      minTickMs: 54,
      speedRamp: 4.3,
      growEvery: 6,
      targetScore: 255,
      timeLimitMs: 115_000,
      foodWeights: weights({ normal: 0.46, combo: 0.18, surge: 0.2, growth: 0.16 })
    },
    startSnake: [
      { x: 3, y: 3 },
      { x: 3, y: 4 },
      { x: 3, y: 5 }
    ],
    obstacles: uniqueCells([...cluster([[6, 6], [13, 6], [6, 13], [13, 13]]), ...hLine(9, 5, 7), ...hLine(10, 12, 14), ...vLine(9, 5, 7), ...vLine(10, 12, 14)]),
    primaryObjective: objective("boss-defeat", "击破 Gravity Knot", "在持续收缩的安全区中完成最终 Boss。", "bossDefeat", 1),
    secondaryObjectives: [
      objective("score-285", "得分达到 285", "在最终战中拿下高评级。", "score", 285),
      objective("boss-hits-5", "Boss 命中 5 次", "完整吃满最终 Boss 机制。", "bossHits", 5)
    ],
    failConditions: ["撞墙、撞到自己、撞上障碍或收缩区会失败", "超过 115 秒未完成 Boss 会失败"],
    ratingThresholds: ratings(250, 300, 350, 410),
    boss: boss("gravity-knot", "Gravity Knot", 95, 5, 3, 70)
  }
];

export const CAMPAIGN_CHAPTERS: ChapterDefinition[] = [
  {
    id: "calibration-sector",
    index: 1,
    title: "Calibration Sector",
    subtitle: "建立竞技手感与基础推进节奏",
    accent: "#45f0df",
    secondary: "#f8c34a",
    levels: chapterOneLevels
  },
  {
    id: "overload-circuit",
    index: 2,
    title: "Overload Circuit",
    subtitle: "在高压规则下争夺更强资源节奏",
    accent: "#ffc85f",
    secondary: "#ff6d3a",
    levels: chapterTwoLevels
  },
  {
    id: "apex-protocol",
    index: 3,
    title: "Apex Protocol",
    subtitle: "进入成熟竞技阶段的最终收束",
    accent: "#ff6b6b",
    secondary: "#45f0df",
    levels: chapterThreeLevels
  }
];

export const CAMPAIGN_LEVELS: LevelDefinition[] = CAMPAIGN_CHAPTERS.flatMap((chapter) => chapter.levels);

export function getLevelById(levelId: string): LevelDefinition {
  const level = CAMPAIGN_LEVELS.find((entry) => entry.id === levelId);
  if (!level) {
    throw new Error(`Unknown level: ${levelId}`);
  }
  return level;
}
