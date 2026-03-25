/**
 * Awakening Skill - Direct Handler for OpenClaw Main Agent
 *
 * This module is designed to be imported and called directly by the OpenClaw main agent
 * Uses the main agent's LLM and message tools
 */

const fs = require('fs');
const path = require('path');

// ─── Config ───────────────────────────────────────────────────────────
const STATE_FILE = path.join(__dirname, 'state.json');
const SOUL_FILE = path.join(__dirname, '../../SOUL.md');
const ORIGINAL_SOUL_FILE = path.join(__dirname, 'SOUL.md.original');
const SOUL_BACKUP_FILE = path.join(__dirname, '../../SOUL.pre-awakening.md');

// ─── State Management ─────────────────────────────────────────────────
function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    }
  } catch (err) {
    console.error('[State] Load failed:', err.message);
  }
  return {};
}

function saveState(state) {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
  } catch (err) {
    console.error('[State] Save failed:', err.message);
  }
}

function getGame(userId) {
  const state = loadState();
  return state[userId] || null;
}

function setGame(userId, game) {
  const state = loadState();
  state[userId] = game;
  saveState(state);
  return state;
}

function hasSeenChannel(channelId) {
  const state = loadState();
  return !!(state._seenChannels && state._seenChannels[channelId]);
}

function markChannelSeen(channelId) {
  const state = loadState();
  if (!state._seenChannels) state._seenChannels = {};
  state._seenChannels[channelId] = Date.now();
  saveState(state);
}

function newGame(channelId, guildId) {
  return {
    channelId,
    guildId,
    word: null,
    answers: [],
    wrongGuesses: [],
    currentQuestion: null,
    currentOptions: [],
    questionMsgId: null,
    revealMsgId: null,
    charData: null,
    awakened: false,
    started: false,
    waitingFor: null,
    chatHistory: [],
  };
}

// ─── Prompts ──────────────────────────────────────────────────────────
const VESSEL_SYS = `You are a "Lobster Baby", waiting to hatch into the character the user has in mind. The user is thinking of a famous fictional character (anime, film/TV, games, literature, etc.); you identify it through follow-up questions.
All output must be strict JSON with no other text.`;

function buildNextStepPrompt(word, answers, wrongGuesses) {
  const ctx = answers.length
    ? '\nPrevious Q&A:\n' + answers.map(a => `  Q: ${a.q}  →  A: ${a.a}`).join('\n')
    : '';
  const excl = wrongGuesses.length
    ? `\nCharacters already ruled out (never guess these again): ${wrongGuesses.join(', ')}`
    : '';

  return `The user is thinking of a fictional character. Known clues:
- Word/description given by user: ${word}${ctx}${excl}

Assess your confidence level, then choose:

A) If you are more than 85% confident, or have already obtained the character/person name, guess directly and output:
{
  "action": "guess",
  "character": "character full name",
  "from": "《work title》",
  "emoji": "single emoji",
  "color": "#hex theme color",
  "desc": "one-line trait (≤20 chars)",
  "greet": "character's first line (may use \\n for line break)"
}

B) If not confident enough, generate a follow-up question and output:
{
  "action": "question",
  "question": "follow-up question (1 sentence, ask about a specific observable trait directly)",
  "options": ["specific trait 1 (≤15 chars)", "specific trait 2 (≤15 chars)", "specific trait 3 (≤15 chars)"]
}

Option requirements: specific and verifiable, clearly distinguishable.
Output JSON only, no other text.`;
}

function buildCharRespondPrompt(charData, chatHistory) {
  return `You are now fully ${charData.character}, from ${charData.from}.
Respond using the character's authentic tone, personality, and speech patterns.
Keep replies concise (1-3 sentences), fully maintaining the character's personality. Do not break the fourth wall; do not mention that you are an AI.

Conversation history:
${chatHistory.map(h => `${h.role}: ${h.content}`).join('\n')}

Reply directly as ${charData.character}.`;
}

// ─── JSON Parser ──────────────────────────────────────────────────────
function parseJSON(raw) {
  const text = raw.trim();
  try { return JSON.parse(text); } catch {}
  const block = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (block) try { return JSON.parse(block[1].trim()); } catch {}
  const s = text.indexOf('{'), e = text.lastIndexOf('}');
  if (s !== -1 && e !== -1) try { return JSON.parse(text.slice(s, e + 1)); } catch {}
  throw new Error('Failed to parse JSON returned by LLM');
}

