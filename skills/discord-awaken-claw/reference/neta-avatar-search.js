/**
 * Neta API 角色头像搜索 - 增强版
 * 
 * 使用 Neta API 搜索角色并获取官方头像
 * 支持灵活关键词策略和图片 URL 验证
 */

const { exec } = require('child_process');
const https = require('https');

/**
 * 验证图片 URL 是否可访问
 * @param {string} url - 图片 URL
 * @returns {Promise<boolean>}
 */
async function isValidImageUrl(url) {
  return new Promise((resolve) => {
    if (!url) {
      resolve(false);
      return;
    }
    
    const req = https.get(url, { timeout: 5000 }, res => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        // 重定向，跟随
        isValidImageUrl(res.headers.location).then(resolve);
        return;
      }
      resolve(res.statusCode === 200);
    });
    
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

/**
 * 执行 Neta 搜索命令
 * @param {string} keywords - 搜索关键词
 * @returns {Promise<Array>}
 */
function runNetaSearch(keywords) {
  return new Promise((resolve, reject) => {
    const command = `cd /opt/openclaw/skills/neta && pnpm start search_character_or_elementum --keywords "${keywords}" --parent_type "character" --sort_scheme "exact" 2>/dev/null`;
    
    exec(command, { encoding: 'utf8', timeout: 10000 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`Neta API 执行失败：${error.message}`));
        return;
      }
      
      try {
        // 提取 JSON 部分（pnpm 可能输出额外日志）
        const jsonMatch = stdout.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          console.log(`[Neta] 未找到 JSON 输出，stdout: ${stdout.substring(0, 200)}`);
          resolve([]);
          return;
        }
        
        const result = JSON.parse(jsonMatch[0]);
        resolve(result.list || []);
      } catch (e) {
        console.log(`[Neta] JSON 解析失败：${e.message}`);
        console.log(`[Neta] stdout: ${stdout.substring(0, 500)}`);
        resolve([]);
      }
    });
  });
}

/**
 * 获取角色详情（通过 UUID）
 * @param {string} uuid - 角色 UUID
 * @returns {Promise<Object|null>}
 */
function getCharacterDetails(uuid) {
  return new Promise((resolve, reject) => {
    const command = `cd /opt/openclaw/skills/neta && pnpm start request_character_or_elementum --uuid "${uuid}"`;
    
    exec(command, { encoding: 'utf8', timeout: 10000 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`Neta API 详情获取失败：${error.message}`));
        return;
      }
      
      try {
        const result = JSON.parse(stdout);
        resolve(result);
      } catch (e) {
        resolve(null);
      }
    });
  });
}

/**
 * 生成灵活的关键词列表
 * @param {string} characterName - 角色名称
 * @param {string} from - 作品名称
 * @returns {string[]}
 */
function generateKeywordsList(characterName, from) {
  const keywordsList = [];
  
  // 策略 1: 原始名称
  keywordsList.push(characterName);
  
  // 策略 2: 去除分隔符（如"阿不思·邓布利多" → "阿不思邓布利多"）
  const noSeparator = characterName.replace(/[·\s\-]/g, '');
  if (noSeparator !== characterName) {
    keywordsList.push(noSeparator);
  }
  
  // 策略 3: 只取名字的最后部分（如"阿不思·邓布利多" → "邓布利多"）
  const lastName = characterName.split('·').pop();
  if (lastName && lastName !== characterName) {
    keywordsList.push(lastName);
  }
  
  // 策略 4: 只取名字的第一部分
  const firstName = characterName.split('·')[0];
  if (firstName && firstName !== characterName) {
    keywordsList.push(firstName);
  }
  
  // 策略 5: 作品名
  const cleanFrom = from.replace(/[《》]/g, '');
  if (cleanFrom) {
    keywordsList.push(cleanFrom);
  }
  
  // 策略 6: 角色 + 作品组合
  keywordsList.push(`${characterName} ${cleanFrom}`);
  
  // 策略 7: 英文名（如果有）
  if (characterName.includes('·')) {
    // 可能是中文名，尝试只用姓氏
    keywordsList.push(lastName + ' ' + cleanFrom);
  }
  
  // 去重
  return [...new Set(keywordsList.filter(k => k && k.trim()))];
}

/**
 * 搜索角色 - 增强版
 * 
 * 使用多种关键词策略，直到找到有效的头像
 * 
 * @param {string} characterName - 角色名称
 * @param {string} from - 作品名称
 * @returns {Promise<{name: string, avatar: string, source: string}|null>}
 */
async function searchCharacter(characterName, from) {
  const keywordsList = generateKeywordsList(characterName, from);
  
  console.log(`[Neta] 开始搜索：${characterName} (${from})`);
  console.log(`[Neta] 关键词策略：${keywordsList.join(' | ')}`);
  
  // 逐个尝试关键词
  for (const keywords of keywordsList) {
    try {
      console.log(`[Neta] 尝试关键词："${keywords}"`);
      const results = await runNetaSearch(keywords);
      
      if (results && results.length > 0) {
        const character = results[0];
        const avatarUrl = character.avatar_img || character.avatar || character.image || character.header_img;
        
        if (avatarUrl) {
          // 验证 URL 是否有效
          const isValid = await isValidImageUrl(avatarUrl);
          if (isValid) {
            console.log(`[Neta] ✅ 找到有效头像：${character.name || characterName}`);
            console.log(`[Neta] 🖼️ URL: ${avatarUrl}`);
            return {
              name: character.name || characterName,
              avatar: avatarUrl,
              source: 'Neta API',
              keywords: keywords,
            };
          } else {
            console.log(`[Neta] ⚠️ URL 无效，继续尝试：${avatarUrl}`);
          }
        }
        
        // 如果有 UUID，尝试获取详情（可能包含更多图片）
        if (character.uuid) {
          try {
            const details = await getCharacterDetails(character.uuid);
            if (details) {
              const detailAvatar = details.avatar_img || details.avatar || details.image;
              if (detailAvatar) {
                const isValid = await isValidImageUrl(detailAvatar);
                if (isValid) {
                  console.log(`[Neta] ✅ 从详情找到有效头像：${character.name || characterName}`);
                  console.log(`[Neta] 🖼️ URL: ${detailAvatar}`);
                  return {
                    name: details.name || character.name || characterName,
                    avatar: detailAvatar,
                    source: 'Neta API (details)',
                    keywords: keywords,
                  };
                }
              }
            }
          } catch (e) {
            console.log(`[Neta] 获取详情失败：${e.message}`);
          }
        }
      }
    } catch (err) {
      console.log(`[Neta] 搜索失败 (${keywords}): ${err.message}`);
    }
  }
  
  console.log(`[Neta] ❌ 所有关键词策略都未找到有效头像`);
  return null;
}

module.exports = {
  searchCharacter,
  isValidImageUrl,
  generateKeywordsList,
};
