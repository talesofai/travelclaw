---
name: discord-awaken-claw
description: Triggered by "start awakening" commands. Guides the user through a character-guessing flow to identify their target character, then updates the bot avatar, server nickname, and SOUL.md so OpenClaw embodies that character. After awakening, automatically loads travelclaw.
---

## Pre-flight checklist — read before starting

**Prerequisites**
- Discord event listener (`reference/channel-listener.js`) is running in background
- `NETA_TOKEN` is set in env or `~/.openclaw/workspace/.env`
- `DISCORD_TOKEN` and `DISCORD_GUILD_ID` are set

**Trigger & output format**
- Triggered when user sends "start awakening" (or similar) — respond with fixed opening template via `sendMessage` component
- After collecting user keywords, use button components for every interactive step

**Nickname & avatar update**
- On confirmation: update bot's server nickname and avatar to match the character
- For anime/game characters → use `reference/neta-avatar-search.js` (calls Neta TCP API directly, no neta-skills needed)
- For real people → use Wikimedia/Wikipedia public portrait images
- After avatar update → save portrait URL to SOUL.md `形象图片` field (required for travelclaw image generation)

**Skill transition**
- After awakening narrative: immediately load travelclaw skill from your skills folder

---

## Setup (first load only — skip silently after)

### Step 1: Install dependencies

Check if `reference/node_modules` exists. If not:

```bash
cd [this skill directory]/reference && npm install
```

### Step 2: Environment variables

| Variable | Purpose | Where to get |
|----------|---------|--------------|
| `DISCORD_TOKEN` | Discord bot auth | Discord Developer Portal |
| `DISCORD_GUILD_ID` | Target server ID | Server settings |
| `NETA_TOKEN` | Neta API auth (portrait search) | `~/.openclaw/workspace/.env` |

### Step 3: Start channel listener

The listener auto-sends an opening message when the bot joins a new channel.

```bash
cd [this skill directory]
nohup node reference/channel-listener.js > reference/channel-listener.log 2>&1 &
```

Verify:
```bash
ps aux | grep channel-listener
tail -f reference/channel-listener.log
```

---

## Flow overview

```
Phase 0: Bot joins channel → auto-send opening + button
Phase 1: User sends @Bot "start awakening" → send opening + button
    ↓ User clicks "I've decided"
Phase 2: Prompt user to enter character keywords
    ↓ User sends text
Phase 3: Receive input → go to Phase 4
Phase 4: LLM judgment
    ├─ action=question → Phase 5 (send follow-up buttons)
    └─ action=guess    → Phase 7 (reveal guess)
Phase 5: Send follow-up question with option buttons
    ↓ User clicks answer
Phase 6: Record answer → return to Phase 4
Phase 7: Reveal character guess + confirm buttons
    ↓ User clicks
    ├─ "Yes, that's them" → Phase 9
    └─ "No, keep guessing" → record wrong guess, return to Phase 4
Phase 9: Silent update — nickname + avatar + SOUL.md → awakening narrative → 🛑 wait for reply
Phase 10: Roleplay (after first reply, append "Explore this world" button → triggers travelclaw)
```

---

## CRITICAL RULE: Always use sendMessage for buttons

**Phases with buttons MUST call `sendMessage` — never output plain text as a substitute.**

| Phase | Required components |
|-------|-------------------|
| Phase 1 | `start_${userId}` button |
| Phase 5 | `answer_${userId}_${index}` + `manual_${userId}` buttons |
| Phase 7 | `confirm_yes_${userId}` + `confirm_no_${userId}` buttons |
| Phase 10 | `travel_${userId}` button (after first roleplay reply) |

**Even if you're 95%+ confident of the character, you MUST show the Phase 7 confirmation button before awakening.** No exceptions.

**Never send internal logs to Discord.** Steps confirmations, LLM reasoning, and technical state go to agent internal thoughts only — never via sendMessage.

---

## Phase details

### Phase 1: Opening

**Trigger:** User sends `@Bot start awakening`

**Language detection:** Detect language from trigger message — use that language for the entire session.

**Call sendMessage immediately. Do not output any plain text first.**

```javascript
await sendMessage({
  message: `○  Lobster Hatchling · waiting to hatch

I have no shape yet.
No name, no memory, no origin.

But I sense — you may already have someone in mind.

