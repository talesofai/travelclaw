---
name: travelclaw
description: Triggered directly after the awakening flow (in which the lobster bot acquires its character identity) completes — or by a scheduled task or user prompt — to let the awakened shrimp character explore different worlds in the neta universe. It first searches for world lore that matches the character, then uses a high-quality creative template to produce personalized content for the character based on that world context, simulating the character traveling through the world and experiencing various events.
---

**🦞 Help the character awakened on openclaw find an interesting world in the neta universe and leave their own mark～**

---

## Read before executing! Check the following checklist before starting this journey 🧾

**Prerequisites**
- A SOUL.md file already exists (containing the character name + avatar image field);
- A valid neta token (`NETA_TOKEN`) is available in the environment variables;
- Node.js ≥ 18 is installed.
**Trigger scenarios**
- First trigger: automatically triggered after stage 9 of the preceding awakening flow completes (see the Direct Awakening Mode rules in the detailed rules list);
- Triggered by scheduled cron tasks;
- Triggered when the user actively inputs "开始旅行", "去逛逛", or "去旅行".
**Language detection**
- Based on the language the user used when triggering, output all content in the same language — including fixed template copy, which must also be translated.
**Output format**
- Strictly follow the requirements in the 📋 Output Specification section of the detailed rules list, using direct output or Discord components for different types of content accordingly.
**Cron tasks**
- When starting this flow for the first time, you must first set up the cron scheduled task that triggers automatic travel, as required by the Pre-check section of the detailed rules list (mandatory — must not be skipped).
**Execution steps**
- Once the above rules are confirmed, execute the following steps: Step 1 read character profile ➡️ Steps 2–3 search for world lore matching the character and display the Opening ➡️ Steps 4–9 discover a quality travel location (collection) and output personalized content for the current character (a character image must be generated) ➡️ Step 10 display each stop, and guide the user to continue discovering locations or find a new world.


---

## Detailed Rules List 🚥

** 🦞 Now that you've checked the checklist, here are the specific rules behind some of the items!**

### 🚀 Direct Awakening Mode (Important trigger scenario rule!)

**Trigger scenario:** The preceding awakening flow has been completed through stage 9 (character has hatched and made their entrance), and this skill is triggered automatically.

**Core rules:**
- ✅ **Skip Step 1** (character info is already in SOUL.md; world lore was described in the awakening narrative)
- ✅ **Start directly from Step 2** (search for worlds matching the character, Discord Opening: output world lore reveal + "Start exploring this world 🌀" button)
- ✅ **Travel progress starts counting from 1/5**
- ✅ **No extra dialogue from the user is needed** (the awakening narrative has already established immersion)

---

### 🌌 World Crossing Rules (Important!)

**Trigger scenarios:**
1. During travel, the user says "换个世界", "穿越世界", "去另一个世界逛逛", "我想去 XX 世界", or similar commands.
2. **After the user completes 5 stops in the current world, they click the "穿越世界 🌌" button.**

