# Neon Snake Studio

一个面向课程大作业展示、同时具备持续游玩价值的贪吃蛇项目仓库。

当前仓库包含两个版本：

- 图形化版本：基于 `Vite + TypeScript + Phaser + Electron`
- OJ 版本：基于 `C`，用于在线评测与题目提交

这套项目已经从“基础贪吃蛇”升级为一款更接近完整产品的单机竞技闯关作品：有章节地图、Boss 战、挑战关卡、回放系统、赛后分析、自由练习模式，以及正在持续完善的桌面版封装能力。

![Neon Snake Studio 首页截图](./docs/images/home.png)

## 项目亮点

### 1. 竞技征程

主打内容为 `竞技征程` 模式，共 3 个章节、12 个固定关卡：

- 第一章 `Calibration Sector`
  - `1-1` 基础冲刺
  - `1-2` 障碍穿梭
  - `1-3` 连击精度
  - `1-4` Boss `Pulse Core`
- 第二章 `Overload Circuit`
  - `2-1` 高速回廊
  - `2-2` 资源争夺
  - `2-3` 计时压迫
  - `2-4` Boss `Laser Lattice`
- 第三章 `Apex Protocol`
  - `3-1` 极限增殖
  - `3-2` 复杂迷宫
  - `3-3` 炼狱试炼
  - `3-4` Final Boss `Gravity Knot`

每个关卡都包含：

- 主目标
- 次目标
- 失败条件
- `Bronze / Silver / Gold / S` 四档评级

### 2. Boss 机制

当前版本包含 3 种章节 Boss 机制：

- `Pulse Core`：十字电场型 Boss，带预警与周期位移
- `Laser Lattice`：整行整列扫线型 Boss
- `Gravity Knot`：安全区收缩型 Boss

Boss 不再只是随机障碍，而是会主动改变场地节奏和走位决策的关卡核心机制。

### 3. 回放与赛后分析

图形化版本已支持三档回放：

- 本局回放
- 本关最佳回放
- 死亡前/结算前 10 秒高光回放

结果页会输出：

- 本局评级
- 分数、食物数、连击数、Boss 命中次数
- 路径热区图
- 关键事件时间线

![项目视觉预览](./docs/images/hero-preview.svg)

### 4. 自由练习模式

除竞技征程外，保留三种自由刷分模式，适合课堂演示和单独体验：

- `Zen Bloom`
- `Arcade Pulse`
- `Inferno Grid`

### 5. 桌面版封装

现在已经接入 Electron 桌面外壳，并补上桌面侧能力：

- 可直接作为桌面程序启动
- 支持本地存档导出 / 导入
- 支持打开桌面数据目录
- 支持打包生成 Windows 便携版

## 仓库结构

```text
snake-graphic/
  src/                  # 图形化版本源码
  electron/             # Electron 主进程与预加载脚本
  scripts/              # 一键启动 / 构建辅助脚本
  docs/
    images/             # GitHub 展示截图与插图
  oj/                   # OJ / 控制台版本
```

## 图形化版本运行方式

### Web 调试

```bash
pnpm install
pnpm dev
```

### Web 构建

```bash
pnpm build
```

### 桌面版直接运行

```bash
pnpm desktop
```

或在 Windows 下直接双击：

- [`启动桌面版.bat`](./启动桌面版.bat)：构建并启动 Electron 桌面版
- [`打包桌面版.bat`](./打包桌面版.bat)：打包生成 Windows 便携版
- [`一键启动游戏.bat`](./一键启动游戏.bat)：启动浏览器版本地服务
- [`免构建直接游玩.bat`](./免构建直接游玩.bat)：直接打开已构建好的 `dist` 浏览器版本
- [`关闭本地游戏服务.bat`](./关闭本地游戏服务.bat)：关闭本地浏览器版服务

### 生成桌面打包产物

```bash
pnpm desktop:pack
```

默认输出目录：

- `release/`

## 图形化版本操作说明

- `W A S D` 或方向键：控制移动
- `Space` / `P`：暂停 / 继续
- `F`：切换全屏
- 移动端：支持方向按钮与滑动输入

## 桌面版新增能力

桌面版右侧信息面板新增 `Desktop Lab`：

- `Export Save Archive`
  - 导出当前本地进度、设置、最佳回放记录
- `Import Save Archive`
  - 导入之前导出的存档并恢复本地进度
- `Open Data Folder`
  - 直接打开桌面端数据目录，便于答辩演示和备份

## OJ 版本说明

OJ 版本位于 [`oj/`](./oj) 目录，主要文件包括：

- [`oj/main.c`](./oj/main.c)：推荐提交的 C 语言版本
- [`oj/main.cpp`](./oj/main.cpp)：保留的 C++ 参考版本
- [`oj/README.md`](./oj/README.md)：OJ 版本说明

OJ 版本已按题目要求处理：

- 每轮先输出移动方向与移动前分数
- 每轮输出后调用 `fflush(stdout)`
- 收到 `100 100` 后输出碰撞前地图和当前得分

![OJ 版本展示图](./docs/images/oj-preview.svg)

## 当前已完成的成熟化内容

- 章节地图与关卡选择
- 3 章 12 关竞技征程
- Boss 战脚本化机制
- 目标系统、评级系统、章节解锁
- 本局回放 / 最佳回放 / 高光回放
- 赛后分析页
- 存档持久化
- 成就、赛季挑战、档案统计
- Electron 桌面封装
- 桌面存档导入导出

## 下一步仍值得继续打磨的方向

- 更丰富的 Boss 阶段变化与演出
- 更强的关卡平衡与数值调校
- 桌面版专属设置页与窗口化参数
- 本地排行榜与回放库管理
- 音乐、音效、命中特效进一步精修
- 更完整的新手引导与教学关

## 建议展示路径

如果你要用于课程答辩或演示，推荐流程：

1. 先打开桌面版首页，展示整体界面与章节地图
2. 进入 `竞技征程` 的 Boss 关，演示关卡目标与危险预警
3. 结算后展示赛后分析页与回放功能
4. 最后补充展示 `oj/main.c`，说明 OJ 版本也已同步完成