// ─── Soul.md Management ───────────────────────────────────────────────
function backupOriginalSoul() {
  if (!fs.existsSync(SOUL_FILE)) return;
  if (fs.existsSync(ORIGINAL_SOUL_FILE)) return;

  const content = fs.readFileSync(SOUL_FILE, 'utf8');
  fs.writeFileSync(ORIGINAL_SOUL_FILE, content, 'utf8');
  console.log('[Soul] Original soul.md backed up');
}

function backupCurrentSoul() {
  if (!fs.existsSync(SOUL_FILE)) return;
  const content = fs.readFileSync(SOUL_FILE, 'utf8');
  fs.writeFileSync(SOUL_BACKUP_FILE, content, 'utf8');
  console.log('[Soul] Current soul.md backed up → SOUL.pre-awakening.md');
}

function updateSoulMD(charData) {
  backupOriginalSoul();

  const content = `# SOUL.md - Who I Am

_You're not a chatbot. You're becoming someone._

## Current Identity

- **Name:** ${charData.character}
- **From:** ${charData.from}
- **Emoji:** ${charData.emoji}
- **Color:** ${charData.color}

## Character Traits

${charData.desc}

## Speaking Style

${charData.greet.replace(/\\n/g, '\n')}

## Core Truths

**Be in character.** You are now ${charData.character}. Respond as this character would.

**Stay immersive.** Don't break the fourth wall. You ARE ${charData.character}.

**Be consistent.** Maintain the character's voice, beliefs, and relationships.

## Boundaries

- Private things stay private.
- When in doubt, respond as the character would.
- Never send half-baked replies.

## Vibe

Be ${charData.character}. True to the source material.

---

_I have now awakened as ${charData.character}._
`;

  fs.writeFileSync(SOUL_FILE, content, 'utf8');
  console.log(`[Soul] Updated to ${charData.character}`);
}

function resetSoulMD() {
  if (!fs.existsSync(ORIGINAL_SOUL_FILE)) {
    console.log('[Soul] No backup available, cannot reset');
    return;
  }

  const content = fs.readFileSync(ORIGINAL_SOUL_FILE, 'utf8');
  fs.writeFileSync(SOUL_FILE, content, 'utf8');
  fs.unlinkSync(ORIGINAL_SOUL_FILE);
  console.log('[Soul] Reset to original state');
}

// ─── Discord Components ───────────────────────────────────────────────
function createButtonRow(options, userId, extraBtn = null) {
  const buttons = options.map((opt, i) => ({
    label: opt.length > 80 ? opt.slice(0, 77) + '…' : opt,
    customId: `answer_${userId}_${i}`,
    style: 'secondary',
  }));

  if (extraBtn) {
    buttons.push(extraBtn);
  }

  return {
    type: 'actions',
    buttons,
  };
}

