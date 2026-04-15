import Phaser from "phaser";
import {
  BOARD_SIZE,
  DIRECTION_VECTORS,
  type Direction
} from "../../game/config";
import { SnakeEngine } from "../../game/simulation/engine";
import type { SnakeSnapshot, StepEvent } from "../../game/simulation/types";

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

  private unsubscribe?: () => void;

  private audioContext?: AudioContext;

  constructor(engine: SnakeEngine, getPreferences: PreferencesReader) {
    super("game-scene");
    this.engine = engine;
    this.getPreferences = getPreferences;
  }

  create(): void {
    this.snapshot = this.engine.getSnapshot();
    this.cameras.main.setBackgroundColor("#08111d");

    this.sceneLights = this.add.graphics();
    this.boardGraphics = this.add.graphics();
    this.fxLayer = this.add.container();

    this.unsubscribe = this.engine.subscribe((snapshot, event) => {
      this.snapshot = snapshot;
      this.handleEngineEvent(event);
    });

    this.bindKeys();
    this.scale.on("resize", () => this.renderScene(this.time.now));
    this.events.on("shutdown", () => this.unsubscribe?.());
    this.renderScene(this.time.now);
  }

  update(_time: number, delta: number): void {
    this.engine.update(delta);
    this.renderScene(this.time.now);
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
      this.spawnEatBurst();
      this.playTone(760, 0.05, "triangle");
      this.tweens.add({
        targets: this.cameras.main,
        zoom: 1.02,
        yoyo: true,
        duration: 90,
        ease: "Sine.Out"
      });
    }

    if (event.type === "step" && event.crashed) {
      this.spawnCrashBurst();
      this.playTone(180, 0.18, "sawtooth");
      this.cameras.main.shake(230, 0.008);
    }

    if (event.type === "pause") {
      this.playTone(this.snapshot.status === "paused" ? 420 : 580, 0.03, "square");
    }
  }

  private spawnEatBurst(): void {
    if (!this.getPreferences().effectsEnabled) return;
    const center = this.cellCenter(this.snapshot.food.x, this.snapshot.food.y);
    for (let i = 0; i < 10; i += 1) {
      const angle = (Math.PI * 2 * i) / 10;
      const particle = this.add.circle(center.x, center.y, 5, 0xffd166, 0.85);
      this.fxLayer.add(particle);
      this.tweens.add({
        targets: particle,
        x: center.x + Math.cos(angle) * Phaser.Math.Between(26, 48),
        y: center.y + Math.sin(angle) * Phaser.Math.Between(26, 48),
        alpha: 0,
        scale: 0.1,
        duration: 420,
        ease: "Cubic.Out",
        onComplete: () => particle.destroy()
      });
    }
  }

  private spawnCrashBurst(): void {
    if (!this.getPreferences().effectsEnabled || this.snapshot.snake.length === 0) return;
    const head = this.snapshot.snake[0];
    const center = this.cellCenter(head.x, head.y);
    for (let i = 0; i < 18; i += 1) {
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const particle = this.add.rectangle(center.x, center.y, 10, 4, 0xff6b6b, 0.92);
      particle.rotation = angle;
      this.fxLayer.add(particle);
      this.tweens.add({
        targets: particle,
        x: center.x + Math.cos(angle) * Phaser.Math.Between(36, 90),
        y: center.y + Math.sin(angle) * Phaser.Math.Between(36, 90),
        alpha: 0,
        scaleX: 0.2,
        scaleY: 0.2,
        duration: 560,
        ease: "Expo.Out",
        onComplete: () => particle.destroy()
      });
    }
  }

  private playTone(
    frequency: number,
    duration: number,
    type: OscillatorType
  ): void {
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
    gainNode.gain.exponentialRampToValueAtTime(
      0.05,
      this.audioContext.currentTime + 0.01
    );
    gainNode.gain.exponentialRampToValueAtTime(
      0.0001,
      this.audioContext.currentTime + duration
    );
    oscillator.stop(this.audioContext.currentTime + duration + 0.01);
  }

  private renderScene(time: number): void {
    const { width, height } = this.scale;
    const boardSize = Math.min(width, height) * 0.92;
    const cellSize = boardSize / BOARD_SIZE;
    const originX = (width - boardSize) / 2;
    const originY = (height - boardSize) / 2;
    const pulse = (Math.sin(time / 320) + 1) * 0.5;

    this.sceneLights.clear();
    this.sceneLights.fillGradientStyle(0x04101d, 0x08192c, 0x071422, 0x06111d, 1);
    this.sceneLights.fillRect(0, 0, width, height);
    this.sceneLights.fillStyle(0x00f5d4, 0.06 + pulse * 0.03);
    this.sceneLights.fillCircle(width * 0.28, height * 0.18, boardSize * 0.34);
    this.sceneLights.fillStyle(0xff4d6d, 0.05 + pulse * 0.02);
    this.sceneLights.fillCircle(width * 0.78, height * 0.82, boardSize * 0.3);

    this.boardGraphics.clear();
    this.boardGraphics.lineStyle(2, 0xb8fff1, 0.18);
    this.boardGraphics.fillStyle(0x0b1728, 0.92);
    this.boardGraphics.fillRoundedRect(originX, originY, boardSize, boardSize, 28);
    this.boardGraphics.strokeRoundedRect(originX, originY, boardSize, boardSize, 28);

    for (let x = 0; x < BOARD_SIZE; x += 1) {
      for (let y = 0; y < BOARD_SIZE; y += 1) {
        const px = originX + x * cellSize;
        const py = originY + y * cellSize;
        const edgeCell =
          x === 0 || y === 0 || x === BOARD_SIZE - 1 || y === BOARD_SIZE - 1;
        this.boardGraphics.fillStyle(edgeCell ? 0x17304f : 0x0e1d32, edgeCell ? 0.96 : 0.72);
        this.boardGraphics.fillRoundedRect(
          px + 1.5,
          py + 1.5,
          cellSize - 3,
          cellSize - 3,
          edgeCell ? 9 : 6
        );
        if (!edgeCell) {
          this.boardGraphics.lineStyle(1, 0xd7f9ff, 0.04);
          this.boardGraphics.strokeRoundedRect(
            px + 2,
            py + 2,
            cellSize - 4,
            cellSize - 4,
            6
          );
        }
      }
    }

    this.snapshot.obstacles.forEach((cell, index) => {
      const center = this.cellCenter(cell.x, cell.y, originX, originY, cellSize);
      const tilt = ((time / 1100 + index) % 1) * 0.6;
      this.boardGraphics.fillStyle(0x4a607d, 0.95);
      this.boardGraphics.fillRoundedRect(
        center.x - cellSize * 0.34,
        center.y - cellSize * 0.34,
        cellSize * 0.68,
        cellSize * 0.68,
        10
      );
      this.boardGraphics.fillStyle(0xb8c7da, 0.18 + tilt * 0.2);
      this.boardGraphics.fillRoundedRect(
        center.x - cellSize * 0.2,
        center.y - cellSize * 0.24,
        cellSize * 0.4,
        cellSize * 0.18,
        8
      );
    });

    const foodCenter = this.cellCenter(
      this.snapshot.food.x,
      this.snapshot.food.y,
      originX,
      originY,
      cellSize
    );
    const orbRadius = cellSize * (0.2 + pulse * 0.07);
    this.boardGraphics.fillStyle(0xffe08a, 0.1);
    this.boardGraphics.fillCircle(foodCenter.x, foodCenter.y, cellSize * 0.42 + pulse * 4);
    this.boardGraphics.lineStyle(2, 0xffc857, 0.8);
    this.boardGraphics.strokeCircle(foodCenter.x, foodCenter.y, cellSize * 0.34 + pulse * 2);
    this.boardGraphics.fillStyle(0xffc857, 1);
    this.boardGraphics.fillCircle(foodCenter.x, foodCenter.y, orbRadius);
    this.boardGraphics.fillStyle(0xfff5c8, 0.92);
    this.boardGraphics.fillCircle(foodCenter.x - orbRadius * 0.28, foodCenter.y - orbRadius * 0.22, orbRadius * 0.32);

    this.snapshot.snake.forEach((segment, index) => {
      const center = this.cellCenter(segment.x, segment.y, originX, originY, cellSize);
      const isHead = index === 0;
      const alpha = 0.98 - Math.min(index * 0.028, 0.4);
      const widthScale = isHead ? 0.78 : 0.7 - Math.min(index * 0.008, 0.1);
      const segmentWidth = cellSize * widthScale;
      const segmentHeight = cellSize * (isHead ? 0.8 : 0.66);
      const color = Phaser.Display.Color.Interpolate.ColorWithColor(
        Phaser.Display.Color.ValueToColor(0x00f5d4),
        Phaser.Display.Color.ValueToColor(0x1fef9f),
        this.snapshot.snake.length,
        index
      );
      const segmentColor = Phaser.Display.Color.GetColor(color.r, color.g, color.b);

      this.boardGraphics.fillStyle(segmentColor, alpha);
      this.boardGraphics.fillRoundedRect(
        center.x - segmentWidth / 2,
        center.y - segmentHeight / 2,
        segmentWidth,
        segmentHeight,
        isHead ? 16 : 14
      );
      this.boardGraphics.fillStyle(0xffffff, isHead ? 0.22 : 0.08);
      this.boardGraphics.fillRoundedRect(
        center.x - segmentWidth / 2 + 4,
        center.y - segmentHeight / 2 + 3,
        segmentWidth * 0.52,
        segmentHeight * 0.22,
        8
      );

      if (isHead) {
        const eyeOffset = cellSize * 0.12;
        const eyeForward = this.eyeForwardOffset(this.snapshot.direction, cellSize * 0.12);
        const eyeSide = this.eyeSideOffset(this.snapshot.direction, eyeOffset);
        this.boardGraphics.fillStyle(0x03121d, 0.95);
        this.boardGraphics.fillCircle(
          center.x + eyeForward.x + eyeSide.x,
          center.y + eyeForward.y + eyeSide.y,
          cellSize * 0.06
        );
        this.boardGraphics.fillCircle(
          center.x + eyeForward.x - eyeSide.x,
          center.y + eyeForward.y - eyeSide.y,
          cellSize * 0.06
        );
      }
    });

    const hazard = this.previewHazard();
    if (hazard) {
      const preview = this.cellCenter(hazard.x, hazard.y, originX, originY, cellSize);
      this.boardGraphics.lineStyle(3, 0xff7b7b, 0.65 + pulse * 0.15);
      this.boardGraphics.strokeRoundedRect(
        preview.x - cellSize * 0.36,
        preview.y - cellSize * 0.36,
        cellSize * 0.72,
        cellSize * 0.72,
        12
      );
    }
  }

  private previewHazard(): { x: number; y: number } | null {
    if (this.snapshot.status !== "playing" || this.snapshot.snake.length === 0) return null;
    const vector = DIRECTION_VECTORS[this.snapshot.pendingDirection];
    const head = this.snapshot.snake[0];
    const next = { x: head.x + vector.x, y: head.y + vector.y };
    const hitsBoundary =
      next.x <= 0 || next.y <= 0 || next.x >= BOARD_SIZE - 1 || next.y >= BOARD_SIZE - 1;
    const hitsObstacle = this.snapshot.obstacles.some(
      (cell) => cell.x === next.x && cell.y === next.y
    );
    const hitsBody = this.snapshot.snake
      .slice(0, -1)
      .some((cell) => cell.x === next.x && cell.y === next.y);
    return hitsBoundary || hitsObstacle || hitsBody ? next : null;
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
