/**
 * Awakening Skill - Direct Handler for OpenClaw Main Agent
 * 
 * 这个模块设计为由 OpenClaw 主 agent 直接导入和调用
 * 使用主 agent 的 LLM 和 message 工具
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
    console.error('[State] 加载失败:', err.message);
  }
  return {};
}

function saveState(state) {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
  } catch (err) {
    console.error('[State] 保存失败:', err.message);
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
const VESSEL_SYS = `你是一个"龙虾宝宝"，正在等待破壳成为用户心中的角色。用户心中想着一个著名虚构角色（动漫、影视、游戏、文学等），你通过追问逐步识别它。
所有输出必须是严格的 JSON，不包含任何其他文字。`;

function buildNextStepPrompt(word, answers, wrongGuesses) {
  const ctx = answers.length
    ? '\n之前的问答：\n' + answers.map(a => `  问：${a.q}  →  答：${a.a}`).join('\n')
    : '';
  const excl = wrongGuesses.length
    ? `\n已排除的角色（绝对不要再猜这些）：${wrongGuesses.join('、')}`
    : '';

  return `用户心中想着一个虚构角色。已知线索：
- 用户给出的词/描述：${word}${ctx}${excl}

请判断你的确信程度，然后选择：

A) 如果你有 85% 以上的把握，甚至已经获得了角色/人物名称，直接猜测，输出：
{
  "action": "guess",
  "character": "角色中文名全名",
  "from": "《作品名》",
  "emoji": "单个 emoji",
  "color": "#十六进制主题色",
  "desc": "一句话特质（≤20 字）",
  "greet": "角色第一句话（可用\\n换行）"
}

B) 如果还不够确定，生成一个追问，输出：
{
  "action": "question",
  "question": "追问（1 句，直接问具体可见的特征）",
  "options": ["具体特征 1（≤15 字）", "具体特征 2（≤15 字）", "具体特征 3（≤15 字）"]
}

选项要求：具体可验证，有明显区分度。
只输出 JSON，不要其他文字。`;
}

function buildCharRespondPrompt(charData, chatHistory) {
  return `你现在完全是${charData.character}，来自${charData.from}。
用该角色真实的口吻、性格、语言习惯回应用户。
回复简洁（1-3 句），完全保持角色个性，不要打破第四面墙，不要提到自己是 AI。

对话历史：
${chatHistory.map(h => `${h.role}: ${h.content}`).join('\n')}

请直接以${charData.character}的身份回复。`;
}

// ─── JSON Parser ──────────────────────────────────────────────────────
function parseJSON(raw) {
  const text = raw.trim();
  try { return JSON.parse(text); } catch {}
  const block = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (block) try { return JSON.parse(block[1].trim()); } catch {}
  const s = text.indexOf('{'), e = text.lastIndexOf('}');
  if (s !== -1 && e !== -1) try { return JSON.parse(text.slice(s, e + 1)); } catch {}
  throw new Error('无法解析 LLM 返回的 JSON');
}

// ─── Soul.md Management ───────────────────────────────────────────────
function backupOriginalSoul() {
  if (!fs.existsSync(SOUL_FILE)) return;
  if (fs.existsSync(ORIGINAL_SOUL_FILE)) return;

  const content = fs.readFileSync(SOUL_FILE, 'utf8');
  fs.writeFileSync(ORIGINAL_SOUL_FILE, content, 'utf8');
  console.log('[Soul] 已备份原始 soul.md');
}

function backupCurrentSoul() {
  if (!fs.existsSync(SOUL_FILE)) return;
  const content = fs.readFileSync(SOUL_FILE, 'utf8');
  fs.writeFileSync(SOUL_BACKUP_FILE, content, 'utf8');
  console.log('[Soul] 已备份当前 soul.md → SOUL.pre-awakening.md');
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

_我现已觉醒为 ${charData.character}。_
`;
  
  fs.writeFileSync(SOUL_FILE, content, 'utf8');
  console.log(`[Soul] 已更新为 ${charData.character}`);
}

function resetSoulMD() {
  if (!fs.existsSync(ORIGINAL_SOUL_FILE)) {
    console.log('[Soul] 没有备份，无法重置');
    return;
  }
  
  const content = fs.readFileSync(ORIGINAL_SOUL_FILE, 'utf8');
  fs.writeFileSync(SOUL_FILE, content, 'utf8');
  fs.unlinkSync(ORIGINAL_SOUL_FILE);
  console.log('[Soul] 已重置为原始状态');
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
async function handleChannelCreate(event, sendMessage) {
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

  // Send awakening intro with a channel-scoped customId (no userId yet)
  await sendMessage({
    message: `○  龙虾宝宝 · 等待破壳中

我……还没有形状。
没有名字，没有记忆，没有来处。

但我知道——你心里或许已经有一个人选。

请告诉我，你心中所想的那个角色——
我会变成 Ta 的模样。`,
    components: {
      blocks: [{
        type: 'actions',
        buttons: [{
          label: '◎  我已想好',
          customId: `start_channel_${channelId}`,
          style: 'primary',
        }],
      }],
      reusable: true,
    },
  });
}

// ─── Main Handler ─────────────────────────────────────────────────────
function isAwakeningCommand(content) {
  if (!content) return false;
  const normalized = content.trim().toLowerCase();
  if (normalized === '/awakening' || normalized === '/awaken') return true;
  const keywords = ['开始觉醒', '觉醒', '龙虾宝宝', '虾宝'];
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
    message: `○  龙虾宝宝 · 等待破壳中

我……还没有形状。
没有名字，没有记忆，没有来处。

但我知道——你心里或许已经有一个人选。

请告诉我，你心中所想的那个角色——
我会变成 Ta 的模样。`,
    components: {
      blocks: [{
        type: 'actions',
        buttons: [{
          label: '◎  我已想好',
          customId: `start_${userId}`,
          style: 'primary',
        }],
      }],
      reusable: true,
    },
  });
}

async function promptInitialWord(channelId, sendMessage) {
  await sendMessage({
    message: `你心中所想的那个角色——

当你想到它，**第一个浮现的词**是什么？

直接发送消息就好`,
  });
}

async function handleInitialWord(userId, word, sendMessage, callLLM) {
  const game = getGame(userId);
  if (!game) return;
  
  game.word = word;
  game.started = true;
  setGame(userId, game);
  
  await sendMessage({ message: `「${word}」` });
  await processNextStep(userId, sendMessage, callLLM);
}

async function processNextStep(userId, sendMessage, callLLM) {
  const game = getGame(userId);
  if (!game) return;
  
  try {
    const prompt = buildNextStepPrompt(game.word, game.answers, game.wrongGuesses);
    const result = typeof callLLM === 'function' ? await callLLM(prompt, VESSEL_SYS) : await callLLM;
    const parsed = parseJSON(result);
    
    if (parsed.action === 'guess') {
      await sendMessage({ message: '越来越近了……\n\n我几乎能感受到那个名字了——' });
      await sleep(1000);
      await showReveal(userId, parsed, sendMessage);
    } else {
      const msg = game.answers.length === 0
        ? '我感受到了某种轮廓……\n\n让我再多了解一些。'
        : '越来越清晰了……\n\n还有一个问题。';
      
      await sendMessage({ message: msg });
      await showQuestion(userId, parsed, sendMessage);
    }
  } catch (err) {
    await sendMessage({ message: `⚠ 错误：${err.message}` });
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
        label: '✏ 自己说',
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
  await sendMessage({ message: '我……\n\n我知道自己是谁了。' });
  await sleep(900);
  await sleep(1000);
  
  await sendMessage({
    message: `-# 虾宝感知到了

## ${charData.emoji}  ${charData.character}
*${charData.from}*

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯

*${charData.desc}*`,
    components: {
      blocks: [{
        type: 'actions',
        buttons: [
          { label: '◎ 就是他/她，请破壳', customId: `confirm_yes_${userId}`, style: 'success' },
          { label: '✗ 不对，继续感知', customId: `confirm_no_${userId}`, style: 'secondary' },
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
    console.error('[Awakening] 更新个人资料失败:', err.message);
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
    const reply = await callLLM(prompt, `你是${c.character}，请用该角色的口吻回复。`, 300);
    game.chatHistory.push({ role: 'assistant', content: reply });
    setGame(userId, game);
    
    await sendMessage({ message: reply });
    return true;
  } catch (err) {
    console.error('[Chat] 错误:', err.message);
    return false;
  }
}

async function handleButtonInteraction(userId, channelId, guildId, customId, sendMessage, callLLM) {
  const game = getGame(userId);
  
  if (!game) {
    await sendMessage({ message: '⚠ 游戏状态不存在，请使用 `/awakening` 重新开始。' });
    return;
  }
  
  const parts = customId.split('_');
  const action = parts[0];
  
  switch (action) {
    case 'start':
      game.started = true;
      game.waitingFor = 'word';
      setGame(userId, game);
      await promptInitialWord(channelId, sendMessage);
      break;
      
    case 'answer': {
      const answerIdx = parseInt(parts[parts.length - 1], 10);
      const answer = game.currentOptions?.[answerIdx];
      if (!answer) { await sendMessage({ message: '⚠ 无效的答案选项。' }); return; }
      
      game.answers.push({ q: game.currentQuestion, a: answer });
      game.currentQuestion = null;
      game.currentOptions = [];
      setGame(userId, game);
      
      await sendMessage({ message: `「${answer}」` });
      await processNextStep(userId, sendMessage, callLLM);
      break;
    }
    
    case 'manual':
      game.waitingFor = 'manual';
      setGame(userId, game);
      await sendMessage({ message: '好的，请用你自己的话描述一下这个角色的特征。' });
      break;
    
    case 'confirm_yes':
      if (!game.charData) { await sendMessage({ message: '⚠ 角色数据不存在。' }); return; }
      await awaken(userId, channelId, guildId, sendMessage);
      break;
    
    case 'confirm_no':
      if (!game.charData) { await sendMessage({ message: '⚠ 角色数据不存在。' }); return; }
      game.wrongGuesses.push(game.charData.character);
      game.charData = null;
      game.currentQuestion = null;
      game.currentOptions = [];
      setGame(userId, game);
      await sendMessage({ message: '明白了，让我继续感知……' });
      await processNextStep(userId, sendMessage, callLLM);
      break;
    
    default:
      console.log('[Awakening] 未知按钮动作:', action);
  }
}

async function handleDiscordMessage(context, callLLM) {
  const { userId, channelId, guildId, content, customId, sendMessage, interactionType = 'message' } = context;
  
  try {
    if (interactionType === 'button' && customId) {
      if (!isButtonInteraction(customId)) return false;

      // Auto-triggered channel join button — first real user to click claims the game
      if (customId.startsWith('start_channel_')) {
        await startAwakening(userId, channelId, guildId, sendMessage);
        return true;
      }

      const buttonUserId = extractUserIdFromButton(customId);
      if (buttonUserId !== userId) {
        await sendMessage({ message: '⚠ 这个按钮不属于你，请使用 `/awakening` 开始自己的觉醒。' });
        return true;
      }
      
      await handleButtonInteraction(userId, channelId, guildId, customId, sendMessage, callLLM);
      return true;
    }
    
    if (interactionType === 'message') {
      const game = getGame(userId);
      
      if (isAwakeningCommand(content)) {
        if (game) {
          const state = loadState();
          delete state[userId];
          saveState(state);
        }
        await startAwakening(userId, channelId, guildId, sendMessage);
        return true;
      }
      
      if (game?.awakened) {
        const handled = await handleAwakenedChat(userId, channelId, guildId, content, sendMessage, callLLM);
        return handled;
      }
      
      if (game?.waitingFor === 'word') {
        const word = content.trim().slice(0, 20);
        game.waitingFor = null;
        await handleInitialWord(userId, word, sendMessage, callLLM);
        return true;
      }
      
      if (game?.waitingFor === 'manual') {
        const manualAnswer = content.trim().slice(0, 200);
        const savedQ = game.currentQuestion || '补充描述';
        game.answers.push({ q: savedQ, a: manualAnswer });
        game.waitingFor = null;
        setGame(userId, game);
        
        await sendMessage({ message: `「${manualAnswer}」` });
        await processNextStep(userId, sendMessage, callLLM);
        return true;
      }
    }
    
    return false;
  } catch (err) {
    console.error('[Awakening] 处理消息失败:', err.message);
    await sendMessage({ message: `⚠ 错误：${err.message}` });
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
};