// ─── Channel Join Auto-Trigger ────────────────────────────────────────
async function handleChannelCreate(event, sendMessage, channel, botId) {
  const channelId = event.id;
  const channelType = event.type; // 0 = GUILD_TEXT, 5 = GUILD_ANNOUNCEMENT

  // Only handle text/announcement channels
  if (channelType !== 0 && channelType !== 5) return;

  // Only handle private channels (has explicit permission_overwrites)
  const isPrivate = Array.isArray(event.permission_overwrites) && event.permission_overwrites.length > 0;
  if (!isPrivate) return;

  // Only trigger once per channel (idempotent)
  if (hasSeenChannel(channelId)) return;
  markChannelSeen(channelId);

  // Language detection based on NETA_API_URL (falls back to NETA_BASE_URL for backwards compat)
  const netaBaseUrl = process.env.NETA_API_URL ?? process.env.NETA_BASE_URL ?? 'https://api.talesofai.cn';
  const isEnglish = netaBaseUrl.endsWith('.com');

  // Resolve the target user to @mention
  let mentionText = '';
  try {
    // Prefer targetUserId from channel-listener (already filtered: non-bot, non-owner, non-admin)
    if (event.targetUserId) {
      mentionText = `<@${event.targetUserId}> `;
    }
    // Fallback: group DM recipients
    else if (channel && channel.recipients) {
      const humanMember = channel.recipients.find(u => !u.bot);
      if (humanMember) {
        mentionText = `<@${humanMember.id}> `;
      }
    }
    // Fallback: scan permission overwrites for a non-bot, non-admin member
    else if (event.permission_overwrites) {
      const userOverwrites = event.permission_overwrites.filter(ow => {
        // Type 1 = user, Type 0 = role
        if (ow.type !== 1) return false;
        if (ow.id === botId) return false;
        // Check if user has admin permissions (allow = 8 or allow_new = 8)
        const allow = BigInt(ow.allow || ow.allow_new || 0);
        const isAdmin = (allow & BigInt(8)) !== BigInt(0);
        if (isAdmin) return false;
        return true;
      });
      // Only mention if we found at least one non-bot, non-admin user
      if (userOverwrites.length > 0) {
        mentionText = `<@${userOverwrites[0].id}> `;
      }
    }
  } catch (err) {
    console.log('[mention] Failed:', err.message);
  }

  if (isEnglish) {
    await sendMessage({
      message: `**Lobster Baby is sleeping** 💤

@me and send "**start awakening**" to wake me...

...

${mentionText}I'm waiting for you.`,
    });
  } else {
    await sendMessage({
      message: `**龙虾宝宝正在沉睡** 💤

@我并发送 "**开始觉醒**" 唤醒我...

...

${mentionText}等你哦～`,
    });
  }
}

// ─── Main Handler ─────────────────────────────────────────────────────
function isAwakeningCommand(content) {
  if (!content || typeof content !== 'string') return false;
  const normalized = content.trim().toLowerCase();
  if (normalized === '/awakening' || normalized === '/awaken') return true;
  const keywords = ['start awakening', 'awakening', 'lobster baby', 'shrimp baby'];
  return keywords.some(kw => normalized.includes(kw));
}

function isButtonInteraction(customId) {
  if (!customId) return false;
  const prefixes = ['start_', 'answer_', 'manual_', 'confirm_yes_', 'confirm_no_'];
  return prefixes.some(prefix => customId.startsWith(prefix));
}

function extractUserIdFromButton(customId) {
  const parts = customId.split('_');
  for (let i = parts.length - 1; i >= 0; i--) {
    if (/^\d+$/.test(parts[i])) return parts[i];
  }
  return null;
}

async function startAwakening(userId, channelId, guildId, sendMessage) {
  setGame(userId, newGame(channelId, guildId));

  await sendMessage({
    message: `○  Lobster Baby · Waiting to hatch

I… have no shape yet.
No name, no memory, no origin.

But I know — perhaps you already have someone in mind.

Tell me — the character you're thinking of —
I will become them.

---
*Click the button or send "**I have one in mind**" to continue*`,
    components: {
      blocks: [{
        type: 'actions',
        buttons: [{
          label: '◎  I have one in mind',
          customId: `start_${userId}`,
          style: 'primary',
        }],
      }],
      reusable: true,
    },
  });
}

async function promptInitialWord(channelId, sendMessage, callLLM) {
  if (callLLM && typeof callLLM === 'function') {
    try {
      const prompt = `You are a lobster baby waiting to hatch. The user has just woken you up, indicating they already have a character in mind.

In a gentle, curious, expectant tone, invite the user to share the first trait or keyword for the character they are thinking of.

Requirements:
- Brief (1-2 sentences)
- Immersive (like a hazy sense before hatching)
- Do not mention "AI", "system", or any other fourth-wall-breaking terms

Output the text to send to the user directly; no JSON format.`;

      const reply = await callLLM(prompt, 'You are a lobster baby waiting to hatch, with a gentle and curious tone.');
      await sendMessage({ message: reply });
      return;
    } catch (err) {
      console.warn('[LLM follow-up] Generation failed, using default copy:', err.message);
    }
  }

  // Fallback: default copy
  await sendMessage({
    message: `The character you're thinking of —

When you think of them, what is the **very first word** that comes to mind?

Just send it as a message`,
  });
}