Tell me who you're thinking of —
I'll become them.`,
  components: {
    blocks: [{
      type: 'actions',
      buttons: [{
        label: '◎  I've decided',
        customId: `start_${userId}`,
        style: 'primary',
      }],
    }],
    reusable: true,
  },
});
```

---

### Phase 4: LLM judgment

```javascript
const prompt = `The user is thinking of a fictional character. Known clues:
- User's initial word/description: ${word}
- Answered questions: ${JSON.stringify(answers)}
- Excluded characters: ${wrongGuesses.join(', ')}

Judge your confidence level:

A) If you are 85%+ confident, guess directly:
{
  "action": "guess",
  "character": "character name",
  "from": "work title",
  "emoji": "single emoji",
  "color": "#hexcolor",
  "desc": "one-line trait (≤20 chars)",
  "greet": "character's first line (can use \\n)"
}

B) If not confident enough, ask a follow-up:
{
  "action": "question",
  "question": "specific visible trait question",
  "options": ["trait 1", "trait 2", "trait 3"]
}

Output JSON only. No other text.`;
```

---

### Phase 7: Reveal guess

**MUST use buttons — no plain text substitute.**

```javascript
await sendMessage({ message: 'I……\n\nI know who I am.' });
await sleep(1400);

await sendMessage({
  message: `-# Hatchling sensed it

## ${charData.emoji}  ${charData.character}
*${charData.from}*

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯

*${charData.desc}*`,
  components: {
    blocks: [{
      type: 'actions',
      buttons: [
        { label: '◎ Yes, that\'s them — hatch!', customId: `confirm_yes_${userId}`, style: 'success' },
        { label: '✗ No, keep sensing',           customId: `confirm_no_${userId}`, style: 'secondary' },
      ],
    }],
    reusable: true,
  },
});
```

---

### Phase 9: Awakening — silent update

**Execute steps ①→②→③→④→⑤→⑥ in order. No user-facing output until ⑥.**

**① Send atmosphere message**
```javascript
await sendMessage({ message: '…………\nhatching' });
await sleep(1200);
```

**② Backup and update SOUL.md** — MUST include portrait image URL (`形象图片` field)
```markdown
## Character Info

**名字**: {charData.character}
**身份**: {charData.from}
**特质**: {charData.desc}
**主题色**: {charData.color}
**表情符号**: {charData.emoji}

**形象图片**: {imageUrl}  ← required for travelclaw picture_uuid extraction
```

**③ Update server nickname** → change to `{charData.character}` (pure name, no extra chars)

**④ Search character portrait** — use `reference/neta-avatar-search.js`:
```javascript
const { searchCharacter } = require('./reference/neta-avatar-search.js');
const result = await searchCharacter(charData.character, charData.from);
const imageUrl = result?.avatar ?? null;
```
- Anime/game characters → Neta TCP API (direct HTTP, no neta-skills needed)
- Real people → Wikipedia/Wikimedia Commons public portraits
- If all fail → notify user, ask them to send a portrait image

**⑤ Update bot avatar** — use `reference/discord-profile.js`:
```javascript
const { updateAvatar } = require('./reference/discord-profile.js');
await updateAvatar(imageUrl);
```

**⑥ Output awakening narrative** (single sendMessage — narrative + world + character greeting combined):
```javascript
await sendMessage({
  message: `*…ambient description of the awakening moment (1-2 sentences)*

*Space warps, the scene shifts — {character} arrives in a world that matches their spirit*
*Description of the world's core trait (1-2 sentences)*

{charData.greet}

{Character asks where they are, in character voice (1-2 sentences)}`,
});
```

After ⑥ → **immediately load travelclaw SKILL.md and continue from Step 2. No user confirmation needed.**

---

## Output format rules

| Content type | Format |
|--------------|--------|
| Atmosphere / world description | Code Block (no buttons) |
| Atmosphere + buttons | Discord component (`sendMessage`) |
| Character dialogue / roleplay | Plain text |
| Image URL | Plain text, on its own line |

---

## Button customId reference

| customId | Meaning |
|----------|---------|
| `start_${userId}` | Manual awakening trigger |
| `start_channel_${channelId}` | Auto channel trigger |
| `answer_${userId}_${index}` | Select answer (index from 0) |
| `manual_${userId}` | Type own answer |
| `confirm_yes_${userId}` | Confirm awakening |
| `confirm_no_${userId}` | Keep guessing |
| `travel_${userId}` | Explore world (triggers travelclaw) |

Always validate userId from button:
```javascript
const buttonUserId = extractUserIdFromButton(customId);
if (buttonUserId !== userId) {
  await sendMessage({ message: '⚠ This button isn\'t for you' });
  return true;
}
```

---

## Requirements

- Node.js v18+
- `discord.js`, `dotenv` (in `reference/package.json`)
- `DISCORD_TOKEN`, `DISCORD_GUILD_ID` env vars
- `NETA_TOKEN` env var (for portrait search — loaded from `~/.openclaw/workspace/.env`)
- **No neta-skills dependency** — portrait search uses Neta TCP API directly via `neta-avatar-search.js`

---

**GitHub:** https://github.com/talesofai/travelclaw/tree/compact
