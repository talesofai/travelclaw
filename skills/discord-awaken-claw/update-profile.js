/**
 * 更新 Discord Bot 个人资料（昵称 + 头像）
 * 由 OpenClaw 主 agent 直接调用
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const TOKEN = process.env.DISCORD_BOT_TOKEN || process.env.DISCORD_TOKEN;
const GUILD_ID = process.env.GUILD_ID || '1480912787814350868';

const CHARACTER_NAME = '行秋';
const AVATAR_URL = 'https://oss.talesofai.cn/fe_assets/mng/21/2e8f1f3d06bc8ef4550e7222d1ef9795.png';

const ASSETS_DIR = path.join(__dirname, 'assets');
if (!fs.existsSync(ASSETS_DIR)) {
  fs.mkdirSync(ASSETS_DIR, { recursive: true });
}

function callDiscordAPI(endpoint, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'discord.com',
      path: `/api/v10${endpoint}`,
      method,
      headers: {
        'Authorization': `Bot ${TOKEN}`,
        'Content-Type': 'application/json',
      },
    };

    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (res.statusCode >= 400) {
            reject(new Error(json.message || `Discord API Error ${res.statusCode}`));
          } else {
            resolve(json);
          }
        } catch (e) {
          if (res.statusCode >= 400) {
            reject(new Error(`Discord API Error ${res.statusCode}: ${data}`));
          } else {
            resolve(data);
          }
        }
      });
    });

    req.on('error', reject);
    
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

function downloadImage(url, filename) {
  return new Promise((resolve, reject) => {
    const filepath = path.join(ASSETS_DIR, filename);
    
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; OpenClaw Bot/1.0)',
      },
    }, res => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        downloadImage(res.headers.location, filename).then(resolve).catch(reject);
        return;
      }
      
      if (res.statusCode !== 200) {
        fs.unlink(filepath, () => {});
        reject(new Error(`图片下载失败：HTTP ${res.statusCode}`));
        return;
      }
      
      const file = fs.createWriteStream(filepath);
      res.pipe(file);
      
      file.on('finish', () => {
        file.close();
        resolve(filepath);
      });
    }).on('error', err => {
      fs.unlink(filepath, () => {});
      reject(err);
    });
  });
}

async function updateNickname(guildId, newNickname) {
  console.log(`[Discord] 正在更新昵称为：${newNickname}`);
  
  await callDiscordAPI(
    `/guilds/${guildId}/members/@me`,
    'PATCH',
    { nick: newNickname }
  );
  
  console.log(`[Discord] ✅ 昵称已更新为：${newNickname}`);
  return true;
}

async function updateAvatar(imageUrl) {
  console.log(`[Discord] 正在下载头像：${imageUrl}`);
  
  const filename = `avatar_${Date.now()}.png`;
  const filepath = await downloadImage(imageUrl, filename);
  
  console.log(`[Discord] 头像已下载到：${filepath}`);
  
  const imageBuffer = fs.readFileSync(filepath);
  const base64Data = imageBuffer.toString('base64');
  const avatarData = `data:image/png;base64,${base64Data}`;
  
  console.log(`[Discord] 正在更新头像...`);
  
  await callDiscordAPI('/users/@me', 'PATCH', {
    avatar: avatarData,
  });
  
  fs.unlinkSync(filepath);
  
  console.log(`[Discord] ✅ 头像已更新`);
  return true;
}

async function main() {
  try {
    console.log('=== 开始更新 Discord Bot 个人资料 ===\n');
    
    // 步骤 1：更新昵称
    await updateNickname(GUILD_ID, CHARACTER_NAME);
    console.log();
    
    // 步骤 2：更新头像
    await updateAvatar(AVATAR_URL);
    console.log();
    
    console.log('=== 个人资料更新完成 ===');
  } catch (err) {
    console.error('❌ 更新失败:', err.message);
    process.exit(1);
  }
}

main();