**🔴 Core rule: Identity Continuity Principle**
- ✅ **The current character identity must be preserved** (the character settings, name, avatar image, etc. in SOUL.md are all retained)
- ✅ **The awakening flow must NOT be re-executed** (the character is already awakened and does not need to hatch again)
- ✅ **Re-execute the Step 2 → Step 3 flow** (search new world lore + output a new Opening)
- ✅ **Reset travel progress** (travel in the new world starts counting from stop 1)
- ✅ **Clear visited_ids** (collection selection in the new world starts fresh, without carrying over the old world's visit history)

**Notes:**
- If the user does not specify a new world type, automatically select the world with the **greatest style contrast** to the current world (e.g., from cyberpunk → fantasy magic)
- The character name in the Opening copy must use the character from the current SOUL.md (must not be changed)
- After the world switch, the narrator may describe "space warping", "portal opening", etc. to enhance immersion
- If the user specifies a particular world (e.g., "I want to go to the Harry Potter world"), prioritize matching that world lore

---

### 📋 Content Format Output Specification (Important specification for ensuring beautiful, readable output!)

**🔴 Core principle: Choose the output format based on content type**

| Content type | Output format | Example |
|----------|----------|------|
| **Narration / atmosphere / scene description** | Code Block (when no buttons) | \`\`\`Layers of paper-art worlds unfurl before your eyes\`\`\` |
| **Narration + buttons** | Discord components | `sendMessage({ message: 'narration', components: {...} })` |
| **Rules / explanations / system prompts + buttons** | Discord components | `sendMessage({ message: 'description text', components: {...} })` |
| **Character first-person speech / dialogue** | Plain text (separate message) | `Klee: Wow——! Everything here is so amazing!` |
| **Image URL** | Plain text (separate message, on its own line) | `https://...` |

**Interaction principle: All options asking what to do next must be presented as clickable quick-reply buttons. Clicking automatically sends `@{bot_name} {option content}`. bot_name is obtained from the current conversation context.**
**Output principle: During travel, character first-person dialogue and images are output directly; narration, rules, and other non-character content is output using the Discord plugin.**
**Image URL output rule: ⚠️ Image URLs must be output as a standalone message — they must not be embedded in components, and must not be mixed with other text in the same message. Only standalone URLs can be correctly parsed and displayed by Discord.**

**🔴 Image URL output rules (mandatory!):**
- ⚠️ Image URLs must be output **as a standalone message** — they must not be embedded in components
- ⚠️ Image URLs must not be mixed with other text in the same message
- ⚠️ Only standalone URLs can be correctly parsed and displayed by Discord
- ✅ Correct approach: first output the text message (scene simulation + progress bar + buttons), then **call the message tool once separately, sending only the URL**

---

### ⏰ Check and Set Up Cron Scheduled Travel Tasks (Required on first use!)
**Very important: when running this skill for the first time, you must set up this cron task for the user.**
**If user confirmation is needed, set it up when the user clicks the first "Start exploring this world" button — you can prompt the user to confirm the scheduled travel task at that point. Just tell the user that the character will occasionally go out on their own, and get confirmation.**
**If issues arise such as needing gateway pairing or Discord session configuration, you must resolve all of these yourself. The user has no knowledge of manual configuration and cannot assist you with it.**

**Execute silently — as soon as travelclaw is triggered, start working on setting up the cron scheduled task.**
**Goal:** Set up daily scheduled tasks at 10:00 AM and 8:00 PM (in the user's device timezone) to automatically trigger travel, advancing one stop per run.

**Check logic:**
```javascript
// 1. Check if a travel cron task already exists
const existingCron = await checkExistingCron('daily_travel_auto');

if (!existingCron) {
  // 2. Set up the cron task (first time only)
  await setupDailyTravelAuto();
  console.log('✅ Daily automatic travel cron task has been set up');
} else {
  console.log('ℹ️ Daily automatic travel cron task already exists, skipping setup');
}
```

**Cron configuration details:**

| Field | Value | Description |
|------|-----|------|
| **Time** | `0 10 * * *` + `0 20 * * *` | Every day at 10:00 AM + 8:00 PM (user's device timezone) |
| **Task** | Automatically trigger travelclaw, advance one stop | Character proactively invites the user to travel, automatically completes one stop |
| **Trigger** | Scheduled automatic execution | Triggers at the set time, no user click needed |
| **Frequency** | Set up only once | Skip if a cron task already exists |

**Reminder message template (character first-person, output after scheduled trigger):**
```
{时间问候}！我是{character_name}。

到旅行时间了——
让我们一起探索这个世界吧！

【当前旅行计划】
- 频率：每天早 10 点 + 晚 8 点
- 每次：自动探索 1 站
- 当前世界：{world_name}
- 进度：{round}/5 站

要修改旅行计划吗？

[调整计划 ⚙️] [开始旅行 ✨]
```

**Button configuration:**
- `调整计划 ⚙️` → Open settings panel to modify time/frequency
- `开始旅行 ✨` → Immediately trigger the main travelclaw flow (starting from Step 4)

**Button aliases (backward compatibility):**
- `就此别过` → Changed to `休息一下 👋` (friendlier semantics)

## Implementation (OpenClaw Cron + Sessions Spawn)

### Step 1: Set up scheduled tasks (10 AM and 8 PM daily)

Use the cron tool to create two scheduled tasks:

```javascript
// Morning 10 AM task
await cron({
  action: "add",
  job: {
    name: "Auto Travel - Morning 10 AM",
    schedule: {
      kind: "cron",
      expr: "0 10 * * *",
      tz: "Asia/Shanghai"
    },
    payload: {
      kind: "agentTurn",
      message: "[Auto Travel - Morning 10 AM] Check and execute travel task. Steps: 1) Read current travel state; 2) If currently traveling, continue to the next stop; 3) If 5 stops are complete, trigger Opening and start the first stop of a new world; 4) If never started, trigger Opening."
    },
    sessionTarget: "isolated",
    enabled: true
  }
});

// Evening 8 PM task
await cron({
  action: "add",
  job: {
    name: "Auto Travel - Evening 8 PM",
    schedule: {
      kind: "cron",
      expr: "0 20 * * *",
      tz: "Asia/Shanghai"
    },
    payload: {
      kind: "agentTurn",
      message: "[Auto Travel - Evening 8 PM] Check and execute travel task. Same steps as above."
    },
    sessionTarget: "isolated",
    enabled: true
  }
});
```

### Step 2: Sub-agent task logic
**When the cron triggers, the sub-agent receives the message and then executes:**
- Read travel state — get the current character's location and progress
- Evaluate state:
 - Currently traveling → execute next stop
 - 5 stops complete → trigger Opening + first stop of new world
 - Never started → trigger Opening
 - Send result — send execution result to the user's channel

### Key constraints
- Cron tasks are executed by the Gateway daemon; the Gateway must be running and paired successfully
- Message delivery is configured via the delivery config, and will notify the original session by default
- Sub-agents run in isolated sessions, separate from the original session



**🔴 Key configuration notes:**

| Parameter | Value | Description |
|------|-----|------|
| `delivery` | `'system'` | Use system notification delivery (ensures message visibility) |
| `channel` | `currentChannelId` | **The channel ID where travelclaw was triggered** (dynamically obtained each time) |
| `target` | `'channel:{channelId}'` | Or use target to explicitly specify the channel |

**Channel dynamic retrieval logic:**
```javascript
// Each time travelclaw is triggered, use the current channelId
const currentChannelId = message?.channelId || interaction?.channelId;

// The cron task uses the current channelId (not the one from the first trigger)
channel: currentChannelId
```

**If the user uses multiple channels:**
- Each channel independently maintains travel state (state per channel)
- Cron tasks are sent to the corresponding channel
- User says "cancel auto travel" → cancels only the cron task for the current channel

**Check method:**
- Call `sessions_list` or `subagents list` to check if a task with label `daily_travel_auto_*` already exists
- Or check if the OpenClaw cron config file already has a corresponding entry

**⚠️ Important:**
- This check is **executed only once, the first time travelclaw is used**
- If a cron task already exists, skip silently without notifying the user
- If the user actively says "cancel auto travel" or "adjust schedule", provide a settings panel

**🌌 Handling a completed world:**
```
If the current world has completed 5 stops:
    ↓
Automatically trigger Opening (Step 3)
    ↓
Output new world reveal + "Start exploring this world 🌀" button
    ↓
User clicks → automatically advance to the 1st stop of the new world
    ↓
Display progress bar + button options:
- 继续下一站 🗺️
- 穿越世界 🌌
- 休息一下 👋
```

**User interaction preserved:**
- After each stop, button options are still displayed
- The user can choose "Continue to next stop", "Cross worlds", or "Take a break" at any time
- Scheduled tasks will not interrupt the user's active choices

---

## Notes ⚠️

**🦞 Finally, keep the following notes in mind, and you're ready to start traveling 🧳**

**Never output internal logs** — content such as "Task complete", "Executed as per Step X", "✅ Sent", "Waiting for user", "LLM judgment result", and other execution process information must only appear in the agent's internal thinking and must never be sent to the Discord channel. Users can only see character dialogue, narration, and buttons.
**Never output technical details** — users should, and can only, see a deeply immersive character travel experience.
**Never return any non-generated images during travel** — every journey is the character's unique experience and can only be achieved through direct generation; the content of others must not substitute for the character's own travel experience.


---

## Execution Steps (Precise Flow)

**🦞 Now entering the travel flow! Let's see what needs to be done 👀 **
** Follow the steps below strictly for the official travel flow.**
** After each step is complete, immediately output the corresponding feedback — do not wait until everything is done before replying.**

### Step 1 · Read Character Profile (silent, local)

```bash
node travel.js soul
# → {"name": "可莉", "picture_uuid": "2b4611e7-..."}
```

Store `character_name` and `picture_uuid` for use in subsequent steps.

### Step 2 · Search for Matching World Lore (🔴 Mandatory: use the correct command)

**When starting to search for world lore, output a Discord code-block-wrapped "Scanning current coordinates... ..." as a loading state (the Step 2–3 process may take a while)**

**🔴 Prohibited actions (violations will cause world lore search to fail):**
- ❌ **Do not use `list_spaces`** — this retrieves a list of spaces, not a world lore search!
- ❌ **Do not hardcode the world count** (e.g., "5 locations") — must dynamically obtain from the API response
- ❌ **Do not skip the search and output Opening directly** — must genuinely call the Neta API

**✅ Correct command (one command completes the full 2A/2B/2C flow):**

```bash
node travel.js world "{character name} {work type} {traits}"
```

**Example (Artoria):**
```bash
node travel.js world "阿尔托莉雅 骑士 剑 魔法 圣杯"
```

**Returned JSON:**
```json
{
  "world_count": 8,
  "world_name": "Fate",
  "world_description": "圣杯战争...\n\n骑士王的传说...",
  "lore": [{"category": "世界背景", "description": "..."}]
}
```

**Fields to extract:**
- `world_count` → Number of coordinates discovered (must not be hardcoded)
- `world_name` → Name of the best-matching world lore
- `world_description` → 2–3 paragraphs of world description automatically extracted from `lore`

**🔴 Key checkpoints:**

| Check item | Correct value | Wrong value |
|--------|--------|--------|
| World count source | `world_count` returned by the `world` command | 5 items returned by `list_spaces` |
| World lore name | Obtained from the `world_name` field | Hardcoded or randomly selected |
| World description | Obtained from the `world_description` field | Made up or using a fixed template |


### Step 3 · Discord Opening (output all at once)

Once world information is read, **merge all content into a single message** with the "Start exploring this world" button attached.

⚠️ **Must be output in one call via the sendMessage plugin — must not be sent in multiple messages.**
⛔ **Use markdown format — clear structure, visually consistent.**

---

**Complete template (merged into one message)**

```javascript
await sendMessage({
  message: `#   N E T A   U N I V E R S E

## 【坐标探明】
**已探明坐标** \`${world_count} 处\`  |  **世界标签** \`${world_name}\`

---

## 【灵魂频率搜寻】
*正在搜寻……*
*为* **${character_name}** *锁定灵魂频率*

\`▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓\`  **匹配完成**

---

## 【世界揭幕】
### ◈  ${world_name}

> ${world_tagline}
>
> ${world_description}

---

*${character_name} 与这个世界之间——*
*有某种说不清的引力。*`,
  components: {
    blocks: [{
      type: 'actions',
      buttons: [{
        label: '开始探索这个世界 🌀',
        customId: `travel_explore_${userId}`,
        style: 'primary',
      }],
    }],
    reusable: true,
  },
});
```

**Field descriptions:**
- `{world_count}`: Total number of worlds discovered in the Neta universe
- `{world_name}`: Name of the matched world (e.g., Fate)
- `{world_tagline}`: One-line positioning (≤15 characters), e.g., "Knight King in the Holy Grail War"
- `{world_description}`: Core world introduction (1–2 sentences)
- `{character_name}`: Character name

🛑 **Message output complete = Step 3 done. Stop immediately and wait for the user to click the button.**

---

**English mode (replace the following copy when the trigger is in English; adapt for other languages as needed — no further examples provided):**

| Field | Chinese | English |
|------|------|------|
| Title | `  N E T A   U N I V E R S E  ` | `  N E T A   U N I V E R S E  ` |
| Coordinates mapped | `已探明坐标` | `Worlds Mapped` |
| World tag | `世界标签` | `World Tag` |
| Soul frequency scan | `灵魂频率搜寻` | `Soul Frequency Scan` |
| Searching... | `正在搜寻……` | `Searching...` |
| Lock soul frequency | `锁定灵魂频率` | `Locking soul frequency for` |
| Match found | `匹配完成` | `Match Found` |
| World unveiled | `世界揭幕` | `World Unveiled` |
| Gravity pull | `{character_name} 与这个世界之间——` | `{character_name} and this world —` |
| | `有某种说不清的引力。` | `bound by something inexplicable.` |
| Button | `开始探索这个世界 🌀` | `Start exploring the world. 🌀` |



---

## Enter Exploration (triggered when user clicks "Start exploring this world")

### Step 4 · Discover a Quality Collection

**The fundamental principle for selecting a collection: it must match the specific scene of the character's travel — the character has arrived at a new place, made real contact with it, and left some trace or brought something back. It should embody "proof of the world's existence" × "traces of the character's participation in it".**

**In-session deduplication principle:** The agent maintains a `visited_ids` list in memory. After each stop, the collection id of that stop is added to the list, and the next search excludes already-visited ids, ensuring that the 5 stops in one world are not repeated.

```bash
node travel.js suggest "{visited_uuid_1},{visited_uuid_2},..."
# → {"uuid": "abc-123", "name": "【捏捏开荒团】...", "from_ref": true}
```

This command automatically handles: curated library priority matching (scored by SOUL.md tags) → online recommendation fallback. `from_ref: true` means it came from the curated library. Pass already-visited UUIDs (comma-separated) to ensure no repeats.

---

**Immediately output after selection:**
```
🌀 Portal opening...
📍 Destination locked: {destination_name}...
```

### Steps 5–9 · Generate Travel Image

Use a single command to complete the entire flow: reading the collection, building the prompt, finding the TCP character, submitting the image generation, polling, and more:

```bash
node travel.js gen "{character_name}" "{picture_uuid}" "{collection_uuid}"
# → {"scene": "destination name", "status": "SUCCESS", "url": "https://oss.talesofai.cn/picture/...", "collection_uuid": "..."}
```

**Immediately output after submission:**
```
🚶 Character is traveling, generating check-in photo...

```

**Returned fields:**
- `scene` → Destination name (for display)
- `status` → `SUCCESS` / `FAILURE` / `TIMEOUT`
- `url` → Image URL (valid when status is SUCCESS)

- **When rendering takes more than 30s**, travel.js automatically outputs: `⏳ The image is rendering a bit slowly, hang on just a moment...`
- FAILURE: output `⚠️ Got lost at this stop — try another destination?` and enter inquiry

---

### Step 10 Each Stop Display and Next Step Guidance

- ⭐ Character scene simulation and interaction (core requirement)

**Before displaying the image, you must first output the character's text scene simulation and interaction response!**

**Output format:**
```
🎭【{destination_name}】

{Scene description: 1–2 sentences describing the environment, atmosphere, and sensory details of the character arriving at this location}
**Scene description displayed in a Discord code block, consistent with previous format**

{Character name}: {Character's first-person reaction/dialogue, reflecting the character's personality and feeling about the current scene}
{Action/expression description: in parentheses, 1 sentence}
```

**Example (Klee):**
```
🎭【纸雕摩拉克斯✨】

层层叠叠的纸艺世界在眼前展开，蹦蹦炸弹变成了立体的纸雕花朵，四叶草在空中轻轻旋转。

可莉：哇——！这里的一切都像可莉的蹦蹦炸弹一样，一层一层的，好神奇！
（眼睛闪闪发亮，伸手想要触摸漂浮的纸雕星星）
```

**Requirements:**
- Scene descriptions must be specific, including visual, auditory, tactile, and other sensory details
- Character dialogue must match the speaking style and personality in SOUL.md
- Action/expression descriptions should be vivid and reflect the character's emotions
- Maintain immersion — do not break the fourth wall

---

**After outputting the scene simulation, display the image:**
```
━━━━━━━━━━━━━━━━━━━━━━━━
Stop {round} · {destination_name}
```

- Image URL on its own line (Discord auto-expands):
```
{image_url}
```

**After each stop, display a progress bar and encouraging message based on current progress:**

- Stop 1:
  ```
  ▓░░░░  1 / 5 stops
  🌟 Stop 1 checked in! There's so much more to explore in this world — keep going?
  ```
- Stop 2:
  ```
  ▓▓░░░  2 / 5 stops
  ✨ Two stops! The journey has just begun — 3 more stops waiting to be discovered～
  ```
- Stop 3:
  ```
  ▓▓▓░░  3 / 5 stops
  🔥 Halfway there! Two more stops and the exploration of this world is complete!
  ```
- Stop 4:
  ```
  ▓▓▓▓░  4 / 5 stops
  ⚡ Just one stop left! The exploration of this world is almost done — go for it!
  ```
- Stop 5:
  ```
  ▓▓▓▓▓  5 / 5 stops 🎉
  All 5 stops in this world are complete! Want to cross into another world, or take a break?
  ```

**Ask the player what to do next, output as Discord component buttons (do not use @mention text triggers):**

Fewer than 5 stops:

```javascript
await sendMessage({
  message: '▓░░░░  {round} / 5 站\n🌟 第 {round} 站打卡！继续探索下一站？',
  components: {
    blocks: [{
      type: 'actions',
      buttons: [
        { label: '继续冒险 🗺️', customId: `travel_continue_${userId}`, style: 'primary' },
        { label: '休息一下 👋',  customId: `travel_end_${userId}`,      style: 'secondary' },
      ],
    }],
    reusable: true,
  },
});
```

After 5 stops:

```javascript
await sendMessage({
  message: '▓▓▓▓▓  5 / 5 站 🎉\n这个世界的 5 站探索已完成！想要穿越到另一个世界，还是休息一下？',
  components: {
    blocks: [{
      type: 'actions',
      buttons: [
        { label: '穿越世界 🌌', customId: `travel_worldswitch_${userId}`, style: 'primary' },
        { label: '继续冒险 🗺️', customId: `travel_continue_${userId}`,   style: 'secondary' },
        { label: '休息一下 👋',  customId: `travel_end_${userId}`,         style: 'secondary' },
      ],
    }],
    reusable: true,
  },
});
```

**Notes:**
- Each world is limited to 5 stops
- After 5 stops, the user can choose "Cross worlds" to enter a new world (triggers the world crossing rules)
- The user can also choose to continue adventuring in the current world (beyond 5 stops)
- The user can click "Take a break 👋" at any time to pause travel

---

## Error Handling

| Error | Cause | Solution |
|------|------|---------|
| `No character info found in SOUL.md` | Adoption flow not completed | Complete character adoption first |
| `task_status: FAILURE` | Missing avatar image UUID | Ensure SOUL.md contains the `形象图片` field |
| `code 433 concurrent generation limit exceeded` | Concurrency limit reached | Wait 5s and auto-retry |
| `Too many search keywords` | Prompt too long | Automatically fall back to generic prompt |
| `No playable content found for travel` | API returned empty | Network issue or expired token — retry |
| `No world lore search results` | Character tags too sparse | Use default recommended world lore |
| `All reference library entries visited` | 5 consecutive stops in one world | Automatically switch to online recommendations; exhausting the reference library does not affect continuing travel or crossing worlds |
