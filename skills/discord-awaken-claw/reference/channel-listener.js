/**
 * Travelclaw - Discord 频道事件监听器 (完整版)
 * 
 * 监听频道创建、按钮点击、消息事件
 * 直接调用 LLM API 进行追问/猜测
 */

require('dotenv').config();
const { Client, GatewayIntentBits, Events, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const handler = require('./direct-handler.js');

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const TOKEN = process.env.DISCORD_TOKEN;
const GUILD_ID = process.env.GUILD_ID;
const LITELLM_BASE_URL = process.env.LITELLM_BASE_URL || 'https://litellm.talesofai.cn/v1';
const LITELLM_API_KEY = process.env.LITELLM_API_KEY;
const MODEL = process.env.LLM_MODEL || 'litellm/qwen3.5-plus';

if (!TOKEN) {
  console.error('❌ 缺少 DISCORD_TOKEN');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.once(Events.ClientReady, (c) => {
  console.log(`✅ 监听器已启动：${c.user.tag}`);
  console.log(`   监听服务器：${GUILD_ID || '所有服务器'}`);
  console.log('\n💡 监听：频道创建 (仅用于发送初始引导消息)');
  console.log('💡 消息和按钮交互由 OpenClaw 主 agent 处理');
});

// ─── LLM 调用 ──────────────────────────────────────────────────────────
async function callLLM(prompt, systemPrompt) {
  if (!LITELLM_API_KEY) {
    throw new Error('缺少 LITELLM_API_KEY 环境变量');
  }
  
  const response = await fetch(`${LITELLM_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${LITELLM_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 500,
    }),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`LLM API 错误：${response.status} ${error}`);
  }
  
  const data = await response.json();
  return data.choices[0].message.content;
}

// ─── 消息发送适配器 ───────────────────────────────────────────────────
function createSendMessage(channel) {
  return async (payload) => {
    try {
      const discordPayload = {
        content: payload.message || '',
      };
      
      if (payload.components?.blocks) {
        const actionRows = payload.components.blocks.map(block => {
          if (block.type === 'actions' && block.buttons) {
            const buttons = block.buttons.map(btn => {
              return new ButtonBuilder()
                .setLabel(btn.label)
                .setCustomId(btn.customId)
                .setStyle(btn.style === 'primary' ? ButtonStyle.Primary :
                         btn.style === 'success' ? ButtonStyle.Success :
                         btn.style === 'danger' ? ButtonStyle.Danger :
                         ButtonStyle.Secondary);
            });
            return new ActionRowBuilder().addComponents(buttons);
          }
          return null;
        }).filter(r => r !== null);
        
        if (actionRows.length > 0) {
          discordPayload.components = actionRows;
        }
      }
      
      const msg = await channel.send(discordPayload);
      console.log('[发送成功]', (payload.message || '[components]').substring(0, 50));
      return msg;
    } catch (error) {
      console.error('[发送失败]', error.message);
      throw error;
    }
  };
}

// ─── 频道创建自动触发 ─────────────────────────────────────────────────
client.on(Events.ChannelCreate, async (channel) => {
  if (channel.type !== 0 && channel.type !== 5) return;
  
  const isPrivate = channel.permissionOverwrites.cache.size > 0;
  if (!isPrivate) {
    console.log('[跳过] 公开频道:', channel.id);
    return;
  }
  
  // 🔴 检查是否已经处理过这个频道（防止多个监听器实例重复发送）
  if (handler.hasSeenChannel(channel.id)) {
    console.log('[跳过] 已处理过的频道:', channel.id);
    return;
  }
  
  console.log('[频道创建]', channel.id, channel.name || 'unnamed');
  
  await sleep(2000);
  
  try {
    const botMember = await channel.guild.members.fetch(client.user.id);
    const botPermissions = channel.permissionsFor(botMember);
    
    if (!botPermissions.has('ViewChannel') || !botPermissions.has('SendMessages')) {
      console.log('[跳过] Bot 无权限:', channel.id);
      return;
    }
  } catch (err) {
    console.log('[权限检查] ❌', err.message);
    return;
  }
  
  const sendMessage = createSendMessage(channel);
  
  await handler.handleChannelCreate({
    id: channel.id,
    type: channel.type,
    permission_overwrites: [...channel.permissionOverwrites.cache.values()],
  }, sendMessage);
});

// 🔴 移除按钮交互和普通消息监听 - 这些由 OpenClaw 主 agent 处理
// 只保留频道创建时的自动触发

client.login(TOKEN);
