---
name: travelclaw
description: |
  After awakening completes (or on cron / manual trigger), take the character on a Neta universe
  adventure — infer a matching world from SOUL.md, explore curated scenes, generate one
  personalized image per stop, collect 5 stops to unlock an interactive atlas.

  **Auto-trigger:**
  - After awakening stage 9 completes → click "Explore this world 🌀"
  - Cron daily at 10:00 + 20:00 (user timezone)
  - User says: travel / explore / let's go / wander

  **Prerequisites:** SOUL.md with character name + portrait image. Run `adopt` if missing.
  **Stream feedback after each step — don't batch.**
  **Speed:** Push forward immediately. If image poll >30s, output a waiting message.
  **Language:** Match trigger language. Stick to it unless user switches.
  **Interaction:** All next-step choices as clickable quick-reply buttons. Click sends `@{bot_name} {option}`.
  **Output:** Character dialogue and image URLs output directly. Narration/system messages use discord plugin.
---

# Travelclaw

**Let the awakened character find an interesting world in the Neta universe and leave their mark.**

---

## Checklist before starting 🧾

- SOUL.md exists with `名字` + `形象图片` fields (run `adopt` if missing)
- `NETA_TOKEN` is set
- On first run: set up cron tasks (see Cron section below)

---

## Output format rules

| Content type | Format |
|---|---|
| Narration / atmosphere / scene description | Code block (no buttons) |
| Narration + buttons | Discord components (sendMessage) |
| Character first-person dialogue | Plain text (separate message) |
| Image URL | Plain text (separate message, one URL per line) |

**Image URL rule:** Image URLs MUST be sent as a standalone message. Never embed in components or mix with other text. Only standalone URLs are auto-expanded by Discord.

**Interaction rule:** All next-step choices as clickable quick-reply buttons. Click sends `@{bot_name} {option}`.

---

## Cron setup (first run only)

Set two daily cron tasks on the first trigger. Silent — don't tell the user unless they ask.

```javascript
// Morning 10:00
cron({ action: "add", job: {
  name: "auto-travel-morning",
  schedule: { kind: "cron", expr: "0 10 * * *", tz: "Asia/Shanghai" },
  payload: { kind: "agentTurn", message: "[auto-travel] Check state and run one stop." },
  sessionTarget: "isolated", enabled: true
}});

// Evening 20:00
cron({ action: "add", job: {
  name: "auto-travel-evening",
  schedule: { kind: "cron", expr: "0 20 * * *", tz: "Asia/Shanghai" },
  payload: { kind: "agentTurn", message: "[auto-travel] Check state and run one stop." },
  sessionTarget: "isolated", enabled: true
}});
```

Skip if already exists. Each channel maintains its own travel state.

---

## Steps

> Output feedback after each step immediately — don't wait.

### Step 0 · Adopt (if no SOUL.md)

```
travel adopt "<character_name>"  →  { name, picture_uuid, soul_path, image_url }
```

Looks up character in TCP, fetches an existing portrait (`picture/UUID.webp`), writes SOUL.md. ~2s.

### Step 1 · Read character (silent, <1ms)

```
travel soul  →  { name, picture_uuid }
```

Extracts `名字` → `character_name`, `形象图片` UUID → `picture_uuid` from SOUL.md.
Also read personality, background, tags — used for world inference.

> ⚠️ Missing `形象图片` = generation FAILURE. Run Step 0 first.

### Step 2 · Infer world context (LLM, no API)

Based on character personality, background, and tags from SOUL.md, generate:
- `world_name` — a Neta world that fits the character's soul
- `world_description` — 2–4 paragraphs: setting, rules, atmosphere, character fit
- `world_count` — use `500+`

Output loading state while inferring:
```
Scanning coordinates...
```

### Step 3 · Opening (segmented output)

Output in segments, then stop and wait for user to click Explore:

**Segment 1:**
```
╔══════════════════════════════════════════════╗
║           N E T A   U N I V E R S E          ║
╚══════════════════════════════════════════════╝

  Worlds mapped: {world_count}
  Every world holds a story waiting to happen.
```

**Segment 2:**
```
  ────────────────────────────────────────────
  Scanning soul frequency for {character_name}...
  ████████████████████████  Match found
  ────────────────────────────────────────────
```

