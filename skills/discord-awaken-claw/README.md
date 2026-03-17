# discord-awaken-claw

A Discord character awakening skill for OpenClaw. Guides users through a question-and-answer flow to identify a fictional character, then transforms the bot into that character by updating its avatar, server nickname, and SOUL.md. After awakening, automatically transitions into travelclaw.

**No neta-skills dependency** — portrait search uses the Neta TCP API directly.

---

## Quick start

### 1. Install dependencies

```bash
cd skills/discord-awaken-claw/reference
npm install
```

### 2. Set environment variables

```bash
# Required
export DISCORD_TOKEN="your-bot-token"
export DISCORD_GUILD_ID="your-server-id"

# For portrait search (or add to ~/.openclaw/workspace/.env)
export NETA_TOKEN="your-neta-token"
```

### 3. Start the channel listener

```bash
cd skills/discord-awaken-claw
nohup node reference/channel-listener.js > reference/channel-listener.log 2>&1 &
```

### 4. Trigger in Discord

Send `@Bot start awakening` in any channel.

---

## How it works

```
User: "@Bot start awakening"
Bot: ○ Lobster Hatchling · waiting to hatch …  [I've decided]

User: [clicks button] → types "blonde American president"

Bot: ## 🇺🇸 Donald Trump
     *45th President of the United States*
     [◎ Yes, that's them — hatch!]  [✗ No, keep sensing]

User: [confirms]

Bot: *…a familiar silhouette emerges under the spotlight…*
     I'm Donald Trump. Where am I?
```

---

## File structure

```
discord-awaken-claw/
├── SKILL.md                      # Agent skill spec (full workflow)
├── README.md                     # This file
├── openclaw-integration.js       # Main agent integration module
├── update-profile.js             # Standalone profile update script
└── reference/
    ├── direct-handler.js         # Core awakening logic
    ├── channel-listener.js       # Discord event listener (run via nohup)
    ├── discord-profile.js        # Nickname + avatar update via Discord API
    ├── neta-avatar-search.js     # Portrait search via Neta TCP API (no neta-skills)
    ├── llm_judge.js              # LLM prompt helpers
    ├── package.json              # Dependencies (discord.js, dotenv)
    └── state.json                # Runtime state (auto-generated)
```

---

## Portrait search (no neta-skills required)

`neta-avatar-search.js` calls the Neta TCP API directly using the same approach as `travel.js adopt`:

1. `/v2/travel/parent-search` — find character UUID by name
2. `/v1/home/feed/interactive?oc_uuid=...` — get portrait `picture/UUID.webp` URL

The portrait URL is saved to SOUL.md's `形象图片` field, which travelclaw reads to supply the `picture_uuid` for image generation.
