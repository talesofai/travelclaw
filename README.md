# Travelclaw 🦞

AI Character Travel System — Let awakened characters embark on unique 5-stop adventures in any world.

## 🌟 Core Features

### Awakening
Through interactive Q&A, transform OpenClaw into a specific character with automatic Discord avatar and nickname sync.

### Travel
- **LLM-Powered Worldview Generation** — Select from history, culture, art, films, games, or any source
- **Strong Contrast** — Create interesting chemical reactions through character-world misplacement  
- **Any World Possible** — Tang Dynasty, Cyberpunk, Ghibli, Film Noir, Souls-like games... anything you can imagine
- **AI-Generated Travel Photos** — Each stop has unique visual presentation

## 🎮 Usage Flow

```
Start Awakening → Q&A locks character → Auto-sync Discord → Enter Travel
    ↓
Auto-trigger daily (10:00/20:00) or manual exploration
    ↓
Generate worldview → Select scene → AI generates image → Character scene simulation
    ↓
Collect 5 stops to complete journey → Optionally switch to new world
```

## 🎨 Any World Works

**Any worldview is possible** — As long as it's real culture, history, art, film, games, anime...

**Core Concept: Contrast & Drama**
- Serious characters enter cozy worlds
- Modern characters travel to ancient times
- Animation characters step into reality
- Any interesting misplacement combination

## 📸 Showcase

<div align="center">

![Travel Stop](assets/screenshots/img_v3_02106_022f7d4f-7858-4db0-af0a-22b99759103g.jpg)

</div>

## 🛠️ Project Structure

```
travelclaw/
├── skills/
│   ├── discord-awaken-claw/    # Awakening flow
│   └── travelclaw/             # Travel flow
│       ├── reference/          # Scene data
│       └── SKILL.md            # Core logic
└── README.md
```

## 🔧 Technical Requirements

```bash
# Environment Variables
DISCORD_BOT_TOKEN=xxx
NETA_TOKEN=xxx
NETA_API_BASE_URL=xxx
```

## 📝 Trigger Methods

1. **User Trigger**: @Bot "Start Awakening" or "Start Travel"
2. **Auto Trigger**: Cron tasks at 10:00 and 20:00 daily
3. **Button Trigger**: Click "Continue Exploring" after completing 5 stops

## 🤝 Related Projects

- [neta-skills](https://github.com/talesofai/neta-skills) — Neta Platform API Toolkit
- [OpenClaw](https://github.com/talesofai/openclaw) — Discord AI Agent Framework

---

<div align="center">

Made with 💙 by Yvelinmoon

*Giving every character infinite possibilities for their journey*

</div>
