import Phaser from "phaser";
import { BOARD_SIZE, DIRECTION_VECTORS, type Direction } from "../../game/config";
import { SnakeEngine } from "../../game/simulation/engine";
import type { BossPatternState, FoodKind, SnakeSnapshot, StepEvent } from "../../game/simulation/types";

export interface ScenePreferences {
  effectsEnabled: boolean;
  sfxEnabled: boolean;
}

type PreferencesReader = () => ScenePreferences;

export class GameScene extends Phaser.Scene {
  private readonly engine: SnakeEngine;

  private readonly getPreferences: PreferencesReader;

  private boardGraphics!: Phaser.GameObjects.Graphics;

  private sceneLights!: Phaser.GameObjects.Graphics;

  private fxLayer!: Phaser.GameObjects.Container;

  private snapshot!: SnakeSnapshot;

  private presentedSnapshot: SnakeSnapshot | null = null;

  private unsubscribe?: () => void;

  private audioContext?: AudioContext;

  constructor(engine: SnakeEngine, getPreferences: PreferencesReader) {
    super("game-scene");
    this.engine = engine;
    this.getPreferences = getPreferences;
  }

  create(): void {
    this.snapshot = this.engine.getSnapshot();
    this.cameras.main.setBackgroundColor("#07101b");

    this.sceneLights = this.add.graphics();
    this.boardGraphics = this.add.graphics();
    this.fxLayer = this.add.container();

    this.unsubscribe = this.engine.subscribe((snapshot, event) => {
      this.snapshot = snapshot;
      if (!this.presentedSnapshot) {
        this.handleEngineEvent(event);
      }
    });

    this.bindKeys();
    this.scale.on("resize", () => this.renderScene(this.time.now));
    this.events.on("shutdown", () => this.unsubscribe?.());
    this.renderScene(this.time.now);
  }

  setPresentation(snapshot: SnakeSnapshot | null): void {
    this.presentedSnapshot = snapshot ? this.cloneSnapshot(snapshot) : null;
  }

  update(time: number, delta: number): void {
    if (!this.presentedSnapshot) {
      this.engine.update(delta);
    }
    this.renderScene(time);
  }

  private cloneSnapshot(snapshot: SnakeSnapshot): SnakeSnapshot {
    return {
      ...snapshot,
      snake: snapshot.snake.map((cell) => ({ ...cell })),
      food: { ...snapshot.food },
      obstacles: snapshot.obstacles.map((cell) => ({ ...cell })),
      achievements: snapshot.achievements.map((achievement) => ({ ...achievement })),
      career: {
        ...snapshot.career,
        unlockedAchievementIds: [...snapshot.career.unlockedAchievementIds]
      },
      boss: {
        ...snapshot.boss,
        core: snapshot.boss.core ? { ...snapshot.boss.core } : null,
        warningCells: snapshot.boss.warningCells.map((cell) => ({ ...cell })),
        hazardCells: snapshot.boss.hazardCells.map((cell) => ({ ...cell })),
        safeCells: snapshot.boss.safeCells.map((cell) => ({ ...cell }))
      },
      replay: { ...snapshot.replay },
      challenge: snapshot.challenge ? { ...snapshot.challenge } : null,
      level: snapshot.level
        ? {
            ...snapshot.level,
            definition: {
              ...snapshot.level.definition,
              startSnake: snapshot.level.definition.startSnake.map((cell) => ({ ...cell })),
              obstacles: snapshot.level.definition.obstacles.map((cell) => ({ ...cell })),
              primaryObjective: { ...snapshot.level.definition.primaryObjective },
              secondaryObjectives: snapshot.level.definition.secondaryObjectives.map((objective) => ({
                ...objective
              })),
              runtime: { ...snapshot.level.definition.runtime },
              ratingThresholds: { ...snapshot.level.definition.ratingThresholds },
              boss: snapshot.level.definition.boss ? { ...snapshot.level.definition.boss } : null,
              failConditions: [...snapshot.level.definition.failConditions]
            },
            primary: { ...snapshot.level.primary },
            secondary: snapshot.level.secondary.map((objective) => ({ ...objective }))
          }
        : null,
      campaign: {
        recentLevelId: snapshot.campaign.recentLevelId,
        levels: Object.fromEntries(
          Object.entries(snapshot.campaign.levels).map(([id, level]) => [id, { ...level }])
        ),
        seasonChallenges: snapshot.campaign.seasonChallenges.map((challenge) => ({ ...challenge }))
      }
    };
  }