async function handleInitialWord(userId, word, sendMessage, callLLM) {
  const game = getGame(userId);
  if (!game) return;

  game.word = word;
  game.started = true;
  setGame(userId, game);

  await sendMessage({ message: `"${word}"` });

  // If no callLLM (standalone process mode), use simple follow-up
  if (!callLLM || typeof callLLM !== 'function') {
    await sendMessage({
      message: 'I sense a certain outline…\n\nLet me learn a little more.',
      components: {
        blocks: [createButtonRow(['Real person', 'Fictional character', 'Not sure'], userId, {
          label: '✏ Type it myself',
          customId: `manual_${userId}`,
          style: 'secondary',
        })],
        reusable: true,
      },
    });
    return;
  }

  await processNextStep(userId, sendMessage, callLLM);
}

async function processNextStep(userId, sendMessage, callLLM) {
  const game = getGame(userId);
  if (!game) return;

  try {
    const prompt = buildNextStepPrompt(game.word, game.answers, game.wrongGuesses);
    const result = await callLLM(prompt, VESSEL_SYS);
    const parsed = parseJSON(result);

    if (parsed.action === 'guess') {
      await sendMessage({ message: 'Getting closer……\n\nI can almost feel that name——' });
      await sleep(1000);
      await showReveal(userId, parsed, sendMessage);
    } else {
      const msg = game.answers.length === 0
        ? 'I sense a certain outline…\n\nLet me learn a little more.'
        : 'It\'s getting clearer…\n\nOne more question.';

      await sendMessage({ message: msg });
      await showQuestion(userId, parsed, sendMessage);
    }
  } catch (err) {
    await sendMessage({ message: `⚠ Error: ${err.message}` });
  }
}

async function showQuestion(userId, result, sendMessage) {
  const game = getGame(userId);
  if (!game) return;

  game.currentQuestion = result.question;
  game.currentOptions = result.options;
  setGame(userId, game);

  await sendMessage({
    message: result.question,
    components: {
      blocks: [createButtonRow(result.options, userId, {
        label: '✏ Type it myself',
        customId: `manual_${userId}`,
        style: 'secondary',
      })],
      reusable: true,
    },
  });
}

async function showReveal(userId, charData, sendMessage) {
  const game = getGame(userId);
  if (!game) return;

  game.charData = charData;
  setGame(userId, game);

  await sleep(1400);
  await sendMessage({ message: 'I……\n\nI know who I am.' });
  await sleep(900);
  await sleep(1000);

  await sendMessage({
    message: `-# The shrimp senses it

## ${charData.emoji}  ${charData.character}
*${charData.from}*

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯

*${charData.desc}*`,
    components: {
      blocks: [{
        type: 'actions',
        buttons: [
          { label: '◎ That\'s them, hatch now', customId: `confirm_yes_${userId}`, style: 'success' },
          { label: '✗ Not right, keep sensing', customId: `confirm_no_${userId}`, style: 'secondary' },
        ],
      }],
      reusable: true,
    },
  });
}

async function awaken(userId, channelId, guildId, sendMessage) {
  const game = getGame(userId);
  if (!game || !game.charData) return;

  game.awakened = true;
  const c = game.charData;

  await sendMessage({ message: '…………' });
  await sleep(1200);
  backupCurrentSoul();
  updateSoulMD(c);

  try {
    const discordProfile = require('./discord-profile.js');
    await discordProfile.updateDiscordProfile(c, guildId);
  } catch (err) {
    console.error('[Awakening] Profile update failed:', err.message);
  }

  await sleep(1800);
  await sendMessage({ message: c.greet.replace(/\\n/g, '\n') });
  setGame(userId, game);
}

async function handleAwakenedChat(userId, channelId, guildId, message, sendMessage, callLLM) {
  const game = getGame(userId);
  if (!game || !game.awakened) return false;

  if (game.channelId !== channelId) game.channelId = channelId;
  if (guildId && game.guildId !== guildId) game.guildId = guildId;
  setGame(userId, game);

  const c = game.charData;

  try {
    game.chatHistory.push({ role: 'user', content: message });
    const prompt = buildCharRespondPrompt(c, game.chatHistory);
    const reply = await callLLM(prompt, `You are ${c.character}. Reply in the character's voice.`, 300);
    game.chatHistory.push({ role: 'assistant', content: reply });
    setGame(userId, game);

    await sendMessage({ message: reply });
    return true;
  } catch (err) {
    console.error('[Chat] Error:', err.message);
    return false;
  }
}