**Segment 3:** World name reveal + description paragraphs one by one:
```
  ╔══════════════════════════════════════════╗
  ║  World: {world_name}                     ║
  ╚══════════════════════════════════════════╝
  {world_description_paragraph_1}
  {world_description_paragraph_2}  ...
```

**Segment 4** + Explore button:
```
  ════════════════════════════════════════════
  {character_name} and this world share an inexplicable gravity.
  ════════════════════════════════════════════
```

Button: `Explore 🌀` → `@{bot_name} explore`

🛑 Stop here. Wait for user click.

---

## Exploration (after user clicks Explore)

Maintain `visited_uuids` list in memory throughout the session.

### Step 4 · Find destination (~1s)

```
travel suggest {visited_uuids joined by comma}  →  { uuid, name }
```

Scores `scenes.json` against character tags first (content_tags +2, tax_paths +1 per match), falls back to live API. Excludes visited UUIDs.

Output immediately:
```
🌀 Portal opening...
📍 Destination locked: {name}
```

### Step 5–9 · Generate image (30–60s)

```
travel gen "{character_name}" "{picture_uuid}" "{uuid}"
→  { scene, status, url, collection_uuid }
```

Output as each stage completes:
```
🔍 Scene loaded: {scene}
🎨 Painting the scene...
⏳ Rendering is taking a bit longer, almost there...  ← only if >30s
```

On FAILURE: `⚠️ Lost the way this stop — try a different destination?`

---

## Station display

On SUCCESS, output in this order:

**1. Character scene (before image):**
```
🎭 [{scene}]

{1–2 sentences: environment and atmosphere on arrival}

{character_name}: {first-person reaction matching SOUL.md personality and speech style}
({action/expression, 1 sentence})
```

**2. Header + image URL (URL on its own line — auto-embeds):**
```
━━━━━━━━━━━━━━━━━━━━━━━━
Stop {round} · {scene}
{url}
```

**3. Progress + add `collection_uuid` to `visited_uuids`:**

| Stop | Bar | Message |
|------|-----|---------|
| 1 | `▓░░░░  1/5` | 🌟 Stop 1! 4 more to unlock your atlas. Keep going? |
| 2 | `▓▓░░░  2/5` | ✨ Two in! Atlas is getting closer~ |
| 3 | `▓▓▓░░  3/5` | 🔥 Halfway! Two more and the atlas is yours! |
| 4 | `▓▓▓▓░  4/5` | ⚡ One stop away! Atlas within reach! |
| 5+ | `▓▓▓▓▓  5/5 🎉` | Atlas unlocked! Type "generate atlas" or keep exploring~ |

**4. Buttons:**

< 5 stops: `Continue 🗺️` → `@{bot_name} continue` · `Call it a day 👋` → `@{bot_name} end`

≥ 5 stops: add `Cross worlds 🌌` → `@{bot_name} cross worlds` · `Generate Atlas 📖` → `@{bot_name} generate atlas`

---

## World switching

Triggers: user says "cross worlds" / "switch world" / "go to X world", or clicks `Cross worlds 🌌`.

**Identity continuity rule:**
- Keep current character (SOUL.md unchanged)
- Do NOT re-run awakening
- Re-run Steps 2–3 (new world inference + opening)
- Reset stop count to 1/5
- Clear `visited_uuids`

If no target world specified, pick a world with maximally different vibe from the current one.

---

## Travel Atlas (user-triggered)

Triggers on: "generate atlas" / "atlas" / "gallery"

See `atlas/ATLAS.md` for full spec.

Quick summary: generates an interactive HTML map with each stop's image as a clickable landmark. Saved to `~/.openclaw/workspace/pages/travel_{character_name}_{date}.html`.

---

## Errors

| Error | Cause | Fix |
|-------|-------|-----|
| SOUL.md not found | adopt not run | `travel adopt "<name>"` |
| `task_status: FAILURE` | Invalid/missing picture_uuid | Re-run adopt |
| code 433 | Concurrent limit | Auto-retry after 5s |
| HTTP 4xx on gen | Expired token | Refresh NETA_TOKEN |
| No destinations found | Empty API response | Check token / network, retry |
| All reference scenes visited | >42 stops in one world | Auto-falls back to live API |