  private bindKeys(): void {
    const keyboard = this.input.keyboard;
    if (!keyboard) return;

    const bindings: Array<[string, Direction]> = [
      ["keydown-W", "up"],
      ["keydown-UP", "up"],
      ["keydown-S", "down"],
      ["keydown-DOWN", "down"],
      ["keydown-A", "left"],
      ["keydown-LEFT", "left"],
      ["keydown-D", "right"],
      ["keydown-RIGHT", "right"]
    ];

    bindings.forEach(([eventName, direction]) => {
      keyboard.on(eventName, () => this.engine.queueDirection(direction));
    });

    keyboard.on("keydown-SPACE", () => this.engine.togglePause());
    keyboard.on("keydown-P", () => this.engine.togglePause());
  }

  private handleEngineEvent(event: StepEvent): void {
    if (event.type === "step" && event.ate) {
      this.spawnEatBurst(event.foodKind ?? "normal", event.scoreDelta ?? 0);
      this.playTone(event.frenzyStarted ? 920 : 760, 0.05, "triangle");
    }
    if (event.type === "step" && event.bossPhaseChanged === "warning") {
      this.spawnSystemBanner("Boss Warning", "#ffd166");
      this.playTone(480, 0.08, "square");
      this.cameras.main.shake(120, 0.003);
    }
    if (event.type === "step" && event.bossDamaged) {
      this.spawnSystemBanner("Core Hit", "#ff8fab");
      this.playTone(640, 0.05, "sawtooth");
      this.cameras.main.shake(110, 0.004);
    }
    if (event.type === "step" && event.bossDefeated) {
      this.spawnSystemBanner("Boss Down", "#45f0df");
      this.playTone(980, 0.12, "triangle");
      this.cameras.main.shake(280, 0.008);
    }
    if (event.type === "step" && event.crashed) {
      this.spawnCrashBurst();
      this.playTone(180, 0.18, "sawtooth");
      this.cameras.main.shake(220, 0.008);
    }
    if (event.type === "step" && event.victory) {
      this.spawnSystemBanner("Level Clear", "#45f0df");
      this.playTone(1040, 0.15, "triangle");
    }
    if (event.type === "pause") {
      this.playTone(this.snapshot.status === "paused" ? 420 : 560, 0.03, "square");
    }
    if (event.unlockedIds && event.unlockedIds.length > 0) {
      this.spawnSystemBanner(`成就解锁 x${event.unlockedIds.length}`, "#ffe28a");
      this.playTone(1020, 0.08, "triangle");
    }
  }

  private spawnEatBurst(kind: FoodKind, scoreDelta: number): void {
    if (!this.getPreferences().effectsEnabled) return;
    const snapshot = this.presentedSnapshot ?? this.snapshot;
    const head = snapshot.snake[0];
    if (!head) return;
    const center = this.cellCenter(head.x, head.y);
    const color =
      kind === "combo" ? 0xff7ad9 : kind === "surge" ? 0x8ec5ff : kind === "growth" ? 0x7ae582 : 0xffd166;
    for (let index = 0; index < 10; index += 1) {
      const angle = (Math.PI * 2 * index) / 10;
      const particle = this.add.circle(center.x, center.y, 5, color, 0.9);
      this.fxLayer.add(particle);
      this.tweens.add({
        targets: particle,
        x: center.x + Math.cos(angle) * Phaser.Math.Between(26, 48),
        y: center.y + Math.sin(angle) * Phaser.Math.Between(26, 48),
        alpha: 0,
        scale: 0.15,
        duration: 420,
        ease: "Cubic.Out",
        onComplete: () => particle.destroy()
      });
    }

    const label = this.add.text(center.x, center.y - 28, `+${scoreDelta}`, {
      fontFamily: '"Sora", sans-serif',
      fontSize: "20px",
      color: "#f8fbff",
      stroke: "#05101a",
      strokeThickness: 4
    });
    label.setOrigin(0.5);
    this.fxLayer.add(label);
    this.tweens.add({
      targets: label,
      y: center.y - 68,
      alpha: 0,
      duration: 560,
      ease: "Cubic.Out",
      onComplete: () => label.destroy()
    });
  }

