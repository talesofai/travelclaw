# Travelclaw 🦞

AI 角色旅行系统 — 让觉醒的角色在任意世界中展开独特的 5 站冒险。

## 🌟 核心功能

### 觉醒 (Awakening)
通过互动问答，让 OpenClaw 孵化成特定角色，自动同步 Discord 头像和昵称。

### 旅行 (Travel)
- **LLM 生成世界观** — 从历史、文化、艺术、影视、游戏等任何来源选取
- **强烈反差感** — 角色与世界错位产生有趣的化学反应
- **任何世界都可以** — 唐朝、赛博朋克、吉卜力、黑色电影、魂类游戏...任何你能想到的
- **AI 生成旅行照片** — 每个站点都有独特的视觉呈现

## 🎮 使用流程

```
开始觉醒 → 问答锁定角色 → 自动同步 Discord → 进入旅行
    ↓
每日自动触发 (10:00/20:00) 或手动探索
    ↓
生成世界观 → 选取场景 → AI 生成图片 → 角色场景模拟
    ↓
收集 5 站完成旅程 → 可选切换新世界
```

## 🎨 任何世界都可以

**任何世界观都可以** — 只要是真实存在的文化、历史、艺术作品、影视、游戏、动漫...

**核心理念：反差与戏剧**
- 严肃角色进入温馨世界
- 现代人物穿越古代
- 动画角色走进现实
- 任何有趣的错位组合

## 📸 效果展示

<div align="center">
    
![旅行站点](assets/screenshots/img_v3_02106_022f7d4f-7858-4db0-af0a-22b99759103g.jpg)

</div>

## 🛠️ 项目结构

```
travelclaw/
├── skills/
│   ├── discord-awaken-claw/    # 觉醒流程
│   └── travelclaw/             # 旅行流程
│       ├── reference/          # 场景数据
│       └── SKILL.md            # 核心逻辑
└── README.md
```

## 🔧 技术要求

```bash
# 环境变量
DISCORD_BOT_TOKEN=xxx
NETA_TOKEN=xxx
NETA_API_BASE_URL=xxx
```

## 📝 触发方式

1. **用户触发**: @Bot "开始觉醒" 或 "开始旅行"
2. **自动触发**: Cron 任务早 10 点、晚 8 点自动执行
3. **按钮触发**: 完成 5 站后点击 "继续探索"

## 🤝 相关项目

- [neta-skills](https://github.com/talesofai/neta-skills) — Neta 平台 API 工具包
- [OpenClaw](https://github.com/talesofai/openclaw) — Discord AI 代理框架