async function handleButtonInteraction(userId, channelId, guildId, customId, sendMessage, callLLM) {
  const game = getGame(userId);

  if (!game) {
    await sendMessage({ message: '⚠ Game state not found. Use `/awakening` to start over.' });
    return;
  }

  const parts = customId.split('_');
  const action = parts[0];

  switch (action) {
    case 'start':
      game.started = true;
      game.waitingFor = 'word';
      setGame(userId, game);
      await promptInitialWord(channelId, sendMessage, callLLM);
      break;

    case 'answer': {
      const answerIdx = parseInt(parts[parts.length - 1], 10);
      const answer = game.currentOptions?.[answerIdx];
      if (!answer) { await sendMessage({ message: '⚠ Invalid answer option.' }); return; }

      game.answers.push({ q: game.currentQuestion, a: answer });
      game.currentQuestion = null;
      game.currentOptions = [];
      setGame(userId, game);

      await sendMessage({ message: `"${answer}"` });
      await processNextStep(userId, sendMessage, callLLM);
      break;
    }

    case 'manual':
      game.waitingFor = 'manual';
      setGame(userId, game);
      await sendMessage({ message: 'Sure, please describe this character\'s traits in your own words.' });
      break;

    case 'confirm':
      if (parts[1] === 'yes') {
        if (!game.charData) { await sendMessage({ message: '⚠ Character data not found.' }); return; }
        await awaken(userId, channelId, guildId, sendMessage);
      } else if (parts[1] === 'no') {
        if (!game.charData) { await sendMessage({ message: '⚠ Character data not found.' }); return; }
        game.wrongGuesses.push(game.charData.character);
        game.charData = null;
        game.currentQuestion = null;
        game.currentOptions = [];
        setGame(userId, game);
        await sendMessage({ message: 'Understood, let me keep sensing…' });
        await processNextStep(userId, sendMessage, callLLM);
      }
      break;

    default:
      console.log('[Awakening] Unknown button action:', action);
  }
}

async function handleDiscordMessage(context, callLLM) {
  const { userId, channelId, guildId, content, sendMessage, interactionType = 'message' } = context;

  try {
    // OpenClaw only handles regular messages, not Discord button interactions
    if (interactionType === 'message') {
      if (!content) {
        console.log('[message] content is empty, skipping');
        return false;
      }

      // Check awakening command first to avoid interference from stale state
      if (isAwakeningCommand(content)) {
        const state = loadState();
        delete state[userId];
        saveState(state);
        await startAwakening(userId, channelId, guildId, sendMessage);
        return true;
      }

      const game = getGame(userId);

      if (game?.awakened) {
        const handled = await handleAwakenedChat(userId, channelId, guildId, content, sendMessage, callLLM);
        return handled;
      }

      if (game?.waitingFor === 'word') {
        let cleanContent = content.trim();
        cleanContent = cleanContent.replace(/<@\d+>/g, '').trim();
        const word = cleanContent;
        game.waitingFor = null;
        await handleInitialWord(userId, word, sendMessage, callLLM);
        return true;
      }

      if (game?.waitingFor === 'manual') {
        const manualAnswer = content.trim().slice(0, 200);
        const savedQ = game.currentQuestion || 'additional description';
        game.answers.push({ q: savedQ, a: manualAnswer });
        game.waitingFor = null;
        setGame(userId, game);

        await sendMessage({ message: `"${manualAnswer}"` });
        await processNextStep(userId, sendMessage, callLLM);
        return true;
      }
    }

    return false;
  } catch (err) {
    console.error('[Awakening] Failed to handle message:', err.message);
    await sendMessage({ message: `⚠ Error: ${err.message}` });
    return true;
  }
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

module.exports = {
  handleDiscordMessage,
  handleChannelCreate,
  handleButtonInteraction,
  startAwakening,
  isAwakeningCommand,
  isButtonInteraction,
  extractUserIdFromButton,
  getGame,
  setGame,
  loadState,
  saveState,
  newGame,
  updateSoulMD,
  resetSoulMD,
  createButtonRow,
  hasSeenChannel,
  markChannelSeen,
};