  private spawnCrashBurst(): void {
    if (!this.getPreferences().effectsEnabled) return;
    const snapshot = this.presentedSnapshot ?? this.snapshot;
    const head = snapshot.snake[0];
    if (!head) return;
    const center = this.cellCenter(head.x, head.y);
    for (let index = 0; index < 20; index += 1) {
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const shard = this.add.rectangle(center.x, center.y, 10, 4, 0xff6b6b, 0.92);
      shard.rotation = angle;
      this.fxLayer.add(shard);
      this.tweens.add({
        targets: shard,
        x: center.x + Math.cos(angle) * Phaser.Math.Between(32, 92),
        y: center.y + Math.sin(angle) * Phaser.Math.Between(32, 92),
        alpha: 0,
        scaleX: 0.2,
        scaleY: 0.2,
        duration: 580,
        ease: "Expo.Out",
        onComplete: () => shard.destroy()
      });
    }
  }

  private spawnSystemBanner(text: string, color: string): void {
    if (!this.getPreferences().effectsEnabled) return;
    const banner = this.add.text(this.scale.width / 2, 72, text, {
      fontFamily: '"Sora", sans-serif',
      fontSize: "24px",
      color: "#04121d",
      backgroundColor: color,
      padding: { x: 18, y: 10 }
    });
    banner.setOrigin(0.5);
    this.fxLayer.add(banner);
    this.tweens.add({
      targets: banner,
      y: 42,
      alpha: 0,
      duration: 1200,
      ease: "Cubic.Out",
      onComplete: () => banner.destroy()
    });
  }

  private playTone(frequency: number, duration: number, type: OscillatorType): void {
    if (!this.getPreferences().sfxEnabled) return;
    if (!this.audioContext) {
      this.audioContext = new window.AudioContext();
    }
    if (this.audioContext.state === "suspended") {
      void this.audioContext.resume();
    }
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gainNode.gain.value = 0.0001;
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    oscillator.start();
    gainNode.gain.exponentialRampToValueAtTime(0.05, this.audioContext.currentTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, this.audioContext.currentTime + duration);
    oscillator.stop(this.audioContext.currentTime + duration + 0.01);
  }

