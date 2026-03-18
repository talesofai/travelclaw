# travelclaw

An OpenClaw skill that sends an awakened character on an image-generating journey through the Neta universe. Zero external dependencies — all API calls are direct HTTP via Node.js built-ins.

## File structure

```
travel.js                          ← CLI entry point (soul / adopt / suggest / gen)
scenes.json                        ← 1200+ curated destinations (local fallback)
package.json                       ← { "type": "module" }
skills/
  travelclaw/
    SKILL.md                       ← Agent workflow spec
    atlas/ATLAS.md                 ← Gallery generator spec
  discord-awaken-claw/
    SKILL.md                       ← Discord awakening flow spec
    README.md
    reference/                     ← Discord bot handlers (discord.js)
```

## Setup

**1. Set your token**
```bash
echo "NETA_TOKEN=your_token_here" >> ~/.openclaw/workspace/.env
```

**2. Adopt a character** (creates SOUL.md with portrait)
```bash
node travel.js adopt "可莉"
```

**3. Run a travel loop**
```bash
# Pick a destination
DEST=$(node travel.js suggest)
UUID=$(echo $DEST | node -e "process.stdin.resume();let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).uuid))")

# Read character
SOUL=$(node travel.js soul)
CHAR=$(echo $SOUL | node -e "process.stdin.resume();let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).name))")
PIC=$(echo $SOUL | node -e "process.stdin.resume();let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).picture_uuid))")

# Generate image
node travel.js gen "$CHAR" "$PIC" "$UUID"
```

## Commands

| Command | Output |
|---|---|
| `node travel.js soul` | `{name, picture_uuid}` from SOUL.md |
| `node travel.js adopt <name>` | TCP search → write SOUL.md → `{name, picture_uuid}` |
| `node travel.js suggest [exclude_csv]` | `{uuid, name, from_ref}` — best matching destination |
| `node travel.js gen <name> <pic_uuid> <uuid>` | `{scene, status, url, collection_uuid}` |

## Requirements

- Node.js ≥ 18
- `NETA_TOKEN` in env or `~/.openclaw/workspace/.env`

## Discord awakening (optional)

See `skills/discord-awaken-claw/README.md`. Requires `DISCORD_TOKEN` + `DISCORD_GUILD_ID`.
