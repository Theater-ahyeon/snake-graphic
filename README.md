# Neon Snake Studio

一个为课程大作业准备的图形化贪吃蛇项目，基于 `Vite + TypeScript + Phaser` 构建，强调三件事：

- 规则完整：单人玩法、记分、障碍、边界、食物与被动增长机制都已经实现
- 界面精致：霓虹网格、玻璃态 HUD、动态光晕、粒子爆发、结果弹层和移动端方向盘
- 适合展示：项目结构清晰，方便继续扩展成小组版课程项目

## 功能亮点

- 三种模式：`Zen Bloom`、`Arcade Pulse`、`Inferno Grid`
- 实时记分与本地最高分存储
- 课程要求对应的障碍、边界、食物和固定步数增长规则
- 键盘和触屏双输入支持
- 暂停 / 重开 / 局后总结 / 任务追踪
- 纯程序化视觉表现，不依赖额外美术资源即可直接运行

## 技术栈

- `Vite`
- `TypeScript`
- `Phaser 3`
- 原生 DOM HUD + CSS 主题系统

## 本地运行

```bash
pnpm install
pnpm dev
```

默认会启动本地开发服务器，打开终端输出里的地址即可。

## 生产构建

```bash
pnpm build
```

构建成功后，静态产物会输出到 `dist/`。

## 操作说明

- `W A S D` 或方向键：控制移动
- `Space` / `P`：暂停或继续
- 点击界面上的模式卡：切换玩法模式
- 点击 `开始本局`：启动新游戏
- 移动端：可直接使用页面底部方向盘

## 项目结构

```text
snake_graphic/
  src/
    game/
      config.ts
      simulation/
        engine.ts
        types.ts
    phaser/
      scenes/
        GameScene.ts
    ui/
      app.ts
    main.ts
    style.css
```

## 课程展示建议

- 答辩时优先演示 `Arcade Pulse`，手感和观感最均衡
- 如果想突出难度和视觉冲击，可以切到 `Inferno Grid`
- 如果想展示界面细节和长时间运营感，可以用 `Zen Bloom`

## 可继续扩展的方向

- 排行榜接后端
- 地图编辑器
- 双人对战
- 自定义障碍布局
- 音乐与更多粒子特效