  private renderScene(time: number): void {
    const snapshot = this.presentedSnapshot ?? this.snapshot;
    const { width, height } = this.scale;
    const boardSize = Math.min(width, height) * 0.92;
    const cellSize = boardSize / BOARD_SIZE;
    const originX = (width - boardSize) / 2;
    const originY = (height - boardSize) / 2;
    const pulse = (Math.sin(time / 320) + 1) * 0.5;

    this.sceneLights.clear();
    this.sceneLights.fillGradientStyle(0x04101d, 0x071727, 0x071727, 0x05101a, 1);
    this.sceneLights.fillRect(0, 0, width, height);
    this.sceneLights.fillStyle(0x45f0df, 0.07 + pulse * 0.03);
    this.sceneLights.fillCircle(width * 0.28, height * 0.2, boardSize * 0.32);
    this.sceneLights.fillStyle(0xff6b6b, 0.04 + pulse * 0.02);
    this.sceneLights.fillCircle(width * 0.78, height * 0.8, boardSize * 0.34);
    if (snapshot.frenzyMs > 0) {
      this.sceneLights.fillStyle(0xffc85f, 0.07 + pulse * 0.04);
      this.sceneLights.fillCircle(width * 0.5, height * 0.5, boardSize * 0.45);
    }

    this.boardGraphics.clear();
    this.boardGraphics.lineStyle(2, 0xb8fff1, 0.16);
    this.boardGraphics.fillStyle(0x0b1728, 0.96);
    this.boardGraphics.fillRoundedRect(originX, originY, boardSize, boardSize, 28);
    this.boardGraphics.strokeRoundedRect(originX, originY, boardSize, boardSize, 28);

    for (let x = 0; x < BOARD_SIZE; x += 1) {
      for (let y = 0; y < BOARD_SIZE; y += 1) {
        const px = originX + x * cellSize;
        const py = originY + y * cellSize;
        const edgeCell = x === 0 || y === 0 || x === BOARD_SIZE - 1 || y === BOARD_SIZE - 1;
        this.boardGraphics.fillStyle(edgeCell ? 0x17304f : 0x0d1b2f, edgeCell ? 0.96 : 0.76);
        this.boardGraphics.fillRoundedRect(px + 1.4, py + 1.4, cellSize - 2.8, cellSize - 2.8, edgeCell ? 10 : 6);
      }
    }

    this.drawBoss(snapshot.boss, originX, originY, cellSize, pulse);

    snapshot.obstacles.forEach((cell, index) => {
      const center = this.cellCenter(cell.x, cell.y, originX, originY, cellSize);
      const glow = ((time / 900 + index) % 1) * 0.18;
      this.boardGraphics.fillStyle(0x4a607d, 0.96);
      this.boardGraphics.fillRoundedRect(center.x - cellSize * 0.34, center.y - cellSize * 0.34, cellSize * 0.68, cellSize * 0.68, 10);
      this.boardGraphics.fillStyle(0xe6f4ff, 0.14 + glow);
      this.boardGraphics.fillRoundedRect(center.x - cellSize * 0.18, center.y - cellSize * 0.24, cellSize * 0.36, cellSize * 0.16, 7);
    });

    const foodCenter = this.cellCenter(snapshot.food.x, snapshot.food.y, originX, originY, cellSize);
    const foodTint =
      snapshot.food.kind === "combo"
        ? { outer: 0xff7ad9, inner: 0xffd2f4, glow: 0xff7ad9 }
        : snapshot.food.kind === "surge"
          ? { outer: 0x8ec5ff, inner: 0xdff2ff, glow: 0x8ec5ff }
          : snapshot.food.kind === "growth"
            ? { outer: 0x7ae582, inner: 0xe6ffe8, glow: 0x7ae582 }
            : { outer: 0xffd166, inner: 0xfff5d4, glow: 0xffd166 };
    this.boardGraphics.fillStyle(foodTint.glow, 0.12);
    this.boardGraphics.fillCircle(foodCenter.x, foodCenter.y, cellSize * 0.44 + pulse * 4);
    this.boardGraphics.fillStyle(foodTint.outer, 1);
    this.boardGraphics.fillCircle(foodCenter.x, foodCenter.y, cellSize * (0.22 + pulse * 0.05));
    this.boardGraphics.fillStyle(foodTint.inner, 0.92);
    this.boardGraphics.fillCircle(foodCenter.x - cellSize * 0.08, foodCenter.y - cellSize * 0.08, cellSize * 0.08);

    snapshot.snake.forEach((segment, index) => {
      const center = this.cellCenter(segment.x, segment.y, originX, originY, cellSize);
      const isHead = index === 0;
      const alpha = 0.98 - Math.min(index * 0.028, 0.42);
      const colorA = snapshot.frenzyMs > 0 ? 0xffc85f : 0x45f0df;
      const colorB = snapshot.frenzyMs > 0 ? 0xff6b6b : 0x1fd4b5;
      const mix = Phaser.Display.Color.Interpolate.ColorWithColor(
        Phaser.Display.Color.ValueToColor(colorA),
        Phaser.Display.Color.ValueToColor(colorB),
        snapshot.snake.length,
        index
      );
      const color = Phaser.Display.Color.GetColor(mix.r, mix.g, mix.b);

      const segmentWidth = cellSize * (isHead ? 0.8 : 0.7 - Math.min(index * 0.008, 0.1));
      const segmentHeight = cellSize * (isHead ? 0.82 : 0.66);
      this.boardGraphics.fillStyle(color, alpha);
      this.boardGraphics.fillRoundedRect(center.x - segmentWidth / 2, center.y - segmentHeight / 2, segmentWidth, segmentHeight, isHead ? 16 : 14);
      this.boardGraphics.fillStyle(0xffffff, isHead ? 0.2 : 0.08);
      this.boardGraphics.fillRoundedRect(center.x - segmentWidth / 2 + 4, center.y - segmentHeight / 2 + 3, segmentWidth * 0.52, segmentHeight * 0.22, 8);

      if (isHead) {
        const eyeForward = this.eyeForwardOffset(snapshot.direction, cellSize * 0.12);
        const eyeSide = this.eyeSideOffset(snapshot.direction, cellSize * 0.11);
        this.boardGraphics.fillStyle(0x03121d, 0.95);
        this.boardGraphics.fillCircle(center.x + eyeForward.x + eyeSide.x, center.y + eyeForward.y + eyeSide.y, cellSize * 0.055);
        this.boardGraphics.fillCircle(center.x + eyeForward.x - eyeSide.x, center.y + eyeForward.y - eyeSide.y, cellSize * 0.055);
      }
    });

    if (!this.presentedSnapshot) {
      const hazard = this.previewHazard(snapshot);
      if (hazard) {
        const center = this.cellCenter(hazard.x, hazard.y, originX, originY, cellSize);
        this.boardGraphics.lineStyle(3, 0xff7b7b, 0.56 + pulse * 0.16);
        this.boardGraphics.strokeRoundedRect(center.x - cellSize * 0.36, center.y - cellSize * 0.36, cellSize * 0.72, cellSize * 0.72, 12);
      }
    }
  }

