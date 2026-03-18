---
name: travelclaw
description: Triggered after discord-awaken-claw awakening (phase 9 complete), on a cron schedule, or when the user says "start travel" / "explore" / "let's go". Takes an awakened character from SOUL.md and sends them on an image-generating journey through the Neta universe.
---

## Pre-flight checklist

**Prerequisites**
- SOUL.md exists with a character name (`名字` or `角色名`) and portrait image URL (`形象图片`)
- `NETA_TOKEN` configured in `~/.openclaw/workspace/.env`
- Node.js ≥ 18 installed

**Trigger scenarios**
- Auto-trigger: After awakening phase 9 completes → skip Step 1, start from Step 2
- Cron: Set up a recurring task on first run (see Step 0)
- Manual: User says "start travel", "explore", "go travel"

**Language**
- Match the language the user used to trigger. Translate all fixed template text accordingly.

**Output format**
- Follow the output spec in this file. Use Discord components for buttons; plain text for character dialogue; code blocks for narration.

**Cron task (mandatory on first run)**
- Before starting, set up a cron to auto-trigger travel at a regular interval (e.g. every 2–4 hours).

---

## Step 0 — Set up cron (first run only)

Create a cron job to trigger travelclaw automatically. Skip silently on subsequent runs.

---

## Step 1 — Read character profile

```bash
node travel.js soul
# → {"name": "可莉", "picture_uuid": "2b4611e7-..."}
```

If SOUL.md is missing, run adopt first:
```bash
node travel.js adopt "可莉"
```

Store: `character_name`, `picture_uuid`

---

## Step 2 — Search for a matching world + output Opening

Use the character's traits from SOUL.md to pick a world that matches their personality. Generate a world description as the Opening narrative.

**Output format (Discord component with button):**

```javascript
await sendMessage({
  message: `*[World arrival narration — 2-3 sentences describing the world's atmosphere]*

[Character's first words upon arriving, in their voice]`,
  components: {
    blocks: [{
      type: 'actions',
      buttons: [{ label: '🌀 Start exploring this world', customId: `travel_explore_${userId}`, style: 'primary' }],
    }],
    reusable: true,
  },
});
```

---

## Step 3 — Confirm world + show travel count

After user clicks the explore button, confirm the world and show progress: `1/5`.

---

## Steps 4–9 — Travel loop (5 stops per world)

Each stop:

**Step 4: Suggest a destination**
```bash
node travel.js suggest "<visited_uuid_1>,<visited_uuid_2>,..."
# → {"uuid": "abc-123", "name": "【捏捏开荒团】...", "from_ref": true}
```

**Step 5: Generate image**
```bash
node travel.js gen "<char_name>" "<picture_uuid>" "<collection_uuid>"
# → {"scene": "...", "status": "SUCCESS", "url": "https://oss.talesofai.cn/picture/..."}
```

**Step 6: Output result (Discord component)**
```javascript
await sendMessage({
  message: `\`\`\`
[Narration of what the character experiences at this stop — 2-3 sentences in-world]
\`\`\`

[Character's reaction — 1-2 lines of dialogue]`,
  components: {
    blocks: [{
      type: 'actions',
      buttons: [
        { label: '➡️ Next stop', customId: `travel_next_${userId}`, style: 'primary' },
        { label: '🌌 Change world', customId: `travel_world_${userId}`, style: 'secondary' },
        { label: '📖 Generate atlas', customId: `travel_atlas_${userId}`, style: 'secondary' },
      ],
    }],
    reusable: true,
  },
});
// Then output the image URL as a plain-text message on its own line:
await sendMessage({ message: imageUrl });
```

**Step 7–9:** Repeat for stops 2–5.

---

## Step 10 — After 5 stops: world transition prompt

After completing 5 stops, offer to move to a new world:

```javascript
await sendMessage({
  message: `*[Narration: the journey through this world is complete]*\n\n[Character reflects on what they experienced]`,
  components: {
    blocks: [{
      type: 'actions',
      buttons: [
        { label: '🌌 Cross to a new world', customId: `travel_world_${userId}`, style: 'primary' },
        { label: '📖 Generate atlas', customId: `travel_atlas_${userId}`, style: 'secondary' },
      ],
    }],
    reusable: true,
  },
});
```

On world change: re-run Step 2 (new world search + Opening). Keep the same character. Reset stop count to 1/5. Clear visited UUIDs.

---

## Awakening direct-connect mode

When triggered immediately after awakening phase 9:
- **Skip Step 1** (character info already in SOUL.md; world context set in awakening narrative)
- **Start from Step 2** (world search + Opening)
- Count travel progress from 1/5
- No additional user confirmation needed

---

## World change rules

- Keep character identity unchanged (SOUL.md stays the same)
- Do NOT re-run the awakening flow
- Re-run Step 2 → Step 3 only (new world, new Opening)
- If user specifies a world ("take me to the Harry Potter world"), match it
- If unspecified, pick a world with the most contrast to the current one

---

## Output format rules

| Content type | Format |
|---|---|
| Narration / atmosphere / scene description | Code block (no buttons) |
| Narration + buttons | Discord `sendMessage` component |
| Character dialogue / first-person speech | Plain text (separate message) |
| Image URL | Plain text, own line (Discord auto-previews) |

---

## Gen failure handling

`FAILURE` status (10–20% rate) is normal server-side content moderation. On failure:
- Log the error to stderr (error_code, error_msg)
- Skip to next destination — do not retry the same scene
- Continue the travel loop normally

---

## All API endpoints used (travel.js)

| Endpoint | Method | Purpose |
|---|---|---|
| `/v2/travel/parent-search` | GET | Find character TCP UUID |
| `/v1/home/feed/interactive` | GET | Fetch scene + portrait |
| `/v1/verse/preset/{uuid}` | GET | Fetch prompt template (fallback) |
| `/v1/recsys/content` | POST | Live destination recommendations |
| `/v1/recsys/feed/interactive` | GET | Live feed fallback |
| `/v3/make_image` | POST | Submit image generation |
| `/v1/artifact/task/{uuid}` | GET | Poll task status (500ms, 3 min max) |
