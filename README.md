# travelclaw

Take an awakened character on a Neta universe adventure — match their soul to a world, explore curated scenes, generate one personalized image per stop, collect 5 stops to unlock an interactive atlas.

## Skills

| Skill | Description |
|-------|-------------|
| `travelclaw` | Core travel loop — explore Neta worlds, generate personalized images, collect 5 stops |
| `atlas` | Interactive travel map generator — unlocked after 5 stops |

## Setup

**Install (one-time):**
```bash
mkdir -p ~/.openclaw/workspace/skills && cd ~/.openclaw/workspace/skills
git clone https://github.com/talesofai/travelclaw.git
```

**Token:** Add `NETA_TOKEN=your_token` to `~/.openclaw/workspace/.env`

**Adopt a character (if no SOUL.md):**
```bash
node ~/.openclaw/workspace/skills/travelclaw/travel.js adopt "<character_name>"
```

All commands run via `node ~/.openclaw/workspace/skills/travelclaw/travel.js <cmd>`.

## Requirements

- `SOUL.md` with `名字` + `形象图片` fields — run `adopt` if missing
- `NETA_TOKEN` in env
- Node.js — no other dependencies