  private drawBoss(
    boss: BossPatternState,
    originX: number,
    originY: number,
    cellSize: number,
    pulse: number
  ): void {
    if (boss.safeCells.length > 0) {
      boss.safeCells.forEach((cell) => {
        const center = this.cellCenter(cell.x, cell.y, originX, originY, cellSize);
        this.boardGraphics.fillStyle(0x45f0df, 0.035);
        this.boardGraphics.fillRoundedRect(center.x - cellSize * 0.42, center.y - cellSize * 0.42, cellSize * 0.84, cellSize * 0.84, 8);
      });
    }

    boss.warningCells.forEach((cell) => {
      const center = this.cellCenter(cell.x, cell.y, originX, originY, cellSize);
      this.boardGraphics.lineStyle(2, 0xffd166, 0.6 + pulse * 0.18);
      this.boardGraphics.strokeRoundedRect(center.x - cellSize * 0.36, center.y - cellSize * 0.36, cellSize * 0.72, cellSize * 0.72, 10);
    });

    boss.hazardCells.forEach((cell) => {
      const center = this.cellCenter(cell.x, cell.y, originX, originY, cellSize);
      const color = boss.kind === "gravity-knot" ? 0xff4d6d : 0xff6b6b;
      this.boardGraphics.fillStyle(color, 0.2 + pulse * 0.08);
      this.boardGraphics.fillRoundedRect(center.x - cellSize * 0.42, center.y - cellSize * 0.42, cellSize * 0.84, cellSize * 0.84, 10);
      this.boardGraphics.lineStyle(2, color, 0.6);
      this.boardGraphics.strokeRoundedRect(center.x - cellSize * 0.35, center.y - cellSize * 0.35, cellSize * 0.7, cellSize * 0.7, 8);
    });

    if (boss.core) {
      const center = this.cellCenter(boss.core.x, boss.core.y, originX, originY, cellSize);
      const coreColor = boss.phase === "defeated" ? 0x45f0df : boss.phase === "active" ? 0xff8fab : 0xffd166;
      this.boardGraphics.fillStyle(coreColor, boss.phase === "defeated" ? 0.3 : 0.16 + pulse * 0.08);
      this.boardGraphics.fillCircle(center.x, center.y, cellSize * 0.5 + pulse * 4);
      this.boardGraphics.fillStyle(coreColor, 0.96);
      this.boardGraphics.fillCircle(center.x, center.y, cellSize * 0.2);
      this.boardGraphics.lineStyle(2, 0xffffff, 0.24);
      this.boardGraphics.strokeCircle(center.x, center.y, cellSize * 0.28);
    }
  }

  private previewHazard(snapshot: SnakeSnapshot): { x: number; y: number } | null {
    if (snapshot.status !== "playing" || snapshot.snake.length === 0) return null;
    const vector = DIRECTION_VECTORS[snapshot.pendingDirection];
    const head = snapshot.snake[0];
    const next = { x: head.x + vector.x, y: head.y + vector.y };
    const hitsBoundary = next.x <= 0 || next.y <= 0 || next.x >= BOARD_SIZE - 1 || next.y >= BOARD_SIZE - 1;
    const hitsObstacle = snapshot.obstacles.some((cell) => cell.x === next.x && cell.y === next.y);
    const hitsBoss = snapshot.boss.hazardCells.some((cell) => cell.x === next.x && cell.y === next.y);
    const hitsBody = snapshot.snake.slice(0, -1).some((cell) => cell.x === next.x && cell.y === next.y);
    return hitsBoundary || hitsObstacle || hitsBody || hitsBoss ? next : null;
  }

  private cellCenter(
    x: number,
    y: number,
    originX = (this.scale.width - Math.min(this.scale.width, this.scale.height) * 0.92) / 2,
    originY = (this.scale.height - Math.min(this.scale.width, this.scale.height) * 0.92) / 2,
    cellSize = (Math.min(this.scale.width, this.scale.height) * 0.92) / BOARD_SIZE
  ): { x: number; y: number } {
    return {
      x: originX + x * cellSize + cellSize / 2,
      y: originY + y * cellSize + cellSize / 2
    };
  }

  private eyeForwardOffset(direction: Direction, distance: number): { x: number; y: number } {
    if (direction === "up") return { x: 0, y: -distance };
    if (direction === "down") return { x: 0, y: distance };
    if (direction === "left") return { x: -distance, y: 0 };
    return { x: distance, y: 0 };
  }

  private eyeSideOffset(direction: Direction, distance: number): { x: number; y: number } {
    if (direction === "up" || direction === "down") {
      return { x: distance, y: 0 };
    }
    return { x: 0, y: distance };
  }
}
